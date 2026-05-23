/**
 * Response DTOs for payment attempt endpoints.
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PaymentAttemptResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-...' })
  id!: string;

  @ApiPropertyOptional({
    example: 'INV-2026-0001',
    nullable: true,
    description: 'Invoice number (from joined invoice)',
  })
  invoiceId!: string;

  @ApiProperty({ example: 'f239538d-...' })
  tenantId!: string;

  @ApiProperty({
    example: 'fake_pi_718cac9ddd9349719ac37fce',
    description: 'Provider-specific payment intent ID',
  })
  providerPaymentId!: string;

  @ApiProperty({ example: 'fake', description: 'Payment provider name' })
  provider!: string;

  @ApiProperty({
    enum: ['PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REQUIRES_ACTION'],
    example: 'SUCCEEDED',
  })
  status!: string;

  @ApiProperty({ example: 9900, description: 'Amount in cents' })
  amount!: number;

  @ApiProperty({ example: 'usd' })
  currency!: string;

  @ApiPropertyOptional({
    example: 'Insufficient funds',
    nullable: true,
    description: 'Failure reason from provider (null if not failed)',
  })
  failureReason!: string | null;

  @ApiProperty({
    example: 0,
    description: 'Attempt number (0 = first, 1 = first retry, etc.)',
  })
  attemptNumber!: number;

  @ApiPropertyOptional({
    nullable: true,
    description: 'When the next retry is scheduled',
  })
  nextRetryAt!: Date | null;

  @ApiProperty({ example: '2026-05-22T08:34:08.751Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-05-22T08:34:08.751Z' })
  updatedAt!: Date;
}

export class PaymentAttemptListResponseDto {
  @ApiProperty({ type: [PaymentAttemptResponseDto] })
  data!: PaymentAttemptResponseDto[];

  @ApiProperty({
    example: { total: 3, page: 1, limit: 20, totalPages: 1 },
  })
  meta!: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
