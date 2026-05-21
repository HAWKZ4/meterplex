/**
 * PaymentProviderBase - Abstract base class for all payment providers.
 *
 * Every payment adapter (Stripe, Adyen, Paddle, Razorpay, etc.)
 * extends this class and implements the abstract methods.
 *
 * The billing system depends on this base class, not on any specific
 * provider. Swapping providers means:
 *   1. Create a new class extending PaymentProviderBase
 *   2. Implement the 4 abstract methods
 *   3. Add a case to the factory in payments.module.ts
 *
 * Shared utilities (amount formatting, metadata sanitization, logging)
 * live here and are inherited by all adapters.
 */
import { Logger } from '@nestjs/common';

// =============================================================
// Result types - shared across all providers
// =============================================================

/** Result of creating a payment intent. */
export interface CreatePaymentIntentResult {
  /** Provider-specific payment intent ID (e.g., pi_... for Stripe) */
  providerPaymentId: string;
  /** Current status from the provider */
  status: 'pending' | 'requires_action' | 'succeeded' | 'failed';
  /** Client secret for frontend confirmation (provider-specific, null if not applicable) */
  clientSecret?: string | null;
}

/** Result of checking payment status. */
export interface PaymentStatusResult {
  providerPaymentId: string;
  status: 'pending' | 'requires_action' | 'succeeded' | 'failed' | 'cancelled';
  /** Amount in smallest currency unit (cents) */
  amount: number;
  currency: string;
  /** Provider-specific failure reason (null if not failed) */
  failureReason?: string | null;
}

/** Result of a refund operation. */
export interface RefundResult {
  providerRefundId: string;
  status: 'pending' | 'succeeded' | 'failed';
  amount: number;
  currency: string;
}

/** Parsed webhook event from any provider, normalized to our internal types. */
export interface WebhookEvent {
  /** Provider event ID (used for deduplication) */
  providerEventId: string;
  /** Event type mapped to our internal types */
  type:
    | 'payment.succeeded'
    | 'payment.failed'
    | 'payment.requires_action'
    | 'refund.succeeded';
  /** Provider payment intent ID this event relates to */
  providerPaymentId: string;
  /** Amount in cents */
  amount: number;
  currency: string;
  /** Provider-specific failure reason */
  failureReason?: string | null;
  /** Raw event payload for storage and debugging */
  rawPayload: Record<string, unknown>;
}

// =============================================================
// Abstract base class
// =============================================================

/**
 * DI token for injecting the payment provider.
 * Used with @Inject(PAYMENT_PROVIDER) in services.
 */
export const PAYMENT_PROVIDER = 'PAYMENT_PROVIDER';

export abstract class PaymentProviderBase {
  /** Provider name for logging (e.g., 'stripe', 'fake', 'adyen'). */
  protected abstract readonly providerName: string;
  protected readonly logger: Logger;

  constructor() {
    this.logger = new Logger(this.constructor.name);
  }

  // =============================================================
  // Abstract methods - every provider MUST implement these
  // =============================================================

  /**
   * Create a payment intent for an invoice.
   *
   * @param amount - Amount in smallest currency unit (cents for USD)
   * @param currency - ISO 4217 currency code (e.g., 'usd')
   * @param metadata - Invoice ID, tenant ID, etc. for reconciliation
   * @returns Payment intent details with provider-specific ID
   */
  abstract createPaymentIntent(
    amount: number,
    currency: string,
    metadata: Record<string, string>,
  ): Promise<CreatePaymentIntentResult>;

  /**
   * Get the current status of a payment.
   *
   * @param providerPaymentId - Provider-specific payment intent ID
   * @returns Current payment status with amount and failure reason
   */
  abstract getPaymentStatus(
    providerPaymentId: string,
  ): Promise<PaymentStatusResult>;

  /**
   * Refund a payment (full or partial).
   *
   * @param providerPaymentId - Provider payment intent ID to refund
   * @param amount - Amount to refund in cents (null = full refund)
   * @returns Refund details with provider-specific refund ID
   */
  abstract refundPayment(
    providerPaymentId: string,
    amount?: number | null,
  ): Promise<RefundResult>;

  /**
   * Validate and parse a webhook event from the provider.
   * MUST validate the signature before parsing - reject invalid signatures.
   *
   * @param rawBody - Raw request body (bytes, not parsed JSON)
   * @param signature - Provider signature header value
   * @returns Parsed and validated webhook event in normalized format
   * @throws Error if signature is invalid or event type is unhandled
   */
  abstract constructWebhookEvent(
    rawBody: Buffer,
    signature: string,
  ): Promise<WebhookEvent>;

  // =============================================================
  // Shared utilities - inherited by all providers
  // =============================================================

  /**
   * Format an amount in cents to a human-readable string.
   * Used in log messages across all adapters.
   *
   * @param amountCents - Amount in smallest currency unit
   * @param currency - ISO 4217 currency code
   * @returns Formatted string: "$99.00 usd"
   */
  protected formatAmount(amountCents: number, currency: string): string {
    return `$${(amountCents / 100).toFixed(2)} ${currency}`;
  }

  /**
   * Sanitize metadata before sending to provider.
   * Strips null/undefined values and converts all values to strings.
   * Most providers require string-only metadata values.
   *
   * @param metadata - Raw metadata object
   * @returns Sanitized metadata with string values only
   */
  protected sanitizeMetadata(
    metadata: Record<string, string | null | undefined>,
  ): Record<string, string> {
    const sanitized: Record<string, string> = {};
    for (const [key, value] of Object.entries(metadata)) {
      if (value != null) {
        sanitized[key] = String(value);
      }
    }
    return sanitized;
  }

  /**
   * Log a payment event with consistent formatting across all providers.
   *
   * @param action - What happened (created, succeeded, failed, refunded)
   * @param providerPaymentId - Provider-specific payment ID
   * @param amount - Amount in cents
   * @param currency - Currency code
   * @param extra - Additional context for the log line
   */
  protected logPaymentEvent(
    action: string,
    providerPaymentId: string,
    amount: number,
    currency: string,
    extra?: string,
  ): void {
    const msg = `[${this.providerName}] Payment ${action}: ${providerPaymentId} (${this.formatAmount(amount, currency)})`;
    this.logger.log(extra ? `${msg} - ${extra}` : msg);
  }
}
