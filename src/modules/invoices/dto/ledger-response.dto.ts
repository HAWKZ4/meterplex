/**
 * Response DTOs for billing ledger endpoints.
 */
import { ApiProperty } from '@nestjs/swagger';

import { LedgerEntryType } from '@prisma/client';

export class LedgerEntryResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-...' })
  id!: string;

  @ApiProperty({ example: 'f239538d-...' })
  tenantId!: string;

  @ApiProperty({ example: 'e2fb5571-...', nullable: true })
  invoiceId!: string | null;

  @ApiProperty({
    enum: LedgerEntryType,
    example: LedgerEntryType.CHARGE,
  })
  type!: string;

  @ApiProperty({ example: 'Invoice INV-2026-0001 finalized' })
  description!: string;

  @ApiProperty({ example: 9900, description: 'Debit amount in cents' })
  debit!: number;

  @ApiProperty({ example: 0, description: 'Credit amount in cents' })
  credit!: number;

  @ApiProperty({ example: 'usd' })
  currency!: string;

  @ApiProperty({ example: null, nullable: true })
  externalReference!: string | null;

  @ApiProperty({ example: '2026-05-20T08:20:13.094Z' })
  createdAt!: Date;
}

export class LedgerListResponseDto {
  @ApiProperty({ type: [LedgerEntryResponseDto] })
  data!: LedgerEntryResponseDto[];

  @ApiProperty({
    example: { total: 4, page: 1, limit: 20, totalPages: 1 },
  })
  meta!: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export class BalanceResponseDto {
  @ApiProperty({ example: 'f239538d-...' })
  tenantId!: string;

  @ApiProperty({ example: 'usd' })
  currency!: string;

  @ApiProperty({
    example: 0,
    description: 'Balance in cents. Positive = owes money.',
  })
  balance!: number;

  @ApiProperty({ example: 9900, description: 'Total charged in cents' })
  totalCharged!: number;

  @ApiProperty({ example: 9900, description: 'Total paid/credited in cents' })
  totalPaid!: number;

  @ApiProperty({ example: 'cents' })
  unit!: string;

  @ApiProperty({ example: '2026-05-20T10:34:20.808Z' })
  asOf!: string;
}
