ALTER TYPE "OrderAttributionSource" ADD VALUE IF NOT EXISTS 'affiliate_link';
ALTER TYPE "OrderAttributionSource" ADD VALUE IF NOT EXISTS 'shop_discount_code';
ALTER TYPE "OrderAttributionSource" ADD VALUE IF NOT EXISTS 'order_request';
ALTER TYPE "OrderAttributionSource" ADD VALUE IF NOT EXISTS 'none';

ALTER TABLE "PartnerCode" ADD COLUMN "codePurpose" TEXT NOT NULL DEFAULT 'affiliate_tracking';
ALTER TABLE "PartnerCode" ADD COLUMN "commissionRateBps" INTEGER;
ALTER TABLE "PartnerCode" ADD COLUMN "customerDiscountBps" INTEGER;

CREATE TABLE "PartnerClick" (
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

CREATE INDEX "PartnerClick_partnerCode_idx" ON "PartnerClick"("partnerCode");
CREATE INDEX "PartnerClick_clickId_idx" ON "PartnerClick"("clickId");
CREATE INDEX "PartnerClick_partnerId_idx" ON "PartnerClick"("partnerId");
CREATE INDEX "PartnerClick_occurredAt_idx" ON "PartnerClick"("occurredAt");
ALTER TABLE "PartnerClick" ADD CONSTRAINT "PartnerClick_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartnerClick" ADD CONSTRAINT "PartnerClick_partnerCodeId_fkey" FOREIGN KEY ("partnerCodeId") REFERENCES "PartnerCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartnerCode" ALTER COLUMN "source" SET DEFAULT 'affiliate_link';
ALTER TABLE "PartnerOrderAttribution" ALTER COLUMN "source" SET DEFAULT 'none';
UPDATE "PartnerCode" SET "source" = 'affiliate_link' WHERE "source"::text IN ('discount_code', 'referral_link', 'imported');
UPDATE "PartnerOrderAttribution" SET "source" = 'shop_discount_code' WHERE "source"::text = 'discount_code';
UPDATE "PartnerOrderAttribution" SET "source" = 'affiliate_link' WHERE "source"::text = 'referral_link';
UPDATE "PartnerOrderAttribution" SET "source" = 'none' WHERE "source"::text = 'imported';
