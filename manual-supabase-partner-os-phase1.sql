-- Partner content library and campaign calendar for Merly Partner OS Phase 1.
CREATE TABLE "PartnerCampaign" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "campaignType" TEXT NOT NULL DEFAULT 'general',
  "status" TEXT NOT NULL DEFAULT 'draft',
  "startAt" TIMESTAMP(3) NOT NULL,
  "endAt" TIMESTAMP(3),
  "priority" TEXT NOT NULL DEFAULT 'normal',
  "productCodes" TEXT,
  "targetUrl" TEXT,
  "ctaLabel" TEXT,
  "ctaUrl" TEXT,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PartnerCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PartnerContentAsset" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "contentType" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'general',
  "assetUrl" TEXT,
  "thumbnailUrl" TEXT,
  "caption" TEXT,
  "targetUrl" TEXT,
  "productCode" TEXT,
  "campaignId" TEXT,
  "tags" JSONB,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "publishAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PartnerContentAsset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PartnerCampaign_status_startAt_endAt_idx" ON "PartnerCampaign"("status", "startAt", "endAt");
CREATE INDEX "PartnerCampaign_campaignType_priority_idx" ON "PartnerCampaign"("campaignType", "priority");
CREATE INDEX "PartnerContentAsset_status_publishAt_expiresAt_idx" ON "PartnerContentAsset"("status", "publishAt", "expiresAt");
CREATE INDEX "PartnerContentAsset_category_contentType_idx" ON "PartnerContentAsset"("category", "contentType");
CREATE INDEX "PartnerContentAsset_campaignId_idx" ON "PartnerContentAsset"("campaignId");
ALTER TABLE "PartnerCampaign" ADD CONSTRAINT "PartnerCampaign_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PartnerContentAsset" ADD CONSTRAINT "PartnerContentAsset_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "PartnerCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PartnerContentAsset" ADD CONSTRAINT "PartnerContentAsset_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
