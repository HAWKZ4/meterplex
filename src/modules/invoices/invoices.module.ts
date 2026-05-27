/**
 * InvoicesModule - Billing, invoicing, and ledger management.
 *
 * Contains:
 *   - InvoiceGenerationService: creates invoices from usage aggregates
 *   - InvoiceLifecycleService: DRAFT → FINALIZED → PAID/VOID transitions
 *   - InvoiceNumberService: sequential invoice number generation
 *   - BillingPeriodService: period detection and advancement
 *   - InvoicesController: invoice CRUD + lifecycle endpoints
 *   - BillingLedgerController: ledger + balance endpoints
 *   - BillingCronService: automated billing cycle processing
 */
import { Module } from '@nestjs/common';

import { BillingCronService } from './billing-cron.service';
import { BillingLedgerController } from './billing-ledger.controller';
import { BillingPeriodService } from './billing-period.service';
import { InvoiceGenerationService } from './invoice-generation.service';
import { InvoiceLifecycleService } from './invoice-lifecycle.service';
import { InvoiceNumberService } from './invoice-number.service';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';

@Module({
  controllers: [InvoicesController, BillingLedgerController],
  providers: [
    InvoiceGenerationService,
    InvoiceLifecycleService,
    InvoiceNumberService,
    BillingPeriodService,
    BillingCronService,
    InvoicesService,
  ],
  exports: [
    InvoiceGenerationService,
    InvoiceLifecycleService,
    BillingPeriodService,
    InvoicesService,
  ],
})
export class InvoicesModule {}
