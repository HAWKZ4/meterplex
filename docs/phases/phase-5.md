# Phase 5 - Payments and Webhook Processing

**Goal:** Collect money for invoices via payment providers, process webhook events idempotently, and automate the billing cycle from invoice finalization to payment confirmation.

**Status:** ✅ Complete

---

## TLDR

Phase 5 is complete. Here's what was built:

- Payment provider adapter pattern (fake + Stripe implementations)
- Payment intent creation on invoice finalize (fire-and-forget)
- Webhook receiver with signature validation and async processing
- Webhook deduplication via provider_event_id unique constraint
- Payment success handler: mark paid → ledger PAYMENT → advance period
- Payment failure handler: exponential backoff retries (1d, 3d, 7d) → PAST_DUE
- Tenant-scoped payment history API (list + detail endpoints)
- Seed data: 3 payments (SUCCEEDED), 3 webhook events (PROCESSED), invoices marked PAID

## What was built

### Payment adapter pattern

Abstract `PaymentProviderBase` with four methods: `createPaymentIntent`, `getPaymentStatus`, `refundPayment`, `constructWebhookEvent`. Two implementations:

- **FakePaymentAdapter** - in-memory, no external calls. Configurable success rate via `FAKE_PAYMENT_SUCCESS_RATE` env var. Used in dev/test.
- **StripePaymentAdapter** - real Stripe API calls. Signature validation on webhooks via `stripe-signature` header.

Provider selected via `PAYMENT_PROVIDER` env var. Injected as `PAYMENT_PROVIDER` token.

### Webhook processing

Single entry point: `POST /api/v1/webhooks/stripe` (or `/fake` for testing). No auth guard - signature validation IS the authentication.

Processing flow: return 200 immediately → validate signature → check dedup → route by event type → update status. Three problem areas handled:

- **Duplicates:** `provider_event_id` UNIQUE constraint + existence check before processing.
- **Out-of-order:** handler gracefully skips if payment attempt not found yet.
- **Timeouts:** 200 returned before processing starts; provider doesn't retry.

### Payment success flow

`payment_intent.succeeded` webhook → find payment attempt by `provider_payment_id` → update to SUCCEEDED → call `invoiceLifecycle.markPaid()` (creates ledger PAYMENT entry) → call `billingPeriod.advancePeriod()`. Period advance is wrapped in try/catch - if it fails, invoice is still PAID (correct state) and the billing cron catches it next tick.

### Payment failure flow

`payment_intent.payment_failed` webhook → update attempt to FAILED with `failure_reason` → check retry count. If under max retries (3), schedule next attempt with exponential backoff. If at max retries, transition subscription to PAST_DUE.

Retry schedule: attempt 0 (original) → 1 day → attempt 1 → 3 days → attempt 2 → 7 days → attempt 3 → PAST_DUE.

### Payment history API

Added to `BillingLedgerController`:

- `GET /api/v1/billing/payments` - paginated, filterable by status. Includes `invoiceNumber` via join.
- `GET /api/v1/billing/payments/:id` - full details including `providerResponse`.

Both tenant-scoped via JWT + TenantGuard.

### Data model

Two new tables: `payment_attempts` (tracks each payment attempt with status, provider ID, retry chain) and `webhook_events` (raw event log with processing status and dedup key).

## API endpoints

### Webhooks

| Method | Path             | Guards | Description                    |
| ------ | ---------------- | ------ | ------------------------------ |
| POST   | /webhooks/stripe | None   | Receive Stripe webhook events  |
| POST   | /webhooks/fake   | None   | Test endpoint for fake adapter |

### Payment history

| Method | Path                  | Guards       | Description                       |
| ------ | --------------------- | ------------ | --------------------------------- |
| GET    | /billing/payments     | JWT + Tenant | List payment attempts (paginated) |
| GET    | /billing/payments/:id | JWT + Tenant | Get payment attempt details       |

## Key decisions

| Decision                    | Why                                                       |
| --------------------------- | --------------------------------------------------------- |
| Adapter pattern             | Swap providers without code changes. Fake adapter for CI. |
| Fire-and-forget on finalize | Don't block finalize response waiting for Stripe.         |
| 200 before processing       | Avoid provider timeout retries.                           |
| Dedup at DB level           | UNIQUE constraint eliminates application-level races.     |
| Denormalized tenant_id      | Query payments by tenant without invoice JOIN.            |
| Period advance in try/catch | Non-critical; cron retries next day if it fails.          |
| PAST_DUE not CANCELLED      | Gives tenant time to fix payment method.                  |

## Seed data

| Tenant | Invoice       | Payment ID               | Amount    | Status    |
| ------ | ------------- | ------------------------ | --------- | --------- |
| Acme   | INV-2026-0001 | fake_pi_seed_inv20260001 | $99.00    | SUCCEEDED |
| Globex | INV-2026-0002 | fake_pi_seed_inv20260002 | $29.00    | SUCCEEDED |
| Stark  | INV-2026-0003 | fake_pi_seed_inv20260003 | $4,788.00 | SUCCEEDED |

## Gotchas encountered

1. **Payment history endpoints in BillingLedgerController** - initially looked for them in the payments module. They live in the invoices module's `BillingLedgerController` since they share the `/billing/` route prefix and tenant-scoping pattern.
2. **WebhookEventResponseDto unused** - DTO created ahead of the admin webhook listing endpoint (Phase 6). Exported from dto barrel but not consumed by any controller yet. Left intentionally for forward compatibility.
3. **Raw body requirement for Stripe signatures** - Stripe signature validation needs the exact bytes received, not parsed JSON. Required raw body parser middleware configuration.

## Limitations carried into next phases

- **No refund endpoint** - `RefundResult` type exists in the adapter but no API endpoint to trigger refunds.
- **No admin webhook viewer** - `WebhookEventResponseDto` is pre-built but no controller exposes it yet.
- **No payment method management** - no Stripe Customer/SetupIntent integration for storing cards.
- **No dunning emails** - payment failures are tracked but no notifications sent.
- **No SCA/3DS** - `REQUIRES_ACTION` status exists in the enum but no flow handles it.
