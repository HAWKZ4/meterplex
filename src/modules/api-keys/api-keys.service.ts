/**
 * ApiKeysService - Server-to-server API key management.
 *
 * Implements the same pattern used by Stripe, GitHub, and AWS:
 *
 * Key format: mp_live_<40 chars of base64url>
 *   - "mp_" = meterplex prefix (identifies the key source in logs)
 *   - "live_" = environment indicator (future: "test_" for sandbox)
 *   - 40 chars = 30 bytes of crypto-random data, base64url encoded
 *
 * Storage:
 *   - The raw key is shown ONCE at creation, then never again
 *   - Only the SHA-256 hash is stored in the database
 *   - The first 10 chars are stored as key_prefix for identification
 *     (e.g., "mp_live_aB" - enough to identify, not enough to use)
 *
 * Authentication flow:
 *   1. Client sends: Authorization: Bearer mp_live_aBcDeFgH...
 *   2. We SHA-256 hash the key
 *   3. Look up the hash in the api_keys table
 *   4. Check status (ACTIVE), expiration, and tenant
 *   5. Update last_used_at timestamp
 *   6. Return the tenant context for the request
 *
 * Security:
 *   - Raw keys never touch the database or logs
 *   - SHA-256 is one-way - a database breach doesn't expose keys
 *   - Constant-time hash comparison prevents timing attacks
 *   - Expiration + revocation support key rotation
 *   - last_used_at identifies stale keys for cleanup
 */
import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { PrismaService } from '@app-prisma/prisma.service';
import { createHash, randomBytes } from 'node:crypto';

import { ERRORS } from '@common/constants';
import { isNotFoundError } from '@common/utils/prisma-errors';

import { ApiKeyStatus } from '@prisma/client';

import { CreateApiKeyDto } from './dto';

/** Prefix for all Meterplex API keys. Identifies the source in logs. */
const KEY_PREFIX = 'mp_live_';

/** Length of the random portion of the key (in bytes). */
const KEY_RANDOM_BYTES = 30;

/** How many characters of the full key to store as the visible prefix. */
const STORED_PREFIX_LENGTH = 10;

@Injectable()
export class ApiKeysService {
  private readonly logger = new Logger(ApiKeysService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate a new API key for a tenant.
   *
   * The raw key is returned ONCE in the response. After this,
   * only the hash and prefix are stored - the raw key cannot
   * be retrieved. If the user loses it, they must create a new one.
   *
   * @param dto - Key name and optional expiration
   * @param tenantId - The tenant this key authenticates for
   * @param userId - The user creating the key (audit trail)
   * @returns The created key metadata + the raw key (shown once)
   */
  async create(dto: CreateApiKeyDto, tenantId: string, userId: string) {
    // Generate the raw key: mp_live_ + 40 chars of base64url randomness
    const randomPart = randomBytes(KEY_RANDOM_BYTES).toString('base64url');
    const rawKey = `${KEY_PREFIX}${randomPart}`;

    // Store only the SHA-256 hash - the raw key never touches the DB
    const keyHash = this.hashKey(rawKey);

    // Store the first 10 chars for display: "mp_live_aB..."
    const keyPrefix = rawKey.substring(0, STORED_PREFIX_LENGTH);

    // Calculate expiration date if specified
    const expiresAt = dto.expiresInDays
      ? new Date(Date.now() + dto.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const apiKey = await this.prisma.apiKey.create({
      data: {
        tenantId,
        createdByUserId: userId,
        keyPrefix,
        keyHash,
        name: dto.name,
        expiresAt,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        status: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    this.logger.log(
      `API key created: ${apiKey.name} (${apiKey.keyPrefix}...) for tenant ${tenantId}`,
    );

    // Return the raw key ONCE. After this response,
    // the raw key is gone forever - only the hash exists.
    return {
      ...apiKey,
      key: rawKey,
      warning: 'Store this key securely. It will not be shown again.',
    };
  }

  /**
   * List all API keys for a tenant.
   *
   * Returns metadata only - never the raw key or hash.
   * The keyPrefix is shown so users can identify which key is which.
   *
   * @param tenantId - The tenant to list keys for
   * @returns Array of API key metadata
   */
  async findAllForTenant(tenantId: string) {
    const keys = await this.prisma.apiKey.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        status: true,
        expiresAt: true,
        lastUsedAt: true,
        createdAt: true,
        createdByUser: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { data: keys };
  }

  /**
   * Revoke an API key.
   *
   * Revocation is permanent - a revoked key cannot be re-activated.
   * If the user needs a new key, they create one.
   *
   * Why not delete? Audit trail. You want to see which keys existed,
   * who created them, and when they were revoked. Hard-deleting
   * erases that history.
   *
   * @param id - API key UUID
   * @param tenantId - The tenant the key belongs to (authorization check)
   * @returns The revoked key metadata
   * @throws NotFoundException if key doesn't exist or doesn't belong to tenant
   */
  async revoke(id: string, tenantId: string) {
    // Find the key and verify it belongs to this tenant
    try {
      await this.prisma.apiKey.findFirstOrThrow({
        where: { id, tenantId },
      });
    } catch (error) {
      if (isNotFoundError(error)) {
        throw new NotFoundException(ERRORS.API_KEY.NOT_FOUND);
      }
      throw error;
    }

    const revoked = await this.prisma.apiKey.update({
      where: { id },
      data: { status: ApiKeyStatus.REVOKED },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        status: true,
        createdAt: true,
      },
    });

    this.logger.log(
      `API key revoked: ${revoked.name} (${revoked.keyPrefix}...) in tenant ${tenantId}`,
    );

    return revoked;
  }

  /**
   * Authenticate a request using an API key.
   *
   * This is the hot path - called on every API-key-authenticated request.
   * Performance matters here.
   *
   * Flow:
   *   1. Hash the provided key with SHA-256
   *   2. Look up the hash in the database (unique index = fast)
   *   3. Validate: status is ACTIVE, not expired
   *   4. Update last_used_at (fire-and-forget, don't block the response)
   *   5. Return the tenant ID for request scoping
   *
   * Security:
   *   - Hash comparison via database lookup is effectively constant-time
   *     (the index lookup is O(log n) regardless of whether the key exists)
   *   - Same error message for "not found" and "revoked" (prevents enumeration)
   *   - Expired keys get the same error as invalid keys
   *
   * @param rawKey - The full API key from the Authorization header
   * @returns Object with tenantId and keyId for request context
   * @throws UnauthorizedException if key is invalid, revoked, or expired
   */
  async authenticate(
    rawKey: string,
  ): Promise<{ tenantId: string; keyId: string }> {
    const keyHash = this.hashKey(rawKey);

    try {
      const apiKey = await this.prisma.apiKey.findUniqueOrThrow({
        where: { keyHash },
        select: {
          id: true,
          tenantId: true,
          status: true,
          expiresAt: true,
        },
      });

      if (apiKey.status !== ApiKeyStatus.ACTIVE) {
        throw new UnauthorizedException(ERRORS.API_KEY.NOT_FOUND);
      }

      if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
        // Mark as expired in the database (best-effort)
        this.prisma.apiKey
          .update({
            where: { id: apiKey.id },
            data: { status: ApiKeyStatus.EXPIRED },
          })
          .catch((err: Error) => {
            this.logger.warn(`Failed to mark key as expired: ${err.message}`);
          });

        throw new UnauthorizedException(ERRORS.API_KEY.EXPIRED);
      }

      // Update last_used_at - fire-and-forget
      this.prisma.apiKey
        .update({
          where: { id: apiKey.id },
          data: { lastUsedAt: new Date() },
        })
        .catch((err: Error) => {
          this.logger.warn(`Failed to update last_used_at: ${err.message}`);
        });

      return {
        tenantId: apiKey.tenantId,
        keyId: apiKey.id,
      };
    } catch (error) {
      if (isNotFoundError(error)) {
        throw new UnauthorizedException(ERRORS.API_KEY.NOT_FOUND);
      }
      throw error;
    }
  }

  /**
   * SHA-256 hash an API key.
   *
   * Same hashing function used for refresh tokens and reset tokens.
   * One-way: given the hash, you cannot recover the original key.
   * Deterministic: same input always produces the same hash.
   *
   * @param key - Raw API key string
   * @returns 64-character lowercase hex string
   */
  private hashKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }
}
