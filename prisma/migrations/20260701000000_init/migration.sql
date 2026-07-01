-- CreateEnum
CREATE TYPE "PartnerTypeCode" AS ENUM ('referral_ctv', 'mini_corner', 'wholesale_agent', 'shop_referral', 'affiliate_creator');

-- CreateEnum
CREATE TYPE "PartnerStatus" AS ENUM ('pending', 'approved', 'rejected', 'suspended', 'inactive');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('temporary', 'pending_delivery', 'reconciliation_waiting', 'payable', 'paid', 'rejected', 'on_hold');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('draft', 'pending', 'paid', 'cancelled');

-- CreateEnum
CREATE TYPE "OrderAttributionSource" AS ENUM ('discount_code', 'referral_link', 'manual', 'imported');

-- CreateEnum
CREATE TYPE "RiskFlagStatus" AS ENUM ('open', 'reviewing', 'resolved', 'dismissed');

-- CreateTable
CREATE TABLE "PartnerType" (
    "id" TEXT NOT NULL,
    "code" "PartnerTypeCode" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "partnerTypeId" TEXT NOT NULL,
    "status" "PartnerStatus" NOT NULL DEFAULT 'pending',
    "email" TEXT,
    "phone" TEXT,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerProfile" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "zalo" TEXT,
    "area" TEXT,
    "sellingChannel" TEXT,
    "socialLink" TEXT,
    "experienceNote" TEXT,
    "bankAccountHolder" TEXT,
    "bankName" TEXT,
    "bankAccountNumber" TEXT,

    CONSTRAINT "PartnerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerCode" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "source" "OrderAttributionSource" NOT NULL DEFAULT 'discount_code',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerLevel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerLevelRule" (
    "id" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "successfulOrdersRequired" INTEGER NOT NULL,
    "commissionRateBps" INTEGER,
    "requiresAdminApproval" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PartnerLevelRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerOrder" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT,
    "externalOrderId" TEXT,
    "orderCode" TEXT NOT NULL,
    "customerName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'created',
    "eligible_product_revenue" INTEGER NOT NULL,
    "discountAmount" INTEGER NOT NULL DEFAULT 0,
    "shippingFee" INTEGER NOT NULL DEFAULT 0,
    "surchargeAmount" INTEGER NOT NULL DEFAULT 0,
    "nonProductFeeAmount" INTEGER NOT NULL DEFAULT 0,
    "paidAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "disputedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "sku" TEXT,
    "productName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "discountAmount" INTEGER NOT NULL DEFAULT 0,
    "eligibleRevenue" INTEGER NOT NULL,

    CONSTRAINT "PartnerOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerOrderAttribution" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "partnerCodeId" TEXT,
    "source" "OrderAttributionSource" NOT NULL DEFAULT 'discount_code',
    "value" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerOrderAttribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerCommissionRule" (
    "id" TEXT NOT NULL,
    "partnerTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "minDiscountBps" INTEGER,
    "maxDiscountBps" INTEGER,
    "commissionRateBps" INTEGER,
    "manualReviewRequired" BOOLEAN NOT NULL DEFAULT false,
    "unauthorizedDiscount" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerCommissionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerCommissionLedger" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "orderId" TEXT,
    "status" "CommissionStatus" NOT NULL DEFAULT 'temporary',
    "amount" INTEGER NOT NULL,
    "commissionRateBps" INTEGER,
    "eligible_product_revenue" INTEGER NOT NULL,
    "reason" TEXT,
    "availableAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerCommissionLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerPayout" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'draft',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "amount" INTEGER NOT NULL,
    "minimumPayoutAmount" INTEGER NOT NULL DEFAULT 100000,
    "rolloverAmount" INTEGER NOT NULL DEFAULT 0,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerPayoutItem" (
    "id" TEXT NOT NULL,
    "payoutId" TEXT NOT NULL,
    "ledgerId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,

    CONSTRAINT "PartnerPayoutItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerRiskFlag" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "orderId" TEXT,
    "status" "RiskFlagStatus" NOT NULL DEFAULT 'open',
    "reason" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerRiskFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "partnerId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HaravanSyncLog" (
    "id" TEXT NOT NULL,
    "syncType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "message" TEXT,
    "metadata" JSONB,

    CONSTRAINT "HaravanSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartnerType_code_key" ON "PartnerType"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Partner_email_key" ON "Partner"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Partner_phone_key" ON "Partner"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerProfile_partnerId_key" ON "PartnerProfile"("partnerId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerCode_code_key" ON "PartnerCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerLevel_name_key" ON "PartnerLevel"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerOrder_externalOrderId_key" ON "PartnerOrder"("externalOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerOrder_orderCode_key" ON "PartnerOrder"("orderCode");

-- AddForeignKey
ALTER TABLE "Partner" ADD CONSTRAINT "Partner_partnerTypeId_fkey" FOREIGN KEY ("partnerTypeId") REFERENCES "PartnerType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerProfile" ADD CONSTRAINT "PartnerProfile_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerCode" ADD CONSTRAINT "PartnerCode_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerLevelRule" ADD CONSTRAINT "PartnerLevelRule_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "PartnerLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerOrder" ADD CONSTRAINT "PartnerOrder_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerOrderItem" ADD CONSTRAINT "PartnerOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PartnerOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerOrderAttribution" ADD CONSTRAINT "PartnerOrderAttribution_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PartnerOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerOrderAttribution" ADD CONSTRAINT "PartnerOrderAttribution_partnerCodeId_fkey" FOREIGN KEY ("partnerCodeId") REFERENCES "PartnerCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerCommissionRule" ADD CONSTRAINT "PartnerCommissionRule_partnerTypeId_fkey" FOREIGN KEY ("partnerTypeId") REFERENCES "PartnerType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerCommissionLedger" ADD CONSTRAINT "PartnerCommissionLedger_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerCommissionLedger" ADD CONSTRAINT "PartnerCommissionLedger_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PartnerOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerPayout" ADD CONSTRAINT "PartnerPayout_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerPayoutItem" ADD CONSTRAINT "PartnerPayoutItem_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "PartnerPayout"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerPayoutItem" ADD CONSTRAINT "PartnerPayoutItem_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "PartnerCommissionLedger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerRiskFlag" ADD CONSTRAINT "PartnerRiskFlag_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

