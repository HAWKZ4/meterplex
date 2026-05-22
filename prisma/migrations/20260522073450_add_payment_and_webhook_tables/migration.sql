-- CreateEnum
CREATE TYPE "payment_attempt_status" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REQUIRES_ACTION');

-- CreateEnum
CREATE TYPE "webhook_event_status" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "payment_attempts" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "provider_payment_id" VARCHAR(255) NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "status" "payment_attempt_status" NOT NULL DEFAULT 'PENDING',
    "amount" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'usd',
    "failure_reason" VARCHAR(1000),
    "provider_response" JSONB,
    "retry_of" UUID,
    "attempt_number" INTEGER NOT NULL DEFAULT 0,
    "next_retry_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" UUID NOT NULL,
    "provider_event_id" VARCHAR(255) NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "status" "webhook_event_status" NOT NULL DEFAULT 'PENDING',
    "raw_payload" JSONB NOT NULL,
    "processing_error" TEXT,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_attempts_provider_payment_id_key" ON "payment_attempts"("provider_payment_id");

-- CreateIndex
CREATE INDEX "payment_attempts_invoice_id_idx" ON "payment_attempts"("invoice_id");

-- CreateIndex
CREATE INDEX "payment_attempts_tenant_id_idx" ON "payment_attempts"("tenant_id");

-- CreateIndex
CREATE INDEX "payment_attempts_status_idx" ON "payment_attempts"("status");

-- CreateIndex
CREATE INDEX "payment_attempts_next_retry_at_idx" ON "payment_attempts"("next_retry_at");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_provider_event_id_key" ON "webhook_events"("provider_event_id");

-- CreateIndex
CREATE INDEX "webhook_events_status_idx" ON "webhook_events"("status");

-- CreateIndex
CREATE INDEX "webhook_events_event_type_idx" ON "webhook_events"("event_type");

-- CreateIndex
CREATE INDEX "webhook_events_created_at_idx" ON "webhook_events"("created_at");

-- AddForeignKey
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
