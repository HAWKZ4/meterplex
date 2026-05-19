/**
 * UsagePipelineModule - Kafka consumers for the usage event pipeline.
 *
 * Contains:
 *   - UsageValidationConsumer: usage.raw → usage.validated
 *   - UsageAggregationConsumer: usage.validated → usage_aggregates table
 *
 * Both consumers start automatically on module init (via KafkaConsumerBase).
 */
import { Module } from '@nestjs/common';

import { DeadLetterConsumer } from './dead-letter.consumer';
import { UsageAggregationConsumer } from './usage-aggregation.consumer';
import { UsageValidationConsumer } from './usage-validation.consumer';

@Module({
  providers: [
    UsageValidationConsumer,
    UsageAggregationConsumer,
    DeadLetterConsumer,
  ],
})
export class UsagePipelineModule {}
