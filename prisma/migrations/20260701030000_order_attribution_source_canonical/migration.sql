-- Canonicalize OrderAttributionSource values. Unattributed orders are represented
-- by PartnerOrder.partnerId = NULL and no PartnerOrderAttribution row; `none` is
-- not a persisted enum value.
ALTER TYPE "OrderAttributionSource" ADD VALUE IF NOT EXISTS 'discount_code';
ALTER TYPE "OrderAttributionSource" ADD VALUE IF NOT EXISTS 'referral_link';
ALTER TYPE "OrderAttributionSource" ADD VALUE IF NOT EXISTS 'affiliate_link';
ALTER TYPE "OrderAttributionSource" ADD VALUE IF NOT EXISTS 'shop_discount_code';
ALTER TYPE "OrderAttributionSource" ADD VALUE IF NOT EXISTS 'manual';
ALTER TYPE "OrderAttributionSource" ADD VALUE IF NOT EXISTS 'order_request';
ALTER TYPE "OrderAttributionSource" ADD VALUE IF NOT EXISTS 'imported';

ALTER TABLE "PartnerOrderAttribution" ALTER COLUMN "source" DROP DEFAULT;
ALTER TABLE "PartnerCode" ALTER COLUMN "source" DROP DEFAULT;

DELETE FROM "PartnerOrderAttribution" WHERE "source"::text = 'none';
UPDATE "PartnerOrder" po
SET "partnerId" = NULL
WHERE NOT EXISTS (
  SELECT 1 FROM "PartnerOrderAttribution" poa WHERE poa."orderId" = po."id"
);

ALTER TYPE "OrderAttributionSource" RENAME TO "OrderAttributionSource_old";
CREATE TYPE "OrderAttributionSource" AS ENUM (
  'discount_code',
  'referral_link',
  'affiliate_link',
  'shop_discount_code',
  'manual',
  'order_request',
  'imported'
);
ALTER TABLE "PartnerCode"
  ALTER COLUMN "source" TYPE "OrderAttributionSource"
  USING "source"::text::"OrderAttributionSource";
ALTER TABLE "PartnerOrderAttribution"
  ALTER COLUMN "source" TYPE "OrderAttributionSource"
  USING "source"::text::"OrderAttributionSource";
DROP TYPE "OrderAttributionSource_old";

ALTER TABLE "PartnerCode" ALTER COLUMN "source" SET DEFAULT 'affiliate_link';
