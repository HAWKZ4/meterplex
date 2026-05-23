/**
 * Response DTOs for feature endpoints.
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { FeatureType, PlanStatus } from '@prisma/client';

export class FeatureResponseDto {
  @ApiProperty({ example: 'b1ccfb75-6d33-4be4-9556-6f3ac55456a1' })
  id!: string;

  @ApiProperty({ example: 'API Calls' })
  name!: string;

  @ApiProperty({ example: 'api_calls' })
  lookupKey!: string;

  @ApiProperty({ enum: FeatureType, example: 'QUOTA' })
  type!: FeatureType;

  @ApiPropertyOptional({ example: 'calls', nullable: true })
  unit!: string | null;

  @ApiPropertyOptional({
    example: 'Number of API requests per billing period',
    nullable: true,
  })
  description!: string | null;

  @ApiProperty({ enum: PlanStatus, example: PlanStatus.ACTIVE })
  status!: PlanStatus;

  @ApiProperty({ example: { category: 'usage' } })
  metadata!: Record<string, unknown>;

  @ApiProperty({ example: '2026-04-10T12:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-04-10T12:00:00.000Z' })
  updatedAt!: Date;
}

export class FeatureListResponseDto {
  @ApiProperty({ type: [FeatureResponseDto] })
  data!: FeatureResponseDto[];
}
