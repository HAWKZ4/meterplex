/**
 * Response DTOs for tenant endpoints.
 *
 * These define the EXACT shape of every response so Scalar/Swagger
 * can display field types, descriptions, and examples without
 * running the API. The frontend team uses these as their contract.
 *
 * Field filtering is handled at the Prisma query level (via select),
 * NOT at the serialization layer. These DTOs are purely for:
 *   1. Swagger documentation (@ApiProperty)
 *   2. TypeScript return type safety (Promise<TenantResponseDto>)
 *
 * If role-based field visibility is needed in the future,
 * ClassSerializerInterceptor can be added per-endpoint at that point.
 */
import { ApiProperty } from '@nestjs/swagger';

import { PaginationMetaDto } from '@common/dto';

import { MembershipRole, TenantStatus } from '@prisma/client';

export class TenantResponseDto {
  @ApiProperty({ example: '0eed08b2-60b6-4578-ae98-a98f3b164c54' })
  id!: string;

  @ApiProperty({ example: 'Acme Corporation' })
  name!: string;

  @ApiProperty({ example: 'acme-corp' })
  slug!: string;

  @ApiProperty({
    enum: TenantStatus,
    example: TenantStatus.ACTIVE,
  })
  status!: TenantStatus;

  @ApiProperty({ example: { timezone: 'America/New_York' } })
  metadata!: Record<string, unknown>;

  @ApiProperty({ example: '2026-04-04T12:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-04-04T12:00:00.000Z' })
  updatedAt!: Date;
}

export class TenantWithRoleResponseDto extends TenantResponseDto {
  @ApiProperty({
    enum: MembershipRole,
    example: 'OWNER',
    description: "The authenticated user's role in this tenant",
  })
  role!: MembershipRole;
}

export class TenantListResponseDto {
  @ApiProperty({ type: [TenantWithRoleResponseDto] })
  data!: TenantWithRoleResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}
