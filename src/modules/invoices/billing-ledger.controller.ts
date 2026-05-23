/**
 * BillingLedgerController - View ledger entries and balance.
 *
 * Routes:
 *   GET /api/v1/billing/ledger       → List ledger entries for tenant
 *   GET /api/v1/billing/balance      → Get current balance
 *   GET /api/v1/billing/payments     → List payment attempts for tenant
 *   GET /api/v1/billing/payments/:id → Get payment attempt details
 */
import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
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
import { TenantId } from '@common/decorators';
import { ErrorResponseDto } from '@common/dto';
import { TenantGuard } from '@common/guards';

import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import {
  PaymentAttemptListResponseDto,
  PaymentAttemptResponseDto,
} from '@modules/payments/dto';

import { BalanceResponseDto, LedgerListResponseDto } from './dto';

@ApiTags('Billing')
@Controller({
  path: 'billing',
  version: '1',
})
export class BillingLedgerController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /api/v1/billing/ledger
   *
   * List ledger entries for the tenant, newest first. Paginated.
   * Optionally filter by type (CHARGE, PAYMENT, CREDIT, REFUND, ADJUSTMENT).
   */
  @Get('ledger')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiBearerAuth()
  @ApiHeader({ name: 'x-tenant-id', required: true })
  @ApiOperation({ summary: 'List billing ledger entries' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['CHARGE', 'PAYMENT', 'CREDIT', 'REFUND', 'ADJUSTMENT'],
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated ledger entries',
    type: LedgerListResponseDto,
  })
  async getLedger(
    @TenantId() tenantId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('type') type?: string,
  ) {
    const pageNum = Math.max(1, page ?? 1);
    const pageSize = Math.min(100, Math.max(1, limit ?? 20));
    const skip = (pageNum - 1) * pageSize;

    const where = {
      tenantId,
      ...(type && { type: type as any }),
    };

    const [entries, total] = await Promise.all([
      this.prisma.billingLedgerEntry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.billingLedgerEntry.count({ where }),
    ]);

    return {
      data: entries,
      meta: {
        total,
        page: pageNum,
        limit: pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * GET /api/v1/billing/balance
   *
   * Calculate the tenant's current balance.
   * Balance = SUM(debit) - SUM(credit)
   * Positive = tenant owes money. Negative = tenant has credit.
   */
  @Get('balance')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiBearerAuth()
  @ApiHeader({ name: 'x-tenant-id', required: true })
  @ApiOperation({ summary: 'Get tenant billing balance' })
  @ApiResponse({
    status: 200,
    description: 'Current balance',
    type: BalanceResponseDto,
  })
  async getBalance(@TenantId() tenantId: string) {
    const result = await this.prisma.billingLedgerEntry.aggregate({
      where: { tenantId },
      _sum: { debit: true, credit: true },
    });

    const totalDebit = result._sum.debit ?? 0;
    const totalCredit = result._sum.credit ?? 0;
    const balance = totalDebit - totalCredit;

    return {
      tenantId,
      currency: 'usd',
      balance,
      totalCharged: totalDebit,
      totalPaid: totalCredit,
      unit: 'cents',
      asOf: new Date().toISOString(),
    };
  }

  /**
   * GET /api/v1/billing/payments
   *
   * List payment attempts for the tenant, newest first. Paginated.
   * Optionally filter by status (PENDING, SUCCEEDED, FAILED, CANCELLED, REQUIRES_ACTION).
   */
  @Get('payments')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiBearerAuth()
  @ApiHeader({ name: 'x-tenant-id', required: true })
  @ApiOperation({ summary: 'List payment attempts for tenant' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REQUIRES_ACTION'],
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated payment attempts',
    type: PaymentAttemptListResponseDto,
  })
  @ApiResponse({ status: 401, type: ErrorResponseDto })
  async getPayments(
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

    const [payments, total] = await Promise.all([
      this.prisma.paymentAttempt.findMany({
        where,
        include: {
          invoice: {
            select: { invoiceNumber: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.paymentAttempt.count({ where }),
    ]);

    // Flatten invoiceNumber into the response
    const data = payments.map((p) => ({
      id: p.id,
      invoiceId: p.invoiceId,
      invoiceNumber: p.invoice.invoiceNumber,
      tenantId: p.tenantId,
      providerPaymentId: p.providerPaymentId,
      provider: p.provider,
      status: p.status,
      amount: p.amount,
      currency: p.currency,
      failureReason: p.failureReason,
      attemptNumber: p.attemptNumber,
      nextRetryAt: p.nextRetryAt,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    return {
      data,
      meta: {
        total,
        page: pageNum,
        limit: pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * GET /api/v1/billing/payments/:id
   *
   * Get a single payment attempt with provider response details.
   */
  @Get('payments/:id')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiBearerAuth()
  @ApiHeader({ name: 'x-tenant-id', required: true })
  @ApiOperation({ summary: 'Get payment attempt details' })
  @ApiParam({ name: 'id', description: 'Payment attempt UUID' })
  @ApiResponse({
    status: 200,
    description: 'Payment attempt details',
    type: PaymentAttemptResponseDto,
  })
  @ApiResponse({ status: 404, type: ErrorResponseDto })
  async getPaymentById(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
  ) {
    const payment = await this.prisma.paymentAttempt.findFirst({
      where: { id, tenantId },
      include: {
        invoice: {
          select: { invoiceNumber: true },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException(ERRORS.PAYMENT.NOT_FOUND);
    }

    return {
      id: payment.id,
      invoiceId: payment.invoiceId,
      invoiceNumber: payment.invoice.invoiceNumber,
      tenantId: payment.tenantId,
      providerPaymentId: payment.providerPaymentId,
      provider: payment.provider,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      failureReason: payment.failureReason,
      attemptNumber: payment.attemptNumber,
      nextRetryAt: payment.nextRetryAt,
      providerResponse: payment.providerResponse,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }
}
