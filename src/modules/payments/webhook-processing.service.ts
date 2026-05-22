/**
 * WebhookProcessingService - Validates, deduplicates, and routes webhook events.
 *
 * Flow:
 *   1. Validate signature via payment adapter
 *   2. Check deduplication (providerEventId UNIQUE in webhook_events)
 *   3. Persist raw event to webhook_events table
 *   4. Route to handler by event type
 *   5. Update webhook_events status (PROCESSED or FAILED)
 *
 * Deduplication is two-layer:
 *   1. DB UNIQUE on provider_event_id - catches duplicates at insert
 *   2. State check in handler - if invoice is already PAID, skip
 */
import { Inject, Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '@app-prisma/prisma.service';

import { isUniqueConstraintError } from '@common/utils/prisma-errors';

import { Prisma } from '@prisma/client';

import { PaymentFailureHandler } from './handlers/payment-failure.handler';
import { PaymentSuccessHandler } from './handlers/payment-success.handler';
import { PAYMENT_PROVIDER, PaymentProviderBase } from './payment-provider.base';

@Injectable()
export class WebhookProcessingService {
  private readonly logger = new Logger(WebhookProcessingService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_PROVIDER)
    private readonly paymentProvider: PaymentProviderBase,
    private readonly successHandler: PaymentSuccessHandler,
    private readonly failureHandler: PaymentFailureHandler,
  ) {}

  /**
   * Process a raw webhook payload.
   *
   * @param rawBody - Raw request body bytes
   * @param signature - Provider signature header
   * @param provider - Provider name ('stripe', 'fake')
   */
  async processWebhook(
    rawBody: Buffer,
    signature: string,
    provider: string,
  ): Promise<void> {
    // 1. Validate and parse via adapter
    let event;
    try {
      event = await this.paymentProvider.constructWebhookEvent(
        rawBody,
        signature,
      );
    } catch (error) {
      this.logger.error(
        `Webhook signature validation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return;
    }

    // 2. Deduplicate - persist to webhook_events (UNIQUE on provider_event_id)
    let webhookEventId: string;
    try {
      const webhookEvent = await this.prisma.webhookEvent.create({
        data: {
          providerEventId: event.providerEventId,
          provider,
          eventType: event.type,
          rawPayload: event.rawPayload as unknown as Prisma.InputJsonValue,
          status: 'PROCESSING',
        },
      });
      webhookEventId = webhookEvent.id;
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        this.logger.debug(
          `Duplicate webhook skipped: ${event.providerEventId}`,
        );
        return;
      }
      throw error;
    }

    // 3. Route to handler by event type
    try {
      switch (event.type) {
        case 'payment.succeeded':
          await this.successHandler.handle(event);
          break;

        case 'payment.failed':
          await this.failureHandler.handle(event);
          break;

        case 'payment.requires_action':
          this.logger.warn(
            `Payment requires action: ${event.providerPaymentId} - manual intervention needed`,
          );
          break;

        case 'refund.succeeded':
          this.logger.log(`Refund succeeded: ${event.providerPaymentId}`);
          // Refund handling comes with Phase 5.5 / Phase 6
          break;

        default:
          this.logger.warn(`Unhandled webhook event type: ${event.type}`);
          await this.prisma.webhookEvent.update({
            where: { id: webhookEventId },
            data: { status: 'SKIPPED', processedAt: new Date() },
          });
          return;
      }

      // 4. Mark as processed
      await this.prisma.webhookEvent.update({
        where: { id: webhookEventId },
        data: { status: 'PROCESSED', processedAt: new Date() },
      });

      this.logger.log(
        `Webhook processed: ${event.providerEventId} (${event.type})`,
      );
    } catch (error) {
      // 5. Mark as failed
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      await this.prisma.webhookEvent.update({
        where: { id: webhookEventId },
        data: {
          status: 'FAILED',
          processingError: errorMessage,
          processedAt: new Date(),
        },
      });

      this.logger.error(
        `Webhook processing failed for ${event.providerEventId}: ${errorMessage}`,
      );
    }
  }
}
