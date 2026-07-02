-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('owner', 'admin', 'staff');

-- CreateEnum
CREATE TYPE "AdminUserStatus" AS ENUM ('active', 'disabled');

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'admin',
    "status" "AdminUserStatus" NOT NULL DEFAULT 'active',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuthSession" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "userAgent" TEXT,
    "ipHash" TEXT,

    CONSTRAINT "AdminAuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");
CREATE INDEX "AdminUser_status_idx" ON "AdminUser"("status");
CREATE UNIQUE INDEX "AdminAuthSession_tokenHash_key" ON "AdminAuthSession"("tokenHash");
CREATE INDEX "AdminAuthSession_adminUserId_idx" ON "AdminAuthSession"("adminUserId");
CREATE INDEX "AdminAuthSession_expiresAt_idx" ON "AdminAuthSession"("expiresAt");

-- AddForeignKey
ALTER TABLE "AdminAuthSession" ADD CONSTRAINT "AdminAuthSession_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
