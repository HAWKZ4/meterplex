/**
 * FakePaymentAdapter - Simulates payment provider for development/testing.
 *
 * Extends PaymentProviderBase. No real charges, no external API calls.
 *
 * Behavior:
 *   - createPaymentIntent: succeeds or fails based on FAKE_PAYMENT_SUCCESS_RATE
 *   - getPaymentStatus: returns the status set at creation
 *   - refundPayment: always succeeds
 *   - constructWebhookEvent: parses body directly, no signature validation
 *
 * Configurable via env:
 *   FAKE_PAYMENT_SUCCESS_RATE: percentage that succeed (default 90)
 */
import { Injectable } from '@nestjs/common';

import { randomUUID } from 'node:crypto';

import {
  type CreatePaymentIntentResult,
  PaymentProviderBase,
  type PaymentStatusResult,
  type RefundResult,
  type WebhookEvent,
} from '../payment-provider.base';

@Injectable()
export class FakePaymentAdapter extends PaymentProviderBase {
  protected readonly providerName = 'fake';
  private readonly successRate: number;

  /** In-memory store of fake payments for status lookups. */
  private readonly payments = new Map<
    string,
    { status: string; amount: number; currency: string }
  >();

  constructor() {
    super();
    this.successRate = parseInt(
      process.env.FAKE_PAYMENT_SUCCESS_RATE ?? '90',
      10,
    );
    this.logger.log(`Initialized (success rate: ${this.successRate}%)`);
  }

  async createPaymentIntent(
    amount: number,
    currency: string,
    metadata: Record<string, string>,
  ): Promise<CreatePaymentIntentResult> {
    const providerPaymentId = `fake_pi_${randomUUID().replace(/-/g, '').substring(0, 24)}`;
    const succeeds = Math.random() * 100 < this.successRate;
    const status = succeeds ? 'succeeded' : 'failed';

    this.payments.set(providerPaymentId, { status, amount, currency });

    this.logPaymentEvent(
      status === 'succeeded' ? 'created (success)' : 'created (will fail)',
      providerPaymentId,
      amount,
      currency,
      `invoice: ${metadata.invoiceId ?? 'unknown'}`,
    );

    return {
      providerPaymentId,
      status: status as 'succeeded' | 'failed',
      clientSecret: null,
    };
  }

  async getPaymentStatus(
    providerPaymentId: string,
  ): Promise<PaymentStatusResult> {
    const payment = this.payments.get(providerPaymentId);

    if (!payment) {
      return {
        providerPaymentId,
        status: 'failed',
        amount: 0,
        currency: 'usd',
        failureReason: 'Payment not found (fake adapter - in-memory only)',
      };
    }

    return {
      providerPaymentId,
      status: payment.status as PaymentStatusResult['status'],
      amount: payment.amount,
      currency: payment.currency,
      failureReason:
        payment.status === 'failed' ? 'Simulated payment failure' : null,
    };
  }

  async refundPayment(
    providerPaymentId: string,
    amount?: number | null,
  ): Promise<RefundResult> {
    const payment = this.payments.get(providerPaymentId);
    const refundAmount = amount ?? payment?.amount ?? 0;
    const providerRefundId = `fake_re_${randomUUID().replace(/-/g, '').substring(0, 24)}`;

    this.logPaymentEvent(
      'refunded',
      providerRefundId,
      refundAmount,
      payment?.currency ?? 'usd',
      `original payment: ${providerPaymentId}`,
    );

    return {
      providerRefundId,
      status: 'succeeded',
      amount: refundAmount,
      currency: payment?.currency ?? 'usd',
    };
  }

  async constructWebhookEvent(
    rawBody: Buffer,
    signature: string,
  ): Promise<WebhookEvent> {
    // Fake adapter: parse body directly, no real signature validation
    this.logger.debug(
      `Webhook received (signature ignored in fake mode: ${signature.substring(0, 10)}...)`,
    );
    const payload = JSON.parse(rawBody.toString());

    return {
      providerEventId:
        payload.id ??
        `fake_evt_${randomUUID().replace(/-/g, '').substring(0, 24)}`,
      type: payload.type ?? 'payment.succeeded',
      providerPaymentId:
        payload.providerPaymentId ?? payload.data?.paymentIntentId ?? 'unknown',
      amount: payload.amount ?? 0,
      currency: payload.currency ?? 'usd',
      failureReason: payload.failureReason ?? null,
      rawPayload: payload,
    };
  }
}
