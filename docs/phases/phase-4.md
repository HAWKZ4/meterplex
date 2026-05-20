# Phase 4 - Billing Ledger and Invoice Generation

**Goal:** Turn usage aggregates into money. Calculate what each tenant owes, generate line-item invoices, and maintain an immutable billing ledger.

**Status:** ✅ Complete

---

## TLDR

Phase 4 is complete. Here's what you built:

- Invoice generation from usage aggregates + subscription pricing
- Overage calculator with micro-cents precision (all integer math, no floats)
- Invoice lifecycle: DRAFT → FINALIZED → PAID / VOID
- Sequential invoice numbers (INV-2026-0001) assigned at finalization only
- Double-entry billing ledger: CHARGE on finalize, PAYMENT on pay, CREDIT on void
- Billing period cron: auto-closes expired periods daily at 00:05 UTC
- Mid-cycle cancellation proration: base fee × (days used / total days)
- Seed data: 3 invoices, 10 line items, 3 ledger entries

## What was built

### Data model

Five new tables/objects:

- **invoices** - one per tenant per billing period. Status lifecycle (DRAFT → FINALIZED → PAID → VOID). Links to subscription. Stores totals, invoice number, due date.
- **invoice_line_items** - individual charges on an invoice. Base subscription fee, per-feature overage charges. Each line has: description, quantity, unit price (micro-cents), total amount (cents).
- **billing_ledger_entries** - double-entry accounting. Every monetary event (CHARGE, PAYMENT, CREDIT, REFUND, ADJUSTMENT) creates an immutable, append-only entry.
- **invoice_sequences** - counter table for sequential invoice numbers. One row per year, atomically incremented.

### Invoice generation

Two modes, one endpoint. `POST /api/v1/invoices/generate` auto-detects:

- **Active subscription** → full-period invoice with base fee + overage line items
- **Cancelled subscription** → prorated invoice with base fee × (days used / total days) + full usage charges

Line items include:

- Base subscription fee (e.g., "Pro plan - monthly" × 1 = $99.00)
- Per-feature overage (e.g., "API Calls overage (55,000 used, 50,000 included)" × 5,000 = $5.00)
- HARD quota features are excluded (they block at limit, no overage to bill)
- BOOLEAN features are excluded (on/off, nothing to bill)

### Overage calculator

Pure function, all integer math:

```typescript
overageUnits = max(0, used - includedAmount)
totalMicroCents = overageUnits × overagePriceMicroCents
totalCents = Math.round(totalMicroCents / 100)
```

Where: $1.00 = 10,000 micro-cents, $0.01 = 100 micro-cents. Division by 100 converts micro-cents to cents.

Rounding happens once at the final cents conversion. This matches Stripe's approach - accumulate in the smallest unit, round once at the end.

### Invoice lifecycle

```text
DRAFT → FINALIZED → PAID
                  → VOID
DRAFT → VOID
```

| Transition        | Side effects                                                           |
| ----------------- | ---------------------------------------------------------------------- |
| DRAFT → FINALIZED | Assigns INV-YYYY-NNNN, sets due date (+30 days), creates ledger CHARGE |
| FINALIZED → PAID  | Creates ledger PAYMENT                                                 |
| FINALIZED → VOID  | Creates ledger CREDIT (reverses the charge)                            |
| DRAFT → VOID      | No ledger entry (nothing was ever charged)                             |

Invoice numbers are assigned at FINALIZE, not creation. DRAFT invoices don't get numbers - prevents gaps in the sequence from voided drafts.

### Billing ledger

Double-entry style, simplified for SaaS billing:

| Entry type | Debit   | Credit  | When                        |
| ---------- | ------- | ------- | --------------------------- |
| CHARGE     | $99.00  | $0.00   | Invoice finalized           |
| PAYMENT    | $0.00   | $99.00  | Payment received            |
| CREDIT     | $0.00   | $99.00  | Invoice voided              |
| REFUND     | $0.00   | $50.00  | Money returned (Phase 5)    |
| ADJUSTMENT | ±amount | ±amount | Manual correction (Phase 6) |

Balance = SUM(debit) - SUM(credit). Positive = tenant owes money.

Entries are immutable and append-only. To correct a mistake, add an ADJUSTMENT - never edit or delete existing entries.

### Billing cron

`BillingCronService` runs daily at 00:05 UTC:

1. Finds all subscriptions with expired billing periods (`currentPeriodEnd <= NOW()`)
2. Finds all cancelled subscriptions needing prorated invoices
3. For each: generate DRAFT → auto-finalize → advance period
4. Logs results: "2 invoices generated, 0 failures"
5. Each subscription processed independently - one failure doesn't block others

### Proration

When a tenant cancels mid-cycle:

- Base fee is prorated: `$29.00 × (7 days used / 31 total days) = $6.55`
- Usage charges are NOT prorated - billed for actual consumption
- Invoice notes show: "Prorated invoice - cancelled on 2026-05-20 (7/31 days used)"

## API endpoints

### Invoices (tenant-scoped)

| Method | Path                     | Guards                     | Description                                     |
| ------ | ------------------------ | -------------------------- | ----------------------------------------------- |
| GET    | /invoices                | JWT + Tenant               | List invoices (paginated, filterable by status) |
| GET    | /invoices/:id            | JWT + Tenant               | Get invoice with line items                     |
| GET    | /invoices/:id/line-items | JWT + Tenant               | Get line items only                             |
| POST   | /invoices/generate       | JWT + Tenant + OWNER/ADMIN | Generate invoice (auto-detects full/prorated)   |
| POST   | /invoices/:id/finalize   | JWT + Tenant + OWNER/ADMIN | DRAFT → FINALIZED                               |
| POST   | /invoices/:id/mark-paid  | JWT + Tenant + OWNER/ADMIN | FINALIZED → PAID                                |
| POST   | /invoices/:id/void       | JWT + Tenant + OWNER/ADMIN | DRAFT/FINALIZED → VOID                          |

### Billing (tenant-scoped)

| Method | Path             | Guards       | Description                                         |
| ------ | ---------------- | ------------ | --------------------------------------------------- |
| GET    | /billing/ledger  | JWT + Tenant | List ledger entries (paginated, filterable by type) |
| GET    | /billing/balance | JWT + Tenant | Get current balance                                 |

## Key decisions

| Decision                                | Why                                                           |
| --------------------------------------- | ------------------------------------------------------------- |
| Invoice number at FINALIZE only         | No gaps from voided drafts. Legal compliance.                 |
| Micro-cents (÷100) not (÷10000)         | $0.01 = 100 micro-cents. Avoids INT overflow on annual plans. |
| HARD quotas excluded from invoices      | They block at limit - no overage exists to bill.              |
| Usage NOT prorated on cancellation      | Tenant is billed for actual consumption, not estimated.       |
| One endpoint auto-detects full/prorated | Frontend doesn't need to maintain state.                      |
| Ledger entries append-only              | Corrections via ADJUSTMENT, not edits. Audit-safe.            |
| Daily cron at 00:05 UTC                 | 5-min buffer for late usage events. Simple, sufficient.       |
| Independent subscription processing     | One billing failure doesn't block others.                     |

## Seed data

| Tenant | Plan                   | Invoice       | Total     | Line items                      |
| ------ | ---------------------- | ------------- | --------- | ------------------------------- |
| Acme   | Pro ($99/mo)           | INV-2026-0001 | $99.00    | Base fee + 3 usage (no overage) |
| Globex | Starter ($29/mo)       | INV-2026-0002 | $29.00    | Base fee + 1 usage (no overage) |
| Stark  | Enterprise ($4,788/yr) | INV-2026-0003 | $4,788.00 | Base fee + 3 usage (no overage) |

## Gotchas encountered

1. **INT overflow on `unitPriceMicroCents`** - Enterprise annual base fee ($4,788) at ×10,000 = 4,788,000,000, exceeding Postgres INT max (2,147,483,647). Fixed by using ×100 conversion (cents → micro-cents) instead of ×10,000.
2. **Missing DTOs** - rushed the invoices module without response DTOs. Inconsistent with Phase 1-3 modules. Fixed: added InvoiceResponseDto, LedgerEntryResponseDto, BalanceResponseDto.
3. **Inline error returns** - used `return { statusCode: 404 }` instead of `throw new NotFoundException(ERRORS.INVOICE.NOT_FOUND)`. Bypassed the global exception filter. Fixed all instances.
4. **Overage calculator ÷10,000 bug** - micro-cents to cents conversion used ÷10,000 instead of ÷100. Caused 5 GB × $0.02/GB = $0.00 instead of $0.10. Fixed and verified with all 4 test cases.
5. **Route ordering** - `/invoices/:id/line-items` must be defined before `/invoices/:id` or NestJS interprets "line-items" as a UUID.

## Limitations carried into next phases

- **No payment provider integration** - `mark-paid` is manual. Phase 5 adds Stripe/webhook-based payment confirmation.
- **No tax calculation** - `total = subtotal` always. Tax engine is a future enhancement.
- **No PDF generation** - invoices are JSON only. PDF rendering is a future enhancement.
- **No admin endpoints for dead letter retry** - dead letter events exist but only queryable via SQL.
- **No REFUND or ADJUSTMENT endpoints** - enum values exist, no API to create them yet.
