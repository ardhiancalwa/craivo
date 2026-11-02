-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'WAITING_CASHIER';

-- CreateEnum
CREATE TYPE "IdempotencyState" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "capabilityNonce" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "quoteId" TEXT;

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "notes" TEXT;

-- AlterTable
ALTER TABLE "idempotency_records" ADD COLUMN IF NOT EXISTS "ownerId" TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE "idempotency_records" ADD COLUMN IF NOT EXISTS "state" "IdempotencyState" NOT NULL DEFAULT 'IN_PROGRESS';
ALTER TABLE "idempotency_records" ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3);
ALTER TABLE "idempotency_records" ADD COLUMN IF NOT EXISTS "orderId" TEXT;
ALTER TABLE "idempotency_records" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "idempotency_records" ALTER COLUMN "responseStatus" DROP NOT NULL;
ALTER TABLE "idempotency_records" ALTER COLUMN "responseBody" DROP NOT NULL;

-- DropIndex
DROP INDEX IF EXISTS "idempotency_records_key_key";
DROP INDEX IF EXISTS "idempotency_records_key_scope_idx";

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "idempotency_records_scope_ownerId_key_key" ON "idempotency_records"("scope", "ownerId", "key");

