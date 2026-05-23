/**
 * UsageValidationConsumer - Reads usage.raw, validates, publishes to usage.validated.
 *
 * Validation checks (re-validated at consumption time because state can change):
 *   1. Event has required fields (id, tenantId, feature, amount, timestamp)
 *   2. eventId is a valid UUID format (idempotency key integrity)
 *   3. Tenant exists and is ACTIVE (not SUSPENDED or CANCELLED)
 *   4. Timestamp is within acceptable window (not future >5min, not older than 7 days)
 *   5. Event is not a duplicate (event_id already processed)
 *   6. Tenant has an active subscription including this feature
 *   7. Feature type is consumable (QUOTA or METERED, not BOOLEAN)
 *   8. Amount is a positive integer matching the feature type requirements
 *
 * On success: publishes enriched event to usage.validated
 * On failure: publishes to usage.dead-letter with failure reason
 *
 * Why re-validate if we already validated at ingestion?
 *   - Tenant's subscription could have been cancelled between ingestion and processing
 *   - Feature could have been removed from the plan
 *   - Ingestion validation is optimistic (fast path), this is the authoritative check
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '@app-prisma/prisma.service';

import {
  KAFKA_CONSUMER_GROUPS,
  KAFKA_TOPICS,
  KafkaConsumerBase,
  KafkaProducerService,
} from '@infra/messaging';

import { SubscriptionStatus, TenantStatus } from '@prisma/client';

/** Shape of a raw usage event from the outbox. */
interface RawUsageEvent {
  id: string;
  eventId: string;
  tenantId: string;
  subscriptionId: string;
  feature: string;
  amount: number;
  timestamp: string;
  metadata: Record<string, unknown>;
}

/** Shape of a validated usage event published downstream. */
interface ValidatedUsageEvent extends RawUsageEvent {
  /** The subscription that was active at validation time. */
  validatedSubscriptionId: string;
  /** Feature type from the entitlement snapshot. */
  featureType: string;
  /** Reset period from the entitlement snapshot. */
  resetPeriod: string;
  /** When validation occurred. */
  validatedAt: string;
}

/** UUID v4 format check. */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Late events older than this are rejected. */
const MAX_EVENT_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Future events beyond this are rejected (clock skew tolerance). */
const MAX_FUTURE_DRIFT_MS = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class UsageValidationConsumer extends KafkaConsumerBase {
  protected readonly topic = KAFKA_TOPICS.USAGE_RAW;
  protected readonly groupId = KAFKA_CONSUMER_GROUPS.USAGE_VALIDATOR;

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaProducer: KafkaProducerService,
  ) {
    super();
  }

  /**
   * Process a single raw usage event.
   *
   * @param payload - Parsed JSON from usage.raw
   * @param key - Message key (aggregate ID, typically usage event UUID)
   */
  async handleMessage(payload: unknown, key: string): Promise<void> {
    const event = payload as RawUsageEvent;

    // key is the Kafka message key (aggregate ID), used for trace logging
    this.logger.debug(`Processing message key=${key}`);

    // Validate required fields
    if (!event.id || !event.tenantId || !event.feature || !event.amount) {
      await this.sendToDeadLetter(
        event,
        'Missing required fields (id, tenantId, feature, amount)',
      );
      await this.updateEventStatus(
        event.id,
        'REJECTED',
        'Missing required fields',
      );
      return;
    }

    // Validate eventId is a valid UUID format (idempotency key integrity)
    if (!UUID_REGEX.test(event.eventId)) {
      await this.sendToDeadLetter(
        event,
        `Invalid eventId format: "${event.eventId}" is not a valid UUID`,
      );
      await this.updateEventStatus(
        event.id,
        'REJECTED',
        'Invalid eventId format',
      );
      return;
    }

    // Validate tenant exists and is ACTIVE (not just subscription check)
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: event.tenantId },
      select: { id: true, status: true },
    });

    if (!tenant) {
      await this.sendToDeadLetter(event, `Tenant ${event.tenantId} not found`);
      await this.updateEventStatus(event.id, 'REJECTED', 'Tenant not found');
      return;
    }

    if (tenant.status !== TenantStatus.ACTIVE) {
      await this.sendToDeadLetter(
        event,
        `Tenant ${event.tenantId} is ${tenant.status}, not ACTIVE`,
      );
      await this.updateEventStatus(
        event.id,
        'REJECTED',
        `Tenant is ${tenant.status}`,
      );
      return;
    }

    // Validate timestamp is within acceptable window
    const eventTime = new Date(event.timestamp).getTime();
    const now = Date.now();

    if (Number.isNaN(eventTime)) {
      await this.sendToDeadLetter(event, 'Invalid timestamp format');
      await this.updateEventStatus(event.id, 'REJECTED', 'Invalid timestamp');
      return;
    }

    if (eventTime > now + MAX_FUTURE_DRIFT_MS) {
      await this.sendToDeadLetter(
        event,
        `Timestamp ${event.timestamp} is too far in the future (max 5 min drift)`,
      );
      await this.updateEventStatus(event.id, 'REJECTED', 'Timestamp in future');
      return;
    }

    if (eventTime < now - MAX_EVENT_AGE_MS) {
      await this.sendToDeadLetter(
        event,
        `Timestamp ${event.timestamp} is too old (max 7 days)`,
      );
      await this.updateEventStatus(event.id, 'REJECTED', 'Timestamp too old');
      return;
    }

    // Check for duplicate processing (event already validated or aggregated)
    const existingEvent = await this.prisma.usageEvent.findUnique({
      where: { eventId: event.eventId },
      select: { status: true },
    });

    if (existingEvent && existingEvent.status !== 'PENDING') {
      // Already processed - publish to duplicates topic for monitoring
      await this.kafkaProducer.publish(
        KAFKA_TOPICS.USAGE_DUPLICATES,
        event.tenantId,
        { eventId: event.eventId, status: existingEvent.status },
      );
      return;
    }

    // Validate tenant has an active subscription
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        tenantId: event.tenantId,
        status: {
          in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING],
        },
      },
      select: {
        id: true,
        entitlementSnapshots: {
          where: { featureLookupKey: event.feature },
          select: {
            featureLookupKey: true,
            featureType: true,
            resetPeriod: true,
          },
        },
      },
    });

    if (!subscription) {
      await this.sendToDeadLetter(
        event,
        `No active subscription for tenant ${event.tenantId}`,
      );
      await this.updateEventStatus(
        event.id,
        'REJECTED',
        'No active subscription',
      );
      return;
    }

    // Validate feature is in the subscription's entitlements
    const snapshot = subscription.entitlementSnapshots[0];
    if (!snapshot) {
      await this.sendToDeadLetter(
        event,
        `Feature "${event.feature}" not in subscription's entitlements`,
      );
      await this.updateEventStatus(
        event.id,
        'REJECTED',
        `Feature "${event.feature}" not entitled`,
      );
      return;
    }

    // Validate feature type matches usage shape
    // BOOLEAN features should not receive usage events (they're on/off, not consumable)
    if (snapshot.featureType === 'BOOLEAN') {
      await this.sendToDeadLetter(
        event,
        `Feature "${event.feature}" is BOOLEAN - cannot record usage against boolean features`,
      );
      await this.updateEventStatus(
        event.id,
        'REJECTED',
        'Cannot record usage for BOOLEAN feature',
      );
      return;
    }

    // QUOTA and METERED features require positive integer amounts
    if (!Number.isInteger(event.amount) || event.amount <= 0) {
      await this.sendToDeadLetter(
        event,
        `Invalid amount ${event.amount} for ${snapshot.featureType} feature - must be a positive integer`,
      );
      await this.updateEventStatus(
        event.id,
        'REJECTED',
        'Amount must be a positive integer',
      );
      return;
    }

    // All checks passed - publish validated event
    const validatedEvent: ValidatedUsageEvent = {
      ...event,
      validatedSubscriptionId: subscription.id,
      featureType: snapshot.featureType,
      resetPeriod: snapshot.resetPeriod ?? 'MONTHLY',
      validatedAt: new Date().toISOString(),
    };

    await this.kafkaProducer.publish(
      KAFKA_TOPICS.USAGE_VALIDATED,
      event.tenantId,
      validatedEvent as unknown as Record<string, unknown>,
    );

    // Update event status in database
    await this.updateEventStatus(event.id, 'VALIDATED');

    this.logger.debug(
      `Validated: ${event.eventId} (${event.feature} × ${event.amount}) for tenant ${event.tenantId}`,
    );
  }

  /**
   * Update the usage event's pipeline status in the database.
   */
  private async updateEventStatus(
    id: string,
    status: 'VALIDATED' | 'REJECTED' | 'DUPLICATE',
    rejectionReason?: string,
  ): Promise<void> {
    try {
      await this.prisma.usageEvent.update({
        where: { id },
        data: {
          status,
          ...(rejectionReason && { rejectionReason }),
        },
      });
    } catch (error) {
      // Non-critical: event was already processed or deleted
      this.logger.warn(
        `Failed to update event status: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Send a failed event to the dead letter topic.
   */
  private async sendToDeadLetter(
    event: RawUsageEvent,
    reason: string,
  ): Promise<void> {
    try {
      await this.kafkaProducer.publish(
        KAFKA_TOPICS.USAGE_DEAD_LETTER,
        event.tenantId ?? 'unknown',
        {
          sourceEventId: event.eventId,
          tenantId: event.tenantId,
          feature: event.feature,
          failureStage: 'VALIDATION',
          failureReason: reason,
          originalPayload: event,
          failedAt: new Date().toISOString(),
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish to dead letter: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    this.logger.warn(`Event rejected: ${event.eventId} - ${reason}`);
  }
}
