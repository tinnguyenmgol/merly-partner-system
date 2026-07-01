CREATE TABLE "PartnerAccount" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "passwordHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'invited',
    "lastLoginAt" TIMESTAMP(3),
    "passwordSetAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PartnerAccount_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PartnerAuthSession" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "userAgent" TEXT,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PartnerAuthSession_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PartnerAuthToken" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PartnerAuthToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PartnerAccount_partnerId_key" ON "PartnerAccount"("partnerId");
CREATE UNIQUE INDEX "PartnerAccount_email_key" ON "PartnerAccount"("email");
CREATE UNIQUE INDEX "PartnerAccount_phone_key" ON "PartnerAccount"("phone");
CREATE INDEX "PartnerAccount_status_idx" ON "PartnerAccount"("status");
CREATE UNIQUE INDEX "PartnerAuthSession_tokenHash_key" ON "PartnerAuthSession"("tokenHash");
CREATE INDEX "PartnerAuthSession_accountId_idx" ON "PartnerAuthSession"("accountId");
CREATE INDEX "PartnerAuthSession_expiresAt_idx" ON "PartnerAuthSession"("expiresAt");
CREATE UNIQUE INDEX "PartnerAuthToken_tokenHash_key" ON "PartnerAuthToken"("tokenHash");
CREATE INDEX "PartnerAuthToken_accountId_idx" ON "PartnerAuthToken"("accountId");
CREATE INDEX "PartnerAuthToken_purpose_idx" ON "PartnerAuthToken"("purpose");
CREATE INDEX "PartnerAuthToken_expiresAt_idx" ON "PartnerAuthToken"("expiresAt");
ALTER TABLE "PartnerAccount" ADD CONSTRAINT "PartnerAccount_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartnerAuthSession" ADD CONSTRAINT "PartnerAuthSession_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PartnerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartnerAuthToken" ADD CONSTRAINT "PartnerAuthToken_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PartnerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
