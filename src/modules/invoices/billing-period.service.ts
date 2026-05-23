/**
 * BillingPeriodService - Determines when billing periods close and advances subscriptions.
 *
 * Responsibilities:
 *   1. Find subscriptions with expired billing periods (currentPeriodEnd <= now)
 *   2. Prevent double-closing (check if invoice already exists for this period)
 *   3. Advance subscription to the next period after invoice generation
 *
 * Period calculation:
 *   MONTHLY:  billingAnchor day of next month
 *   ANNUALLY: billingAnchor day of same month, next year
 *
 * Called by:
 *   - BillingCronService (automatic, daily at 00:05 UTC)
 *   - POST /invoices/generate (manual trigger for testing/admin)
 */
import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '@app-prisma/prisma.service';

import { SubscriptionStatus } from '@prisma/client';

/** Subscription with the fields needed for billing period operations. */
export interface BillableSubscription {
  id: string;
  tenantId: string;
  planId: string;
  priceId: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  billingAnchor: number;
  cancelledAt?: Date | null;
  plan: { id: string; name: string; slug: string };
  price: { id: string; interval: string; amount: number; currency: string };
}

@Injectable()
export class BillingPeriodService {
  private readonly logger = new Logger(BillingPeriodService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find all active subscriptions whose billing period has ended.
   * These are ready for invoice generation.
   *
   * Excludes subscriptions that already have an invoice for
   * the current period (prevents double-billing).
   *
   * @returns Array of subscriptions ready to be invoiced
   */
  async findBillableSubscriptions(): Promise<BillableSubscription[]> {
    const now = new Date();

    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        status: {
          in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING],
        },
        currentPeriodEnd: { lte: now },
      },
      select: {
        id: true,
        tenantId: true,
        planId: true,
        priceId: true,
        status: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        billingAnchor: true,
        plan: { select: { id: true, name: true, slug: true } },
        price: {
          select: { id: true, interval: true, amount: true, currency: true },
        },
      },
    });

    // Filter out subscriptions that already have an invoice for this period
    const billable: BillableSubscription[] = [];

    for (const sub of subscriptions) {
      const existingInvoice = await this.prisma.invoice.findFirst({
        where: {
          subscriptionId: sub.id,
          periodStart: sub.currentPeriodStart,
          periodEnd: sub.currentPeriodEnd,
        },
        select: { id: true },
      });

      if (existingInvoice) {
        this.logger.debug(
          `Skipping ${sub.plan.slug} for tenant ${sub.tenantId}: invoice already exists for period`,
        );
        continue;
      }

      billable.push(sub);
    }

    return billable;
  }

  /**
   * Advance a subscription to its next billing period.
   *
   * Called after an invoice is successfully generated.
   * Updates currentPeriodStart and currentPeriodEnd.
   *
   * @param subscriptionId - Subscription to advance
   * @param currentPeriodEnd - The end of the period that was just billed
   * @param interval - MONTHLY or ANNUALLY
   */
  async advancePeriod(
    subscriptionId: string,
    currentPeriodEnd: Date,
    interval: string,
  ): Promise<void> {
    const nextPeriodStart = currentPeriodEnd;
    const nextPeriodEnd = this.calculateNextPeriodEnd(
      currentPeriodEnd,
      interval,
    );

    await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        currentPeriodStart: nextPeriodStart,
        currentPeriodEnd: nextPeriodEnd,
      },
    });

    this.logger.log(
      `Advanced subscription ${subscriptionId}: ${nextPeriodStart.toISOString()} → ${nextPeriodEnd.toISOString()}`,
    );
  }

  /**
   * Calculate the end of the next billing period.
   *
   * MONTHLY:  same day next month
   * ANNUALLY: same day next year
   */
  private calculateNextPeriodEnd(currentEnd: Date, interval: string): Date {
    const next = new Date(currentEnd);
    if (interval === 'ANNUALLY') {
      next.setFullYear(next.getFullYear() + 1);
    } else {
      next.setMonth(next.getMonth() + 1);
    }
    return next;
  }

  /**
   * Calculate proration factor for a mid-cycle cancellation.
   *
   * Returns a value between 0 and 1 representing the fraction
   * of the billing period that was used.
   *
   * Example:
   *   30-day period, cancelled on day 15 → 0.5 (50%)
   *   30-day period, cancelled on day 30 → 1.0 (100%, no proration)
   *   30-day period, cancelled on day 1  → 0.033 (~3%)
   *
   * @param periodStart - When the billing period started
   * @param periodEnd - When the billing period was scheduled to end
   * @param cancelledAt - When the tenant actually cancelled
   * @returns Proration factor (0 to 1)
   */
  calculateProration(
    periodStart: Date,
    periodEnd: Date,
    cancelledAt: Date,
  ): number {
    const totalMs = periodEnd.getTime() - periodStart.getTime();
    if (totalMs <= 0) return 1; // Edge case: invalid period

    const usedMs = cancelledAt.getTime() - periodStart.getTime();
    if (usedMs <= 0) return 0; // Cancelled before period started
    if (usedMs >= totalMs) return 1; // Cancelled after period ended (full charge)

    return usedMs / totalMs;
  }

  /**
   * Find cancelled subscriptions that need a final prorated invoice.
   *
   * These are subscriptions where:
   *   - cancelledAt is set (tenant requested cancellation)
   *   - No invoice exists for the current (partial) period
   *   - The subscription is still within its current period
   *     (cancelledAt < currentPeriodEnd)
   */
  async findCancelledSubscriptionsNeedingInvoice(): Promise<
    Array<BillableSubscription & { cancelledAt: Date }>
  > {
    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        cancelledAt: { not: null },
        status: {
          in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.CANCELLED],
        },
      },
      select: {
        id: true,
        tenantId: true,
        planId: true,
        priceId: true,
        status: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        billingAnchor: true,
        cancelledAt: true,
        plan: { select: { id: true, name: true, slug: true } },
        price: {
          select: { id: true, interval: true, amount: true, currency: true },
        },
      },
    });

    const needsInvoice: Array<BillableSubscription & { cancelledAt: Date }> =
      [];

    for (const sub of subscriptions) {
      if (!sub.cancelledAt) continue;

      // Check if a prorated invoice already exists for this period
      const existingInvoice = await this.prisma.invoice.findFirst({
        where: {
          subscriptionId: sub.id,
          periodStart: sub.currentPeriodStart,
          notes: { contains: 'prorated' },
        },
        select: { id: true },
      });

      if (existingInvoice) continue;

      needsInvoice.push(sub as BillableSubscription & { cancelledAt: Date });
    }

    return needsInvoice;
  }
}
