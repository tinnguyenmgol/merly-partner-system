-- Merly Partner OS Phase 3: training center and partner referrals
CREATE TABLE "PartnerTrainingLesson" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT NOT NULL,
  "level" TEXT NOT NULL DEFAULT 'beginner',
  "videoUrl" TEXT,
  "thumbnailUrl" TEXT,
  "body" TEXT,
  "estimatedMinutes" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "orderIndex" INTEGER NOT NULL DEFAULT 0,
  "publishAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "archivedAt" TIMESTAMP(3),
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PartnerTrainingLesson_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PartnerTrainingProgress" (
  "id" TEXT NOT NULL,
  "lessonId" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'not_started',
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PartnerTrainingProgress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PartnerReferral" (
  "id" TEXT NOT NULL,
  "referrerPartnerId" TEXT NOT NULL,
  "referredPartnerId" TEXT,
  "referredEmail" TEXT,
  "referredPhone" TEXT,
  "status" TEXT NOT NULL DEFAULT 'invited',
  "rewardAmount" INTEGER,
  "rewardDescription" TEXT,
  "adminNote" TEXT,
  "rewardApprovedAt" TIMESTAMP(3),
  "rewardedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PartnerReferral_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PartnerTrainingLesson_status_publishAt_archivedAt_idx" ON "PartnerTrainingLesson"("status", "publishAt", "archivedAt");
CREATE INDEX "PartnerTrainingLesson_category_level_orderIndex_idx" ON "PartnerTrainingLesson"("category", "level", "orderIndex");
CREATE UNIQUE INDEX "PartnerTrainingProgress_lessonId_partnerId_key" ON "PartnerTrainingProgress"("lessonId", "partnerId");
CREATE INDEX "PartnerTrainingProgress_partnerId_status_idx" ON "PartnerTrainingProgress"("partnerId", "status");
CREATE INDEX "PartnerReferral_referrerPartnerId_status_createdAt_idx" ON "PartnerReferral"("referrerPartnerId", "status", "createdAt");
CREATE INDEX "PartnerReferral_referredPartnerId_idx" ON "PartnerReferral"("referredPartnerId");
CREATE INDEX "PartnerReferral_status_createdAt_idx" ON "PartnerReferral"("status", "createdAt");

ALTER TABLE "PartnerTrainingLesson" ADD CONSTRAINT "PartnerTrainingLesson_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PartnerTrainingProgress" ADD CONSTRAINT "PartnerTrainingProgress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "PartnerTrainingLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartnerTrainingProgress" ADD CONSTRAINT "PartnerTrainingProgress_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartnerReferral" ADD CONSTRAINT "PartnerReferral_referrerPartnerId_fkey" FOREIGN KEY ("referrerPartnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartnerReferral" ADD CONSTRAINT "PartnerReferral_referredPartnerId_fkey" FOREIGN KEY ("referredPartnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
