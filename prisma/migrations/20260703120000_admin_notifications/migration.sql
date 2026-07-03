CREATE TYPE "AdminNotificationSeverity" AS ENUM ('info', 'warning', 'urgent');
CREATE TYPE "AdminNotificationStatus" AS ENUM ('unread', 'read', 'archived');

CREATE TABLE "AdminNotification" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT,
  "severity" "AdminNotificationSeverity" NOT NULL DEFAULT 'info',
  "status" "AdminNotificationStatus" NOT NULL DEFAULT 'unread',
  "entityType" TEXT,
  "entityId" TEXT,
  "actionUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "AdminNotification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminNotification_status_createdAt_idx" ON "AdminNotification"("status", "createdAt");
CREATE INDEX "AdminNotification_severity_createdAt_idx" ON "AdminNotification"("severity", "createdAt");
CREATE INDEX "AdminNotification_entityType_entityId_idx" ON "AdminNotification"("entityType", "entityId");
