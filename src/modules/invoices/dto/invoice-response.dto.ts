/**
 * Response DTOs for invoice endpoints.
 *
 * Defines the exact shape of every response for Scalar/Swagger.
 * Field filtering is handled at the Prisma query level via select/include.
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { InvoiceStatus } from '@prisma/client';

export class InvoiceLineItemResponseDto {
  @ApiProperty({ example: 'e0481932-...' })
  id!: string;

  @ApiProperty({ example: 'Pro plan - monthly' })
  description!: string;

  @ApiPropertyOptional({ example: 'api_calls', nullable: true })
  featureLookupKey!: string | null;

  @ApiProperty({ example: 1 })
  quantity!: number;

  @ApiProperty({
    example: 99000000,
    description: 'Unit price in micro-cents',
  })
  unitPriceMicroCents!: number;

  @ApiProperty({ example: 9900, description: 'Line total in cents' })
  amount!: number;

  @ApiProperty({ example: 0 })
  sortOrder!: number;

  @ApiProperty({ example: '2026-05-20T08:19:50.920Z' })
  createdAt!: Date;
}

export class InvoiceResponseDto {
  @ApiProperty({ example: 'e2fb5571-...' })
  id!: string;

  @ApiProperty({ example: 'f239538d-...' })
  tenantId!: string;

  @ApiProperty({ example: '38bf9635-...' })
  subscriptionId!: string;

  @ApiPropertyOptional({
    example: 'INV-2026-0001',
    nullable: true,
    description: 'Assigned at FINALIZE. Null while DRAFT.',
  })
  invoiceNumber!: string | null;

  @ApiProperty({
    enum: InvoiceStatus,
    example: InvoiceStatus.FINALIZED,
  })
  status!: string;

  @ApiProperty({ example: 'usd' })
  currency!: string;

  @ApiProperty({ example: 9900, description: 'Subtotal in cents' })
  subtotal!: number;

  @ApiProperty({ example: 9900, description: 'Total in cents' })
  total!: number;

  @ApiProperty({ example: '2026-05-13T15:39:16.183Z' })
  periodStart!: Date;

  @ApiProperty({ example: '2026-06-13T15:39:16.183Z' })
  periodEnd!: Date;

  @ApiPropertyOptional({
    example: '2026-06-19T08:20:13.094Z',
    nullable: true,
  })
  dueDate!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  finalizedAt!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  paidAt!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  voidedAt!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  notes!: string | null;

  @ApiProperty({ example: '2026-05-20T08:19:50.917Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-05-20T08:19:50.917Z' })
  updatedAt!: Date;

  @ApiProperty({ type: [InvoiceLineItemResponseDto] })
  lineItems!: InvoiceLineItemResponseDto[];
}

export class InvoiceListResponseDto {
  @ApiProperty({ type: [InvoiceResponseDto] })
  data!: InvoiceResponseDto[];

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

export class InvoiceLineItemListResponseDto {
  @ApiProperty({ type: [InvoiceLineItemResponseDto] })
  data!: InvoiceLineItemResponseDto[];
}
