# Usage Event Pipeline

The usage event pipeline is the core data flow of Phase 3. It replaces Phase 2's in-memory usage counters with a production-grade event streaming architecture that survives restarts, scales across multiple app instances, and supports replay for billing recalculation.

---

## Why this exists

Phase 2's entitlement check engine works, but the usage _recording_ has critical flaws:

- **In-memory `Map<>`** resets on every server restart - all usage data is lost
- **No shared state** between app instances - two instances maintain separate counters that diverge
- **Race conditions** on HARD limit enforcement - two concurrent requests at `used=9` both pass the `9 < 10` check, making `used=11`
- **No replay** - if billing logic has a bug, there's no way to reprocess historical events
- **No audit trail** - usage events aren't persisted, so billing disputes have no evidence

A real billing platform cannot lose usage events. This pipeline fixes all five problems with the **transactional outbox pattern** + **Kafka event streaming** - the same architecture used by Stripe, AWS, and every serious billing system.

---

## Pipeline overview

The pipeline is an assembly line with 6 stations. An event enters at station 1 and flows through each one asynchronously.

```text
Client SDK
    │
    ▼
POST /api/v1/usage/events (API key auth)
    │
    ▼ (single Postgres transaction)
┌────────────────────────────────────┐
│  usage_events  +  outbox_events    │
└────────────────────────────────────┘
    │                    │
    │                    ▼ (every 1 second)
    │              Outbox Publisher
    │                    │
    │                    ▼
    │              Kafka: usage.raw
    │                    │
    │                    ▼
    │           Validation Consumer
    │              ╱            ╲
    │             ╱              ╲
    │            ▼                ▼
    │    usage.validated    usage.dead-letter
    │            │                │
    │            ▼                ▼
    │    Aggregation         Dead Letter
    │    Consumer             Handler
    │            │                │
    │            ▼                ▼
    │    usage_aggregates   dead_letter_events
    │            │
    ▼            ▼
  202       Check Engine
 Accepted   reads from
            aggregates
```

**The key insight:** The client gets `202 Accepted` immediately at station 2. Everything after that is async - the client doesn't wait for validation, aggregation, or any of it. The event flows through the pipeline in the background, typically completing in under 2 seconds.

---

## Station 1 - Client sends event

The tenant's backend calls the usage events API with an API key:

```http
POST /api/v1/usage/events
Authorization: Bearer mp_live_...
Content-Type: application/json

{
  "events": [
    {
      "eventId": "evt_abc123",
      "feature": "api_calls",
      "amount": 1,
      "timestamp": "2026-05-08T12:00:00Z",
      "metadata": { "endpoint": "/v1/widgets" }
    }
  ]
}
```

**Auth:** API key only (server-to-server). The API key identifies the tenant - no `x-tenant-id` header needed.

**Batch:** Always an array, 1-1000 events per request. Single events are `{ events: [oneEvent] }`. This follows the Stripe Meter Events and AWS CloudWatch PutMetricData pattern.

**`eventId`:** Client-generated idempotency key. Same `eventId` submitted twice = processed once. Critical for SDKs that retry on network failures.

**Per-event validation at ingestion:**

- Feature must exist in the tenant's active subscription
- Timestamp must be within acceptable window (not future beyond 5 min, not older than 7 days)
- Amount must be a positive integer

**Per-event mixed response:** Each event gets its own status. A batch of 100 events where 1 has a bad feature name returns 99 accepted + 1 rejected - the valid events aren't blocked.

```json
{
  "accepted": 99,
  "rejected": 1,
  "events": [
    { "eventId": "evt_abc123", "status": "accepted" },
    {
      "eventId": "evt_xyz789",
      "status": "rejected",
      "reason": "Feature \"foobar\" not found"
    }
  ]
}
```

Possible per-event statuses:

| Status      | Meaning                                                        |
| ----------- | -------------------------------------------------------------- |
| `accepted`  | New event, queued for processing                               |
| `duplicate` | `eventId` already exists, idempotent no-op (counts as success) |
| `rejected`  | Validation failed, reason provided                             |

**Implementation:** `UsageEventsController` + `UsageEventsService` in `src/modules/usage-events/`.

---

## Station 2 - Transactional outbox write

Inside `UsageEventsService.ingest()`, every accepted event creates **two rows in a single Postgres transaction**:

```typescript
await prisma.$transaction(async (tx) => {
  // Row 1: the usage event itself
  const usageEvent = await tx.usageEvent.create({
    data: { eventId, tenantId, featureLookupKey, amount, timestamp, ... }
  });

  // Row 2: the outbox entry (same transaction)
  await tx.outboxEvent.create({
    data: { topic: 'usage.raw', aggregateId: usageEvent.id, payload: { ... } }
  });
});
```

Both succeed or both fail. This is the **transactional outbox pattern** - the solution to the dual-write problem.

### The dual-write problem

Without the outbox, the naive approach is:

```text
1. INSERT into usage_events     ← succeeds
2. PUBLISH to Kafka             ← fails (network blip)
Result: event in DB, never published. Customer never billed.
```

Or worse:

```text
1. PUBLISH to Kafka             ← succeeds
2. INSERT into usage_events     ← fails (constraint violation)
Result: event published to Kafka but not in DB. Billing disagrees with records.
```

The outbox pattern eliminates both failure modes because the outbox write is in the same transaction as the business data write. Postgres guarantees atomicity.

### Database state after station 2

| Table           | Row                                        | Status  |
| --------------- | ------------------------------------------ | ------- |
| `usage_events`  | `eventId=abc, feature=api_calls, amount=1` | PENDING |
| `outbox_events` | `topic=usage.raw, payload={...}`           | PENDING |

Both PENDING, waiting for the outbox publisher.

---

## Station 3 - Outbox publisher drains to Kafka

`OutboxPublisherService` is a NestJS scheduled task that runs every 1 second:

1. `SELECT` up to 100 PENDING outbox rows, oldest first
2. For each row, publish to the target Kafka topic
3. On success: mark `PUBLISHED`, set `published_at`
4. On failure: increment `retry_count`, set `next_retry_at` with exponential backoff
5. After 5 failures: mark `FAILED`, write to `dead_letter_events`

### Concurrency safety

Uses `SELECT ... FOR UPDATE SKIP LOCKED`:

```sql
SELECT id, topic, aggregate_id, payload, retry_count
FROM outbox_events
WHERE status = 'PENDING'
  AND (next_retry_at IS NULL OR next_retry_at <= NOW())
ORDER BY created_at ASC
LIMIT 100
FOR UPDATE SKIP LOCKED
```

`SKIP LOCKED` means if two publisher instances run simultaneously, they skip rows already locked by the other. No duplicate publishes.

### Exponential backoff

On failure, the next retry is delayed by `2^retryCount` seconds:

| Attempt | Delay                 |
| ------- | --------------------- |
| 1       | 2 seconds             |
| 2       | 4 seconds             |
| 3       | 8 seconds             |
| 4       | 16 seconds            |
| 5       | Dead letter (give up) |

### Database state after station 3

| Table           | Row               | Status    |
| --------------- | ----------------- | --------- |
| `usage_events`  | `eventId=abc`     | PENDING   |
| `outbox_events` | `topic=usage.raw` | PUBLISHED |

The event is now in Kafka's `usage.raw` topic, partitioned by the aggregate ID. The outbox row is done.

**Implementation:** `OutboxPublisherService` in `src/modules/outbox/`.

---

## Station 4 - Validation consumer

`UsageValidationConsumer` subscribes to `usage.raw`. For each message, it re-validates the event against the current system state.

### Why re-validate?

Between station 2 (ingestion) and station 4 (processing), the world can change:

- Tenant's subscription could have been cancelled
- Feature could have been removed from the plan
- A duplicate event could have arrived via a different code path

Station 2 validation is **optimistic** - "looks good right now, let it through fast." Station 4 validation is **authoritative** - "confirmed good against current state, proceed to billing."

### Validation checks

1. **Required fields:** `id`, `tenantId`, `feature`, `amount` must all be present
2. **Duplicate detection:** If `usage_events.status != PENDING`, this event was already processed - publish to `usage.duplicates` topic for monitoring and skip
3. **Active subscription:** Tenant must have a subscription with status ACTIVE or TRIALING
4. **Feature entitled:** The feature's `lookup_key` must exist in the subscription's entitlement snapshots

### On validation success

Publishes an enriched event to `usage.validated` with additional context:

```json
{
  "id": "...",
  "eventId": "abc",
  "tenantId": "acme-uuid",
  "feature": "api_calls",
  "amount": 1,
  "timestamp": "2026-05-08T12:00:00Z",
  "validatedSubscriptionId": "sub-uuid",
  "featureType": "QUOTA",
  "validatedAt": "2026-05-08T12:00:01.234Z"
}
```

The enriched fields (`validatedSubscriptionId`, `featureType`) save downstream consumers from doing their own lookups.

Updates `usage_events.status` to `VALIDATED`.

### On validation failure

Publishes to `usage.dead-letter` topic with the failure reason. Updates `usage_events.status` to `REJECTED` with the reason.

### Message key strategy

Events are keyed by `tenantId`. Kafka partitions by key, so all events for the same tenant land on the same partition. This guarantees ordered processing per tenant - critical for quota enforcement.

**Implementation:** `UsageValidationConsumer` in `src/modules/usage-pipeline/`.

---

## Station 5 - Aggregation consumer

`UsageAggregationConsumer` subscribes to `usage.validated`. For each validated event, it atomically updates the rolled-up counter in `usage_aggregates`.

### The atomic upsert

```sql
INSERT INTO usage_aggregates (
  id, tenant_id, subscription_id, feature_lookup_key,
  period_key, amount, period_start, period_end, last_event_at
)
VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (tenant_id, feature_lookup_key, period_key, subscription_id)
DO UPDATE SET
  amount = usage_aggregates.amount + EXCLUDED.amount,
  last_event_at = EXCLUDED.last_event_at,
  updated_at = NOW()
```

This is Postgres's atomic upsert - `INSERT ... ON CONFLICT DO UPDATE`. If the row doesn't exist, it creates it. If it does, it atomically adds to the existing amount. No race conditions, no lost increments, even under concurrent writes from multiple consumer instances.

### Period calculation

The period key is derived from the event's timestamp:

| Reset period | Timestamp            | Period key | Period range            |
| ------------ | -------------------- | ---------- | ----------------------- |
| MONTHLY      | 2026-05-08T12:00:00Z | `2026-05`  | May 1 → Jun 1           |
| ANNUALLY     | 2026-05-08T12:00:00Z | `2026`     | Jan 1 → Jan 1 next year |
| NEVER        | any                  | `lifetime` | unbounded               |

### On aggregation success

Updates `usage_events.status` to `AGGREGATED`.

### On aggregation failure

Publishes to `usage.dead-letter` topic with stage `AGGREGATION` and the error details.

### Database state after station 5

| Table              | Row                                                        | Status     |
| ------------------ | ---------------------------------------------------------- | ---------- |
| `usage_events`     | `eventId=abc`                                              | AGGREGATED |
| `outbox_events`    | `topic=usage.raw`                                          | PUBLISHED  |
| `usage_aggregates` | `tenant=acme, feature=api_calls, period=2026-05, amount=1` | -          |

**Implementation:** `UsageAggregationConsumer` in `src/modules/usage-pipeline/`.

---

## Station 6 - Check engine reads from aggregates

When someone calls `GET /api/v1/entitlements/api_calls/check`, the entitlement check service reads from `usage_aggregates` instead of the in-memory `Map<>`:

```sql
SELECT amount FROM usage_aggregates
WHERE tenant_id = 'acme-uuid'
  AND feature_lookup_key = 'api_calls'
  AND period_key = '2026-05'
  AND subscription_id = 'sub-uuid'
```

This is the real data - persisted, shared across all app instances, survives restarts. The response includes the live usage count:

```json
{
  "allowed": true,
  "feature": "api_calls",
  "type": "QUOTA",
  "limit": 50000,
  "used": 23456,
  "remaining": 26544,
  "resetAt": "2026-06-01T00:00:00Z"
}
```

**Future optimization (Phase 3, Step 9):** Redis caches the aggregate with a 60s TTL for sub-millisecond reads. HARD limit enforcement uses a Redis Lua script for atomic check-and-increment.

---

## Dead letter path

When any station fails to process an event, it goes to the dead letter path:

### Flow

```text
Failed event
    │
    ▼
Kafka: usage.dead-letter
    │
    ▼
Dead Letter Handler (consumer)
    │
    ▼
dead_letter_events table
```

### What's captured

| Field              | Purpose                                           |
| ------------------ | ------------------------------------------------- |
| `source_event_id`  | Links back to the original usage event            |
| `tenant_id`        | For filtering in admin UI                         |
| `topic`            | Which Kafka topic the failure occurred on         |
| `failure_stage`    | INGESTION, PUBLISHING, VALIDATION, or AGGREGATION |
| `failure_reason`   | Human-readable error message                      |
| `original_payload` | Full event JSON as it was at failure time         |
| `error_details`    | Stack trace or detailed error info                |
| `retry_count`      | Number of manual retry attempts                   |
| `status`           | FAILED → RETRYING → RESOLVED or DISCARDED         |

### Lifecycle

```text
FAILED → admin investigates → RETRYING (re-queued to original topic)
                             → RESOLVED (successfully reprocessed)
                             → DISCARDED (admin decided to drop it)
```

Every failed event is investigable. Lost events = lost revenue. The dead letter table is the operational dashboard for the billing team.

---

## Kafka topics

| Topic               | Producer               | Consumer             | Key          | Purpose                                         |
| ------------------- | ---------------------- | -------------------- | ------------ | ----------------------------------------------- |
| `usage.raw`         | Outbox Publisher       | Validation Consumer  | aggregate ID | Raw events from clients, pending validation     |
| `usage.validated`   | Validation Consumer    | Aggregation Consumer | tenant ID    | Validated + enriched events, ready for counting |
| `usage.dead-letter` | Validation/Aggregation | Dead Letter Handler  | tenant ID    | Failed events for investigation                 |
| `usage.duplicates`  | Validation Consumer    | (monitoring)         | tenant ID    | Duplicate events detected (observability)       |

### Consumer groups

| Group                           | Consumer                 | Purpose                     |
| ------------------------------- | ------------------------ | --------------------------- |
| `meterplex-usage-validator`     | UsageValidationConsumer  | Validates raw events        |
| `meterplex-usage-aggregator`    | UsageAggregationConsumer | Aggregates validated events |
| `meterplex-dead-letter-handler` | DeadLetterHandler        | Persists failures           |

---

## Idempotency guarantees

Usage events are idempotent at three levels:

1. **At ingestion (API layer):** The `usage_events.event_id` column has a UNIQUE constraint. Submitting the same `eventId` twice returns `status: "duplicate"` without double-counting.

2. **At validation (Kafka layer):** The validation consumer checks `usage_events.status`. If the event is already `VALIDATED` or `AGGREGATED`, it's skipped and published to the `usage.duplicates` monitoring topic.

3. **At aggregation (database layer):** The atomic upsert (`INSERT ... ON CONFLICT DO UPDATE SET amount = amount + EXCLUDED.amount`) is safe to retry - but the status check at validation prevents the same event from reaching aggregation twice.

---

## Event status lifecycle

Each usage event tracks its pipeline progression:

```text
PENDING → VALIDATED → AGGREGATED
    │
    └→ REJECTED (validation failed)
    └→ DUPLICATE (already processed)
```

| Status     | Meaning                                 | Set by               |
| ---------- | --------------------------------------- | -------------------- |
| PENDING    | Received, awaiting processing           | Ingestion API        |
| VALIDATED  | Passed validation, awaiting aggregation | Validation Consumer  |
| AGGREGATED | Counted in usage_aggregates             | Aggregation Consumer |
| REJECTED   | Failed validation                       | Validation Consumer  |
| DUPLICATE  | Already processed (idempotent skip)     | Validation Consumer  |

---

## Performance characteristics

| Metric                | Value                | Notes                                     |
| --------------------- | -------------------- | ----------------------------------------- |
| Ingestion latency     | < 50ms               | API to 202 response (Postgres write only) |
| End-to-end latency    | < 2s                 | API to usage_aggregates updated           |
| Outbox polling        | 1 second             | Tunable, balances latency vs DB load      |
| Batch size            | 100 outbox rows/tick | Tunable via BATCH_SIZE constant           |
| Max batch per request | 1000 events          | Prevents memory exhaustion                |
| Max event age         | 7 days               | Late events beyond this are rejected      |
| Max future drift      | 5 minutes            | Clock skew tolerance                      |

---

## Schema summary

Four tables added in Phase 3:

| Table                | Purpose                        | Indexes                                                                 |
| -------------------- | ------------------------------ | ----------------------------------------------------------------------- |
| `usage_events`       | Immutable event log            | (tenant_id, feature_lookup_key, timestamp), (status), (event_id UNIQUE) |
| `outbox_events`      | Transactional outbox for Kafka | (status, next_retry_at), (created_at)                                   |
| `usage_aggregates`   | Rolled-up counters             | UNIQUE(tenant_id, feature_lookup_key, period_key, subscription_id)      |
| `dead_letter_events` | Failed events                  | (status), (tenant_id), (failure_stage), (first_failed_at)               |

See the Prisma schema in `prisma/schema.prisma` for the full column definitions and comments.

---

## Future improvements

- **Redis caching** on the read path (Step 9) - 60s TTL for sub-millisecond entitlement checks
- **Redis Lua scripts** for atomic HARD limit enforcement - eliminates the race condition
- **Partition strategy** - usage events partitioned by tenant_id for per-tenant ordering
- **Consumer lag monitoring** - alert when aggregation falls behind validation
- **Outbox cleanup** - cron job to delete PUBLISHED outbox rows older than 7 days
- **Event replay** - re-read Kafka from a specific offset to reprocess events after a billing logic fix
- **Billing period alignment** - UTC-based period boundaries instead of local server time
