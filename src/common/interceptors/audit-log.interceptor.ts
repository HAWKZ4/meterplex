/**
 * AuditLogInterceptor - Automatically logs every mutation to the audit_logs table.
 *
 * How it works:
 *   1. Runs AFTER the route handler completes (in the response pipeline)
 *   2. Checks if the request is a mutation (POST, PATCH, PUT, DELETE)
 *   3. Extracts: who (actor), what (resource + action), where (tenant)
 *   4. Writes an immutable audit record to Postgres
 *   5. Fire-and-forget - audit failures are logged but never block the response
 *
 * What it skips:
 *   - GET, HEAD, OPTIONS requests (reads don't mutate)
 *   - Health checks (/health)
 *   - Auth endpoints (/auth/login, /auth/register, /auth/refresh, etc.)
 *     These have their own security logging concerns
 *
 * How resource detection works:
 *   The interceptor infers the resource type from the URL path:
 *     /api/v1/tenants     → resource = "tenant"
 *     /api/v1/users       → resource = "user"
 *     /api/v1/api-keys    → resource = "api_key"
 *
 *   The resource ID comes from:
 *     - Route params (:id) for UPDATE/DELETE
 *     - Response body (id field) for CREATE
 *
 * How actor detection works:
 *   - JWT auth: request.user.id → actorType = USER
 *   - API key auth: request.apiKeyId → actorType = API_KEY
 *   - Neither: actorType = SYSTEM (shouldn't happen on guarded routes)
 *
 * Why fire-and-forget?
 *   Audit logging is important but not critical-path. If the database
 *   write fails (e.g., Postgres is overloaded), the user's request
 *   should still succeed. The failure is logged to stdout where
 *   Loki/ELK will catch it in Phase 7.
 *
 * Usage:
 *   Applied globally in main.ts - no per-controller decoration needed.
 *   To skip a specific route, use the @SkipAudit() decorator.
 */
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PrismaService } from '@app-prisma/prisma.service';
import type { Request } from 'express';
import { Observable, tap } from 'rxjs';

import { CORRELATION_ID_HEADER } from '@common/constants';

import { AuditAction, AuditActorType, Prisma } from '@prisma/client';

/** Metadata key for the @SkipAudit() decorator. */
export const SKIP_AUDIT_KEY = 'skipAudit';

/**
 * HTTP method → audit action mapping.
 * Only mutating methods are mapped. GETs are skipped entirely.
 */
const METHOD_TO_ACTION: Record<string, AuditAction> = {
  POST: AuditAction.CREATE,
  PATCH: AuditAction.UPDATE,
  PUT: AuditAction.UPDATE,
  DELETE: AuditAction.DELETE,
};

/**
 * URL path segment → resource name mapping.
 * Maps the first meaningful path segment after the version prefix
 * to a normalized resource name for the audit log.
 *
 * Add new mappings here as you add modules in future phases.
 */
const PATH_TO_RESOURCE: Record<string, string> = {
  tenants: 'tenant',
  users: 'user',
  'api-keys': 'api_key',
  memberships: 'membership',
  plans: 'plan',
  features: 'feature',
  entitlements: 'entitlement',
  subscriptions: 'subscription',
  usage: 'usage_event',
  invoices: 'invoice',
  billing: 'billing_ledger',
  payments: 'payment_attempt',
  webhooks: 'webhook_event',
};

/**
 * Paths that should never be audited.
 * Auth endpoints have their own security logging.
 * Health checks are infrastructure, not business operations.
 */
const SKIP_PATHS = ['/health', '/api/v1/auth'];

/** Extended request type with our custom properties. */
interface AuditableRequest extends Request {
  user?: { id: string; [key: string]: unknown };
  tenantId?: string;
  apiKeyId?: string;
}

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuditableRequest>();
    const method = request.method.toUpperCase();

    // Skip non-mutating methods
    const action = METHOD_TO_ACTION[method];
    if (!action) {
      return next.handle();
    }

    // Skip excluded paths
    const path = request.path;
    if (SKIP_PATHS.some((skip) => path.startsWith(skip))) {
      return next.handle();
    }

    // Skip if @SkipAudit() decorator is present on the handler
    const skipAudit = this.reflector.get<boolean>(
      SKIP_AUDIT_KEY,
      context.getHandler(),
    );
    if (skipAudit) {
      return next.handle();
    }

    return next.handle().pipe(
      tap((responseBody) => {
        // Fire-and-forget: write the audit log asynchronously.
        // The response is already sent to the client at this point.
        this.writeAuditLog(request, action, responseBody).catch((err) => {
          this.logger.error(
            `Failed to write audit log: ${err instanceof Error ? err.message : String(err)}`,
          );
        });
      }),
    );
  }

  /**
   * Writes a single audit log record to the database.
   *
   * @param request - The HTTP request with actor and tenant context
   * @param action - CREATE, UPDATE, or DELETE
   * @param responseBody - The response returned by the controller
   */
  private async writeAuditLog(
    request: AuditableRequest,
    action: AuditAction,
    responseBody: unknown,
  ): Promise<void> {
    // --- Actor detection ---
    let actorId = 'anonymous';
    let actorType: AuditActorType = AuditActorType.SYSTEM;

    if (request.user?.id) {
      actorId = request.user.id;
      actorType = AuditActorType.USER;
    } else if (request.apiKeyId) {
      actorId = request.apiKeyId;
      actorType = AuditActorType.API_KEY;
    }

    // --- Tenant detection ---
    const tenantId =
      request.tenantId || (request.headers['x-tenant-id'] as string) || null;

    // No tenant context = can't write a tenant-scoped audit log.
    // This happens on tenant creation (the tenant doesn't exist yet).
    // For CREATE tenant, use the ID from the response body.
    const effectiveTenantId =
      tenantId || this.extractIdFromBody(responseBody) || 'unknown';

    // --- Resource detection ---
    const resource = this.extractResource(request.path);
    const resourceId =
      this.extractResourceId(request) ||
      this.extractIdFromBody(responseBody) ||
      'unknown';

    // --- Changes ---
    const changes = this.buildChanges(
      action,
      request.body as Record<string, unknown>,
      responseBody,
    );

    // --- Write ---
    await this.prisma.auditLog.create({
      data: {
        tenantId: effectiveTenantId,
        actorId,
        actorType,
        action,
        resource,
        resourceId,
        changes,
        ipAddress: this.extractIp(request),
        userAgent: request.headers['user-agent']?.substring(0, 500) || null,
        correlationId:
          (request.headers[CORRELATION_ID_HEADER] as string) || null,
      },
    });
  }

  /**
   * Extracts the resource type from the URL path.
   *
   * /api/v1/tenants/:id     → "tenant"
   * /api/v1/api-keys/:id    → "api_key"
   * /api/v1/users/:id       → "user"
   *
   * Falls back to the raw path segment if no mapping exists.
   */
  private extractResource(path: string): string {
    // Split: ['', 'api', 'v1', 'tenants', ':id', ...]
    const segments = path.split('/').filter(Boolean);

    // Skip 'api' and version prefix (e.g., 'v1')
    // The resource is the first segment after the version
    const resourceSegment = segments[2] || 'unknown';

    return PATH_TO_RESOURCE[resourceSegment] || resourceSegment;
  }

  /**
   * Extracts the resource ID from route parameters.
   * Used for UPDATE and DELETE operations where the ID is in the URL.
   */
  private extractResourceId(request: AuditableRequest): string | null {
    // Express stores route params in request.params
    // :id → request.params.id
    return (request.params?.['id'] as string) || null;
  }

  /**
   * Extracts the 'id' field from the response body.
   * Used for CREATE operations where the ID is generated server-side.
   */
  private extractIdFromBody(body: unknown): string | null {
    if (body && typeof body === 'object' && 'id' in body) {
      return (body as { id: string }).id;
    }
    return null;
  }

  /**
   * Builds the changes JSONB payload based on the action type.
   *
   * CREATE: { "after": { ...response body } }
   * UPDATE: { "before": "unavailable", "after": { ...request body } }
   * DELETE: { "before": { ...response body } }
   *
   * Note: For UPDATE, we don't have the "before" state because the
   * interceptor runs AFTER the handler. To capture "before" state,
   * we'd need to query the database before the update - that's a
   * performance cost we avoid for now. If needed, individual services
   * can pass before/after diffs explicitly.
   */
  private buildChanges(
    action: AuditAction,
    requestBody: Record<string, unknown> | undefined,
    responseBody: unknown,
  ): Prisma.InputJsonObject {
    // Strip sensitive fields from any payload before storing
    const sanitize = (obj: unknown): Prisma.InputJsonObject => {
      if (!obj || typeof obj !== 'object') return obj as any;
      const sanitized = { ...(obj as Record<string, unknown>) };
      // Never store passwords, tokens, or key material in audit logs
      delete sanitized['password'];
      delete sanitized['passwordHash'];
      delete sanitized['currentPassword'];
      delete sanitized['newPassword'];
      delete sanitized['key'];
      delete sanitized['keyHash'];
      delete sanitized['tokenHash'];
      delete sanitized['refreshToken'];
      delete sanitized['accessToken'];
      return sanitized as Prisma.InputJsonObject;
    };

    switch (action) {
      case AuditAction.CREATE:
        return { after: sanitize(responseBody) };
      case AuditAction.UPDATE:
        return {
          requestedChanges: sanitize(requestBody),
          after: sanitize(responseBody),
        };
      case AuditAction.DELETE:
        return { before: sanitize(responseBody) };
    }
  }

  /**
   * Extracts the client IP address from the request.
   * Respects X-Forwarded-For for reverse proxy setups.
   */
  private extractIp(request: AuditableRequest): string | null {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0]?.trim() || null;
    }
    return request.ip || null;
  }
}
