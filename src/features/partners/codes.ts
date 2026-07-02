"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ATTRIBUTION_SOURCES } from "./attribution-sources";

const ADMIN_ACTOR_ID = "admin";
const SAFE_CODE = /^[A-Z0-9_-]{3,50}$/;

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}
function bps(formData: FormData, key: string) {
  const raw = text(formData, key);
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 10_000) throw new Error(`${key} must be between 0 and 10000 bps.`);
  return parsed;
}
function normalizeCode(value: string) {
  const code = value.trim().toUpperCase();
  if (!SAFE_CODE.test(code)) throw new Error("Code must be 3-50 chars: A-Z, 0-9, underscore or dash.");
  return code;
}

export async function createShopReferralCodeAction(formData: FormData) {
  const partnerId = text(formData, "partnerId");
  const code = normalizeCode(text(formData, "code"));
  const customerDiscountBps = bps(formData, "customerDiscountBps");
  const commissionRateBps = bps(formData, "commissionRateBps");
  if (!partnerId) throw new Error("Missing partnerId.");
  await db.$transaction(async (tx) => {
    const partner = await tx.partner.findUnique({ where: { id: partnerId }, include: { partnerType: true } });
    if (!partner || partner.partnerType.code !== "shop_referral") throw new Error("Shop discount codes can only be created for shop_referral partners.");
    const created = await tx.partnerCode.create({
      data: { partnerId, code, source: ATTRIBUTION_SOURCES.SHOP_DISCOUNT_CODE, codePurpose: "shop_discount_code", customerDiscountBps, commissionRateBps, active: true },
    });
    await tx.adminAuditLog.create({ data: { actorId: ADMIN_ACTOR_ID, partnerId, action: "partner_code.create_shop_discount_code", entityType: "PartnerCode", entityId: created.id, beforeJson: Prisma.JsonNull, afterJson: { code, customerDiscountBps, commissionRateBps, active: true }, note: "Created shop_referral discount code." } });
  });
  revalidatePath(`/admin/partners/${partnerId}`);
}

export async function updatePartnerCodeAction(formData: FormData) {
  const partnerId = text(formData, "partnerId");
  const codeId = text(formData, "codeId");
  const active = text(formData, "active") === "true";
  const customerDiscountBps = bps(formData, "customerDiscountBps");
  const commissionRateBps = bps(formData, "commissionRateBps");
  if (!partnerId || !codeId) throw new Error("Missing partner/code id.");
  await db.$transaction(async (tx) => {
    const before = await tx.partnerCode.findFirst({ where: { id: codeId, partnerId } });
    if (!before) throw new Error("Partner code not found.");
    const after = await tx.partnerCode.update({ where: { id: codeId }, data: { active, customerDiscountBps, commissionRateBps } });
    await tx.adminAuditLog.create({ data: { actorId: ADMIN_ACTOR_ID, partnerId, action: "partner_code.update", entityType: "PartnerCode", entityId: codeId, beforeJson: { active: before.active, customerDiscountBps: before.customerDiscountBps, commissionRateBps: before.commissionRateBps }, afterJson: { active: after.active, customerDiscountBps: after.customerDiscountBps, commissionRateBps: after.commissionRateBps }, note: "Updated partner code status/discount/commission." } });
  });
  revalidatePath(`/admin/partners/${partnerId}`);
}
