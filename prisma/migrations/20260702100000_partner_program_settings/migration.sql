CREATE TABLE "PartnerProgramSetting" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PartnerProgramSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PartnerProgramSetting_key_key" ON "PartnerProgramSetting"("key");
CREATE INDEX "PartnerProgramSetting_key_idx" ON "PartnerProgramSetting"("key");
