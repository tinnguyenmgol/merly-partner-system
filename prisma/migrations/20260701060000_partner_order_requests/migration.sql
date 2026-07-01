CREATE TYPE "PartnerOrderRequestStatus" AS ENUM ('pending', 'matched', 'approved', 'rejected', 'cancelled');

CREATE TABLE "PartnerOrderRequest" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "status" "PartnerOrderRequestStatus" NOT NULL DEFAULT 'pending',
    "orderCode" TEXT,
    "contactHint" TEXT,
    "expectedAmount" INTEGER,
    "note" TEXT,
    "matchedOrderId" TEXT,
    "adminNote" TEXT,
    "rejectReason" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerOrderRequest_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PartnerOrderRequest" ADD CONSTRAINT "PartnerOrderRequest_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartnerOrderRequest" ADD CONSTRAINT "PartnerOrderRequest_matchedOrderId_fkey" FOREIGN KEY ("matchedOrderId") REFERENCES "PartnerOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "PartnerOrderRequest_partnerId_status_createdAt_idx" ON "PartnerOrderRequest"("partnerId", "status", "createdAt");
CREATE INDEX "PartnerOrderRequest_status_createdAt_idx" ON "PartnerOrderRequest"("status", "createdAt");
CREATE INDEX "PartnerOrderRequest_orderCode_idx" ON "PartnerOrderRequest"("orderCode");
CREATE INDEX "PartnerOrderRequest_matchedOrderId_idx" ON "PartnerOrderRequest"("matchedOrderId");
