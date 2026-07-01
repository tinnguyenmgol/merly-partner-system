CREATE TABLE "PartnerStatementToken" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PartnerStatementToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PartnerStatementToken_tokenHash_key" ON "PartnerStatementToken"("tokenHash");
CREATE INDEX "PartnerStatementToken_partnerId_idx" ON "PartnerStatementToken"("partnerId");
ALTER TABLE "PartnerStatementToken" ADD CONSTRAINT "PartnerStatementToken_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
