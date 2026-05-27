/**
 * EntitlementCheckService - The hot path. Answers "can this tenant do X?"
 *
 * This runs on every guarded API request. Performance matters.
 *
 * Flow:
 *   1. Find tenant's active subscription
 *   2. Find the entitlement snapshot for the requested feature
 *   3. Evaluate based on feature type:
 *      BOOLEAN → return snapshot.value
 *      QUOTA   → compare usage counter against snapshot.limit
 *      METERED → always allowed (tracked for billing)
 *
 * Usage counter read path (cache-aside pattern):
 *   1. Try Redis GET → if hit, use cached value
 *   2. Cache miss → query usage_aggregates in Postgres
 *   3. Write result to Redis with 60s TTL
 *   4. Return the value
 *
 * Usage counter write path (consume):
 *   1. For HARD quotas: atomic check-and-increment via Redis Lua script
 *      (prevents race condition where two concurrent requests both pass)
 *   2. For SOFT quotas and METERED: Redis INCRBY (always succeeds)
 *   3. Publish usage event through the outbox so Postgres aggregate catches up
 *
 * Redis is the fast path. Postgres is the source of truth.
 * If Redis is down, we fall back to Postgres (slower but correct).
 */
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '@app-prisma/prisma.service';
import { randomUUID } from 'node:crypto';

import { ERRORS } from '@common/constants';

import { RedisService } from '@infra/cache';

import { FeatureType, ResetPeriod, SubscriptionStatus } from '@prisma/client';

/**
 * Redis Lua script for atomic HARD limit check-and-increment.
 *
 * KEYS[1] = cache key (usage:{tenantId}:{feature}:{period})
 * ARGV[1] = amount to consume
 * ARGV[2] = limit
 *
 * Returns:
 *   >= 0: new usage after increment (success)
 *   -1: would exceed limit (blocked)
 *
 * This is atomic - Redis executes the entire script as a single
 * operation. No race condition possible between the GET and INCRBY.
 */
const HARD_LIMIT_LUA = `
  local current = tonumber(redis.call('GET', KEYS[1]) or '0')
  if current + tonumber(ARGV[1]) > tonumber(ARGV[2]) then
    return -1
  end
  return redis.call('INCRBY', KEYS[1], ARGV[1])
`;

/** Cache TTL in seconds. Balances freshness vs Redis load. */
const CACHE_TTL_SECONDS = 60;

@Injectable()
export class EntitlementCheckService {
  private readonly logger = new Logger(EntitlementCheckService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Check if a tenant has access to a feature.
   *
   * @param tenantId - Tenant UUID
   * @param featureLookupKey - Feature lookup key (e.g., "api_calls")
   * @returns Access check result with usage info for QUOTA features
   */
  async check(tenantId: string, featureLookupKey: string) {
    const snapshot = await this.getSnapshot(tenantId, featureLookupKey);

    if (!snapshot) {
      this.logger.log(
        `Entitlement check failed: tenant ${tenantId} → feature ${featureLookupKey} (No active subscription or feature not in plan)`,
      );
      return {
        allowed: false,
        feature: featureLookupKey,
        type: 'UNKNOWN',
        reason: 'No active subscription or feature not included in plan',
      };
    }

    switch (snapshot.featureType) {
      case FeatureType.BOOLEAN:
        return {
          allowed: snapshot.value === true,
          feature: featureLookupKey,
          type: 'BOOLEAN',
          reason: snapshot.value ? null : 'Feature not included in your plan',
        };

      case FeatureType.QUOTA: {
        const used = await this.getUsage(
          tenantId,
          featureLookupKey,
          snapshot.resetPeriod,
        );
        const limit = snapshot.limit ?? 0;
        const remaining = Math.max(0, limit - used);
        const allowed = snapshot.limitBehavior === 'SOFT' || used < limit;

        const reason = allowed ? null : 'Quota exceeded';

        if (!allowed) {
          this.logger.log(
            `Entitlement denied: tenant ${tenantId} → feature ${featureLookupKey} (Quota exceeded: ${used}/${limit})`,
          );
        }

        return {
          allowed,
          feature: featureLookupKey,
          type: 'QUOTA',
          limit,
          used,
          remaining,
          resetAt: this.getResetDate(snapshot.resetPeriod),
          reason,
        };
      }

      case FeatureType.METERED: {
        const used = await this.getUsage(
          tenantId,
          featureLookupKey,
          snapshot.resetPeriod,
        );
        const includedAmount = snapshot.includedAmount ?? 0;

        return {
          allowed: true,
          feature: featureLookupKey,
          type: 'METERED',
          includedAmount,
          used,
          overage: Math.max(0, used - includedAmount),
          resetAt: this.getResetDate(snapshot.resetPeriod),
        };
      }

      default:
        return {
          allowed: false,
          feature: featureLookupKey,
          type: snapshot.featureType,
          reason: 'Unknown feature type',
        };
    }
  }

  /**
   * Consume units of a quota/metered feature.
   *
   * For QUOTA (HARD): uses Redis Lua script for atomic check-and-increment.
   * For QUOTA (SOFT): Redis INCRBY (always succeeds, flags overage).
   * For METERED: Redis INCRBY (always succeeds, tracked for billing).
   * For BOOLEAN: returns error (boolean features aren't consumable).
   *
   * After Redis update, publishes a usage event through the outbox
   * so the Postgres aggregate eventually catches up.
   *
   * @param tenantId - Tenant UUID
   * @param featureLookupKey - Feature lookup key
   * @param amount - Units to consume (default: 1)
   * @returns Consumption result with updated usage
   */
  async consume(tenantId: string, featureLookupKey: string, amount = 1) {
    const snapshot = await this.getSnapshot(tenantId, featureLookupKey);

    if (!snapshot) {
      this.logger.log(
        `Consumption failed: tenant ${tenantId} → feature ${featureLookupKey} (No active subscription or feature not in plan)`,
      );
      throw new NotFoundException(
        'No active subscription or feature not included in plan',
      );
    }

    if (snapshot.featureType === 'BOOLEAN') {
      throw new ForbiddenException(
        'Boolean features cannot be consumed. Use the check endpoint instead.',
      );
    }

    const cacheKey = this.buildCacheKey(
      tenantId,
      featureLookupKey,
      snapshot.resetPeriod,
    );

    let newUsage: number;

    // For HARD quota: atomic check-and-increment via Lua script
    if (
      snapshot.featureType === 'QUOTA' &&
      snapshot.limitBehavior === 'HARD' &&
      snapshot.limit !== null
    ) {
      try {
        // Ensure Redis has current state before atomic check
        await this.ensureCacheSeeded(
          cacheKey,
          tenantId,
          featureLookupKey,
          snapshot.resetPeriod,
        );

        const result = await this.redis.eval(
          HARD_LIMIT_LUA,
          [cacheKey],
          [amount, snapshot.limit],
        );

        if (result === -1) {
          const currentUsage = await this.getUsage(
            tenantId,
            featureLookupKey,
            snapshot.resetPeriod,
          );
          this.logger.log(
            `Consumption denied: tenant ${tenantId} → feature ${featureLookupKey} (HARD quota exceeded)`,
          );
          throw new ForbiddenException(
            ERRORS.ENTITLEMENT_CHECK.QUOTA_EXCEEDED(
              featureLookupKey,
              snapshot.limit,
              currentUsage,
            ),
          );
        }

        newUsage = result as number;
      } catch (error) {
        // If it's our own ForbiddenException, rethrow
        if (error instanceof ForbiddenException) throw error;

        // Redis failure - fall back to Postgres-based check
        this.logger.warn(
          `Redis Lua failed, falling back to Postgres: ${error instanceof Error ? error.message : String(error)}`,
        );
        newUsage = await this.consumeFallback(
          tenantId,
          featureLookupKey,
          snapshot.resetPeriod,
          amount,
          snapshot.limit,
        );
      }
    } else {
      // SOFT quota or METERED: always allow, just increment
      try {
        await this.ensureCacheSeeded(
          cacheKey,
          tenantId,
          featureLookupKey,
          snapshot.resetPeriod,
        );
        newUsage = await this.redis.incrBy(cacheKey, amount);
        await this.redis.expire(cacheKey, CACHE_TTL_SECONDS);
      } catch {
        // Redis failure - fall back to Postgres
        this.logger.warn('Redis INCRBY failed, falling back to Postgres');
        const currentUsage = await this.getUsageFromPostgres(
          tenantId,
          featureLookupKey,
          snapshot.resetPeriod,
        );
        newUsage = currentUsage + amount;
      }
    }

    // Determine overage
    const limit = snapshot.limit ?? snapshot.includedAmount ?? 0;
    const isOverage = newUsage > limit;
    const remaining = Math.max(0, limit - newUsage);

    // Persist usage event through the pipeline for billing durability.
    // Redis increment is the fast path for immediate feedback;
    // this ensures the event reaches usage_aggregates for invoicing.
    const eventId = `consume-${tenantId}-${featureLookupKey}-${randomUUID()}`;

    try {
      await this.prisma.$transaction(async (tx) => {
        const usageEvent = await tx.usageEvent.create({
          data: {
            eventId,
            tenantId,
            subscriptionId: snapshot.subscriptionId,
            featureLookupKey,
            amount,
            timestamp: new Date(),
            status: 'PENDING',
            metadata: { source: 'consume-endpoint' },
          },
        });

        await tx.outboxEvent.create({
          data: {
            topic: 'usage.raw',
            aggregateType: 'usage_event',
            aggregateId: usageEvent.id,
            payload: {
              eventId,
              tenantId,
              subscriptionId: snapshot.subscriptionId,
              featureLookupKey,
              amount,
            },
          },
        });
      });
    } catch (error) {
      // Log but don't fail the consume response - Redis already incremented.
      // The pipeline will reconcile on the next aggregation cycle.
      this.logger.warn(
        `Failed to persist usage event for consume: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    this.logger.log(
      `Consumed ${amount} units of ${featureLookupKey} for tenant ${tenantId} (New usage: ${newUsage}, Overage: ${isOverage})`,
    );

    return {
      allowed: true,
      feature: featureLookupKey,
      consumed: amount,
      used: newUsage,
      remaining,
      overage: isOverage,
    };
  }

  // =============================================================
  // Snapshot lookup
  // =============================================================

  /**
   * Find the entitlement snapshot for a tenant's active subscription + feature.
   *
   * This is the core lookup - optimized with indexes on:
   *   subscriptions(tenant_id) + entitlement_snapshots(subscription_id, feature_lookup_key)
   */
  private async getSnapshot(tenantId: string, featureLookupKey: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        tenantId,
        status: {
          in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING],
        },
      },
      select: { id: true },
    });

    if (!subscription) {
      return null;
    }

    return this.prisma.entitlementSnapshot.findUnique({
      where: {
        subscriptionId_featureLookupKey: {
          subscriptionId: subscription.id,
          featureLookupKey,
        },
      },
    });
  }

  // =============================================================
  // Usage counter reads - cache-aside pattern
  // =============================================================

  /**
   * Get current usage count. Cache-aside pattern:
   *   1. Try Redis GET
   *   2. Cache miss → query Postgres usage_aggregates
   *   3. Write to Redis with 60s TTL
   *   4. Return the value
   *
   * If Redis is down entirely, falls back to Postgres.
   */
  private async getUsage(
    tenantId: string,
    featureLookupKey: string,
    resetPeriod: string | null,
  ): Promise<number> {
    const cacheKey = this.buildCacheKey(
      tenantId,
      featureLookupKey,
      resetPeriod,
    );

    // Try Redis first
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached !== null) {
        return parseInt(cached, 10);
      }
    } catch {
      // Redis down - fall through to Postgres
      this.logger.warn('Redis GET failed, falling back to Postgres');
    }

    // Cache miss or Redis down - query Postgres
    const amount = await this.getUsageFromPostgres(
      tenantId,
      featureLookupKey,
      resetPeriod,
    );

    // Seed Redis cache for next read
    try {
      await this.redis.set(cacheKey, amount.toString(), CACHE_TTL_SECONDS);
    } catch {
      // Non-critical - next read will fall back to Postgres again
    }

    return amount;
  }

  /**
   * Query usage from the Postgres usage_aggregates table.
   * This is the source of truth - slower but always correct.
   */
  private async getUsageFromPostgres(
    tenantId: string,
    featureLookupKey: string,
    resetPeriod: string | null,
  ): Promise<number> {
    const periodKey = this.getPeriodKey(resetPeriod);

    const aggregate = await this.prisma.usageAggregate.findFirst({
      where: {
        tenantId,
        featureLookupKey,
        periodKey,
      },
      select: { amount: true },
    });

    return aggregate?.amount ?? 0;
  }

  // =============================================================
  // Cache seeding and fallback
  // =============================================================

  /**
   * Ensure Redis has a value for this key before atomic operations.
   * If the key doesn't exist in Redis, seed it from Postgres.
   *
   * This prevents the Lua script from operating on a zero value
   * when Postgres has a non-zero aggregate (e.g., after server restart).
   */
  private async ensureCacheSeeded(
    cacheKey: string,
    tenantId: string,
    featureLookupKey: string,
    resetPeriod: string | null,
  ): Promise<void> {
    try {
      const exists = await this.redis.get(cacheKey);
      if (exists !== null) return; // Already seeded

      // Seed from Postgres
      const amount = await this.getUsageFromPostgres(
        tenantId,
        featureLookupKey,
        resetPeriod,
      );
      await this.redis.set(cacheKey, amount.toString(), CACHE_TTL_SECONDS);
    } catch {
      // Non-critical - Lua script will operate on 0, which is
      // conservative (allows consumption that might be over limit).
      // The next aggregation cycle corrects the Redis value.
    }
  }

  /**
   * Fallback consume path when Redis is unavailable.
   * Uses Postgres aggregate directly. No race condition protection
   * (acceptable degradation - Redis being down is already a bad day).
   */
  private async consumeFallback(
    tenantId: string,
    featureLookupKey: string,
    resetPeriod: string | null,
    amount: number,
    limit: number,
  ): Promise<number> {
    const currentUsage = await this.getUsageFromPostgres(
      tenantId,
      featureLookupKey,
      resetPeriod,
    );

    if (currentUsage + amount > limit) {
      throw new ForbiddenException(
        ERRORS.ENTITLEMENT_CHECK.QUOTA_EXCEEDED(
          featureLookupKey,
          limit,
          currentUsage,
        ),
      );
    }

    return currentUsage + amount;
  }

  // =============================================================
  // Key building and period helpers
  // =============================================================

  /**
   * Build the Redis cache key.
   * Format: usage:{tenantId}:{featureLookupKey}:{periodKey}
   * Same format used by UsageAggregationConsumer for writes.
   */
  private buildCacheKey(
    tenantId: string,
    featureLookupKey: string,
    resetPeriod: string | null,
  ): string {
    const periodKey = this.getPeriodKey(resetPeriod);
    return `usage:${tenantId}:${featureLookupKey}:${periodKey}`;
  }

  /**
   * Generate a period key based on reset period.
   * MONTHLY: "2026-04", ANNUALLY: "2026", NEVER: "lifetime"
   */
  private getPeriodKey(resetPeriod: string | null): string {
    const now = new Date();
    switch (resetPeriod) {
      case ResetPeriod.MONTHLY:
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      case ResetPeriod.ANNUALLY:
        return `${now.getFullYear()}`;
      case ResetPeriod.NEVER:
      default:
        return 'lifetime';
    }
  }

  /**
   * Calculate the next reset date based on period.
   */
  private getResetDate(resetPeriod: string | null): Date | null {
    const now = new Date();
    switch (resetPeriod) {
      case ResetPeriod.MONTHLY: {
        const reset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        return reset;
      }
      case ResetPeriod.ANNUALLY: {
        const reset = new Date(now.getFullYear() + 1, 0, 1);
        return reset;
      }
      default:
        return null;
    }
  }
}
