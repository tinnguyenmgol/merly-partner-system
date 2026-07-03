CREATE TABLE "PartnerAnnouncement" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'general',
  "priority" TEXT NOT NULL DEFAULT 'normal',
  "publishAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "ctaLabel" TEXT,
  "ctaUrl" TEXT,
  "pinned" BOOLEAN NOT NULL DEFAULT false,
  "archivedAt" TIMESTAMP(3),
  "targetPartnerType" "PartnerTypeCode" NOT NULL DEFAULT 'referral_ctv',
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PartnerAnnouncement_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PartnerAnnouncementRead" (
  "id" TEXT NOT NULL,
  "announcementId" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartnerAnnouncementRead_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ShortLink" (
  "id" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "destinationUrl" TEXT NOT NULL,
  "disabledAt" TIMESTAMP(3),
  "disabledReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShortLink_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ShortLinkClick" (
  "id" TEXT NOT NULL,
  "shortLinkId" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "userAgent" TEXT,
  "ipHash" TEXT,
  "referrer" TEXT,
  "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShortLinkClick_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PartnerAnnouncement_targetPartnerType_publishAt_expiresAt_archivedAt_idx" ON "PartnerAnnouncement"("targetPartnerType", "publishAt", "expiresAt", "archivedAt");
CREATE INDEX "PartnerAnnouncement_pinned_priority_idx" ON "PartnerAnnouncement"("pinned", "priority");
CREATE UNIQUE INDEX "PartnerAnnouncementRead_announcementId_partnerId_key" ON "PartnerAnnouncementRead"("announcementId", "partnerId");
CREATE INDEX "PartnerAnnouncementRead_partnerId_readAt_idx" ON "PartnerAnnouncementRead"("partnerId", "readAt");
CREATE UNIQUE INDEX "ShortLink_slug_key" ON "ShortLink"("slug");
CREATE INDEX "ShortLink_partnerId_createdAt_idx" ON "ShortLink"("partnerId", "createdAt");
CREATE INDEX "ShortLink_disabledAt_idx" ON "ShortLink"("disabledAt");
CREATE INDEX "ShortLinkClick_shortLinkId_clickedAt_idx" ON "ShortLinkClick"("shortLinkId", "clickedAt");
CREATE INDEX "ShortLinkClick_partnerId_clickedAt_idx" ON "ShortLinkClick"("partnerId", "clickedAt");
ALTER TABLE "PartnerAnnouncementRead" ADD CONSTRAINT "PartnerAnnouncementRead_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "PartnerAnnouncement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartnerAnnouncementRead" ADD CONSTRAINT "PartnerAnnouncementRead_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShortLink" ADD CONSTRAINT "ShortLink_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShortLinkClick" ADD CONSTRAINT "ShortLinkClick_shortLinkId_fkey" FOREIGN KEY ("shortLinkId") REFERENCES "ShortLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShortLinkClick" ADD CONSTRAINT "ShortLinkClick_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
