-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "PrintDocumentType" AS ENUM ('CUSTOMER_RECEIPT', 'KITCHEN_TICKET', 'SUMMARY_REPORT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable tables
ALTER TABLE "tables" ADD COLUMN IF NOT EXISTS "label" TEXT;

-- AlterTable cravio_configs
ALTER TABLE "cravio_configs" ADD COLUMN IF NOT EXISTS "isTaxInclusive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "cravio_configs" ADD COLUMN IF NOT EXISTS "openingHours" TEXT DEFAULT '08:00 - 22:00 WIB';
ALTER TABLE "cravio_configs" ADD COLUMN IF NOT EXISTS "quizVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "cravio_configs" ADD COLUMN IF NOT EXISTS "productionDomain" TEXT;

-- AlterTable menu_items
ALTER TABLE "menu_items" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable payment_attempts
ALTER TABLE "payment_attempts" ADD COLUMN IF NOT EXISTS "merchantOrderId" TEXT;

-- AlterTable print_logs
ALTER TABLE "print_logs" ADD COLUMN IF NOT EXISTS "documentType" "PrintDocumentType" NOT NULL DEFAULT 'CUSTOMER_RECEIPT';

-- AlterTable quiz_options
ALTER TABLE "quiz_options" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable quiz_questions
ALTER TABLE "quiz_questions" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "quiz_questions" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable staff_users
ALTER TABLE "staff_users" ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "staff_users" ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3);

-- CreateTable menu_images
CREATE TABLE IF NOT EXISTS "menu_images" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "menu_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "menu_images_filename_key" ON "menu_images"("filename");
CREATE INDEX IF NOT EXISTS "menu_images_hash_idx" ON "menu_images"("hash");

-- CreateTable rate_limit_records
CREATE TABLE IF NOT EXISTS "rate_limit_records" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 1,
    "expireAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_limit_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "rate_limit_records_key_key" ON "rate_limit_records"("key");
CREATE INDEX IF NOT EXISTS "rate_limit_records_expireAt_idx" ON "rate_limit_records"("expireAt");
