"use server";

import { requireAdminSession } from "@/features/auth/admin-auth";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { CTV_SETTINGS_KEY, normalizeCtvProgramSettings } from "./settings";

function readString(formData: FormData, key: string) { const value = formData.get(key); return typeof value === "string" ? value.trim() : ""; }
function readInt(formData: FormData, key: string, fallback: number) { const parsed = Number(readString(formData, key).replace(/[^\d]/g, "")); return Number.isFinite(parsed) ? parsed : fallback; }
function readBps(formData: FormData, key: string, fallback: number) { const parsed = Number(readString(formData, key).replace(",", ".")); return Number.isFinite(parsed) ? Math.round(parsed * 100) : fallback; }

export async function updateCtvProgramSettingsAction(formData: FormData) {
  await requireAdminSession();
  const existing = await db.partnerProgramSetting.findUnique({ where: { key: CTV_SETTINGS_KEY } });
  const current = normalizeCtvProgramSettings(existing?.value);
  const normal = current.ctvNoStockCommissionPolicy.orderClasses.find((c) => c.key === "normal_price")!;
  const discounted = current.ctvNoStockCommissionPolicy.orderClasses.find((c) => c.key === "merly_discount_5_to_10")!;
  const settings = normalizeCtvProgramSettings({
    ctvProgramEnabled: formData.get("ctvProgramEnabled") === "on",
    defaultCommissionRateBps: readBps(formData, "normal_base_percent", current.defaultCommissionRateBps),
    minimumPayoutAmount: readInt(formData, "minimumPayoutAmount", current.minimumPayoutAmount),
    reconciliationWaitDays: readInt(formData, "reconciliationWaitDays", current.reconciliationWaitDays),
    supportPhoneOrZalo: readString(formData, "supportPhoneOrZalo") || current.supportPhoneOrZalo,
    publicPolicyText: readString(formData, "publicPolicyText") || current.publicPolicyText,
    bankInfoRequiredBeforePayout: formData.get("bankInfoRequiredBeforePayout") === "on",
    orderRequestEnabled: formData.get("orderRequestEnabled") === "on",
    affiliateLinkEnabled: formData.get("affiliateLinkEnabled") === "on",
    ctvNoStockCommissionPolicy: {
      ...current.ctvNoStockCommissionPolicy,
      enabled: formData.get("ctvNoStockCommissionPolicyEnabled") === "on",
      monthlyTierThresholds: [
        { key: "base", minValidOrders: 0 },
        { key: "tier_10", minValidOrders: readInt(formData, "threshold_tier_10", 10) },
        { key: "tier_30", minValidOrders: readInt(formData, "threshold_tier_30", 30) },
      ],
      orderClasses: [
        { ...normal, ratesByTierBps: { base: readBps(formData, "normal_base_percent", 1000), tier_10: readBps(formData, "normal_tier_10_percent", 1200), tier_30: readBps(formData, "normal_tier_30_percent", 1500) } },
        { ...discounted, ratesByTierBps: { base: readBps(formData, "discounted_base_percent", 600), tier_10: readBps(formData, "discounted_tier_10_percent", 700), tier_30: readBps(formData, "discounted_tier_30_percent", 800) } },
      ],
    },
  });
  const row = await db.partnerProgramSetting.upsert({ where: { key: CTV_SETTINGS_KEY }, update: { value: settings }, create: { key: CTV_SETTINGS_KEY, value: settings } });
  await db.adminAuditLog.create({ data: { actorId: "admin-placeholder", action: "partner_program_settings.update", entityType: "PartnerProgramSetting", entityId: row.id, beforeJson: current, afterJson: settings, note: "Updated referral CTV monthly performance commission settings" } });
  revalidatePath("/"); revalidatePath("/dang-ky"); revalidatePath("/admin/settings/ctv"); revalidatePath("/dashboard");
}
