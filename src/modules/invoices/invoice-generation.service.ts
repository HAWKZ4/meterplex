/**
 * InvoiceGenerationService - Turns usage aggregates into invoices.
 *
 * Two generation modes:
 *   generate() - Full-period invoice (normal billing cycle close)
 *   generateProrated() - Partial-period invoice (mid-cycle cancellation)
 *
 * Full-period flow:
 *   1. Creates a DRAFT invoice
 *   2. Adds base subscription fee line item
 *   3. For each QUOTA (SOFT) and METERED feature:
 *      - Reads usage from usage_aggregates
 *      - Calculates overage using OverageCalculator
 *      - Adds a line item if there's usage to report
 *   4. Calculates totals
 *   5. Returns the complete invoice with all line items
 *
 * Called by:
 *   - BillingCronService (automatic, for expired periods)
 *   - POST /invoices/generate (manual trigger)
 */
import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '@app-prisma/prisma.service';

import {
  type BillableSubscription,
  BillingPeriodService,
} from './billing-period.service';
import { calculateOverage } from './overage-calculator';

@Injectable()
export class InvoiceGenerationService {
  private readonly logger = new Logger(InvoiceGenerationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly billingPeriod: BillingPeriodService,
  ) {}

  /**
   * Generate a DRAFT invoice for a subscription's billing period.
   *
   * @param subscription - The subscription to invoice (with plan and price)
   * @returns The created invoice with all line items
   */
  async generate(subscription: BillableSubscription) {
    const { tenantId, plan, price } = subscription;
    const periodStart = subscription.currentPeriodStart;
    const periodEnd = subscription.currentPeriodEnd;

    // Calculate the period key for usage aggregate lookup
    const periodKey = this.getPeriodKey(periodStart, price.interval);

    // Load entitlement snapshots for this subscription
    const snapshots = await this.prisma.entitlementSnapshot.findMany({
      where: { subscriptionId: subscription.id },
    });

    // Load usage aggregates for this tenant + period
    const aggregates = await this.prisma.usageAggregate.findMany({
      where: {
        tenantId,
        subscriptionId: subscription.id,
        periodKey,
      },
    });

    // Build a map of feature → usage amount for quick lookup
    const usageMap = new Map(
      aggregates.map((a) => [a.featureLookupKey, a.amount]),
    );

    // Build line items
    const lineItems: Array<{
      description: string;
      featureLookupKey: string | null;
      quantity: number;
      unitPriceMicroCents: number;
      amount: number;
      sortOrder: number;
    }> = [];

    // Line 1: Base subscription fee
    // Convert cents to micro-cents for consistent unitPrice format
    const baseFeeLabel = `${plan.name} plan - ${price.interval.toLowerCase()}`;
    lineItems.push({
      description: baseFeeLabel,
      featureLookupKey: null,
      quantity: 1,
      unitPriceMicroCents: price.amount * 100, // cents → micro-cents (1 cent = 100 micro-cents)
      amount: price.amount, // already in cents
      sortOrder: 0,
    });

    // Feature line items (QUOTA SOFT and METERED only)
    let sortOrder = 1;
    for (const snapshot of snapshots) {
      // Skip BOOLEAN features - no usage to bill
      if (snapshot.featureType === 'BOOLEAN') continue;

      // Skip HARD quota features - they block at limit, no overage
      if (snapshot.featureType === 'QUOTA' && snapshot.limitBehavior === 'HARD')
        continue;

      const used = usageMap.get(snapshot.featureLookupKey) ?? 0;
      const included = snapshot.includedAmount ?? snapshot.limit ?? 0;

      // Calculate overage
      const overage = calculateOverage(
        used,
        snapshot.includedAmount ?? snapshot.limit,
        snapshot.overagePrice,
      );

      // Build description
      const description = this.buildLineDescription(
        snapshot.featureLookupKey,
        used,
        included,
        snapshot.featureType,
      );

      lineItems.push({
        description,
        featureLookupKey: snapshot.featureLookupKey,
        quantity: overage.overageUnits,
        unitPriceMicroCents: overage.unitPriceMicroCents,
        amount: overage.totalCents,
        sortOrder: sortOrder++,
      });
    }

    // Calculate totals
    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
    const total = subtotal; // Tax added in a future phase

    // Create invoice + line items in a transaction
    const invoice = await this.prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.create({
        data: {
          tenantId,
          subscriptionId: subscription.id,
          currency: price.currency,
          subtotal,
          total,
          periodStart,
          periodEnd,
        },
      });

      if (lineItems.length > 0) {
        await tx.invoiceLineItem.createMany({
          data: lineItems.map((li) => ({
            invoiceId: inv.id,
            description: li.description,
            featureLookupKey: li.featureLookupKey,
            quantity: li.quantity,
            unitPriceMicroCents: li.unitPriceMicroCents,
            amount: li.amount,
            sortOrder: li.sortOrder,
          })),
        });
      }

      return inv;
    });

    // Fetch complete invoice with line items
    const result = await this.prisma.invoice.findUnique({
      where: { id: invoice.id },
      include: {
        lineItems: { orderBy: { sortOrder: 'asc' } },
      },
    });

    this.logger.log(
      `Invoice generated for ${plan.slug} (tenant ${tenantId}): ${lineItems.length} line items, total $${(total / 100).toFixed(2)} ${price.currency}`,
    );

    return result;
  }

  /**
   * Generate a prorated DRAFT invoice for a mid-cycle cancellation.
   *
   * The base fee is multiplied by the proration factor:
   *   30-day period, cancelled on day 15 → base fee × 0.5
   *
   * Usage-based charges (overage) are NOT prorated - the tenant
   * is billed for exactly what they used, regardless of when
   * they cancelled. Only the base subscription fee is prorated.
   *
   * @param subscription - The cancelled subscription
   * @param cancelledAt - When the cancellation occurred
   * @returns The created prorated invoice with line items
   */
  async generateProrated(
    subscription: BillableSubscription,
    cancelledAt: Date,
  ) {
    const { tenantId, plan, price } = subscription;
    const periodStart = subscription.currentPeriodStart;
    const periodEnd = subscription.currentPeriodEnd;

    // Calculate proration factor
    const prorationFactor = this.billingPeriod.calculateProration(
      periodStart,
      periodEnd,
      cancelledAt,
    );

    // Calculate the period key for usage aggregate lookup
    const periodKey = this.getPeriodKey(periodStart, price.interval);

    // Load entitlement snapshots
    const snapshots = await this.prisma.entitlementSnapshot.findMany({
      where: { subscriptionId: subscription.id },
    });

    // Load usage aggregates
    const aggregates = await this.prisma.usageAggregate.findMany({
      where: {
        tenantId,
        subscriptionId: subscription.id,
        periodKey,
      },
    });

    const usageMap = new Map(
      aggregates.map((a) => [a.featureLookupKey, a.amount]),
    );

    // Build line items
    const lineItems: Array<{
      description: string;
      featureLookupKey: string | null;
      quantity: number;
      unitPriceMicroCents: number;
      amount: number;
      sortOrder: number;
    }> = [];

    // Prorated base fee
    const proratedAmount = Math.round(price.amount * prorationFactor);
    const daysUsed = Math.round(
      (cancelledAt.getTime() - periodStart.getTime()) / (24 * 60 * 60 * 1000),
    );
    const totalDays = Math.round(
      (periodEnd.getTime() - periodStart.getTime()) / (24 * 60 * 60 * 1000),
    );

    lineItems.push({
      description: `${plan.name} plan - ${price.interval.toLowerCase()} (prorated: ${daysUsed}/${totalDays} days)`,
      featureLookupKey: null,
      quantity: 1,
      unitPriceMicroCents: proratedAmount * 100,
      amount: proratedAmount,
      sortOrder: 0,
    });

    // Usage-based line items - NOT prorated, billed for actual usage
    let sortOrder = 1;
    for (const snapshot of snapshots) {
      if (snapshot.featureType === 'BOOLEAN') continue;
      if (snapshot.featureType === 'QUOTA' && snapshot.limitBehavior === 'HARD')
        continue;

      const used = usageMap.get(snapshot.featureLookupKey) ?? 0;
      const included = snapshot.includedAmount ?? snapshot.limit ?? 0;

      const overage = calculateOverage(
        used,
        snapshot.includedAmount ?? snapshot.limit,
        snapshot.overagePrice,
      );

      const description = this.buildLineDescription(
        snapshot.featureLookupKey,
        used,
        included,
        snapshot.featureType,
      );

      lineItems.push({
        description,
        featureLookupKey: snapshot.featureLookupKey,
        quantity: overage.overageUnits,
        unitPriceMicroCents: overage.unitPriceMicroCents,
        amount: overage.totalCents,
        sortOrder: sortOrder++,
      });
    }

    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
    const total = subtotal;

    // Create invoice + line items
    const invoice = await this.prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.create({
        data: {
          tenantId,
          subscriptionId: subscription.id,
          currency: price.currency,
          subtotal,
          total,
          periodStart,
          periodEnd: cancelledAt, // Prorated period ends at cancellation
          notes: `Prorated invoice - cancelled on ${cancelledAt.toISOString().split('T')[0]} (${daysUsed}/${totalDays} days used)`,
        },
      });

      if (lineItems.length > 0) {
        await tx.invoiceLineItem.createMany({
          data: lineItems.map((li) => ({
            invoiceId: inv.id,
            description: li.description,
            featureLookupKey: li.featureLookupKey,
            quantity: li.quantity,
            unitPriceMicroCents: li.unitPriceMicroCents,
            amount: li.amount,
            sortOrder: li.sortOrder,
          })),
        });
      }

      return inv;
    });

    const result = await this.prisma.invoice.findUnique({
      where: { id: invoice.id },
      include: {
        lineItems: { orderBy: { sortOrder: 'asc' } },
      },
    });

    this.logger.log(
      `Prorated invoice generated for ${plan.slug} (tenant ${tenantId}): ${daysUsed}/${totalDays} days, total $${(total / 100).toFixed(2)} ${price.currency}`,
    );

    return result;
  }

  /**
   * Build a human-readable description for a feature line item.
   */
  private buildLineDescription(
    featureKey: string,
    used: number,
    included: number,
    featureType: string,
  ): string {
    const featureName = featureKey
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    if (featureType === 'METERED') {
      return `${featureName} (${used.toLocaleString()} used, ${included.toLocaleString()} included)`;
    }

    // QUOTA SOFT
    return `${featureName} overage (${used.toLocaleString()} used, ${included.toLocaleString()} included)`;
  }

  /**
   * Get the period key for usage aggregate lookup.
   * Matches the key format used by the aggregation consumer.
   */
  private getPeriodKey(periodStart: Date, interval: string): string {
    const year = periodStart.getUTCFullYear();
    const month = periodStart.getUTCMonth();

    if (interval === 'ANNUALLY') {
      return `${year}`;
    }
    return `${year}-${String(month + 1).padStart(2, '0')}`;
  }
}
