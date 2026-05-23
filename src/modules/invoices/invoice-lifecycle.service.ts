/**
 * InvoiceLifecycleService - Manages invoice status transitions.
 *
 * State machine:
 *   DRAFT → FINALIZED → PAID
 *                     → VOID
 *   DRAFT → VOID
 *
 * Each transition has side effects:
 *   FINALIZE: assign invoice number, set due date, create ledger CHARGE entry
 *   MARK PAID: create ledger PAYMENT entry
 *   VOID: create ledger CREDIT entry (reverses the charge)
 */
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '@app-prisma/prisma.service';

import { ERRORS } from '@common/constants';

import { InvoiceStatus, LedgerEntryType } from '@prisma/client';

import { InvoiceNumberService } from './invoice-number.service';

/** Days after finalization before payment is due. */
const PAYMENT_DUE_DAYS = 30;

@Injectable()
export class InvoiceLifecycleService {
  private readonly logger = new Logger(InvoiceLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly invoiceNumberService: InvoiceNumberService,
  ) {}

  /**
   * Default select for invoice queries.
   */
  private readonly defaultSelect = {
    id: true,
    tenantId: true,
    subscriptionId: true,
    invoiceNumber: true,
    status: true,
    currency: true,
    subtotal: true,
    total: true,
    periodStart: true,
    periodEnd: true,
    dueDate: true,
    finalizedAt: true,
    paidAt: true,
    voidedAt: true,
    notes: true,
    createdAt: true,
    updatedAt: true,
    lineItems: {
      select: {
        id: true,
        description: true,
        featureLookupKey: true,
        quantity: true,
        unitPriceMicroCents: true,
        amount: true,
        sortOrder: true,
      },
      orderBy: { sortOrder: 'asc' as const },
    },
  };

  /**
   * DRAFT → FINALIZED
   *
   * Side effects:
   *   1. Assign sequential invoice number (INV-2026-0001)
   *   2. Set due date (finalization + 30 days)
   *   3. Create billing ledger CHARGE entry
   *   4. Lock the invoice (no more edits)
   */
  async finalize(invoiceId: string, tenantId: string) {
    const invoice = await this.findInvoiceForTenant(invoiceId, tenantId);

    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException(
        ERRORS.INVOICE.INVALID_TRANSITION(
          invoice.status,
          InvoiceStatus.FINALIZED,
        ),
      );
    }

    const now = new Date();
    const dueDate = new Date(
      now.getTime() + PAYMENT_DUE_DAYS * 24 * 60 * 60 * 1000,
    );
    const invoiceNumber = await this.invoiceNumberService.generateNext();

    const result = await this.prisma.$transaction(async (tx) => {
      // Update invoice status
      const finalized = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: InvoiceStatus.FINALIZED,
          invoiceNumber,
          dueDate,
          finalizedAt: now,
        },
        select: this.defaultSelect,
      });

      // Create ledger CHARGE entry
      await tx.billingLedgerEntry.create({
        data: {
          tenantId,
          invoiceId,
          type: LedgerEntryType.CHARGE,
          description: `Invoice ${invoiceNumber} finalized`,
          debit: invoice.total,
          credit: 0,
          currency: invoice.currency,
        },
      });

      return finalized;
    });

    this.logger.log(
      `Invoice ${invoiceNumber} finalized: $${(invoice.total / 100).toFixed(2)} ${invoice.currency} for tenant ${tenantId}`,
    );

    return result;
  }

  /**
   * FINALIZED → PAID
   *
   * Side effects:
   *   1. Create billing ledger PAYMENT entry
   *   2. Record payment timestamp
   */
  async markPaid(
    invoiceId: string,
    tenantId: string,
    externalReference?: string,
  ) {
    const invoice = await this.findInvoiceForTenant(invoiceId, tenantId);

    if (invoice.status !== InvoiceStatus.FINALIZED) {
      throw new BadRequestException(
        ERRORS.INVOICE.INVALID_TRANSITION(invoice.status, 'PAID'),
      );
    }

    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const paid = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: 'PAID',
          paidAt: now,
        },
        select: this.defaultSelect,
      });

      // Create ledger PAYMENT entry
      await tx.billingLedgerEntry.create({
        data: {
          tenantId,
          invoiceId,
          type: LedgerEntryType.PAYMENT,
          description: `Payment received for invoice ${invoice.invoiceNumber}`,
          debit: 0,
          credit: invoice.total,
          currency: invoice.currency,
          externalReference,
        },
      });

      return paid;
    });

    this.logger.log(
      `Invoice ${invoice.invoiceNumber} marked paid: $${(invoice.total / 100).toFixed(2)} ${invoice.currency}`,
    );

    return result;
  }

  /**
   * FINALIZED → VOID (or DRAFT → VOID)
   *
   * Side effects (if was FINALIZED):
   *   1. Create billing ledger CREDIT entry (reverses the charge)
   *   2. Record void timestamp
   */
  async void(invoiceId: string, tenantId: string) {
    const invoice = await this.findInvoiceForTenant(invoiceId, tenantId);

    if (
      invoice.status !== InvoiceStatus.DRAFT &&
      invoice.status !== InvoiceStatus.FINALIZED
    ) {
      throw new BadRequestException(
        ERRORS.INVOICE.INVALID_TRANSITION(invoice.status, 'VOID'),
      );
    }

    const now = new Date();
    const wasFinalized = invoice.status === InvoiceStatus.FINALIZED;

    const result = await this.prisma.$transaction(async (tx) => {
      const voided = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: 'VOID',
          voidedAt: now,
        },
        select: this.defaultSelect,
      });

      // Reverse the charge if the invoice was finalized
      if (wasFinalized) {
        await tx.billingLedgerEntry.create({
          data: {
            tenantId,
            invoiceId,
            type: LedgerEntryType.CREDIT,
            description: `Invoice ${invoice.invoiceNumber} voided - charge reversed`,
            debit: 0,
            credit: invoice.total,
            currency: invoice.currency,
          },
        });
      }

      return voided;
    });

    this.logger.log(
      `Invoice ${invoice.invoiceNumber ?? invoiceId} voided${wasFinalized ? ' - ledger CREDIT created' : ''}`,
    );

    return result;
  }

  /**
   * Find an invoice and verify it belongs to the tenant.
   */
  private async findInvoiceForTenant(invoiceId: string, tenantId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
      select: {
        id: true,
        status: true,
        total: true,
        currency: true,
        invoiceNumber: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException(ERRORS.INVOICE.NOT_FOUND);
    }

    return invoice;
  }
}
