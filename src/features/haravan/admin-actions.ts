import { NextResponse } from "next/server";
import { requireAdminSession } from "@/features/auth/admin-auth";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/public-url";
import { syncHaravanProducts } from "./product-sync";
import { syncHaravanOrders } from "./order-sync";
import { HARAVAN_ORDER_SYNC_SETTING_KEY, HARAVAN_SHOP_BASE_URL_SETTING_KEY, DEFAULT_HARAVAN_ORDER_SYNC_SETTINGS, splitLines } from "./settings";

export async function handleProductSync() { await requireAdminSession(); await syncHaravanProducts(); return NextResponse.redirect(appUrl("/admin/haravan/products?synced=1")); }
export async function handleOrderSync() { await requireAdminSession(); await syncHaravanOrders(); return NextResponse.redirect(appUrl("/admin/settings/haravan")); }
export async function handleHaravanSettingsSave(request: Request) {
  await requireAdminSession();
  const formData = await request.formData();
  const settings = { ...DEFAULT_HARAVAN_ORDER_SYNC_SETTINGS,
    orderSyncEnabled: formData.get("orderSyncEnabled") === "on",
    orderSyncLookbackDays: Math.max(1, Number(formData.get("orderSyncLookbackDays") || 7)),
    allowedOrderSources: splitLines(formData.get("allowedOrderSources")),
    excludedOrderSources: splitLines(formData.get("excludedOrderSources")),
    allowedFinancialStatuses: splitLines(formData.get("allowedFinancialStatuses")),
    allowedFulfillmentStatuses: splitLines(formData.get("allowedFulfillmentStatuses")),
    onlyOrdersWithPartnerSignals: formData.get("onlyOrdersWithPartnerSignals") === "on",
    syncUnattributedOrders: formData.get("syncUnattributedOrders") === "on",
    syncCancelledOrdersForReversal: formData.get("syncCancelledOrdersForReversal") === "on",
  };
  const shopBaseUrl = String(formData.get("shopBaseUrl") || "https://merlyshoes.com").trim().replace(/\/$/, "");
  await db.partnerProgramSetting.upsert({ where: { key: HARAVAN_ORDER_SYNC_SETTING_KEY }, create: { key: HARAVAN_ORDER_SYNC_SETTING_KEY, value: settings }, update: { value: settings } });
  await db.partnerProgramSetting.upsert({ where: { key: HARAVAN_SHOP_BASE_URL_SETTING_KEY }, create: { key: HARAVAN_SHOP_BASE_URL_SETTING_KEY, value: { url: shopBaseUrl } }, update: { value: { url: shopBaseUrl } } });
  return NextResponse.redirect(appUrl("/admin/settings/haravan"));
}
