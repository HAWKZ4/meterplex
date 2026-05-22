/**
 * PaymentIntentService - Creates payment intents when invoices are finalized.
 *
 * Flow:
 *   1. Invoice finalized → this service is called
 *   2. Creates a payment intent via the adapter (Stripe or fake)
 *   3. Records a payment_attempts row with status PENDING
 *   4. If the adapter returns immediate success (fake adapter),
 *      triggers the success handler directly
 *
 * Retry flow (called by PaymentFailureHandler):
 *   1. Previous attempt failed
 *   2. Creates a new payment intent with incremented attemptNumber
 *   3. Links to previous attempt via retryOf
 *
 * The service doesn't wait for webhooks - it creates the intent
 * and returns. The webhook handler processes the async result.
 */
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';

import { PrismaService } from '@app-prisma/prisma.service';

import { ERRORS } from '@common/constants';

import { PAYMENT_PROVIDER, PaymentProviderBase } from './payment-provider.base';

/** Max payment retries before giving up. */
const MAX_RETRIES = 3;

/** Retry delays in milliseconds: day 1, day 3, day 7. */
const RETRY_DELAYS_MS = [
  1 * 24 * 60 * 60 * 1000,
  3 * 24 * 60 * 60 * 1000,
  7 * 24 * 60 * 60 * 1000,
];

@Injectable()
export class PaymentIntentService {
  private readonly logger = new Logger(PaymentIntentService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_PROVIDER)
    private readonly paymentProvider: PaymentProviderBase,
  ) {}

  /**
   * Create a payment intent for a finalized invoice.
   *
   * @param invoiceId - Invoice UUID
   * @param tenantId - Tenant UUID
   * @param amount - Amount in cents
   * @param currency - ISO 4217 currency code
   * @returns The created payment attempt record
   */
  async createForInvoice(
    invoiceId: string,
    tenantId: string,
    amount: number,
    currency: string,
  ) {
    // Verify invoice is FINALIZED
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId, status: 'FINALIZED' },
      select: { id: true, invoiceNumber: true },
    });

    if (!invoice) {
      throw new BadRequestException(ERRORS.PAYMENT.INVOICE_NOT_FINALIZED);
    }

    // Check for existing successful payment
    const existingSuccess = await this.prisma.paymentAttempt.findFirst({
      where: { invoiceId, status: 'SUCCEEDED' },
      select: { id: true },
    });

    if (existingSuccess) {
      throw new BadRequestException(ERRORS.PAYMENT.ALREADY_SUCCEEDED);
    }

    // Count previous attempts for this invoice
    const previousAttempts = await this.prisma.paymentAttempt.count({
      where: { invoiceId },
    });

    if (previousAttempts >= MAX_RETRIES) {
      throw new BadRequestException(
        ERRORS.PAYMENT.MAX_RETRIES_EXCEEDED(invoiceId),
      );
    }

    // Create payment intent via provider adapter
    const result = await this.paymentProvider.createPaymentIntent(
      amount,
      currency,
      {
        invoiceId,
        invoiceNumber: invoice.invoiceNumber ?? '',
        tenantId,
      },
    );

    // Find the last failed attempt for retry linking
    const lastFailed = await this.prisma.paymentAttempt.findFirst({
      where: { invoiceId, status: 'FAILED' },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    // Record the payment attempt
    const attempt = await this.prisma.paymentAttempt.create({
      data: {
        invoiceId,
        tenantId,
        providerPaymentId: result.providerPaymentId,
        provider: process.env.PAYMENT_PROVIDER ?? 'fake',
        status: this.mapInitialStatus(result.status),
        amount,
        currency,
        attemptNumber: previousAttempts,
        retryOf: lastFailed?.id ?? null,
      },
    });

    this.logger.log(
      `Payment intent created: ${result.providerPaymentId} for invoice ${invoice.invoiceNumber} (attempt ${previousAttempts + 1}/${MAX_RETRIES})`,
    );

    return {
      ...attempt,
      providerStatus: result.status,
      clientSecret: result.clientSecret,
    };
  }

  /**
   * Schedule a retry for a failed payment.
   *
   * @param paymentAttemptId - The failed payment attempt
   * @returns The new payment attempt, or null if max retries exceeded
   */
  async scheduleRetry(paymentAttemptId: string) {
    const failed = await this.prisma.paymentAttempt.findUnique({
      where: { id: paymentAttemptId },
      include: {
        invoice: {
          select: {
            id: true,
            tenantId: true,
            total: true,
            currency: true,
            invoiceNumber: true,
          },
        },
      },
    });

    if (!failed || failed.status !== 'FAILED') return null;

    const delayMs =
      RETRY_DELAYS_MS[failed.attemptNumber] ??
      RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
    const nextRetryAt = new Date(Date.now() + delayMs);

    // Update the failed attempt with retry schedule
    await this.prisma.paymentAttempt.update({
      where: { id: paymentAttemptId },
      data: { nextRetryAt },
    });

    this.logger.log(
      `Retry scheduled for payment ${paymentAttemptId}: attempt ${failed.attemptNumber + 2}/${MAX_RETRIES} at ${nextRetryAt.toISOString()}`,
    );

    return { nextRetryAt, attemptNumber: failed.attemptNumber + 1 };
  }

  /**
   * Map the provider's initial status to our enum.
   */
  private mapInitialStatus(
    providerStatus: string,
  ): 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REQUIRES_ACTION' {
    switch (providerStatus) {
      case 'succeeded':
        return 'SUCCEEDED';
      case 'failed':
        return 'FAILED';
      case 'requires_action':
        return 'REQUIRES_ACTION';
      default:
        return 'PENDING';
    }
  }
}
