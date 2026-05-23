# Payments and Webhook Architecture

The payment system collects money for invoices. It integrates with payment providers via an adapter pattern, processes webhook events idempotently, and handles failure retries with exponential backoff.

---

## Why this exists

Phase 4 generates invoices and tracks what tenants owe. But `mark-paid` was manual - someone had to call an endpoint to confirm payment. Phase 5 automates this: finalize an invoice → create a payment intent → provider charges the card → webhook confirms → invoice marked PAID → billing period advances.

---

## Schema overview

Two new tables:

```text
┌───────────────────────────┐
│    payment_attempts       │
│───────────────────────────│
│ id                        │
│ invoice_id          (FK)  │
│ tenant_id           (FK)  │
│ provider_payment_id (UQ)  │
│ provider                  │
│ status                    │
│ amount (cents)            │
│ currency                  │
│ failure_reason            │
│ provider_response   (JSON)│
│ retry_of                  │
│ attempt_number            │
│ next_retry_at             │
│ created_at                │
│ updated_at                │
└───────────────────────────┘

┌───────────────────────────┐
│    webhook_events         │
│───────────────────────────│
│ id                        │
│ provider_event_id   (UQ)  │
│ provider                  │
│ event_type                │
│ status                    │
│ raw_payload         (JSON)│
│ processing_error          │
│ processed_at              │
│ created_at                │
│ updated_at                │
└───────────────────────────┘
```

### Relationships

- **Invoice → PaymentAttempts:** one-to-many. One invoice can have multiple attempts (retries after failure).
- **Tenant → PaymentAttempts:** one-to-many. Denormalized `tenant_id` for filtering without JOIN.
- **WebhookEvents:** standalone. Not FK'd to anything - the provider event ID is the deduplication key.

---

## Payment adapter pattern

All provider interaction goes through `PaymentProviderBase`, an abstract class with four methods:

```typescript
abstract class PaymentProviderBase {
  abstract createPaymentIntent(
    amount,
    currency,
    metadata,
  ): Promise<CreatePaymentIntentResult>;
  abstract getPaymentStatus(providerPaymentId): Promise<PaymentStatusResult>;
  abstract refundPayment(providerPaymentId, amount?): Promise<RefundResult>;
  abstract constructWebhookEvent(rawBody, signature): Promise<WebhookEvent>;
}
```

Two implementations:

| Adapter                | When                      | Behavior                                                 |
| ---------------------- | ------------------------- | -------------------------------------------------------- |
| `FakePaymentAdapter`   | `PAYMENT_PROVIDER=fake`   | In-memory, no external calls. Configurable success rate. |
| `StripePaymentAdapter` | `PAYMENT_PROVIDER=stripe` | Real Stripe API. Signature validation on webhooks.       |

The adapter is injected via `PAYMENT_PROVIDER` token. Swapping providers requires zero code changes - just change the env var.

### Why an adapter and not direct Stripe calls

- **Testing:** fake adapter runs in CI without Stripe credentials.
- **Provider migration:** switching from Stripe to another provider means writing one new adapter class, not rewriting the entire payment flow.
- **Dev experience:** `pnpm db:seed` creates fake payment data without touching any external API.

---

## Payment flow

### Happy path: invoice finalize → paid

```text
┌─────────┐     ┌──────────────┐     ┌──────────┐     ┌─────────────┐
│ Finalize │────▶│ Create       │────▶│ Provider │────▶│ Webhook     │
│ Invoice  │     │ PaymentIntent│     │ charges  │     │ received    │
└─────────┘     └──────────────┘     └──────────┘     └──────┬──────┘
                                                              │
                       ┌──────────────────────────────────────┘
                       ▼
              ┌─────────────────┐     ┌──────────────┐     ┌──────────────┐
              │ Dedup check     │────▶│ Update       │────▶│ Mark invoice │
              │ (provider       │     │ attempt      │     │ PAID + ledger│
              │  event ID)      │     │ SUCCEEDED    │     │ PAYMENT      │
              └─────────────────┘     └──────────────┘     └──────┬───────┘
                                                                   │
                                                                   ▼
                                                          ┌──────────────┐
                                                          │ Advance      │
                                                          │ billing      │
                                                          │ period       │
                                                          └──────────────┘
```

1. Invoice finalized → `PaymentIntentService.createPaymentIntent()` fires (fire-and-forget, doesn't block the finalize response).
2. Adapter calls provider → gets back `providerPaymentId` (e.g., `pi_abc123` or `fake_pi_seed_...`).
3. A `payment_attempts` row is created with status PENDING (or SUCCEEDED if the fake adapter auto-resolves).
4. Provider sends webhook → `WebhookController` receives it.
5. `WebhookProcessingService` validates signature, checks deduplication, routes to handler.
6. `PaymentSuccessHandler` updates attempt to SUCCEEDED, marks invoice PAID, creates ledger PAYMENT, advances billing period.

### Failure path: retry with exponential backoff

```text
Day 0:  Payment fails → attempt #0, status FAILED
        Schedule retry → next_retry_at = now + 1 day

Day 1:  Retry fires → attempt #1, status FAILED
        Schedule retry → next_retry_at = now + 3 days

Day 4:  Retry fires → attempt #2, status FAILED
        Schedule retry → next_retry_at = now + 7 days

Day 11: Retry fires → attempt #3, status FAILED
        Max retries (3) reached → subscription → PAST_DUE
```

Retry intervals: 1 day, 3 days, 7 days. After 3 retries (4 total attempts), the subscription transitions to PAST_DUE. Each retry creates a new `payment_attempts` row with `retry_of` pointing to the previous attempt and an incremented `attempt_number`.

---

## Webhook processing

### Why webhooks are hard

Three problems every webhook receiver must solve:

1. **Duplicates:** Stripe retries on timeout. The same event arrives twice. Without dedup, you'd mark an invoice PAID twice and create two ledger entries.
2. **Out-of-order:** `payment_intent.succeeded` might arrive before the `payment_attempts` row is created (race condition with the create call).
3. **Timeouts:** If processing takes too long, the provider retries. Now you have concurrent processing of the same event.

### How Meterplex handles each

**Duplicates:** The `provider_event_id` column on `webhook_events` has a UNIQUE constraint. Before processing, we check if the event already exists. If it does and status is PROCESSED, skip. This is the deduplication gate.

**Out-of-order:** The `PaymentSuccessHandler` looks up the payment attempt by `provider_payment_id`. If the attempt doesn't exist yet (race condition), the handler logs a warning and returns - the event is marked PROCESSED to prevent retries. The payment attempt creation will handle the success state independently since the fake adapter returns the final status synchronously.

**Timeouts:** The webhook endpoint returns 200 immediately, then processes asynchronously. The provider sees success and doesn't retry. Processing happens in the background.

### Webhook processing flow

```text
POST /api/v1/webhooks/stripe
  │
  ├─ Return 200 immediately (don't make Stripe wait)
  │
  └─ Async processing:
       1. Validate signature (adapter.constructWebhookEvent)
       2. Check dedup (webhookEvent.findUnique by providerEventId)
       3. If exists + PROCESSED → skip
       4. Create webhookEvent row (status: PENDING)
       5. Update status → PROCESSING
       6. Route by event type:
          ├─ payment_intent.succeeded → PaymentSuccessHandler
          ├─ payment_intent.payment_failed → PaymentFailureHandler
          └─ other → mark SKIPPED
       7. Update status → PROCESSED (or FAILED with error)
```

---

## Payment status lifecycle

```text
PaymentAttempt statuses:

  PENDING ──────────▶ SUCCEEDED
     │
     └──────────────▶ FAILED ──▶ (new attempt created as retry)
                        │
                        └──▶ after max retries: subscription → PAST_DUE

WebhookEvent statuses:

  PENDING ──▶ PROCESSING ──▶ PROCESSED
                  │
                  └──────────▶ FAILED

  (unhandled event types) ──▶ SKIPPED
```

---

## API endpoints

### Webhooks (no auth - signature is the auth)

| Method | Path             | Description                    |
| ------ | ---------------- | ------------------------------ |
| POST   | /webhooks/stripe | Receive Stripe webhook events  |
| POST   | /webhooks/fake   | Test endpoint for fake adapter |

### Payment history (tenant-scoped, JWT + Tenant guard)

| Method | Path                  | Description                                             |
| ------ | --------------------- | ------------------------------------------------------- |
| GET    | /billing/payments     | List payment attempts (paginated, filterable by status) |
| GET    | /billing/payments/:id | Get payment attempt details with provider response      |

---

## Key decisions

| Decision                                     | Why                                                                |
| -------------------------------------------- | ------------------------------------------------------------------ |
| Adapter pattern for payment providers        | Swap providers without code changes. Fake adapter for dev/CI.      |
| Fire-and-forget payment intent on finalize   | Don't block the finalize response waiting for Stripe.              |
| Return 200 before processing webhook         | Stripe retries on non-2xx. Process async to avoid timeout retries. |
| Dedup by provider_event_id unique constraint | Database-level guarantee. No application-level race conditions.    |
| Denormalized tenant_id on payment_attempts   | Filter by tenant without joining through invoice.                  |
| retry_of FK chain on attempts                | Full retry history traceable. Each attempt is its own record.      |
| Exponential backoff (1d, 3d, 7d)             | Gives transient failures time to resolve without spam.             |
| PAST_DUE after max retries, not CANCELLED    | Gives the tenant a chance to update payment method.                |

---

## Seed data

| Tenant | Invoice       | Payment ID               | Amount    | Status    |
| ------ | ------------- | ------------------------ | --------- | --------- |
| Acme   | INV-2026-0001 | fake_pi_seed_inv20260001 | $99.00    | SUCCEEDED |
| Globex | INV-2026-0002 | fake_pi_seed_inv20260002 | $29.00    | SUCCEEDED |
| Stark  | INV-2026-0003 | fake_pi_seed_inv20260003 | $4,788.00 | SUCCEEDED |

Each seed invoice has: 1 payment attempt (SUCCEEDED), 1 webhook event (PROCESSED), invoice status PAID, ledger PAYMENT entry.

---

## Future enhancements

- **Stripe integration testing:** real Stripe test-mode keys in CI with webhook forwarding via Stripe CLI.
- **Refund endpoint:** `POST /billing/payments/:id/refund` creates a refund via adapter + ledger REFUND entry.
- **Admin webhook events API:** `GET /admin/webhook-events` for support/debugging (WebhookEventResponseDto is pre-built).
- **Payment method management:** store/update cards via Stripe Customer + SetupIntent.
- **Dunning emails:** automated emails on payment failure with retry schedule.
- **SCA/3DS support:** handle REQUIRES_ACTION status for Strong Customer Authentication.
