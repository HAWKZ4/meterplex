/**
 * InvoicesService - Business logic for invoice queries and generation.
 *
 * Handles:
 *   - Paginated invoice listing with status filter
 *   - Single invoice lookup with line items
 *   - Line items only lookup
 *   - Invoice generation (auto-detects full vs prorated)
 *
 * All methods are tenant-scoped - tenantId is always required.
 */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { PrismaService } from '@app-prisma/prisma.service';

import { ERRORS } from '@common/constants';

import { InvoiceGenerationService } from './invoice-generation.service';

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly invoiceGeneration: InvoiceGenerationService,
  ) {}

  /**
   * List invoices for a tenant, newest first.
   */
  async findAll(tenantId: string, page = 1, limit = 20, status?: string) {
    const pageNum = Math.max(1, page);
    const pageSize = Math.min(100, Math.max(1, limit));
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
   * Get a single invoice with line items.
   */
  async findById(tenantId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
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
   * Get line items only for an invoice.
   */
  async findLineItems(tenantId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
      select: { id: true },
    });

    if (!invoice) {
      throw new NotFoundException(ERRORS.INVOICE.NOT_FOUND);
    }

    const lineItems = await this.prisma.invoiceLineItem.findMany({
      where: { invoiceId },
      orderBy: { sortOrder: 'asc' },
    });

    return { data: lineItems };
  }

  /**
   * Generate an invoice for the tenant's subscription.
   * Auto-detects full-period vs prorated based on subscription state.
   */
  async generateForTenant(tenantId: string) {
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
      this.logger.warn(`No subscription found for tenant ${tenantId}`);
      throw new NotFoundException(ERRORS.INVOICE.NO_SUBSCRIPTION);
    }

    if (
      subscription.cancelledAt &&
      subscription.cancelledAt < subscription.currentPeriodEnd
    ) {
      return this.invoiceGeneration.generateProrated(
        subscription,
        subscription.cancelledAt,
      );
    }

    return this.invoiceGeneration.generate(subscription);
  }
}
