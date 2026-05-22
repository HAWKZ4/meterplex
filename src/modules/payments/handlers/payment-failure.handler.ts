/**
 * PaymentFailureHandler - Handles payment.failed webhook events.
 *
 * Flow:
 *   1. Find the payment attempt by providerPaymentId
 *   2. Update attempt status to FAILED with reason
 *   3. If retries remain: schedule next retry
 *   4. If max retries exceeded: transition subscription to PAST_DUE
 */
import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '@app-prisma/prisma.service';

import { Prisma } from '@prisma/client';

import { PaymentIntentService } from '../payment-intent.service';
import type { WebhookEvent } from '../payment-provider.base';

/** Max total attempts (including first attempt). */
const MAX_ATTEMPTS = 3;

@Injectable()
export class PaymentFailureHandler {
  private readonly logger = new Logger(PaymentFailureHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentIntentService: PaymentIntentService,
  ) {}

  /**
   * Handle a failed payment event.
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

    // Update payment attempt status to FAILED
    await this.prisma.paymentAttempt.update({
      where: { id: attempt.id },
      data: {
        status: 'FAILED',
        failureReason: event.failureReason ?? 'Unknown failure',
        providerResponse: event.rawPayload as unknown as Prisma.InputJsonValue,
      },
    });

    this.logger.warn(
      `Payment failed for invoice ${attempt.invoice.invoiceNumber}: ${event.failureReason ?? 'Unknown reason'} (attempt ${attempt.attemptNumber + 1}/${MAX_ATTEMPTS})`,
    );

    // Check if retries remain
    if (attempt.attemptNumber + 1 < MAX_ATTEMPTS) {
      // Schedule retry
      await this.paymentIntentService.scheduleRetry(attempt.id);
      this.logger.log(
        `Retry scheduled for invoice ${attempt.invoice.invoiceNumber}`,
      );
    } else {
      // Max retries exceeded - transition subscription to PAST_DUE
      await this.prisma.subscription.update({
        where: { id: attempt.invoice.subscriptionId },
        data: { status: 'PAST_DUE' },
      });

      this.logger.error(
        `Max retries exceeded for invoice ${attempt.invoice.invoiceNumber} - subscription moved to PAST_DUE`,
      );
    }
  }
}
