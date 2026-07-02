"server-only";

import { db, hasDatabaseUrl } from "@/lib/db";

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
};

export const CTV_SETTINGS_KEY = "referral_ctv_program";

export const DEFAULT_CTV_PROGRAM_SETTINGS: CtvProgramSettings = {
  ctvProgramEnabled: true,
  defaultCommissionRateBps: 1000,
  minimumPayoutAmount: 100000,
  reconciliationWaitDays: 7,
  supportPhoneOrZalo: "Zalo/SĐT Merly",
  publicPolicyText:
    "Hoa hồng CTV được tính trên doanh thu sản phẩm hợp lệ sau giảm giá, không bao gồm phí vận chuyển, phụ phí, hộp/túi hoặc khoản thu không phải sản phẩm. Đơn hủy, hoàn, từ chối nhận hoặc tranh chấp không được tính hoa hồng.",
  bankInfoRequiredBeforePayout: true,
  orderRequestEnabled: true,
  affiliateLinkEnabled: true,
};

function asBool(value: unknown, fallback: boolean) { return typeof value === "boolean" ? value : fallback; }
function asInt(value: unknown, fallback: number) { const n = typeof value === "number" ? value : Number(value); return Number.isFinite(n) ? Math.round(n) : fallback; }
function asString(value: unknown, fallback: string) { return typeof value === "string" ? value : fallback; }

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
  };
}

export async function getCtvProgramSettings() {
  if (!hasDatabaseUrl()) return DEFAULT_CTV_PROGRAM_SETTINGS;
  const row = await db.partnerProgramSetting.findUnique({ where: { key: CTV_SETTINGS_KEY } });
  return normalizeCtvProgramSettings(row?.value);
}
