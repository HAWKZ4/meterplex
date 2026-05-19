# Phase 3 — Usage Ingestion, Outbox Pattern, and Kafka Pipeline

**Goal:** Replace Phase 2's in-memory usage counters with a production-grade event streaming pipeline. Usage events survive restarts, scale across instances, and support replay.

**Status:** ✅ Complete

---

## TLDR

Phase 3 is complete. Here's what you built:

- Usage events API with batch ingestion, per-event validation, and mixed response
- Transactional outbox pattern solving the dual-write problem (DB + Kafka atomicity)
- Kafka producer/consumer infrastructure with topic management
- Validation consumer that re-checks tenant/subscription/feature state
- Aggregation consumer with atomic Postgres upsert + Redis cache write
- Dead letter queue handler for failed event investigation
- Three-layer idempotency (Redis SETNX → Postgres UNIQUE → Kafka consumer dedup)
- EntitlementCheckService migrated from in-memory Map to Redis + Postgres
- Atomic HARD limit enforcement via Redis Lua script (no race conditions)
- Realistic seed data for demo scenarios

## What was built

### Data model

Four new tables:

- **usage_events** — immutable event log. Every usage event ever submitted. Append-only, indexed by tenant + feature + timestamp. Status tracks pipeline progression (PENDING → VALIDATED → AGGREGATED or REJECTED).
- **outbox_events** — transactional outbox for guaranteed Kafka publishing. Written in the same Postgres transaction as usage_events. Background worker drains to Kafka with retry + exponential backoff.
- **usage_aggregates** — rolled-up counters per tenant, feature, and period. Replaces the in-memory `Map<>`. Atomically updated via `INSERT ... ON CONFLICT DO UPDATE SET amount = amount + N`.
- **dead_letter_events** — failed events with original payload, failure reason, failure stage. The operational dashboard for billing investigation.

See [Usage Pipeline architecture](../architecture/phase-3-usage-pipeline.md) for the full schema, design decisions, and flow diagrams.

### The pipeline (6 stations)

```text
Client SDK → POST /usage/events (API key auth)
  → usage_events + outbox_events (single Postgres transaction)
  → Outbox Publisher (1s polling) → Kafka: usage.raw
  → Validation Consumer → Kafka: usage.validated (or usage.dead-letter)
  → Aggregation Consumer → usage_aggregates + Redis cache
  → EntitlementCheckService reads from Redis (fast) or Postgres (fallback)
```

The client gets `202 Accepted` immediately. Everything after that is async, completing in under 2 seconds.

### Transactional outbox pattern

Solves the dual-write problem. Without it:

- DB succeeds → Kafka fails → event lost, customer never billed
- Kafka succeeds → DB fails → billing disagrees with records

With the outbox: both writes are in one Postgres transaction. The outbox publisher drains to Kafka with at-least-once delivery and exponential backoff. After 5 retries, failed events go to the dead letter table.

### Three-layer idempotency

1. **Redis SETNX at ingestion** — `usage:event:{eventId}` with 24h TTL. Catches retries instantly without hitting Postgres.
2. **Postgres UNIQUE constraint** — `usage_events.event_id` is unique. Catches any retry that slips past Redis (Redis down, TTL expired).
3. **Kafka validation consumer** — checks `usage_events.status`. Skips events already validated/aggregated.

### Entitlement check migration

Phase 2's in-memory `Map<string, number>` replaced with:

- **Read path (cache-aside):** Redis GET → cache miss → Postgres query → seed Redis with 60s TTL
- **Write path (HARD quota):** Atomic check-and-increment via Redis Lua script — impossible to exceed limit even under concurrent requests
- **Write path (SOFT/METERED):** Redis INCRBY — always succeeds, flags overage
- **Fallback:** If Redis is down, Postgres is the degraded read path (slower but correct)

### Kafka infrastructure

| Topic               | Producer               | Consumer             | Purpose                             |
| :------------------ | :--------------------- | :------------------- | :---------------------------------- |
| `usage.raw`         | Outbox Publisher       | Validation Consumer  | Raw events pending validation       |
| `usage.validated`   | Validation Consumer    | Aggregation Consumer | Validated events ready for counting |
| `usage.dead-letter` | Validation/Aggregation | Dead Letter Handler  | Failed events for investigation     |
| `usage.duplicates`  | Validation Consumer    | (monitoring)         | Duplicate events detected           |

### Validation checks (8 total)

1. Required fields present (id, tenantId, feature, amount)
2. eventId is valid UUID format
3. Tenant exists and is ACTIVE (not SUSPENDED/CANCELLED)
4. Timestamp within acceptable window (not >5min future, not >7 days old)
5. Not a duplicate (status != PENDING means already processed)
6. Tenant has active subscription including this feature
7. Feature type is consumable (QUOTA or METERED, not BOOLEAN)
8. Amount is a positive integer

## API endpoints

### Usage Events (API key auth only)

| Method | Path          | Description                                       |
| :----- | :------------ | :------------------------------------------------ |
| POST   | /usage/events | Submit batch of usage events (1-1000 per request) |

Response: `202 Accepted` with per-event status:

```json
{
  "accepted": 99,
  "rejected": 1,
  "events": [
    { "eventId": "abc", "status": "accepted" },
    { "eventId": "xyz", "status": "rejected", "reason": "..." }
  ]
}
```

Per-event statuses: `accepted`, `duplicate`, `rejected`.

### Entitlement Checks (updated — now backed by real data)

| Method | Path                              | Description                                          |
| :----- | :-------------------------------- | :--------------------------------------------------- |
| GET    | /entitlements/:featureKey/check   | Check access + show real usage from aggregates       |
| POST   | /entitlements/:featureKey/consume | Atomic consume via Redis Lua (HARD) or INCRBY (SOFT) |

## Key decisions

| Decision                                       | Why                                                  |
| :--------------------------------------------- | :--------------------------------------------------- |
| Transactional outbox over direct Kafka publish | Eliminates dual-write data loss                      |
| Kafka over RabbitMQ/SQS                        | Replay, multiple consumers, ordering, throughput     |
| 1-second outbox polling over CDC/Debezium      | Simpler infrastructure, acceptable latency           |
| SKIP LOCKED on outbox queries                  | Safe horizontal scaling of publisher workers         |
| Re-validate at Kafka consumer (not just API)   | State changes between ingestion and processing       |
| Atomic Postgres upsert for aggregation         | No lost increments under concurrent writes           |
| Redis Lua for HARD limits                      | Atomic check-and-increment, no race conditions       |
| Cache-aside with 60s TTL                       | Balances freshness vs Redis load                     |
| Three-layer idempotency                        | Belt and suspenders — no double-billing              |
| Direct INSERT for seed usage data              | Pipeline already proven; seed is dev convenience     |
| Per-event mixed response                       | Don't reject 99 valid events because 1 is bad        |
| API key auth only for usage events             | Server-to-server; JWT doesn't map to real use case   |
| Batch-only API (array always)                  | Matches Stripe/AWS pattern; one contract to maintain |

## Seed data

| Tenant            | Plan       | api_calls              | Storage        | Demo scenario   |
| :---------------- | :--------- | :--------------------- | :------------- | :-------------- |
| Acme Corp         | Pro        | 35,000 / 50,000 (70%)  | 7 GB / 10 GB   | Healthy usage   |
| Globex Industries | Starter    | 950 / 1,000 (95%)      | 1 GB / 1 GB    | Near HARD limit |
| Stark Enterprises | Enterprise | 50,000 / 500,000 (10%) | 25 GB / 100 GB | Low utilization |

## Gotchas encountered

1. **Kafka group coordinator not available on startup** — transient race condition when consumers start before Kafka finishes setting up the coordinator. Auto-recovers within 300ms via kafkajs retry. Normal in dev.
2. **Non-UUID eventId rejected by validation consumer** — adding UUID format check at the validation layer caught `redis-test-001` from earlier testing. Ingestion doesn't validate UUID format (Stripe allows any string as idempotency key), but validation does. Design choice.
3. **Redis cache mismatch after adding Redis mid-phase** — events aggregated before Redis was added had counters in Postgres but not Redis. The `ensureCacheSeeded` function handles this by reading from Postgres and seeding Redis on first access.
4. **Stale API keys after database re-seed** — re-seeding changes tenant UUIDs, invalidating previously created API keys. Need to create fresh keys after re-seed.
5. **TimeoutNegativeWarning from kafkajs** — Node.js warning about negative timeout values in kafkajs timer handling. Known issue, doesn't affect functionality.
6. **Shell variable expansion in redis-cli** — `$ACME_ID` doesn't expand inside `docker compose exec redis redis-cli GET "usage:$ACME_ID:..."`. Use the full UUID string directly.

## Infrastructure added

| Component           | Technology        | Purpose                                          |
| :------------------ | :---------------- | :----------------------------------------------- |
| KafkaModule         | kafkajs           | Producer service, consumer base class            |
| RedisModule         | ioredis           | Cache, atomic counters, dedup keys               |
| OutboxModule        | @nestjs/schedule  | 1s polling, SKIP LOCKED, exponential backoff     |
| UsagePipelineModule | KafkaConsumerBase | Validation + Aggregation + Dead Letter consumers |

## Limitations carried into next phases

- **No consumer lag monitoring** — can't detect when aggregation falls behind validation. Phase 7 adds observability.
- **No outbox cleanup** — PUBLISHED rows accumulate forever. Needs a cron to delete rows older than 7 days.
- **Billing period boundaries use UTC** — but `getResetDate()` uses local server time. Needs explicit UTC handling for production.
- **No admin API for dead letter events** — events are persisted but only queryable via SQL. Phase 6 adds `GET/POST/DELETE /admin/dead-letter`.
- **No platform admin guard** — usage events endpoint uses API key auth (correct), but plans/features/entitlements endpoints still lack platform admin restriction.
