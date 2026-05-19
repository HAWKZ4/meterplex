/**
 * UsageEventsService  Ingests usage events into the pipeline.
 *
 * This is Step 2 of Phase 3. The service:
 *   1. Validates each event against the tenant's active subscription
 *   2. Persists accepted events to usage_events table
 *   3. Writes corresponding outbox rows in the SAME transaction
 *      (transactional outbox pattern  prevents dual-write loss)
 *   4. Returns per-event status so clients can retry failed events
 *
 * The outbox worker (Step 4) will later drain outbox rows to Kafka.
 * For now, events sit in usage_events with status=PENDING and in
 * outbox with status=PENDING, ready for the next steps.
 *
 * Idempotency is enforced at three layers:
 *   1. Redis SETNX (fast path): usage:event:{eventId} with 24h TTL.
 *      Catches retries instantly without hitting Postgres.
 *   2. Postgres UNIQUE constraint (authoritative): INSERT fails on
 *      duplicate event_id, caught and returned as status = duplicate.
 *   3. Kafka validation consumer: checks usage_events.status, skips
 *      events already validated/aggregated.
 *
 * Validation performed per-event:
 *   - Tenant has an active subscription (cached per-request)
 *   - Feature exists and is in the subscription's entitlement snapshots
 *   - Timestamp is within acceptable window (not future, not >7d old)
 *
 * Trade-offs:
 *   - Per-event validation in a loop is O(n). For batches of 1000,
 *     we pre-load the subscription + snapshots once and reuse.
 *   - Individual INSERT per event (not bulk) because we need
 *     per-event status (accepted vs duplicate vs rejected).
 *   - All writes happen in a single transaction for atomicity.
 */
import { ForbiddenException, Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '@app-prisma/prisma.service';

import { ERRORS } from '@common/constants';
import { isUniqueConstraintError } from '@common/utils/prisma-errors';

import { RedisService } from '@modules/redis';

import { SubscriptionStatus } from '@prisma/client';

import type {
  CreateUsageEventsDto,
  UsageEventInputDto,
  UsageEventResultDto,
} from './dto';

/** Late events older than this are rejected. */
const MAX_EVENT_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Future events beyond this are rejected (clock skew tolerance). */
const MAX_FUTURE_DRIFT_MS = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class UsageEventsService {
  private readonly logger = new Logger(UsageEventsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Ingest a batch of usage events for a tenant.
   *
   * Flow:
   *   1. Load tenant's active subscription + entitlement snapshots (ONE query)
   *   2. For each event: validate + persist (usage_event + outbox row)
   *      in a single transaction with the rest of the batch
   *   3. Return per-event status
   *
   * @param tenantId - Tenant UUID (from authenticated API key)
   * @param dto - Array of usage events
   * @returns Per-event status with accepted/rejected counts
   */
  async ingest(
    tenantId: string,
    dto: CreateUsageEventsDto,
  ): Promise<{
    accepted: number;
    rejected: number;
    events: UsageEventResultDto[];
  }> {
    // Load subscription + snapshots once for the whole batch
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        tenantId,
        status: {
          in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING],
        },
      },
      select: {
        id: true,
        entitlementSnapshots: {
          select: { featureLookupKey: true },
        },
      },
    });

    if (!subscription) {
      // No subscription = every event rejected. Fail fast with clean error.
      throw new ForbiddenException(ERRORS.USAGE_EVENT.NO_ACTIVE_SUBSCRIPTION);
    }

    // Build a Set of feature keys for O(1) lookups in the per-event loop
    const entitledFeatures = new Set(
      subscription.entitlementSnapshots.map((s) => s.featureLookupKey),
    );

    // Pre-validate each event (no DB calls) to split into persist vs reject
    const now = Date.now();
    const toPersist: Array<{
      event: UsageEventInputDto;
      result: UsageEventResultDto;
    }> = [];
    const rejected: UsageEventResultDto[] = [];

    for (const event of dto.events) {
      // Fast dedup via Redis SETNX — catches retries before hitting Postgres.
      // Key: usage:event:{eventId}, TTL: 24h. If key exists → duplicate.
      // This is the first dedup layer (fast). Postgres UNIQUE is the second (authoritative).
      try {
        const dedupKey = `usage:event:${event.eventId}`;
        const isNew = await this.redis
          .getClient()
          .set(dedupKey, '1', 'EX', 86400, 'NX');
        if (!isNew) {
          rejected.push({
            eventId: event.eventId,
            status: 'duplicate',
          });
          continue;
        }
      } catch {
        // Redis down — skip fast dedup, fall through to Postgres UNIQUE constraint.
        // Slightly slower but still correct.
      }

      const rejection = this.preValidate(event, entitledFeatures, now);
      if (rejection) {
        rejected.push({
          eventId: event.eventId,
          status: 'rejected',
          reason: rejection,
        });
        continue;
      }

      toPersist.push({
        event,
        result: { eventId: event.eventId, status: 'accepted' },
      });
    }

    // Persist accepted events in a single transaction
    // Each event gets an individual INSERT attempt so we can detect duplicates
    const persistResults = await this.prisma.$transaction(async (tx) => {
      const results: UsageEventResultDto[] = [];

      for (const { event, result } of toPersist) {
        try {
          // Create usage_event row
          const usageEvent = await tx.usageEvent.create({
            data: {
              eventId: event.eventId,
              tenantId,
              subscriptionId: subscription.id,
              featureLookupKey: event.feature,
              amount: event.amount,
              timestamp: new Date(event.timestamp),
              metadata: (event.metadata ?? {}) as any,
            },
            select: { id: true, eventId: true },
          });

          // Create corresponding outbox row (transactional outbox pattern)
          // Same transaction: either both commit or both rollback
          await tx.outboxEvent.create({
            data: {
              topic: 'usage.raw',
              aggregateType: 'usage_event',
              aggregateId: usageEvent.id,
              payload: {
                id: usageEvent.id,
                eventId: event.eventId,
                tenantId,
                subscriptionId: subscription.id,
                feature: event.feature,
                amount: event.amount,
                timestamp: event.timestamp,
                metadata: (event.metadata ?? {}) as any,
              },
            },
          });

          results.push(result);
        } catch (error) {
          // UNIQUE(event_id) violation = duplicate event = idempotent success
          if (isUniqueConstraintError(error)) {
            results.push({
              eventId: event.eventId,
              status: 'duplicate',
            });
            continue;
          }
          // Unexpected error  fail the whole transaction
          throw error;
        }
      }

      return results;
    });

    // Merge persist results with pre-validation rejections
    const allResults = [...persistResults, ...rejected];

    // Count: accepted = new + duplicate (both are successful outcomes)
    const acceptedCount = allResults.filter(
      (r) => r.status === 'accepted' || r.status === 'duplicate',
    ).length;
    const rejectedCount = allResults.filter(
      (r) => r.status === 'rejected',
    ).length;

    this.logger.log(
      `Ingested batch for tenant ${tenantId}: ${acceptedCount} accepted, ${rejectedCount} rejected`,
    );

    // Preserve original request order in the response
    const orderedResults = dto.events.map(
      (e) =>
        allResults.find((r) => r.eventId === e.eventId) ?? {
          eventId: e.eventId,
          status: 'rejected' as const,
          reason: 'Internal error',
        },
    );

    return {
      accepted: acceptedCount,
      rejected: rejectedCount,
      events: orderedResults,
    };
  }

  /**
   * Per-event synchronous validation (no DB calls).
   *
   * Returns null if the event is valid, or a rejection reason string.
   *
   * Validations:
   *   - Feature is in the tenant's active subscription
   *   - Timestamp is not too far in the future (clock skew protection)
   *   - Timestamp is not too far in the past (late event protection)
   */
  private preValidate(
    event: UsageEventInputDto,
    entitledFeatures: Set<string>,
    now: number,
  ): string | null {
    if (!entitledFeatures.has(event.feature)) {
      return ERRORS.USAGE_EVENT.FEATURE_NOT_ENTITLED(event.feature);
    }

    const eventTime = new Date(event.timestamp).getTime();
    if (Number.isNaN(eventTime)) {
      return 'Invalid timestamp format';
    }

    if (eventTime > now + MAX_FUTURE_DRIFT_MS) {
      return ERRORS.USAGE_EVENT.TIMESTAMP_IN_FUTURE;
    }

    if (eventTime < now - MAX_EVENT_AGE_MS) {
      return ERRORS.USAGE_EVENT.TIMESTAMP_TOO_OLD;
    }

    return null;
  }
}
