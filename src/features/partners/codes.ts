"use server";

import { requireAdminSession } from "@/features/auth/admin-auth";
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
function percentToBps(formData: FormData, key: string) {
  const raw = text(formData, key);
  if (!raw) return null;
  const parsed = Number.parseFloat(raw.replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) throw new Error(`${key} must be between 0 and 100 percent.`);
  return Math.round(parsed * 100);
}
function normalizeCode(value: string) {
  const code = value.trim().toUpperCase();
  if (!SAFE_CODE.test(code)) throw new Error("Code must be 3-50 chars: A-Z, 0-9, underscore or dash.");
  return code;
}

export async function createShopReferralCodeAction(formData: FormData) {
  await requireAdminSession();
  const partnerId = text(formData, "partnerId");
  const code = normalizeCode(text(formData, "code"));
  const customerDiscountBps = percentToBps(formData, "customerDiscountPercent");
  const commissionRateBps = percentToBps(formData, "commissionPercent");
  if (!partnerId) throw new Error("Missing partnerId.");
  await db.$transaction(async (tx) => {
    const partner = await tx.partner.findUnique({ where: { id: partnerId }, include: { partnerType: true } });
    if (!partner || partner.partnerType.code !== "shop_referral") throw new Error("Shop discount codes can only be created for shop_referral partners.");
    const created = await tx.partnerCode.create({
      data: { partnerId, code, source: ATTRIBUTION_SOURCES.SHOP_DISCOUNT_CODE, codePurpose: "shop_discount_code", customerDiscountBps, commissionRateBps, active: true },
    });
    await tx.adminAuditLog.create({ data: { actorId: ADMIN_ACTOR_ID, partnerId, action: "partner_code.create_shop_discount_code", entityType: "PartnerCode", entityId: created.id, beforeJson: Prisma.JsonNull, afterJson: { code, customerDiscountBps, commissionRateBps, active: true }, note: "Created shop_referral discount code from percent UI." } });
  });
  revalidatePath(`/admin/partners/${partnerId}`);
}

export async function updatePartnerCodeAction(formData: FormData) {
  await requireAdminSession();
  const partnerId = text(formData, "partnerId");
  const codeId = text(formData, "codeId");
  const active = text(formData, "active") === "true";
  const customerDiscountBps = percentToBps(formData, "customerDiscountPercent");
  const commissionRateBps = percentToBps(formData, "commissionPercent");
  if (!partnerId || !codeId) throw new Error("Missing partner/code id.");
  await db.$transaction(async (tx) => {
    const before = await tx.partnerCode.findFirst({ where: { id: codeId, partnerId }, include: { partner: { include: { partnerType: true } } } });
    if (!before) throw new Error("Partner code not found.");
    const isShopReferral = before.partner.partnerType.code === "shop_referral";
    const data = isShopReferral ? { active, customerDiscountBps, commissionRateBps } : { active };
    const after = await tx.partnerCode.update({ where: { id: codeId }, data });
    await tx.adminAuditLog.create({ data: { actorId: ADMIN_ACTOR_ID, partnerId, action: "partner_code.update", entityType: "PartnerCode", entityId: codeId, beforeJson: { active: before.active, customerDiscountBps: before.customerDiscountBps, commissionRateBps: before.commissionRateBps }, afterJson: { active: after.active, customerDiscountBps: after.customerDiscountBps, commissionRateBps: after.commissionRateBps }, note: isShopReferral ? "Updated shop referral code status/discount/commission from percent UI." : "Updated referral CTV code active state." } });
  });
  revalidatePath(`/admin/partners/${partnerId}`);
}

export async function normalizePartnerCodeAction(formData: FormData) {
  await requireAdminSession();
  const partnerId = text(formData, "partnerId");
  const codeId = text(formData, "codeId");
  if (!partnerId || !codeId) throw new Error("Missing partner/code id.");
  await db.$transaction(async (tx) => {
    const before = await tx.partnerCode.findFirst({ where: { id: codeId, partnerId }, include: { partner: { include: { partnerType: true } } } });
    if (!before) throw new Error("Partner code not found.");
    const isShopReferral = before.partner.partnerType.code === "shop_referral";
    const data = isShopReferral
      ? { codePurpose: "shop_discount_code", source: ATTRIBUTION_SOURCES.SHOP_DISCOUNT_CODE }
      : { codePurpose: "affiliate_tracking", source: ATTRIBUTION_SOURCES.AFFILIATE_LINK, customerDiscountBps: null };
    const after = await tx.partnerCode.update({ where: { id: codeId }, data });
    await tx.adminAuditLog.create({ data: { actorId: ADMIN_ACTOR_ID, partnerId, action: "partner_code.normalize", entityType: "PartnerCode", entityId: codeId, beforeJson: { codePurpose: before.codePurpose, source: before.source, customerDiscountBps: before.customerDiscountBps }, afterJson: { codePurpose: after.codePurpose, source: after.source, customerDiscountBps: after.customerDiscountBps }, note: "Normalized partner code configuration based on partner type." } });
  });
  revalidatePath(`/admin/partners/${partnerId}`);
}
