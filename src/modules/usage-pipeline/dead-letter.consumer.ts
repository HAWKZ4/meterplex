/**
 * DeadLetterConsumer - Persists failed events from usage.dead-letter to the database.
 *
 * Every event that fails validation or aggregation gets published to
 * the usage.dead-letter Kafka topic. This consumer reads those events
 * and persists them to the dead_letter_events table for investigation.
 *
 * What it captures per event:
 *   - Original payload (full event JSON as it was at failure time)
 *   - Failure reason (human-readable string)
 *   - Failure stage (INGESTION, PUBLISHING, VALIDATION, AGGREGATION)
 *   - Retry count, first failed at, last attempted at
 *
 * What it does NOT do (Phase 6):
 *   - Admin API endpoints (list, retry, discard)
 *   - Auto-retry logic
 *   - Alerting/notifications
 *
 * For now, the table is the operational dashboard. Investigate via SQL:
 *   SELECT * FROM dead_letter_events WHERE status = 'FAILED' ORDER BY first_failed_at DESC;
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '@app-prisma/prisma.service';

import {
  KAFKA_CONSUMER_GROUPS,
  KAFKA_TOPICS,
  KafkaConsumerBase,
} from '@modules/kafka';

import { Prisma } from '@prisma/client';

/** Shape of a dead letter message published by validation/aggregation consumers. */
interface DeadLetterMessage {
  sourceEventId?: string;
  tenantId?: string;
  feature?: string;
  failureStage: string;
  failureReason: string;
  originalPayload: Record<string, unknown>;
  failedAt: string;
}

/** Map string stage names to the DeadLetterStage enum values. */
const STAGE_MAP: Record<
  string,
  'INGESTION' | 'PUBLISHING' | 'VALIDATION' | 'AGGREGATION' | 'UNKNOWN'
> = {
  INGESTION: 'INGESTION',
  PUBLISHING: 'PUBLISHING',
  VALIDATION: 'VALIDATION',
  AGGREGATION: 'AGGREGATION',
};

@Injectable()
export class DeadLetterConsumer extends KafkaConsumerBase {
  protected readonly topic = KAFKA_TOPICS.USAGE_DEAD_LETTER;
  protected readonly groupId = KAFKA_CONSUMER_GROUPS.DEAD_LETTER_HANDLER;

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  /**
   * Process a single dead letter message.
   * Persists to dead_letter_events table for investigation.
   */
  async handleMessage(payload: unknown, key: string): Promise<void> {
    const message = payload as DeadLetterMessage;

    this.logger.debug(`Processing dead letter message key=${key}`);

    try {
      // Map the string stage to the enum value, default to UNKNOWN
      const failureStage = STAGE_MAP[message.failureStage] ?? 'UNKNOWN';

      await this.prisma.deadLetterEvent.create({
        data: {
          sourceEventId: message.sourceEventId ?? null,
          tenantId: message.tenantId ?? null,
          topic: KAFKA_TOPICS.USAGE_RAW,
          failureStage,
          failureReason: message.failureReason ?? 'Unknown failure reason',
          originalPayload: (message.originalPayload ??
            {}) as unknown as Prisma.InputJsonValue,
          firstFailedAt: message.failedAt
            ? new Date(message.failedAt)
            : new Date(),
          lastAttemptedAt: new Date(),
        },
      });

      this.logger.warn(
        `Dead letter persisted: event=${message.sourceEventId ?? 'unknown'}, ` +
          `stage=${failureStage}, reason="${message.failureReason}"`,
      );
    } catch (error) {
      // If we can't even persist the dead letter, log everything we have.
      // This is the last resort - if this fails, the event data is in the Kafka
      // topic and can be reprocessed manually from the topic offset.
      this.logger.error(
        `Failed to persist dead letter event: ${error instanceof Error ? error.message : String(error)}. ` +
          `Original payload: ${JSON.stringify(message)}`,
      );
    }
  }
}
