CREATE TABLE "HaravanProduct" (
  "id" TEXT NOT NULL,
  "haravanProductId" TEXT NOT NULL,
  "handle" TEXT,
  "title" TEXT NOT NULL,
  "vendor" TEXT,
  "productType" TEXT,
  "tags" TEXT,
  "status" TEXT,
  "publishedAt" TIMESTAMP(3),
  "imageUrl" TEXT,
  "productUrl" TEXT,
  "rawJson" JSONB,
  "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HaravanProduct_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "HaravanProductVariant" (
  "id" TEXT NOT NULL,
  "haravanVariantId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "sku" TEXT,
  "title" TEXT,
  "option1" TEXT,
  "option2" TEXT,
  "option3" TEXT,
  "price" INTEGER,
  "inventoryQuantity" INTEGER,
  "rawJson" JSONB,
  "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HaravanProductVariant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HaravanProduct_haravanProductId_key" ON "HaravanProduct"("haravanProductId");
CREATE INDEX "HaravanProduct_title_idx" ON "HaravanProduct"("title");
CREATE INDEX "HaravanProduct_handle_idx" ON "HaravanProduct"("handle");
CREATE INDEX "HaravanProduct_status_idx" ON "HaravanProduct"("status");
CREATE INDEX "HaravanProduct_syncedAt_idx" ON "HaravanProduct"("syncedAt");
CREATE UNIQUE INDEX "HaravanProductVariant_haravanVariantId_key" ON "HaravanProductVariant"("haravanVariantId");
CREATE INDEX "HaravanProductVariant_productId_idx" ON "HaravanProductVariant"("productId");
CREATE INDEX "HaravanProductVariant_sku_idx" ON "HaravanProductVariant"("sku");
CREATE INDEX "HaravanProductVariant_title_idx" ON "HaravanProductVariant"("title");
ALTER TABLE "HaravanProductVariant" ADD CONSTRAINT "HaravanProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "HaravanProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
