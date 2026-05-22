/**
 * Response DTOs for webhook event endpoints (admin use).
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WebhookEventResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-...' })
  id!: string;

  @ApiProperty({
    example: 'fake_evt_success_008',
    description: 'Provider event ID (deduplication key)',
  })
  providerEventId!: string;

  @ApiProperty({ example: 'fake' })
  provider!: string;

  @ApiProperty({ example: 'payment.succeeded' })
  eventType!: string;

  @ApiProperty({
    enum: ['PENDING', 'PROCESSING', 'PROCESSED', 'FAILED', 'SKIPPED'],
    example: 'PROCESSED',
  })
  status!: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Error message if processing failed',
  })
  processingError!: string | null;

  @ApiPropertyOptional({ nullable: true })
  processedAt!: Date | null;

  @ApiProperty({ example: '2026-05-22T08:51:56.397Z' })
  createdAt!: Date;
}
