/**
 * Response DTOs for API key endpoints.
 *
 * These define the EXACT shape of every response so Scalar/Swagger
 * can display field types, descriptions, and examples without
 * running the API.
 *
 * Field filtering is handled at the Prisma query level (via select),
 * NOT at the serialization layer. The service methods use select
 * to ensure sensitive fields (keyHash) never enter application memory.
 *
 * The CreateApiKeyResponseDto includes the raw key - this is
 * the ONLY time it appears. All other responses show only
 * the prefix and metadata.
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { ApiKeyStatus } from '@prisma/client';

class ApiKeyCreatorDto {
  @ApiProperty({ example: 'b1ccfb75-6d33-4be4-9556-6f3ac55456a1' })
  id!: string;

  @ApiProperty({ example: 'alice@meterplex.dev' })
  email!: string;

  @ApiProperty({ example: 'Alice' })
  firstName!: string;

  @ApiProperty({ example: 'Johnson' })
  lastName!: string;
}

export class CreateApiKeyResponseDto {
  @ApiProperty({ example: 'ec2decdf-1e5d-4229-b43a-7f557741e207' })
  id!: string;

  @ApiProperty({ example: 'Production backend' })
  name!: string;

  @ApiProperty({
    example: 'mp_live_aB',
    description: 'First 10 chars for identification',
  })
  keyPrefix!: string;

  @ApiProperty({ enum: ApiKeyStatus, example: ApiKeyStatus.ACTIVE })
  status!: ApiKeyStatus;

  @ApiPropertyOptional({ example: '2026-07-04T12:00:00.000Z', nullable: true })
  expiresAt!: Date | null;

  @ApiProperty({ example: '2026-04-04T12:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({
    example: 'mp_live_aBcDeFgHiJkLmNoPqRsTuVwXyZ012345',
    description: 'The full API key - shown ONCE, never again',
  })
  key!: string;

  @ApiProperty({
    example: 'Store this key securely. It will not be shown again.',
  })
  warning!: string;
}

export class ApiKeyResponseDto {
  @ApiProperty({ example: 'ec2decdf-1e5d-4229-b43a-7f557741e207' })
  id!: string;

  @ApiProperty({ example: 'Production backend' })
  name!: string;

  @ApiProperty({ example: 'mp_live_aB' })
  keyPrefix!: string;

  @ApiProperty({ enum: ApiKeyStatus, example: ApiKeyStatus.ACTIVE })
  status!: ApiKeyStatus;

  @ApiPropertyOptional({ example: '2026-07-04T12:00:00.000Z', nullable: true })
  expiresAt!: Date | null;

  @ApiPropertyOptional({ example: '2026-04-04T12:00:00.000Z', nullable: true })
  lastUsedAt!: Date | null;

  @ApiProperty({ example: '2026-04-04T12:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ type: ApiKeyCreatorDto })
  createdByUser!: ApiKeyCreatorDto;
}

export class ApiKeyListResponseDto {
  @ApiProperty({ type: [ApiKeyResponseDto] })
  data!: ApiKeyResponseDto[];
}

export class ApiKeyRevokedResponseDto {
  @ApiProperty({ example: 'ec2decdf-1e5d-4229-b43a-7f557741e207' })
  id!: string;

  @ApiProperty({ example: 'Production backend' })
  name!: string;

  @ApiProperty({ example: 'mp_live_aB' })
  keyPrefix!: string;

  @ApiProperty({ example: ApiKeyStatus.REVOKED })
  status!: string;

  @ApiProperty({ example: '2026-04-04T12:00:00.000Z' })
  createdAt!: Date;
}
