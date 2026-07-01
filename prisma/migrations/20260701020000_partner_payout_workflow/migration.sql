-- Partner payout workflow statuses and timestamps.
ALTER TYPE "PayoutStatus" ADD VALUE IF NOT EXISTS 'approved';
ALTER TYPE "PayoutStatus" ADD VALUE IF NOT EXISTS 'rejected';

ALTER TABLE "PartnerPayout"
  ADD COLUMN IF NOT EXISTS "requestedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rejectReason" TEXT,
  ADD COLUMN IF NOT EXISTS "lastReconciledAt" TIMESTAMP(3);

UPDATE "PartnerPayout" SET "requestedAt" = COALESCE("requestedAt", "createdAt") WHERE "status" IN ('pending', 'paid', 'cancelled');
