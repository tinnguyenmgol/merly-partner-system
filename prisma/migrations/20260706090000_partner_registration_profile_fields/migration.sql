ALTER TABLE "PartnerProfile" ADD COLUMN IF NOT EXISTS "salesChannelsJson" JSONB;
ALTER TABLE "PartnerProfile" ADD COLUMN IF NOT EXISTS "provinceCode" TEXT;
ALTER TABLE "PartnerProfile" ADD COLUMN IF NOT EXISTS "provinceName" TEXT;
ALTER TABLE "PartnerProfile" ADD COLUMN IF NOT EXISTS "wardCode" TEXT;
ALTER TABLE "PartnerProfile" ADD COLUMN IF NOT EXISTS "wardName" TEXT;
CREATE INDEX IF NOT EXISTS "PartnerProfile_provinceCode_idx" ON "PartnerProfile"("provinceCode");
