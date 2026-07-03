CREATE TABLE "PartnerChallenge" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "challengeType" TEXT NOT NULL DEFAULT 'monthly_orders',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "targetMetric" TEXT NOT NULL DEFAULT 'valid_order_count',
    "targetValue" INTEGER NOT NULL,
    "periodType" TEXT NOT NULL DEFAULT 'monthly',
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "rewardType" TEXT NOT NULL DEFAULT 'manual',
    "rewardAmount" INTEGER,
    "rewardDescription" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PartnerChallenge_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PartnerChallengeProgress" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "periodKey" TEXT,
    "currentValue" INTEGER NOT NULL DEFAULT 0,
    "targetValue" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "completedAt" TIMESTAMP(3),
    "rewardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PartnerChallengeProgress_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PartnerChallenge_status_priority_idx" ON "PartnerChallenge"("status", "priority");
CREATE INDEX "PartnerChallenge_periodType_startAt_endAt_idx" ON "PartnerChallenge"("periodType", "startAt", "endAt");
CREATE UNIQUE INDEX "PartnerChallengeProgress_challengeId_partnerId_periodKey_key" ON "PartnerChallengeProgress"("challengeId", "partnerId", "periodKey");
CREATE INDEX "PartnerChallengeProgress_partnerId_status_idx" ON "PartnerChallengeProgress"("partnerId", "status");
CREATE INDEX "PartnerChallengeProgress_challengeId_status_idx" ON "PartnerChallengeProgress"("challengeId", "status");
ALTER TABLE "PartnerChallengeProgress" ADD CONSTRAINT "PartnerChallengeProgress_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "PartnerChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartnerChallengeProgress" ADD CONSTRAINT "PartnerChallengeProgress_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "PartnerChallenge" ("id", "title", "description", "challengeType", "status", "targetMetric", "targetValue", "periodType", "rewardType", "rewardDescription", "priority", "updatedAt") VALUES
('phase2_first_5_orders', '5 đơn đầu tiên', 'Hoàn thành 5 đơn hợp lệ đầu tiên để kích hoạt hành trình CTV.', 'first_orders', 'active', 'valid_order_count', 5, 'lifetime', 'manual', 'Quà kích hoạt CTV do admin cấu hình/xét duyệt.', 100, CURRENT_TIMESTAMP),
('phase2_10_orders_month', '10 đơn trong tháng', 'Đạt 10 đơn hợp lệ trong tháng hiện tại.', 'monthly_orders', 'active', 'valid_order_count', 10, 'monthly', 'commission_note', 'Mở khóa mốc hoa hồng cao hơn hoặc thưởng theo chính sách Merly.', 90, CURRENT_TIMESTAMP),
('phase2_30_orders_month', '30 đơn trong tháng', 'Đạt 30 đơn hợp lệ trong tháng hiện tại.', 'monthly_orders', 'active', 'valid_order_count', 30, 'monthly', 'commission_note', 'Mốc cao nhất theo chính sách hoa hồng/thưởng Merly.', 80, CURRENT_TIMESTAMP),
('phase2_first_order_72h', 'Đơn đầu tiên trong 72h', 'Có đơn hợp lệ đầu tiên trong 72 giờ sau khi được duyệt.', 'first_order_after_approval', 'active', 'valid_order_count', 1, 'after_approval', 'manual', 'Admin xét thưởng nhanh cho CTV kích hoạt sớm.', 70, CURRENT_TIMESTAMP);
