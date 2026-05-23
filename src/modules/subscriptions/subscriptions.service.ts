/**
 * SubscriptionsService - Manages tenant subscriptions to plans.
 *
 * The subscription is the binding between a tenant and a plan.
 * When a tenant subscribes:
 *   1. Validate plan, price, and tenant
 *   2. Check no active subscription exists (one active per tenant)
 *   3. Calculate billing period based on today's date + price interval
 *   4. Create the subscription record
 *   5. Snapshot ALL entitlements from the plan (frozen copy)
 *   6. Return the subscription with snapshots
 *
 * The snapshot step is critical: it freezes the plan's entitlements
 * at the moment of subscription. If the plan's limits change later,
 * existing subscribers keep their original limits until renewal.
 *
 * Business rules:
 *   - One active subscription per tenant
 *   - Upgrades/downgrades cancel the old subscription and create a new one
 *   - Cancellation sets cancelledAt but subscription stays active until
 *     currentPeriodEnd (cancel-at-end-of-period)
 *   - billingAnchor is the day-of-month, capped at 28
 */
import {
  BadRequestException,
  Injectable,
  Logger,
  // ConflictException,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '@app-prisma/prisma.service';

import { ERRORS } from '@common/constants';
import { isNotFoundError } from '@common/utils/prisma-errors';

import { SubscriptionStatus, TenantStatus } from '@prisma/client';

import { CreateSubscriptionDto } from './dto';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Default select for subscription queries.
   */
  private readonly DEFAULT_SELECT = {
    id: true,
    tenantId: true,
    status: true,
    currentPeriodStart: true,
    currentPeriodEnd: true,
    billingAnchor: true,
    trialEndsAt: true,
    cancelledAt: true,
    createdAt: true,
    plan: {
      select: {
        id: true,
        name: true,
        slug: true,
      },
    },
    price: {
      select: {
        id: true,
        interval: true,
        amount: true,
        currency: true,
      },
    },
    entitlementSnapshots: {
      select: {
        featureLookupKey: true,
        featureType: true,
        value: true,
        limit: true,
        limitBehavior: true,
        overagePrice: true,
        includedAmount: true,
        resetPeriod: true,
      },
      orderBy: { featureLookupKey: 'asc' as const },
    },
  };

  /**
   * Subscribe a tenant to a plan.
   *
   * This is a transactional operation:
   *   1. Validate plan, price, tenant
   *   2. Cancel any existing active subscription
   *   3. Create new subscription
   *   4. Snapshot all plan entitlements
   *
   * All four steps happen in a single Prisma transaction.
   * If any step fails, nothing is committed.
   *
   * @param tenantId - Tenant UUID (from x-tenant-id header)
   * @param dto - Plan ID, Price ID, optional trial days
   * @returns The created subscription with entitlement snapshots
   */
  async create(tenantId: string, dto: CreateSubscriptionDto) {
    // 1. Validate plan exists and is ACTIVE
    const plan = await this.prisma.plan.findUnique({
      where: { id: dto.planId },
      select: { id: true, slug: true, status: true },
    });

    if (!plan) {
      throw new NotFoundException(ERRORS.PLAN.NOT_FOUND_ID(dto.planId));
    }

    if (plan.status !== TenantStatus.ACTIVE) {
      throw new BadRequestException(
        ERRORS.SUBSCRIPTION.PLAN_NOT_ACTIVE(plan.slug),
      );
    }

    // 2. Validate price exists, belongs to plan, and is active
    const price = await this.prisma.planPrice.findFirst({
      where: { id: dto.priceId, planId: dto.planId, isActive: true },
      select: { id: true, interval: true, amount: true, currency: true },
    });

    if (!price) {
      throw new NotFoundException(ERRORS.SUBSCRIPTION.PRICE_NOT_FOUND);
    }

    // 3. Load plan's entitlements for snapshotting
    const entitlements = await this.prisma.entitlement.findMany({
      where: { planId: dto.planId },
      select: {
        value: true,
        limit: true,
        limitBehavior: true,
        overagePrice: true,
        includedAmount: true,
        resetPeriod: true,
        feature: {
          select: {
            lookupKey: true,
            type: true,
          },
        },
      },
    });

    // 4. Calculate billing period
    const now = new Date();
    const billingAnchor = Math.min(now.getDate(), 28);
    const periodStart = now;
    const periodEnd = this.calculatePeriodEnd(now, price.interval);
    const trialEndsAt = dto.trialDays
      ? new Date(now.getTime() + dto.trialDays * 24 * 60 * 60 * 1000)
      : null;
    const status = dto.trialDays
      ? SubscriptionStatus.TRIALING
      : SubscriptionStatus.ACTIVE;

    // 5. Execute in a transaction: cancel old + create new + snapshot
    const subscription = await this.prisma.$transaction(async (tx) => {
      // Cancel any existing active/trialing subscription
      await tx.subscription.updateMany({
        where: {
          tenantId,
          status: {
            in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING],
          },
        },
        data: {
          status: SubscriptionStatus.CANCELLED,
          cancelledAt: now,
        },
      });

      // Create the new subscription
      const sub = await tx.subscription.create({
        data: {
          tenantId,
          planId: dto.planId,
          priceId: dto.priceId,
          status,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          billingAnchor,
          trialEndsAt,
        },
      });

      // Snapshot all entitlements
      if (entitlements.length > 0) {
        await tx.entitlementSnapshot.createMany({
          data: entitlements.map((e) => ({
            subscriptionId: sub.id,
            featureLookupKey: e.feature.lookupKey,
            featureType: e.feature.type,
            value: e.value,
            limit: e.limit,
            limitBehavior: e.limitBehavior,
            overagePrice: e.overagePrice,
            includedAmount: e.includedAmount,
            resetPeriod: e.resetPeriod,
          })),
        });
      }

      return sub;
    });

    // 6. Fetch the full subscription with relations
    const result = await this.prisma.subscription.findUnique({
      where: { id: subscription.id },
      select: this.DEFAULT_SELECT,
    });

    this.logger.log(
      `Subscription created: tenant ${tenantId} → ${plan.slug} (${price.interval}, ${price.amount} ${price.currency})`,
    );

    return result;
  }

  /**
   * Get the active subscription for a tenant.
   *
   * @param tenantId - Tenant UUID
   * @returns The active subscription with plan, price, and snapshots
   * @throws NotFoundException if no active subscription exists
   */
  async findActiveForTenant(tenantId: string) {
    try {
      return await this.prisma.subscription.findFirstOrThrow({
        where: {
          tenantId,
          status: {
            in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING],
          },
        },
        select: this.DEFAULT_SELECT,
      });
    } catch (error) {
      if (isNotFoundError(error)) {
        throw new NotFoundException(
          ERRORS.SUBSCRIPTION.NO_ACTIVE_SUBSCRIPTION(tenantId),
        );
      }

      throw error;
    }
  }

  /**
   * List all subscriptions for a tenant (including cancelled).
   *
   * @param tenantId - Tenant UUID
   * @returns Array of subscriptions ordered by creation date (newest first)
   */
  async findAllForTenant(tenantId: string) {
    const subscriptions = await this.prisma.subscription.findMany({
      where: { tenantId },
      select: this.DEFAULT_SELECT,
      orderBy: { createdAt: 'desc' },
    });

    return { data: subscriptions };
  }

  /**
   * Cancel a subscription.
   *
   * Sets cancelledAt to now but keeps the subscription active until
   * currentPeriodEnd. The tenant continues to have access until
   * their billing period ends (cancel-at-end-of-period behavior).
   *
   * @param tenantId - Tenant UUID
   * @param id - Subscription UUID
   * @returns The updated subscription
   */
  async cancel(tenantId: string, id: string) {
    try {
      const subscription = await this.prisma.subscription.findFirstOrThrow({
        where: {
          id,
          tenantId,
          status: {
            in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING],
          },
        },
        select: this.DEFAULT_SELECT,
      });

      const cancelled = await this.prisma.subscription.update({
        where: { id },
        data: { cancelledAt: new Date() },
        select: this.DEFAULT_SELECT,
      });

      this.logger.log(
        `Subscription cancelled: ${id} for tenant ${tenantId} (active until ${subscription.currentPeriodEnd.toISOString()})`,
      );

      return cancelled;
    } catch (error) {
      if (isNotFoundError(error)) {
        throw new NotFoundException(ERRORS.SUBSCRIPTION.NOT_FOUND);
      }

      throw error;
    }
  }

  /**
   * Calculate the end of a billing period based on interval.
   *
   * MONTHLY: same day next month (capped at 28)
   * ANNUALLY: same day next year
   */
  private calculatePeriodEnd(start: Date, interval: string): Date {
    const end = new Date(start);
    if (interval === 'ANNUALLY') {
      end.setFullYear(end.getFullYear() + 1);
    } else {
      end.setMonth(end.getMonth() + 1);
    }
    return end;
  }
}
