/**
 * WebhookController - Receives webhook events from payment providers.
 *
 * Single endpoint: POST /api/v1/webhooks/stripe
 *
 * NO authentication guard - Stripe doesn't send JWT tokens.
 * Signature validation IS the authentication (via the adapter).
 *
 * Critical: uses raw body (not parsed JSON) because Stripe
 * signature validation requires the exact bytes as received.
 *
 * Flow:
 *   1. Receive raw body + signature header
 *   2. Validate signature via adapter
 *   3. Check deduplication (provider event ID)
 *   4. Route to handler by event type
 *   5. Return 200 immediately
 */
import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiExcludeEndpoint,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import type { Request, Response } from 'express';

import { WebhookProcessingService } from './webhook-processing.service';

@ApiTags('Webhooks')
@Controller({
  path: 'webhooks',
  version: '1',
})
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly webhookProcessing: WebhookProcessingService) {}

  /**
   * POST /api/v1/webhooks/stripe
   *
   * Receives Stripe webhook events.
   * No auth guard - signature validation is the authentication.
   * Returns 200 immediately - Stripe retries on non-2xx.
   */
  @Post('stripe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive Stripe webhook events' })
  @ApiHeader({ name: 'stripe-signature', required: true })
  @ApiResponse({ status: 200, description: 'Webhook received' })
  @ApiResponse({ status: 400, description: 'Invalid signature or payload' })
  async handleStripeWebhook(
    @Req() req: Request,
    @Headers('stripe-signature') signature: string,
    @Res() res: Response,
  ) {
    // Return 200 immediately - don't make Stripe wait
    res.status(200).json({ received: true });

    // Process asynchronously (fire-and-forget)
    try {
      const rawBody = (req as any).rawBody as Buffer;

      if (!rawBody) {
        this.logger.error(
          'Raw body not available - ensure raw body parser is configured',
        );
        return;
      }

      await this.webhookProcessing.processWebhook(
        rawBody,
        signature ?? '',
        'stripe',
      );
    } catch (error) {
      this.logger.error(
        `Webhook processing failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * POST /api/v1/webhooks/fake
   *
   * Test endpoint for the fake payment adapter.
   * Accepts JSON body directly (no signature validation).
   * Only available when PAYMENT_PROVIDER=fake.
   */
  @Post('fake')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async handleFakeWebhook(@Req() req: Request, @Res() res: Response) {
    res.status(200).json({ received: true });

    try {
      const body = Buffer.from(JSON.stringify(req.body));
      await this.webhookProcessing.processWebhook(
        body,
        'fake-signature',
        'fake',
      );
    } catch (error) {
      this.logger.error(
        `Fake webhook processing failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
