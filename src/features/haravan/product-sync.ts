import { Prisma } from "@prisma/client";
import { db, hasDatabaseUrl } from "@/lib/db";
import { HaravanClient } from "./haravan-client";
import { getHaravanShopBaseUrl } from "./settings";
import type { HaravanProduct } from "./types";

function toInt(value: unknown) { const n = typeof value === "number" ? value : Number.parseFloat(String(value ?? "")); return Number.isFinite(n) ? Math.round(n) : undefined; }
function parseDate(value?: string | null) { if (!value) return undefined; const d = new Date(value); return Number.isNaN(d.getTime()) ? undefined : d; }
function imageUrl(product: HaravanProduct) { return product.image?.src ?? product.images?.find((img) => img.src)?.src; }

export async function syncHaravanProducts(client = new HaravanClient()) {
  if (!hasDatabaseUrl()) return { ok: false, message: "DATABASE_URL is required for Haravan product sync.", syncedProducts: 0, syncedVariants: 0, logId: undefined as string | undefined };
  const log = await db.haravanSyncLog.create({ data: { syncType: "products", status: "running" } });
  let syncedProducts = 0, syncedVariants = 0, pagesFetched = 0;
  const errors: string[] = [];
  const maxPages = Number.parseInt(process.env.HARAVAN_PRODUCT_SYNC_MAX_PAGES || "200", 10);
  try {
    const shopBaseUrl = await getHaravanShopBaseUrl();
    let page = 1;
    for (;;) {
      if (page > maxPages) throw new Error(`Haravan product sync stopped by safety guard after ${maxPages} pages.`);
      const products = await client.listProducts({ limit: 250, page });
      pagesFetched += 1;
      if (products.length === 0) break;
      for (const product of products) {
        const handle = product.handle || null;
        const row = await db.haravanProduct.upsert({
          where: { haravanProductId: String(product.id) },
          update: {
            handle, title: product.title || "Haravan product", vendor: product.vendor || null, productType: product.product_type || null,
            tags: product.tags || null, status: product.status || null, publishedAt: parseDate(product.published_at) ?? null,
            imageUrl: imageUrl(product) || null, productUrl: handle ? `${shopBaseUrl}/products/${handle}` : null, rawJson: product as Prisma.InputJsonValue, syncedAt: new Date(),
          },
          create: {
            haravanProductId: String(product.id), handle, title: product.title || "Haravan product", vendor: product.vendor || null, productType: product.product_type || null,
            tags: product.tags || null, status: product.status || null, publishedAt: parseDate(product.published_at) ?? null,
            imageUrl: imageUrl(product) || null, productUrl: handle ? `${shopBaseUrl}/products/${handle}` : null, rawJson: product as Prisma.InputJsonValue,
          },
        });
        syncedProducts += 1;
        for (const variant of product.variants ?? []) {
          await db.haravanProductVariant.upsert({ where: { haravanVariantId: String(variant.id) }, update: { productId: row.id, sku: variant.sku || null, title: variant.title || null, option1: variant.option1 || null, option2: variant.option2 || null, option3: variant.option3 || null, price: toInt(variant.price), inventoryQuantity: toInt(variant.inventory_quantity), rawJson: variant as Prisma.InputJsonValue, syncedAt: new Date() }, create: { haravanVariantId: String(variant.id), productId: row.id, sku: variant.sku || null, title: variant.title || null, option1: variant.option1 || null, option2: variant.option2 || null, option3: variant.option3 || null, price: toInt(variant.price), inventoryQuantity: toInt(variant.inventory_quantity), rawJson: variant as Prisma.InputJsonValue } });
          syncedVariants += 1;
        }
      }
      if (products.length < 250) break;
      page += 1;
    }
    await db.haravanSyncLog.update({ where: { id: log.id }, data: { status: "success", finishedAt: new Date(), message: `Synced ${syncedProducts} Haravan products.`, metadata: { pagesFetched, productsFetched: syncedProducts, productsUpserted: syncedProducts, variantsFetched: syncedVariants, variantsUpserted: syncedVariants, syncedProducts, syncedVariants, errors } } });
    return { ok: true, message: `Synced ${syncedProducts} Haravan products across ${pagesFetched} page(s).`, pagesFetched, syncedProducts, syncedVariants, logId: log.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Haravan product sync error";
    errors.push(message);
    await db.haravanSyncLog.update({ where: { id: log.id }, data: { status: "failed", finishedAt: new Date(), message, metadata: { pagesFetched, productsFetched: syncedProducts, productsUpserted: syncedProducts, variantsFetched: syncedVariants, variantsUpserted: syncedVariants, syncedProducts, syncedVariants, errors } } });
    return { ok: false, message, pagesFetched, syncedProducts, syncedVariants, logId: log.id };
  }
}
