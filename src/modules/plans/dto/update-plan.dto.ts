/**
 * UpdatePlanDto - Validates the request body for plan updates.
 *
 * All fields are optional - only provided fields are updated.
 * slug is NOT updatable - changing it breaks API references
 * and existing subscription records.
 *
 * Example request:
 *   {
 *     "name": "Pro Plus",
 *     "description": "For growing teams that need even more power.",
 *     "status": "ARCHIVED",
 *     "isPublic": false,
 *     "displayOrder": 3,
 *     "metadata": { "trialDays": 30 }
 *   }
 */
import { ApiPropertyOptional } from '@nestjs/swagger';

import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

import { PlanStatus } from '@prisma/client';

export class UpdatePlanDto {
  /**
   * Human-readable plan name shown on pricing pages.
   */
  @ApiPropertyOptional({
    example: 'Pro Plus',
    description: 'Updated plan name',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  /**
   * Optional marketing description for pricing pages.
   */
  @ApiPropertyOptional({
    example: 'For growing teams that need even more power.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  /**
   * Plan status.
   */
  @ApiPropertyOptional({
    enum: PlanStatus,
    example: PlanStatus.ARCHIVED,
    description: 'ARCHIVED = no new subscriptions, existing ones continue',
  })
  @IsOptional()
  @IsEnum(PlanStatus)
  status?: PlanStatus;

  /**
   * Whether this plan appears on public pricing pages.
   */
  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  /**
   * Controls display order on pricing pages. Lower = first.
   */
  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  /**
   * Flexible metadata bag for plan-specific settings.
   */
  @ApiPropertyOptional({ example: { trialDays: 30 } })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
