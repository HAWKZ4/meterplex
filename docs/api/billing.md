# Billing API

The Billing API provides access to ledger entries, balance, and payment history. All endpoints are tenant-scoped - they require a valid JWT and `x-tenant-id` header.

---

## Get Billing Ledger

Returns paginated ledger entries for the tenant, newest first.

**Endpoint:** `GET /api/v1/billing/ledger`

### Query Parameters

| Parameter | Type   | Default | Description                                                 |
| :-------- | :----- | :------ | :---------------------------------------------------------- |
| `page`    | number | 1       | Page number                                                 |
| `limit`   | number | 20      | Results per page (max 100)                                  |
| `type`    | string | -       | Filter by type: CHARGE, PAYMENT, CREDIT, REFUND, ADJUSTMENT |

### Response

```json
{
  "data": [
    {
      "id": "uuid",
      "tenantId": "uuid",
      "invoiceId": "uuid",
      "type": "CHARGE",
      "description": "Invoice INV-2026-0001 finalized",
      "debit": 9900,
      "credit": 0,
      "currency": "usd",
      "externalReference": null,
      "createdAt": "2026-05-22T10:00:00Z"
    }
  ],
  "meta": { "total": 6, "page": 1, "limit": 20, "totalPages": 1 }
}
```

---

## Get Balance

Returns the tenant's current billing balance.

**Endpoint:** `GET /api/v1/billing/balance`

### Response

```json
{
  "tenantId": "uuid",
  "currency": "usd",
  "balance": 0,
  "totalCharged": 9900,
  "totalPaid": 9900,
  "unit": "cents",
  "asOf": "2026-05-22T10:00:00Z"
}
```

Balance = SUM(debit) - SUM(credit). Positive means the tenant owes money. Zero means fully paid.

---

## List Payment Attempts

Returns paginated payment attempts for the tenant, newest first.

**Endpoint:** `GET /api/v1/billing/payments`

### Query Parameters

| Parameter | Type   | Default | Description                                                    |
| :-------- | :----- | :------ | :------------------------------------------------------------- |
| `page`    | number | 1       | Page number                                                    |
| `limit`   | number | 20      | Results per page (max 100)                                     |
| `status`  | string | -       | Filter: PENDING, SUCCEEDED, FAILED, CANCELLED, REQUIRES_ACTION |

### Response

```json
{
  "data": [
    {
      "id": "uuid",
      "invoiceId": "uuid",
      "invoiceNumber": "INV-2026-0001",
      "tenantId": "uuid",
      "providerPaymentId": "fake_pi_seed_inv20260001",
      "provider": "fake",
      "status": "SUCCEEDED",
      "amount": 9900,
      "currency": "usd",
      "failureReason": null,
      "attemptNumber": 0,
      "nextRetryAt": null,
      "createdAt": "2026-05-22T10:00:00Z",
      "updatedAt": "2026-05-22T10:00:00Z"
    }
  ],
  "meta": { "total": 1, "page": 1, "limit": 20, "totalPages": 1 }
}
```

---

## Get Payment Attempt Details

Returns a single payment attempt with full provider response.

**Endpoint:** `GET /api/v1/billing/payments/:id`

### Path Parameters

| Parameter | Type | Description          |
| :-------- | :--- | :------------------- |
| `id`      | UUID | Payment attempt UUID |

### Response

```json
{
  "id": "uuid",
  "invoiceId": "uuid",
  "invoiceNumber": "INV-2026-0001",
  "tenantId": "uuid",
  "providerPaymentId": "fake_pi_seed_inv20260001",
  "provider": "fake",
  "status": "SUCCEEDED",
  "amount": 9900,
  "currency": "usd",
  "failureReason": null,
  "attemptNumber": 0,
  "nextRetryAt": null,
  "providerResponse": {
    "source": "seed",
    "status": "succeeded"
  },
  "createdAt": "2026-05-22T10:00:00Z",
  "updatedAt": "2026-05-22T10:00:00Z"
}
```

### Error Responses

| Status | Description               |
| :----- | :------------------------ |
| 404    | Payment attempt not found |

---

## Webhook Endpoints

These endpoints receive events from payment providers. They have NO authentication guard - the provider's signature is the authentication.

### Stripe Webhook

**Endpoint:** `POST /api/v1/webhooks/stripe`

Requires `stripe-signature` header. Returns 200 immediately; processes asynchronously.

### Fake Webhook (dev/test only)

**Endpoint:** `POST /api/v1/webhooks/fake`

Accepts JSON body directly. No signature validation. Use for testing payment flows locally.

### Simulating a payment webhook

```bash
curl -X POST http://localhost:3000/api/v1/webhooks/fake \
  -H "Content-Type: application/json" \
  -d '{
    "type": "payment.succeeded",
    "providerPaymentId": "fake_pi_test_001",
    "amount": 9900,
    "currency": "usd"
  }'
```
