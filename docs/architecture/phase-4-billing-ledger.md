# Billing Ledger and Invoice Architecture

The billing system turns usage aggregates into money. It generates invoices, tracks every monetary event in an immutable ledger, and handles the full invoice lifecycle from draft to payment.

---

## Why this exists

Phase 3 answers "how much did Acme use?" Phase 4 answers "how much does Acme owe?"

Without a billing layer, Meterplex knows Acme used 35,000 API calls but can't tell them they owe $99 (base fee, no overage since they're under the 50,000 limit). The billing ledger is the financial source of truth - every dollar in, every dollar out, traceable to a source document.

---

## Schema overview

Four tables power the billing system:

```text
┌──────────────────────┐
│     invoices         │
│──────────────────────│
│ id                   │
│ tenant_id       (FK) │
│ subscription_id      │
│ invoice_number       │
│ status               │
│ subtotal (cents)     │
│ total (cents)        │
│ period_start         │
│ period_end           │
│ due_date             │
│ finalized_at         │
│ paid_at              │
│ voided_at            │
└────────┬─────────────┘
         │ 1:N
         ▼
┌───────────────────────┐
│ invoice_line_items    │
│───────────────────────│
│ id                    │
│ invoice_id      (FK)  │
│ description           │
│ feature_lookup_key    │
│ quantity              │
│ unit_price_micro_cents│
│ amount (cents)        │
│ sort_order            │
└───────────────────────┘

┌───────────────────────┐
│ billing_ledger_entries│
│───────────────────────│
│ id                    │
│ tenant_id       (FK)  │
│ invoice_id      (FK)  │
│ type                  │
│ description           │
│ debit (cents)         │
│ credit (cents)        │
│ currency              │
│ external_reference    │
│ created_at            │
└───────────────────────┘

┌──────────────────────┐
│ invoice_sequences    │
│──────────────────────│
│ year            (PK) │
│ last_value           │
└──────────────────────┘
```

### Relationships

- **Invoice → Line Items:** one-to-many. Each invoice has 1+ line items. Cascade delete (if invoice is deleted, line items go with it).
- **Invoice → Ledger Entries:** one-to-many. A FINALIZED invoice has a CHARGE entry. A PAID invoice adds a PAYMENT entry. A VOID invoice adds a CREDIT entry.
- **Tenant → Invoices:** one-to-many. Each tenant has zero or more invoices.
- **Tenant → Ledger Entries:** one-to-many. The ledger is tenant-scoped for balance calculation.
- **Invoice Sequences:** standalone. One row per year, atomically incremented for invoice number generation.

---

## Invoice lifecycle

```text
         ┌───────────┐
         │  DRAFT    │
         │ (editable)│
         └────┬──────┘
              │
           finalize
              │
              ▼
         ┌──────────┐
         │FINALIZED │────────────┐
         │ (locked) │            │
         └────┬─────┘            │
              │                  │
           mark-paid            void
              │                  │
              ▼                  ▼
         ┌──────────┐     ┌──────────┐
         │   PAID   │     │   VOID   │
         │(complete)│     │(reversed)│
         └──────────┘     └──────────┘
```

### State descriptions

| State     | Editable | Visible to tenant | Ledger entry                     | Invoice number         |
| --------- | -------- | ----------------- | -------------------------------- | ---------------------- |
| DRAFT     | Yes      | No                | None                             | None                   |
| FINALIZED | No       | Yes               | CHARGE created                   | INV-YYYY-NNNN assigned |
| PAID      | No       | Yes               | PAYMENT created                  | Preserved              |
| VOID      | No       | Yes (marked void) | CREDIT created (reverses charge) | Preserved              |

### Transition rules

- **DRAFT → FINALIZED:** assigns invoice number, sets due date (now + 30 days), creates ledger CHARGE entry.
- **FINALIZED → PAID:** creates ledger PAYMENT entry, records payment timestamp.
- **FINALIZED → VOID:** creates ledger CREDIT entry (reverses the original charge), records void timestamp.
- **DRAFT → VOID:** no ledger entry needed (nothing was ever charged). Records void timestamp.
- **PAID → anything:** not allowed. Payment is final.
- **VOID → anything:** not allowed. Void is final. Create a new invoice to correct.

### Why DRAFT exists

Auto-finalize is convenient but dangerous. The DRAFT state allows:

- Review before the tenant sees it
- Correction of line items before locking
- Deletion without wasting an invoice number
- Testing invoice generation without creating real charges

The billing cron auto-finalizes immediately after generating, but the manual `POST /invoices/generate` endpoint creates a DRAFT for human review.

---

## Invoice number generation

Format: `INV-{YEAR}-{SEQUENCE}` (e.g., INV-2026-0001, INV-2026-0002).

### Why at FINALIZE, not at creation

If numbers were assigned at creation:

1. Create DRAFT → INV-2026-0001
2. Create DRAFT → INV-2026-0002
3. Void INV-2026-0001 (never sent)
4. Create DRAFT → INV-2026-0003

The sequence now has a gap (0001 was never used). Many jurisdictions require sequential invoice numbers with no gaps for tax compliance.

By assigning at finalization:

1. Create DRAFT → no number
2. Create DRAFT → no number
3. Void first DRAFT → no number wasted
4. Finalize second DRAFT → INV-2026-0001 (first real invoice)

No gaps. Legally compliant.

### Atomicity

The counter uses Postgres atomic upsert:

```sql
INSERT INTO invoice_sequences (year, last_value)
VALUES (2026, 1)
ON CONFLICT (year)
DO UPDATE SET last_value = invoice_sequences.last_value + 1
RETURNING last_value AS next_value
```

Even under concurrent invoice generation, no two invoices get the same number.

---

## Overage calculation

The overage calculator is a pure function with no side effects, no database calls, and no floating-point math.

### The formula

```typescript
overageUnits = max(0, used - includedAmount)
totalMicroCents = overageUnits × overagePriceMicroCents
totalCents = Math.round(totalMicroCents / 100)
```

### Unit system

| Value   | Micro-cents | Cents | Dollars |
| ------- | ----------- | ----- | ------- |
| $1.00   | 10,000      | 100   | 1.00    |
| $0.01   | 100         | 1     | 0.01    |
| $0.001  | 10          | 0.1   | 0.001   |
| $0.0005 | 5           | 0.05  | 0.0005  |

Conversion: `micro-cents ÷ 100 = cents`

### Why ÷100 and not ÷10,000

The original implementation used ÷10,000 which was incorrect:

- `$0.02/GB × 5 GB = 1,000 micro-cents`
- `1,000 ÷ 10,000 = 0.1` → rounds to 0 cents ❌
- `1,000 ÷ 100 = 10 cents` → correct ✅

The error: $1.00 = 10,000 micro-cents, so $0.01 = 100 micro-cents. Converting micro-cents to cents requires ÷100, not ÷10,000.

### Why round once at the end

Per-unit rounding loses money:

```text
1,000 units at $0.001/unit:
  Per-unit:  1,000 × round($0.001) = 1,000 × $0.00 = $0.00 ❌
  Per-total: round(1,000 × $0.001) = round($1.00) = $1.00 ✅
```

Accumulate in the smallest unit, round once. This is how Stripe handles sub-cent pricing.

### Verified test cases

| Scenario       | Used   | Included | Price/unit | Overage units | Total |
| -------------- | ------ | -------- | ---------- | ------------- | ----- |
| Under limit    | 35,000 | 50,000   | $0.001     | 0             | $0.00 |
| Over limit     | 55,000 | 50,000   | $0.001     | 5,000         | $5.00 |
| Under included | 7 GB   | 10 GB    | $0.02      | 0             | $0.00 |
| Over included  | 15 GB  | 10 GB    | $0.02      | 5 GB          | $0.10 |

All four pass with the ÷100 formula.

---

## Double-entry billing ledger

### Why not just track invoices?

Invoices show what we charged. They don't show:

- What we received (payments)
- What we reversed (voids, refunds)
- What we adjusted (manual corrections)
- The net balance (what the tenant actually owes)

The ledger answers: "how did we get to this balance?" Every dollar is traceable.

### Simplified double-entry model

Full double-entry accounting uses separate debit and credit accounts (assets, liabilities, revenue, etc.). That's overkill for SaaS billing.

Our model: each entry has a `debit` and `credit` amount on a single row. The balance formula is:

```typescript
balance = SUM(debit) - SUM(credit);
```

| Event             | Debit   | Credit  | Effect on balance          |
| ----------------- | ------- | ------- | -------------------------- |
| Invoice finalized | $99.00  | $0.00   | +$99.00 (tenant owes more) |
| Payment received  | $0.00   | $99.00  | -$99.00 (tenant owes less) |
| Invoice voided    | $0.00   | $99.00  | -$99.00 (charge reversed)  |
| Refund issued     | $0.00   | $50.00  | -$50.00 (money returned)   |
| Manual adjustment | ±amount | ±amount | depends                    |

Positive balance = tenant owes money. Negative balance = tenant has credit (overpaid or has promotional credit).

### Immutability

Ledger entries have:

- `created_at` - when the entry was created
- No `updated_at` - entries are never modified
- No delete method - entries are never removed

To correct a mistake: add an ADJUSTMENT entry. The original wrong entry stays for audit trail.

### Why this matters

This is the table auditors look at. When a tenant disputes a charge, you show them:

```text
INV-2026-0001 finalized  → CHARGE  +$99.00
INV-2026-0001 voided     → CREDIT  -$99.00
INV-2026-0002 finalized  → CHARGE  +$99.00
Payment received          → PAYMENT -$99.00
Balance: $0.00
```

Every dollar accounted for. No mysteries.

---

## Invoice generation flow

### Full-period invoice

Triggered by billing cron (auto) or `POST /invoices/generate` (manual):

```text
1. Load subscription + plan + price
2. Load entitlement snapshots for subscription
3. Load usage aggregates for tenant + period
4. Create line items:
   a. Base subscription fee (quantity=1, amount=price in cents)
   b. For each SOFT quota / METERED feature:
      - Calculate overage: max(0, used - included) × price
      - Add line item even if overage = 0 (transparency)
   c. Skip BOOLEAN features (nothing to bill)
   d. Skip HARD quota features (they block, no overage)
5. Sum line items → subtotal → total
6. Create DRAFT invoice with line items in one transaction
```

### Prorated invoice (mid-cycle cancellation)

Same endpoint, auto-detected when `subscription.cancelledAt < currentPeriodEnd`:

```text
1. Calculate proration factor:
   factor = (cancelledAt - periodStart) / (periodEnd - periodStart)
   Example: 7 days used out of 31 → factor = 0.226

2. Prorate base fee:
   $29.00 × 0.226 = $6.55 (rounded to nearest cent)

3. Usage charges NOT prorated:
   Billed for actual consumption regardless of cancellation date

4. Invoice period_end set to cancelledAt (not original period end)
5. Notes: "Prorated invoice - cancelled on 2026-05-20 (7/31 days used)"
```

### Why usage is not prorated

If a tenant uses 950 API calls in 7 days and cancels, they owe for 950 calls - not `950 × (7/31) = 215 calls`. They actually consumed those resources. The base fee covers the right to access the platform; usage charges cover actual consumption.

This matches how AWS, GCP, and Stripe handle prorated billing: subscription fees are prorated, usage charges are not.

---

## Billing period cron

`BillingCronService` runs at `0 5 0 * * *` (00:05 UTC daily).

### Flow

```text
1. Find expired periods:
   WHERE status IN (ACTIVE, TRIALING)
   AND current_period_end <= NOW()
   AND no existing invoice for this period

2. Find cancelled subscriptions:
   WHERE cancelled_at IS NOT NULL
   AND no prorated invoice exists

3. For each expired period:
   a. Generate DRAFT invoice
   b. Auto-finalize (assigns number, creates CHARGE)
   c. Advance subscription to next period

4. For each cancelled subscription:
   a. Generate prorated DRAFT invoice
   b. Auto-finalize

5. Log: "2 invoices generated, 0 failures"
```

### Error handling

Each subscription is processed independently in a try/catch:

```typescript
for (const subscription of billable) {
  try {
    // generate → finalize → advance
  } catch (error) {
    failed++;
    logger.error(`Failed to bill ${subscription.id}: ${error.message}`);
    // Continue to next - don't block other tenants
  }
}
```

A billing failure for one tenant doesn't block others. Failed subscriptions still have expired periods, so the next cron tick retries them automatically.

### Why 00:05 UTC and not 00:00

Usage events timestamped at 23:59:59 might still be in the Kafka pipeline at midnight. The 5-minute buffer ensures all events from the previous day are aggregated before invoice generation starts.

---

## Monetary amount conventions

| Field                                       | Unit        | Example                               |
| ------------------------------------------- | ----------- | ------------------------------------- |
| `plan_prices.amount`                        | cents       | 9900 ($99.00)                         |
| `invoice.subtotal`                          | cents       | 9900                                  |
| `invoice.total`                             | cents       | 9900                                  |
| `invoice_line_items.amount`                 | cents       | 9900                                  |
| `invoice_line_items.unit_price_micro_cents` | micro-cents | 990000 (for $99 base fee: 9900 × 100) |
| `entitlement.overage_price`                 | micro-cents | 10 ($0.001)                           |
| `billing_ledger_entries.debit`              | cents       | 9900                                  |
| `billing_ledger_entries.credit`             | cents       | 9900                                  |

Rule: all storage is integer. No floats anywhere in the billing path. The only floating-point operation is the proration factor calculation, and the result is immediately rounded to the nearest cent via `Math.round()`.

---

## Future enhancements

- **Tax calculation:** `total = subtotal + tax`. Requires tax rate per jurisdiction.
- **PDF invoice generation:** render invoice to PDF for download/email.
- **Credit wallet / prepaid balance:** AI credits, top-ups, promotional discounts.
- **Timezone-aware billing periods:** period boundaries respect tenant timezone.
- **Webhook on invoice events:** notify external systems when invoices are finalized/paid.
- **Batch invoice generation:** generate all invoices in parallel for large-scale deployments.
