/**
 * TenantsController - HTTP layer for tenant management.
 *
 * This controller handles ONLY HTTP concerns:
 *   - Route mapping (which URL maps to which method)
 *   - HTTP status codes (201 for creation, 200 for reads)
 *   - Request parsing (path params, query params, body)
 *   - Swagger documentation decorators
 *   - Guard chain for authentication and authorization
 *
 * ALL business logic lives in TenantsService.
 * The controller is thin - it delegates everything to the service.
 *
 * Response strategy:
 *   The service layer handles field filtering via Prisma select/queries.
 *   Response DTOs exist purely for Swagger documentation and TypeScript
 *   return type safety. No serialization interceptor is needed because
 *   sensitive fields never enter application memory.
 *
 * Authorization levels:
 *   POST   /tenants           → Authenticated (any user can create a tenant)
 *   GET    /tenants           → Authenticated (list tenants user belongs to)
 *   GET    /tenants/slug/:slug → Authenticated
 *   GET    /tenants/:id       → JWT + TenantGuard (must be member)
 *   PATCH  /tenants/:id       → JWT + TenantGuard + OWNER or ADMIN
 *   DELETE /tenants/:id       → JWT + TenantGuard + OWNER only
 */
import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { ERRORS } from '@common/constants';
import { CurrentUser, Roles, TenantId } from '@common/decorators';
import { ErrorResponseDto } from '@common/dto';
import { RolesGuard, TenantGuard } from '@common/guards';

import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';

import { MembershipRole } from '@prisma/client';

import {
  CreateTenantDto,
  TenantListResponseDto,
  TenantResponseDto,
  TenantWithRoleResponseDto,
  UpdateTenantDto,
} from './dto';
import { TenantsService } from './tenants.service';

@ApiTags('Tenants')
@Controller({
  path: 'tenants',
  version: '1',
})
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  /**
   * POST /api/v1/tenants
   *
   * Creates a new tenant organization.
   * Any authenticated user can create a tenant - they become the OWNER
   * automatically. This is separate from the registration flow
   * (which creates user + tenant together).
   *
   * Use case: an existing user wants to create a second organization.
   *
   * Guard chain: JwtAuthGuard only - no tenant context needed
   * (the tenant doesn't exist yet).
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new tenant' })
  @ApiResponse({
    status: 201,
    description: 'Tenant created successfully',
    type: TenantWithRoleResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Slug already exists',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated',
    type: ErrorResponseDto,
  })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateTenantDto,
  ) {
    return this.tenantsService.createWithOwner(dto, userId);
  }

  /**
   * GET /api/v1/tenants?page=1&limit=20
   *
   * Lists tenants the authenticated user belongs to.
   * NOT a global list - each user sees only their own tenants.
   * A global admin list would be a separate endpoint.
   *
   * Guard chain: JwtAuthGuard only - filters by user membership.
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List tenants the current user belongs to' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of user tenants',
    type: TenantListResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated',
    type: ErrorResponseDto,
  })
  async findAll(
    @CurrentUser('id') userId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.tenantsService.findAllForUser(userId, page ?? 1, limit ?? 20);
  }

  /**
   * GET /api/v1/tenants/slug/:slug
   *
   * Finds a tenant by its URL-safe slug.
   * Authenticated users can look up any tenant by slug
   * (e.g., to check if a slug is taken before creating a tenant).
   *
   * Guard chain: JwtAuthGuard only.
   */
  @Get('slug/:slug')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get tenant by slug' })
  @ApiParam({ name: 'slug', example: 'acme-corp' })
  @ApiResponse({
    status: 200,
    description: 'Tenant found',
    type: TenantResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Tenant not found',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated',
    type: ErrorResponseDto,
  })
  async findBySlug(@Param('slug') slug: string) {
    return this.tenantsService.findBySlug(slug);
  }

  /**
   * GET /api/v1/tenants/:id
   *
   * Finds a tenant by UUID.
   * Requires x-tenant-id header and membership - you can only
   * view tenant details if you're a member.
   *
   * Guard chain: JwtAuthGuard → TenantGuard
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiBearerAuth()
  @ApiHeader({
    name: 'x-tenant-id',
    description: 'Tenant UUID',
    required: true,
  })
  @ApiOperation({ summary: 'Get tenant by ID' })
  @ApiParam({ name: 'id', description: 'Tenant UUID' })
  @ApiResponse({
    status: 200,
    description: 'Tenant found',
    type: TenantWithRoleResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Tenant not found',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Not a member of this tenant',
    type: ErrorResponseDto,
  })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.tenantsService.findById(id, userId);
  }

  /**
   * PATCH /api/v1/tenants/:id
   *
   * Updates a tenant. Only OWNER and ADMIN can modify tenant settings.
   * DEVELOPER and BILLING roles cannot change tenant configuration.
   *
   * Guard chain: JwtAuthGuard → TenantGuard → RolesGuard(OWNER, ADMIN)
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
  @ApiBearerAuth()
  @ApiHeader({
    name: 'x-tenant-id',
    description: 'Tenant UUID',
    required: true,
  })
  @ApiOperation({ summary: 'Update a tenant (OWNER or ADMIN only)' })
  @ApiParam({ name: 'id', description: 'Tenant UUID' })
  @ApiResponse({
    status: 200,
    description: 'Tenant updated',
    type: TenantResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient role',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Tenant not found',
    type: ErrorResponseDto,
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
    @Body() dto: UpdateTenantDto,
  ) {
    if (id !== tenantId) {
      throw new ForbiddenException(ERRORS.TENANT.ID_MISMATCH);
    }

    return this.tenantsService.update(id, dto);
  }

  /**
   * DELETE /api/v1/tenants/:id
   *
   * Soft-deletes a tenant by setting status to CANCELLED.
   * ONLY the OWNER can cancel a tenant - this is a destructive action
   * that affects all members, billing, and API keys.
   *
   * Guard chain: JwtAuthGuard → TenantGuard → RolesGuard(OWNER)
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(MembershipRole.OWNER)
  @ApiBearerAuth()
  @ApiHeader({
    name: 'x-tenant-id',
    description: 'Tenant UUID',
    required: true,
  })
  @ApiOperation({ summary: 'Cancel a tenant (OWNER only, soft delete)' })
  @ApiParam({ name: 'id', description: 'Tenant UUID' })
  @ApiResponse({
    status: 200,
    description: 'Tenant cancelled',
    type: TenantResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Only OWNER can cancel a tenant',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Tenant not found',
    type: ErrorResponseDto,
  })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
  ) {
    if (id !== tenantId) {
      throw new ForbiddenException(ERRORS.TENANT.ID_MISMATCH);
    }

    return this.tenantsService.remove(id);
  }
}
