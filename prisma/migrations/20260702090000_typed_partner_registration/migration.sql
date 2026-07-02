-- Add typed onboarding profile fields and the agency partner type.
ALTER TYPE "PartnerTypeCode" ADD VALUE IF NOT EXISTS 'agency';

ALTER TABLE "PartnerProfile"
  ADD COLUMN IF NOT EXISTS "contactName" TEXT,
  ADD COLUMN IF NOT EXISTS "shopName" TEXT,
  ADD COLUMN IF NOT EXISTS "businessName" TEXT,
  ADD COLUMN IF NOT EXISTS "storeAddress" TEXT,
  ADD COLUMN IF NOT EXISTS "warehouseAddress" TEXT,
  ADD COLUMN IF NOT EXISTS "cityProvince" TEXT,
  ADD COLUMN IF NOT EXISTS "salesChannel" TEXT,
  ADD COLUMN IF NOT EXISTS "customerSegment" TEXT,
  ADD COLUMN IF NOT EXISTS "displayAreaNote" TEXT,
  ADD COLUMN IF NOT EXISTS "expectedDisplayQuantity" INTEGER,
  ADD COLUMN IF NOT EXISTS "businessModelNote" TEXT,
  ADD COLUMN IF NOT EXISTS "expectedOpeningOrderAmount" INTEGER,
  ADD COLUMN IF NOT EXISTS "coverageArea" TEXT,
  ADD COLUMN IF NOT EXISTS "taxCode" TEXT,
  ADD COLUMN IF NOT EXISTS "hasOfflineStore" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "hasLivestream" BOOLEAN;

UPDATE "PartnerProfile"
SET "contactName" = COALESCE("contactName", "fullName"),
    "cityProvince" = COALESCE("cityProvince", "area"),
    "salesChannel" = COALESCE("salesChannel", "sellingChannel");

INSERT INTO "PartnerType" ("id", "code", "name", "description", "enabled", "createdAt", "updatedAt")
VALUES (concat('ptype_', replace(gen_random_uuid()::text, '-', '')), 'agency', 'Đại lý', 'Đối tác nhập hàng bán lại hoặc phân phối.', true, now(), now())
ON CONFLICT ("code") DO UPDATE SET "enabled" = true, "name" = EXCLUDED."name", "description" = EXCLUDED."description", "updatedAt" = now();
