"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { CTV_SETTINGS_KEY, normalizeCtvProgramSettings } from "./settings";

function readString(formData: FormData, key: string) { const value = formData.get(key); return typeof value === "string" ? value.trim() : ""; }
function readInt(formData: FormData, key: string, fallback: number) { const parsed = Number(readString(formData, key).replace(/[^\d]/g, "")); return Number.isFinite(parsed) ? parsed : fallback; }
function readBps(formData: FormData, key: string, fallback: number) { const parsed = Number(readString(formData, key).replace(",", ".")); return Number.isFinite(parsed) ? Math.round(parsed * 100) : fallback; }

export async function updateCtvProgramSettingsAction(formData: FormData) {
  const existing = await db.partnerProgramSetting.findUnique({ where: { key: CTV_SETTINGS_KEY } });
  const current = normalizeCtvProgramSettings(existing?.value);
  const settings = normalizeCtvProgramSettings({
    ctvProgramEnabled: formData.get("ctvProgramEnabled") === "on",
    defaultCommissionRateBps: readBps(formData, "defaultCommissionRatePercent", current.defaultCommissionRateBps),
    minimumPayoutAmount: readInt(formData, "minimumPayoutAmount", current.minimumPayoutAmount),
    reconciliationWaitDays: readInt(formData, "reconciliationWaitDays", current.reconciliationWaitDays),
    supportPhoneOrZalo: readString(formData, "supportPhoneOrZalo") || current.supportPhoneOrZalo,
    publicPolicyText: readString(formData, "publicPolicyText") || current.publicPolicyText,
    bankInfoRequiredBeforePayout: formData.get("bankInfoRequiredBeforePayout") === "on",
    orderRequestEnabled: formData.get("orderRequestEnabled") === "on",
    affiliateLinkEnabled: formData.get("affiliateLinkEnabled") === "on",
  });
  const row = await db.partnerProgramSetting.upsert({ where: { key: CTV_SETTINGS_KEY }, update: { value: settings }, create: { key: CTV_SETTINGS_KEY, value: settings } });
  await db.adminAuditLog.create({ data: { actorId: "admin-placeholder", action: "partner_program_settings.update", entityType: "PartnerProgramSetting", entityId: row.id, beforeJson: current, afterJson: settings, note: "Updated referral CTV program settings" } });
  revalidatePath("/"); revalidatePath("/dang-ky"); revalidatePath("/admin/settings/ctv");
}
