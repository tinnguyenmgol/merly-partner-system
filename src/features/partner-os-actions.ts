"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdminSession } from "@/features/auth/admin-auth";
import { parseVietnamDatetimeLocal } from "@/features/partner-os";

function str(formData: FormData, key: string) { return String(formData.get(key) ?? "").trim(); }
function optionalStr(formData: FormData, key: string) { return str(formData, key) || undefined; }

async function maybeCreateAnnouncement(formData: FormData, title: string, body: string, ctaLabel: string, ctaUrl: string, adminUserId: string) {
  if (formData.get("createAnnouncement") !== "on") return;
  await db.partnerAnnouncement.create({ data: { title, body, category: "partner_os", priority: "normal", ctaLabel, ctaUrl, createdByAdminId: adminUserId } });
}

export async function createContentAssetAction(formData: FormData) {
  const session = await requireAdminSession();
  const title = str(formData, "title");
  if (!title) throw new Error("Title is required.");
  const asset = await db.partnerContentAsset.create({ data: {
    title,
    contentType: str(formData, "contentType") || "caption",
    category: str(formData, "category") || "general",
    description: optionalStr(formData, "description"),
    caption: optionalStr(formData, "caption"),
    assetUrl: optionalStr(formData, "assetUrl"),
    thumbnailUrl: optionalStr(formData, "thumbnailUrl"),
    targetUrl: optionalStr(formData, "targetUrl"),
    productCode: optionalStr(formData, "productCode"),
    campaignId: optionalStr(formData, "campaignId"),
    publishAt: parseVietnamDatetimeLocal(formData.get("publishAt")) ?? new Date(),
    expiresAt: parseVietnamDatetimeLocal(formData.get("expiresAt")),
    status: str(formData, "status") || "draft",
    createdByAdminId: session.adminUserId,
  } });
  await maybeCreateAnnouncement(formData, "Merly có nội dung mới để chị đăng hôm nay", asset.title, "Xem kho nội dung", "/dashboard/kho-noi-dung", session.adminUserId);
  revalidatePath("/admin/content-library"); revalidatePath("/dashboard/kho-noi-dung"); revalidatePath("/dashboard");
}

export async function archiveContentAssetAction(formData: FormData) {
  await requireAdminSession();
  await db.partnerContentAsset.update({ where: { id: str(formData, "id") }, data: { status: "archived" } });
  revalidatePath("/admin/content-library"); revalidatePath("/dashboard/kho-noi-dung"); revalidatePath("/dashboard");
}

export async function createCampaignAction(formData: FormData) {
  const session = await requireAdminSession();
  const title = str(formData, "title");
  const startAt = parseVietnamDatetimeLocal(formData.get("startAt"));
  if (!title || !startAt) throw new Error("Title and startAt are required.");
  const campaign = await db.partnerCampaign.create({ data: {
    title,
    description: optionalStr(formData, "description"),
    campaignType: str(formData, "campaignType") || "general",
    status: str(formData, "status") || "draft",
    startAt,
    endAt: parseVietnamDatetimeLocal(formData.get("endAt")),
    priority: str(formData, "priority") || "normal",
    productCodes: optionalStr(formData, "productCodes"),
    targetUrl: optionalStr(formData, "targetUrl"),
    ctaLabel: optionalStr(formData, "ctaLabel"),
    ctaUrl: optionalStr(formData, "ctaUrl"),
    createdByAdminId: session.adminUserId,
  } });
  await maybeCreateAnnouncement(formData, "Có chương trình mới từ Merly", campaign.title, "Xem lịch chương trình", "/dashboard/lich-chuong-trinh", session.adminUserId);
  revalidatePath("/admin/campaigns"); revalidatePath("/dashboard/lich-chuong-trinh"); revalidatePath("/dashboard");
}

export async function archiveCampaignAction(formData: FormData) {
  await requireAdminSession();
  await db.partnerCampaign.update({ where: { id: str(formData, "id") }, data: { status: "archived" } });
  revalidatePath("/admin/campaigns"); revalidatePath("/dashboard/lich-chuong-trinh"); revalidatePath("/dashboard");
}
