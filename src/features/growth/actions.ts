"use server";

import { createHash, randomBytes } from "crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdminSession } from "@/features/auth/admin-auth";
import { requirePartnerSession } from "@/features/auth/partner-auth";

import { ensureTrustedMerlyUrl } from "@/features/growth/utils";

function parseVietnamDatetimeLocal(value: FormDataEntryValue | null) {
  const s = String(value ?? "").trim();
  if (!s) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return undefined;
  const withoutZone = s.replace(/(?:Z|[+-]\d{2}:?\d{2})$/, "");
  return new Date(`${withoutZone.length === 16 ? `${withoutZone}:00` : withoutZone}+07:00`);
}

function sha256(value: string) { return createHash("sha256").update(value).digest("hex"); }
function slug() { return randomBytes(5).toString("base64url").replace(/[_-]/g, "").slice(0, 7); }

export async function createAnnouncementAction(formData: FormData) {
  const session = await requireAdminSession();
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!title || !body) throw new Error("Title and body are required.");
  await db.partnerAnnouncement.create({ data: {
    title, body,
    category: String(formData.get("category") || "general"),
    priority: String(formData.get("priority") || "normal"),
    publishAt: parseVietnamDatetimeLocal(formData.get("publishAt")) ?? new Date(),
    expiresAt: parseVietnamDatetimeLocal(formData.get("expiresAt")),
    ctaLabel: String(formData.get("ctaLabel") || "").trim() || undefined,
    ctaUrl: String(formData.get("ctaUrl") || "").trim() || undefined,
    pinned: formData.get("pinned") === "on",
    createdByAdminId: session.adminUserId,
  }});
  revalidatePath("/admin/announcements"); revalidatePath("/dashboard"); revalidatePath("/dashboard/thong-bao");
}

export async function archiveAnnouncementAction(formData: FormData) {
  await requireAdminSession();
  const id = String(formData.get("id") ?? "");
  await db.partnerAnnouncement.update({ where: { id }, data: { archivedAt: new Date() } });
  revalidatePath("/admin/announcements");
}

export async function markAnnouncementReadAction(formData: FormData) {
  const session = await requirePartnerSession();
  const announcementId = String(formData.get("announcementId") ?? "");
  const now = new Date();
  const announcement = await db.partnerAnnouncement.findFirst({ where: { id: announcementId, targetPartnerType: session.account.partner.partnerType.code, archivedAt: null, publishAt: { lte: now }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }, select: { id: true } });
  if (!announcement) throw new Error("Announcement not found.");
  await db.partnerAnnouncementRead.upsert({ where: { announcementId_partnerId: { announcementId, partnerId: session.account.partner.id } }, create: { announcementId, partnerId: session.account.partner.id }, update: { readAt: new Date() } });
  revalidatePath("/dashboard/thong-bao"); revalidatePath("/dashboard");
}

export async function createShortLinkAction(formData: FormData) {
  const session = await requirePartnerSession();
  const code = session.account.partner.codes[0]?.code;
  if (!code) throw new Error("Partner does not have a referral code.");
  const destinationUrl = ensureTrustedMerlyUrl(String(formData.get("destinationUrl") ?? ""), code);
  let candidate = slug();
  for (let i = 0; i < 5; i++) {
    try { await db.shortLink.create({ data: { partnerId: session.account.partner.id, slug: candidate, destinationUrl } }); break; }
    catch { candidate = slug(); if (i === 4) throw new Error("Không tạo được slug."); }
  }
  revalidatePath("/dashboard/link-rut-gon");
}

export async function disableShortLinkAction(formData: FormData) {
  await requireAdminSession();
  await db.shortLink.update({ where: { id: String(formData.get("id") ?? "") }, data: { disabledAt: new Date(), disabledReason: String(formData.get("reason") || "Admin disabled") } });
  revalidatePath("/admin/announcements");
}

export async function redirectShortLink(slugValue: string) {
  const link = await db.shortLink.findUnique({ where: { slug: slugValue } });
  if (!link || link.disabledAt) redirect("/");
  const h = await headers();
  await db.shortLinkClick.create({ data: { shortLinkId: link.id, partnerId: link.partnerId, userAgent: h.get("user-agent"), referrer: h.get("referer"), ipHash: h.get("x-forwarded-for") ? sha256(h.get("x-forwarded-for")!.split(",")[0].trim()) : undefined } });
  redirect(link.destinationUrl);
}
