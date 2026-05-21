/**
 * StripePaymentAdapter - Real Stripe SDK integration.
 *
 * Extends PaymentProviderBase. Uses the official Stripe Node.js SDK.
 *
 * Requires env vars:
 *   STRIPE_SECRET_KEY: sk_test_... or sk_live_...
 *   STRIPE_WEBHOOK_SECRET: whsec_...
 *
 * All amounts in smallest currency unit (cents for USD).
 * Stripe uses the same convention - no conversion needed.
 */
import { Injectable } from '@nestjs/common';

import Stripe from 'stripe';

import {
  type CreatePaymentIntentResult,
  PaymentProviderBase,
  type PaymentStatusResult,
  type RefundResult,
  type WebhookEvent,
} from '../payment-provider.base';

type StripeClient = InstanceType<typeof Stripe>;

/** Map Stripe payment intent status to our internal status. */
function mapStripeStatus(stripeStatus: string): PaymentStatusResult['status'] {
  switch (stripeStatus) {
    case 'succeeded':
      return 'succeeded';
    case 'requires_payment_method':
    case 'requires_confirmation':
    case 'requires_action':
      return 'requires_action';
    case 'canceled':
      return 'cancelled';
    case 'processing':
      return 'pending';
    default:
      return 'failed';
  }
}

/** Map Stripe status specifically for createPaymentIntent (no 'cancelled' possible). */
function mapStripeCreateStatus(
  stripeStatus: string,
): CreatePaymentIntentResult['status'] {
  switch (stripeStatus) {
    case 'succeeded':
      return 'succeeded';
    case 'requires_payment_method':
    case 'requires_confirmation':
    case 'requires_action':
      return 'requires_action';
    case 'processing':
      return 'pending';
    default:
      return 'failed';
  }
}

/** Map Stripe event type to our normalized internal type. */
function mapStripeEventType(stripeType: string): WebhookEvent['type'] | null {
  switch (stripeType) {
    case 'payment_intent.succeeded':
      return 'payment.succeeded';
    case 'payment_intent.payment_failed':
      return 'payment.failed';
    case 'payment_intent.requires_action':
      return 'payment.requires_action';
    case 'charge.refunded':
      return 'refund.succeeded';
    default:
      return null;
  }
}

@Injectable()
export class StripePaymentAdapter extends PaymentProviderBase {
  protected readonly providerName = 'stripe';
  private readonly stripe: StripeClient;
  private readonly webhookSecret: string;

  constructor() {
    super();

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }

    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? '';
    if (!this.webhookSecret) {
      this.logger.warn(
        'STRIPE_WEBHOOK_SECRET not set - webhook signature validation will fail',
      );
    }

    this.stripe = new Stripe(secretKey);

    this.logger.log('Initialized');
  }

  async createPaymentIntent(
    amount: number,
    currency: string,
    metadata: Record<string, string>,
  ): Promise<CreatePaymentIntentResult> {
    const sanitized = this.sanitizeMetadata(metadata);

    const intent = await this.stripe.paymentIntents.create({
      amount,
      currency,
      metadata: sanitized,
      automatic_payment_methods: { enabled: true },
    });

    this.logPaymentEvent(
      'created',
      intent.id,
      amount,
      currency,
      `invoice: ${metadata.invoiceId ?? 'unknown'}`,
    );

    return {
      providerPaymentId: intent.id,
      status: mapStripeCreateStatus(intent.status),
      clientSecret: intent.client_secret,
    };
  }

  async getPaymentStatus(
    providerPaymentId: string,
  ): Promise<PaymentStatusResult> {
    const intent = await this.stripe.paymentIntents.retrieve(providerPaymentId);

    return {
      providerPaymentId: intent.id,
      status: mapStripeStatus(intent.status),
      amount: intent.amount,
      currency: intent.currency,
      failureReason: intent.last_payment_error?.message ?? null,
    };
  }

  async refundPayment(
    providerPaymentId: string,
    amount?: number | null,
  ): Promise<RefundResult> {
    const refund = await this.stripe.refunds.create({
      payment_intent: providerPaymentId,
      ...(amount && { amount }),
    });

    this.logPaymentEvent(
      'refunded',
      refund.id,
      refund.amount,
      refund.currency,
      `original: ${providerPaymentId}`,
    );

    return {
      providerRefundId: refund.id,
      status: refund.status === 'succeeded' ? 'succeeded' : 'pending',
      amount: refund.amount,
      currency: refund.currency,
    };
  }

  async constructWebhookEvent(
    rawBody: Buffer,
    signature: string,
  ): Promise<WebhookEvent> {
    const event = this.stripe.webhooks.constructEvent(
      rawBody,
      signature,
      this.webhookSecret,
    );

    const mappedType = mapStripeEventType(event.type);
    if (!mappedType) {
      throw new Error(`Unhandled Stripe event type: ${event.type}`);
    }

    const data = event.data.object as Record<string, any>;

    return {
      providerEventId: event.id,
      type: mappedType,
      providerPaymentId: data.id,
      amount: data.amount ?? 0,
      currency: data.currency ?? 'usd',
      failureReason: data.last_payment_error?.message ?? null,
      rawPayload: event as unknown as Record<string, unknown>,
    };
  }
}
