/**
 * InvoicesController - Invoice management endpoints.
 *
 * Routes:
 *   GET    /api/v1/invoices              → List invoices for tenant
 *   GET    /api/v1/invoices/:id          → Get invoice with line items
 *   POST   /api/v1/invoices/generate     → Manually trigger invoice generation
 *   POST   /api/v1/invoices/:id/finalize → DRAFT → FINALIZED
 *   POST   /api/v1/invoices/:id/mark-paid → FINALIZED → PAID
 *   POST   /api/v1/invoices/:id/void     → DRAFT/FINALIZED → VOID
 *
 * All endpoints are tenant-scoped (require x-tenant-id header).
 */
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  Param,
  ParseUUIDPipe,
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

import { PrismaService } from '@app-prisma/prisma.service';

import { ERRORS } from '@common/constants';
import { Roles, TenantId } from '@common/decorators';
import { ErrorResponseDto } from '@common/dto';
import { RolesGuard, TenantGuard } from '@common/guards';

import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { PaymentIntentService } from '@modules/payments/payment-intent.service';

import { MembershipRole } from '@prisma/client';

import {
  InvoiceLineItemListResponseDto,
  InvoiceListResponseDto,
  InvoiceResponseDto,
} from './dto';
import { InvoiceGenerationService } from './invoice-generation.service';
import { InvoiceLifecycleService } from './invoice-lifecycle.service';

@ApiTags('Invoices')
@Controller({
  path: 'invoices',
  version: '1',
})
export class InvoicesController {
  private readonly logger = new Logger(InvoicesController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly invoiceGeneration: InvoiceGenerationService,
    private readonly invoiceLifecycle: InvoiceLifecycleService,
    private readonly paymentIntentService: PaymentIntentService,
  ) {}

  /**
   * GET /api/v1/invoices
   *
   * List invoices for the tenant, newest first. Paginated.
   * Optionally filter by status (DRAFT, FINALIZED, PAID, VOID).
   */
  @Get()
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiBearerAuth()
  @ApiHeader({ name: 'x-tenant-id', required: true })
  @ApiOperation({ summary: 'List invoices for tenant' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['DRAFT', 'FINALIZED', 'PAID', 'VOID'],
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated invoice list',
    type: InvoiceListResponseDto,
  })
  @ApiResponse({ status: 401, type: ErrorResponseDto })
  async findAll(
    @TenantId() tenantId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) {
    const pageNum = Math.max(1, page ?? 1);
    const pageSize = Math.min(100, Math.max(1, limit ?? 20));
    const skip = (pageNum - 1) * pageSize;

    const where = {
      tenantId,
      ...(status && { status: status as any }),
    };

    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        include: {
          lineItems: { orderBy: { sortOrder: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      data: invoices,
      meta: {
        total,
        page: pageNum,
        limit: pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * GET /api/v1/invoices/:id/line-items
   *
   * Get line items only for an invoice. Lighter payload than
   * the full invoice endpoint when the frontend only needs
   * the breakdown table.
   */
  @Get(':id/line-items')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiBearerAuth()
  @ApiHeader({ name: 'x-tenant-id', required: true })
  @ApiOperation({ summary: 'Get invoice line items only' })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  @ApiResponse({
    status: 200,
    description: 'Line items list',
    type: InvoiceLineItemListResponseDto,
  })
  @ApiResponse({ status: 404, type: ErrorResponseDto })
  async findLineItems(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
  ) {
    // Verify invoice belongs to tenant
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });

    if (!invoice) {
      throw new NotFoundException(ERRORS.INVOICE.NOT_FOUND);
    }

    const lineItems = await this.prisma.invoiceLineItem.findMany({
      where: { invoiceId: id },
      orderBy: { sortOrder: 'asc' },
    });

    return { data: lineItems };
  }

  /**
   * GET /api/v1/invoices/:id
   *
   * Get a single invoice with all line items.
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiBearerAuth()
  @ApiHeader({ name: 'x-tenant-id', required: true })
  @ApiOperation({ summary: 'Get invoice with line items' })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  @ApiResponse({
    status: 200,
    description: 'Invoice details',
    type: InvoiceResponseDto,
  })
  @ApiResponse({ status: 404, type: ErrorResponseDto })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
  ) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, tenantId },
      include: {
        lineItems: { orderBy: { sortOrder: 'asc' } },
      },
    });

    if (!invoice) {
      throw new NotFoundException(ERRORS.INVOICE.NOT_FOUND);
    }

    return invoice;
  }

  /**
   * POST /api/v1/invoices/generate
   *
   * Manually trigger invoice generation for the tenant's subscription.
   * Automatically detects the subscription state:
   *   - Active subscription → full-period invoice
   *   - Cancelled subscription → prorated invoice (days used / total days)
   *
   * The frontend calls this one endpoint. The backend handles the logic.
   * OWNER/ADMIN only.
   */
  @Post('generate')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
  @ApiBearerAuth()
  @ApiHeader({ name: 'x-tenant-id', required: true })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Generate invoice (auto-detects full or prorated)' })
  @ApiResponse({
    status: 201,
    description: 'Invoice generated',
    type: InvoiceResponseDto,
  })
  @ApiResponse({ status: 404, type: ErrorResponseDto })
  async generate(@TenantId() tenantId: string) {
    // Find the most recent subscription (active or cancelled)
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        tenantId,
        status: { in: ['ACTIVE', 'TRIALING', 'CANCELLED'] },
      },
      select: {
        id: true,
        tenantId: true,
        planId: true,
        priceId: true,
        status: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        billingAnchor: true,
        cancelledAt: true,
        plan: { select: { id: true, name: true, slug: true } },
        price: {
          select: { id: true, interval: true, amount: true, currency: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      return { statusCode: 404, message: 'No subscription found' };
    }

    // Cancelled mid-cycle → prorated invoice
    if (
      subscription.cancelledAt &&
      subscription.cancelledAt < subscription.currentPeriodEnd
    ) {
      return this.invoiceGeneration.generateProrated(
        subscription,
        subscription.cancelledAt,
      );
    }

    // Active/trialing → full-period invoice
    return this.invoiceGeneration.generate(subscription);
  }

  /**
   * POST /api/v1/invoices/:id/finalize
   *
   * DRAFT → FINALIZED. Assigns invoice number, creates ledger CHARGE.
   */
  @Post(':id/finalize')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
  @ApiBearerAuth()
  @ApiHeader({ name: 'x-tenant-id', required: true })
  @ApiOperation({ summary: 'Finalize a draft invoice' })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  @ApiResponse({
    status: 200,
    description: 'Invoice finalized',
    type: InvoiceResponseDto,
  })
  @ApiResponse({ status: 400, type: ErrorResponseDto })
  @ApiResponse({ status: 404, type: ErrorResponseDto })
  async finalize(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
  ) {
    const result = await this.invoiceLifecycle.finalize(id, tenantId);

    // Create payment intent - fire-and-forget (don't block the response)
    this.paymentIntentService
      .createForInvoice(id, tenantId, result.total, result.currency)
      .then((attempt) => {
        this.logger.log(
          `Payment intent created for ${result.invoiceNumber}: ${attempt.providerPaymentId}`,
        );
      })
      .catch((error) => {
        this.logger.error(
          `Failed to create payment intent for ${result.invoiceNumber}: ${error instanceof Error ? error.message : String(error)}`,
        );
      });

    return result;
  }

  /**
   * POST /api/v1/invoices/:id/mark-paid
   *
   * FINALIZED → PAID. Creates ledger PAYMENT entry.
   * Manual placeholder until Phase 5 payment provider integration.
   */
  @Post(':id/mark-paid')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
  @ApiBearerAuth()
  @ApiHeader({ name: 'x-tenant-id', required: true })
  @ApiOperation({ summary: 'Mark invoice as paid' })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  @ApiResponse({
    status: 200,
    description: 'Invoice marked paid',
    type: InvoiceResponseDto,
  })
  @ApiResponse({ status: 400, type: ErrorResponseDto })
  @ApiResponse({ status: 404, type: ErrorResponseDto })
  async markPaid(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
  ) {
    return this.invoiceLifecycle.markPaid(id, tenantId);
  }

  /**
   * POST /api/v1/invoices/:id/void
   *
   * DRAFT/FINALIZED → VOID. Creates ledger CREDIT if was finalized.
   */
  @Post(':id/void')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
  @ApiBearerAuth()
  @ApiHeader({ name: 'x-tenant-id', required: true })
  @ApiOperation({ summary: 'Void an invoice' })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  @ApiResponse({
    status: 200,
    description: 'Invoice voided',
    type: InvoiceResponseDto,
  })
  @ApiResponse({ status: 400, type: ErrorResponseDto })
  @ApiResponse({ status: 404, type: ErrorResponseDto })
  async voidInvoice(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
  ) {
    return this.invoiceLifecycle.void(id, tenantId);
  }
}
