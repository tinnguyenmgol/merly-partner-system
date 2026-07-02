"server-only";

import { db, hasDatabaseUrl } from "@/lib/db";

export type CtvCommissionTierKey = "base" | "tier_10" | "tier_30";
export type CtvNoStockCommissionPolicy = {
  enabled: boolean;
  monthlyTierThresholds: { key: CtvCommissionTierKey; minValidOrders: number }[];
  orderClasses: {
    key: "normal_price" | "merly_discount_5_to_10";
    label: string;
    minDiscountBps?: number;
    maxDiscountBps?: number;
    ratesByTierBps: Record<CtvCommissionTierKey, number>;
  }[];
  excludedRules: { key: string; label: string; commissionRateBps: number; countsTowardMonthlyTier: boolean; status: "rejected" }[];
};

export type CtvProgramSettings = {
  ctvProgramEnabled: boolean;
  defaultCommissionRateBps: number;
  minimumPayoutAmount: number;
  reconciliationWaitDays: number;
  supportPhoneOrZalo: string;
  publicPolicyText: string;
  bankInfoRequiredBeforePayout: boolean;
  orderRequestEnabled: boolean;
  affiliateLinkEnabled: boolean;
  ctvNoStockCommissionPolicy: CtvNoStockCommissionPolicy;
};

export const CTV_SETTINGS_KEY = "referral_ctv_program";

export const CTV_POLICY_EXCLUDED_NOTE = "Đơn hủy, hoàn, khách không nhận hoặc đơn tự ý giảm giá ngoài chính sách sẽ không tính hoa hồng và cũng không tính vào mốc thưởng tháng.";
export const DEFAULT_CTV_POLICY_TEXT = `Dạ Merly có chính sách thưởng theo hiệu suất tháng để chị có động lực bán nhiều hơn ạ.

Nếu chị bán đúng giá Merly, không dùng mã giảm giá:
- Dưới 10 đơn/tháng: hoa hồng 10%
- Từ 10 đơn/tháng: hoa hồng 12%
- Từ 30 đơn/tháng: hoa hồng 15%

Nếu đơn có dùng mã giảm giá hoặc ưu đãi thành viên từ 5%–10%:
- Dưới 10 đơn/tháng: 6%
- Từ 10 đơn/tháng: 7%
- Từ 30 đơn/tháng: 8%

${CTV_POLICY_EXCLUDED_NOTE}`;

export const DEFAULT_CTV_NO_STOCK_COMMISSION_POLICY: CtvNoStockCommissionPolicy = {
  enabled: true,
  monthlyTierThresholds: [
    { key: "base", minValidOrders: 0 },
    { key: "tier_10", minValidOrders: 10 },
    { key: "tier_30", minValidOrders: 30 },
  ],
  orderClasses: [
    { key: "normal_price", label: "Bán đúng giá Merly, không dùng mã giảm giá", ratesByTierBps: { base: 1000, tier_10: 1200, tier_30: 1500 } },
    { key: "merly_discount_5_to_10", label: "Có mã giảm giá / ưu đãi thành viên từ 5%–10%", minDiscountBps: 500, maxDiscountBps: 1000, ratesByTierBps: { base: 600, tier_10: 700, tier_30: 800 } },
  ],
  excludedRules: [
    { key: "cancelled_returned_refused", label: "Đơn hủy, hoàn, khách không nhận", commissionRateBps: 0, countsTowardMonthlyTier: false, status: "rejected" },
    { key: "outside_policy_discount", label: "Đơn tự ý giảm giá ngoài chính sách", commissionRateBps: 0, countsTowardMonthlyTier: false, status: "rejected" },
  ],
};

export const DEFAULT_CTV_PROGRAM_SETTINGS: CtvProgramSettings = {
  ctvProgramEnabled: true,
  defaultCommissionRateBps: 1000,
  minimumPayoutAmount: 100000,
  reconciliationWaitDays: 7,
  supportPhoneOrZalo: "Zalo/SĐT Merly",
  publicPolicyText: DEFAULT_CTV_POLICY_TEXT,
  bankInfoRequiredBeforePayout: true,
  orderRequestEnabled: true,
  affiliateLinkEnabled: true,
  ctvNoStockCommissionPolicy: DEFAULT_CTV_NO_STOCK_COMMISSION_POLICY,
};

function asBool(value: unknown, fallback: boolean) { return typeof value === "boolean" ? value : fallback; }
function asInt(value: unknown, fallback: number) { const n = typeof value === "number" ? value : Number(value); return Number.isFinite(n) ? Math.round(n) : fallback; }
function asString(value: unknown, fallback: string) { return typeof value === "string" ? value : fallback; }
function normalizePolicy(value: unknown): CtvNoStockCommissionPolicy {
  const input = (value && typeof value === "object" ? value : {}) as Partial<CtvNoStockCommissionPolicy>;
  const fallback = DEFAULT_CTV_NO_STOCK_COMMISSION_POLICY;
  const thresholds = fallback.monthlyTierThresholds.map((tier) => ({ ...tier, minValidOrders: Math.max(0, asInt(input.monthlyTierThresholds?.find((t) => t.key === tier.key)?.minValidOrders, tier.minValidOrders)) }));
  const orderClasses = fallback.orderClasses.map((orderClass) => {
    const current = input.orderClasses?.find((c) => c.key === orderClass.key);
    return { ...orderClass, ratesByTierBps: { base: Math.max(0, asInt(current?.ratesByTierBps?.base, orderClass.ratesByTierBps.base)), tier_10: Math.max(0, asInt(current?.ratesByTierBps?.tier_10, orderClass.ratesByTierBps.tier_10)), tier_30: Math.max(0, asInt(current?.ratesByTierBps?.tier_30, orderClass.ratesByTierBps.tier_30)) } };
  });
  return { enabled: asBool(input.enabled, fallback.enabled), monthlyTierThresholds: thresholds, orderClasses, excludedRules: fallback.excludedRules };
}

export function normalizeCtvProgramSettings(value: unknown): CtvProgramSettings {
  const input = (value && typeof value === "object" ? value : {}) as Partial<Record<keyof CtvProgramSettings, unknown>>;
  return {
    ctvProgramEnabled: asBool(input.ctvProgramEnabled, DEFAULT_CTV_PROGRAM_SETTINGS.ctvProgramEnabled),
    defaultCommissionRateBps: asInt(input.defaultCommissionRateBps, DEFAULT_CTV_PROGRAM_SETTINGS.defaultCommissionRateBps),
    minimumPayoutAmount: asInt(input.minimumPayoutAmount, DEFAULT_CTV_PROGRAM_SETTINGS.minimumPayoutAmount),
    reconciliationWaitDays: asInt(input.reconciliationWaitDays, DEFAULT_CTV_PROGRAM_SETTINGS.reconciliationWaitDays),
    supportPhoneOrZalo: asString(input.supportPhoneOrZalo, DEFAULT_CTV_PROGRAM_SETTINGS.supportPhoneOrZalo),
    publicPolicyText: asString(input.publicPolicyText, DEFAULT_CTV_PROGRAM_SETTINGS.publicPolicyText),
    bankInfoRequiredBeforePayout: asBool(input.bankInfoRequiredBeforePayout, DEFAULT_CTV_PROGRAM_SETTINGS.bankInfoRequiredBeforePayout),
    orderRequestEnabled: asBool(input.orderRequestEnabled, DEFAULT_CTV_PROGRAM_SETTINGS.orderRequestEnabled),
    affiliateLinkEnabled: asBool(input.affiliateLinkEnabled, DEFAULT_CTV_PROGRAM_SETTINGS.affiliateLinkEnabled),
    ctvNoStockCommissionPolicy: normalizePolicy(input.ctvNoStockCommissionPolicy),
  };
}

export async function getCtvProgramSettings() {
  if (!hasDatabaseUrl()) return DEFAULT_CTV_PROGRAM_SETTINGS;
  const row = await db.partnerProgramSetting.findUnique({ where: { key: CTV_SETTINGS_KEY } });
  return normalizeCtvProgramSettings(row?.value);
}
