/**
 * Response DTOs for subscription endpoints.
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  BillingInterval,
  FeatureType,
  LimitBehavior,
  ResetPeriod,
  SubscriptionStatus,
} from '@prisma/client';

class SubscriptionPlanDto {
  @ApiProperty({ example: '0eed08b2-...' })
  id!: string;

  @ApiProperty({ example: 'Pro' })
  name!: string;

  @ApiProperty({ example: 'pro' })
  slug!: string;
}

class SubscriptionPriceDto {
  @ApiProperty({ example: 'a1b2c3d4-...' })
  id!: string;

  @ApiProperty({ enum: BillingInterval, example: 'MONTHLY' })
  interval!: string;

  @ApiProperty({ example: 9900 })
  amount!: number;

  @ApiProperty({ example: 'usd' })
  currency!: string;
}

class SnapshotSummaryDto {
  @ApiProperty({ example: 'api_calls' })
  featureLookupKey!: string;

  @ApiProperty({ enum: FeatureType, example: 'QUOTA' })
  featureType!: string;

  @ApiPropertyOptional({ example: true, nullable: true })
  value!: boolean | null;

  @ApiPropertyOptional({ example: 50000, nullable: true })
  limit!: number | null;

  @ApiPropertyOptional({ enum: LimitBehavior, nullable: true })
  limitBehavior!: string | null;

  @ApiPropertyOptional({ example: 10, nullable: true })
  overagePrice!: number | null;

  @ApiPropertyOptional({ example: 10, nullable: true })
  includedAmount!: number | null;

  @ApiPropertyOptional({
    enum: ResetPeriod,
    nullable: true,
  })
  resetPeriod!: string | null;
}

export class SubscriptionResponseDto {
  @ApiProperty({ example: 'ec2decdf-...' })
  id!: string;

  @ApiProperty({ example: '91a81431-...' })
  tenantId!: string;

  @ApiProperty({
    enum: SubscriptionStatus,
    example: SubscriptionStatus.ACTIVE,
  })
  status!: string;

  @ApiProperty({ example: '2026-04-12T00:00:00.000Z' })
  currentPeriodStart!: Date;

  @ApiProperty({ example: '2026-05-12T00:00:00.000Z' })
  currentPeriodEnd!: Date;

  @ApiProperty({ example: 12 })
  billingAnchor!: number;

  @ApiPropertyOptional({ example: '2026-04-26T00:00:00.000Z', nullable: true })
  trialEndsAt!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  cancelledAt!: Date | null;

  @ApiProperty({ example: '2026-04-12T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ type: SubscriptionPlanDto })
  plan!: SubscriptionPlanDto;

  @ApiProperty({ type: SubscriptionPriceDto })
  price!: SubscriptionPriceDto;

  @ApiPropertyOptional({ type: [SnapshotSummaryDto] })
  entitlementSnapshots?: SnapshotSummaryDto[];
}

export class SubscriptionListResponseDto {
  @ApiProperty({ type: [SubscriptionResponseDto] })
  data!: SubscriptionResponseDto[];
}
