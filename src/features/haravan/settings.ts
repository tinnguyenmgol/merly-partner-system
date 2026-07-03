import { db } from "@/lib/db";

export const HARAVAN_ORDER_SYNC_SETTING_KEY = "haravan.order_sync_scope";
export const HARAVAN_SHOP_BASE_URL_SETTING_KEY = "haravan.shop_base_url";

export type HaravanOrderSyncSettings = {
  orderSyncEnabled: boolean;
  orderSyncLookbackDays: number;
  allowedOrderSources: string[];
  excludedOrderSources: string[];
  allowedFinancialStatuses: string[];
  allowedFulfillmentStatuses: string[];
  onlyOrdersWithPartnerSignals: boolean;
  syncUnattributedOrders: boolean;
  syncCancelledOrdersForReversal: boolean;
};

export const DEFAULT_HARAVAN_ORDER_SYNC_SETTINGS: HaravanOrderSyncSettings = {
  orderSyncEnabled: true,
  orderSyncLookbackDays: 7,
  allowedOrderSources: [],
  excludedOrderSources: [],
  allowedFinancialStatuses: [],
  allowedFulfillmentStatuses: [],
  onlyOrdersWithPartnerSignals: true,
  syncUnattributedOrders: false,
  syncCancelledOrdersForReversal: true,
};

function stringList(value: unknown) {
  return Array.isArray(value) ? value.map(String).map((v) => v.trim()).filter(Boolean) : [];
}

export function normalizeSourceValue(value?: string | null) { return String(value ?? "").trim().toLowerCase(); }

export async function getHaravanOrderSyncSettings(): Promise<HaravanOrderSyncSettings> {
  const row = await db.partnerProgramSetting.findUnique({ where: { key: HARAVAN_ORDER_SYNC_SETTING_KEY } });
  const value = (row?.value ?? {}) as Partial<HaravanOrderSyncSettings>;
  return {
    ...DEFAULT_HARAVAN_ORDER_SYNC_SETTINGS,
    ...value,
    orderSyncLookbackDays: Number(value.orderSyncLookbackDays ?? DEFAULT_HARAVAN_ORDER_SYNC_SETTINGS.orderSyncLookbackDays) || 7,
    allowedOrderSources: stringList(value.allowedOrderSources),
    excludedOrderSources: stringList(value.excludedOrderSources),
    allowedFinancialStatuses: stringList(value.allowedFinancialStatuses),
    allowedFulfillmentStatuses: stringList(value.allowedFulfillmentStatuses),
  };
}

export async function getHaravanShopBaseUrl() {
  const row = await db.partnerProgramSetting.findUnique({ where: { key: HARAVAN_SHOP_BASE_URL_SETTING_KEY } });
  const value = typeof row?.value === "object" && row.value && "url" in row.value ? String((row.value as { url?: unknown }).url ?? "") : "";
  return (value || process.env.HARAVAN_SHOP_BASE_URL || "https://merlyshoes.com").replace(/\/$/, "");
}

export function splitLines(value: FormDataEntryValue | null) {
  return String(value ?? "").split(/[\n,]/).map((v) => v.trim()).filter(Boolean);
}
