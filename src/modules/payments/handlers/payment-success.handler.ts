/**
 * PaymentSuccessHandler - Handles payment.succeeded webhook events.
 *
 * Flow:
 *   1. Find the payment attempt by providerPaymentId
 *   2. Update attempt status to SUCCEEDED
 *   3. Mark the invoice as PAID (creates ledger PAYMENT entry)
 *   4. Advance the subscription to the next billing period
 *
 * Idempotent: if invoice is already PAID, skip silently.
 *
 * Transaction note: markPaid uses its own Prisma transaction internally.
 * advancePeriod is a separate call - if it fails, the invoice is still
 * PAID (correct state) and the billing cron catches un-advanced periods
 * on the next daily tick. This is an acceptable trade-off vs forcing
 * all operations into a single transaction (which would require
 * refactoring markPaid to accept a transaction client).
 */
import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '@app-prisma/prisma.service';

import { BillingPeriodService } from '@modules/invoices/billing-period.service';
import { InvoiceLifecycleService } from '@modules/invoices/invoice-lifecycle.service';

import { Prisma } from '@prisma/client';

import type { WebhookEvent } from '../payment-provider.base';

@Injectable()
export class PaymentSuccessHandler {
  private readonly logger = new Logger(PaymentSuccessHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly invoiceLifecycle: InvoiceLifecycleService,
    private readonly billingPeriod: BillingPeriodService,
  ) {}

  /**
   * Handle a successful payment event.
   */
  async handle(event: WebhookEvent): Promise<void> {
    // Find the payment attempt
    const attempt = await this.prisma.paymentAttempt.findUnique({
      where: { providerPaymentId: event.providerPaymentId },
      include: {
        invoice: {
          select: {
            id: true,
            tenantId: true,
            subscriptionId: true,
            status: true,
            invoiceNumber: true,
          },
        },
      },
    });

    if (!attempt) {
      this.logger.warn(
        `Payment attempt not found for provider ID: ${event.providerPaymentId}`,
      );
      return;
    }

    // Idempotent: if invoice is already PAID, skip
    if (attempt.invoice.status === 'PAID') {
      this.logger.debug(
        `Invoice ${attempt.invoice.invoiceNumber} already PAID - skipping`,
      );
      return;
    }

    // Update payment attempt status
    await this.prisma.paymentAttempt.update({
      where: { id: attempt.id },
      data: {
        status: 'SUCCEEDED',
        providerResponse: event.rawPayload as unknown as Prisma.InputJsonValue,
      },
    });

    // Mark invoice as PAID (creates ledger PAYMENT entry)
    await this.invoiceLifecycle.markPaid(
      attempt.invoiceId,
      attempt.tenantId,
      event.providerPaymentId,
    );

    // Advance subscription to next billing period
    // Wrapped in try/catch - if this fails, invoice is still PAID (correct)
    // and the billing cron will catch the un-advanced period on the next tick.
    try {
      const subscription = await this.prisma.subscription.findUnique({
        where: { id: attempt.invoice.subscriptionId },
        select: {
          id: true,
          currentPeriodEnd: true,
          price: { select: { interval: true } },
        },
      });

      if (subscription) {
        await this.billingPeriod.advancePeriod(
          subscription.id,
          subscription.currentPeriodEnd,
          subscription.price.interval,
        );
      }
    } catch (error) {
      // Non-critical: billing cron retries un-advanced periods daily
      this.logger.error(
        `Failed to advance period for invoice ${attempt.invoice.invoiceNumber}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    this.logger.log(
      `Payment succeeded for invoice ${attempt.invoice.invoiceNumber}: ${event.providerPaymentId}`,
    );
  }
}
