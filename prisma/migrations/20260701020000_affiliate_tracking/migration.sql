ALTER TYPE "OrderAttributionSource" ADD VALUE IF NOT EXISTS 'affiliate_link';
ALTER TYPE "OrderAttributionSource" ADD VALUE IF NOT EXISTS 'shop_discount_code';
ALTER TYPE "OrderAttributionSource" ADD VALUE IF NOT EXISTS 'order_request';

ALTER TABLE "PartnerCode" ADD COLUMN IF NOT EXISTS "codePurpose" TEXT NOT NULL DEFAULT 'affiliate_tracking';
ALTER TABLE "PartnerCode" ADD COLUMN IF NOT EXISTS "commissionRateBps" INTEGER;
ALTER TABLE "PartnerCode" ADD COLUMN IF NOT EXISTS "customerDiscountBps" INTEGER;

CREATE TABLE IF NOT EXISTS "PartnerClick" (
  "id" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "partnerCodeId" TEXT NOT NULL,
  "partnerCode" TEXT NOT NULL,
  "clickId" TEXT NOT NULL,
  "landingUrl" TEXT,
  "currentUrl" TEXT,
  "referrer" TEXT,
  "source" TEXT,
  "userAgent" TEXT,
  "ipHash" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartnerClick_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PartnerClick_partnerCode_idx" ON "PartnerClick"("partnerCode");
CREATE INDEX IF NOT EXISTS "PartnerClick_clickId_idx" ON "PartnerClick"("clickId");
CREATE INDEX IF NOT EXISTS "PartnerClick_partnerId_idx" ON "PartnerClick"("partnerId");
CREATE INDEX IF NOT EXISTS "PartnerClick_occurredAt_idx" ON "PartnerClick"("occurredAt");
CREATE INDEX IF NOT EXISTS "PartnerCode_codePurpose_idx" ON "PartnerCode"("codePurpose");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PartnerClick_partnerId_fkey') THEN
    ALTER TABLE "PartnerClick" ADD CONSTRAINT "PartnerClick_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PartnerClick_partnerCodeId_fkey') THEN
    ALTER TABLE "PartnerClick" ADD CONSTRAINT "PartnerClick_partnerCodeId_fkey" FOREIGN KEY ("partnerCodeId") REFERENCES "PartnerCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
ALTER TABLE "PartnerCode" ALTER COLUMN "source" SET DEFAULT 'affiliate_link';
ALTER TABLE "PartnerOrderAttribution" ALTER COLUMN "source" SET DEFAULT 'imported';
UPDATE "PartnerCode" SET "source" = 'affiliate_link' WHERE "source"::text IN ('discount_code', 'referral_link', 'imported');
UPDATE "PartnerOrderAttribution" SET "source" = 'shop_discount_code' WHERE "source"::text = 'discount_code';
UPDATE "PartnerOrderAttribution" SET "source" = 'affiliate_link' WHERE "source"::text = 'referral_link';
UPDATE "PartnerOrderAttribution" SET "source" = 'imported' WHERE "source"::text = 'imported';
