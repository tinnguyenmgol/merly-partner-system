"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/features/auth/admin-auth";
import { requirePartnerSession } from "@/features/auth/partner-auth";
import { createAdminNotification } from "@/features/notifications";
import { db } from "@/lib/db";

function text(formData: FormData, key: string) { const value = formData.get(key); return typeof value === "string" ? value.trim() : ""; }
function optionalDate(value: string) { return value ? new Date(value) : new Date(); }

export async function saveTrainingLessonAction(formData: FormData) {
  const session = await requireAdminSession();
  const id = text(formData, "id");
  const status = text(formData, "status") || "draft";
  const data = {
    title: text(formData, "title"),
    description: text(formData, "description") || null,
    category: text(formData, "category") || "Bắt đầu bán cùng Merly",
    level: text(formData, "level") || "beginner",
    videoUrl: text(formData, "videoUrl") || null,
    thumbnailUrl: text(formData, "thumbnailUrl") || null,
    body: text(formData, "body") || null,
    estimatedMinutes: Number(text(formData, "estimatedMinutes")) || null,
    status,
    orderIndex: Number(text(formData, "orderIndex")) || 0,
    publishAt: optionalDate(text(formData, "publishAt")),
    createdByAdminId: session.adminUserId,
  };
  if (!data.title) throw new Error("Training lesson title is required.");
  const lesson = id ? await db.partnerTrainingLesson.update({ where: { id }, data }) : await db.partnerTrainingLesson.create({ data });
  if (formData.get("announce") === "on" && status === "published") {
    const targetPartnerTypes = ["referral_ctv", "agency", "mini_corner"] as const;
    await db.partnerAnnouncement.createMany({
      data: targetPartnerTypes.map((targetPartnerType) => ({
        title: `Bài đào tạo mới: ${data.title}`,
        body: data.description || "Merly vừa xuất bản bài học mới trong Trung tâm đào tạo.",
        category: "training",
        priority: "normal",
        ctaLabel: "Xem bài học",
        ctaUrl: `/dashboard/dao-tao/${lesson.id}`,
        targetPartnerType,
        createdByAdminId: session.adminUserId,
      })),
    });
  }
  revalidatePath("/admin/training"); revalidatePath("/dashboard"); revalidatePath("/dashboard/dao-tao");
  redirect("/admin/training");
}

export async function archiveTrainingLessonAction(formData: FormData) {
  await requireAdminSession();
  const id = text(formData, "id");
  if (!id) return;
  await db.partnerTrainingLesson.update({ where: { id }, data: { status: "archived", archivedAt: new Date() } });
  revalidatePath("/admin/training"); revalidatePath("/dashboard/dao-tao");
}

export async function completeTrainingLessonAction(formData: FormData) {
  const session = await requirePartnerSession();
  const lessonId = text(formData, "lessonId");
  if (!lessonId) return;
  const partnerId = session.account.partner.id;
  await db.partnerTrainingProgress.upsert({ where: { lessonId_partnerId: { lessonId, partnerId } }, create: { lessonId, partnerId, status: "completed", startedAt: new Date(), completedAt: new Date() }, update: { status: "completed", completedAt: new Date() } });
  revalidatePath("/dashboard"); revalidatePath("/dashboard/dao-tao"); revalidatePath(`/dashboard/dao-tao/${lessonId}`);
}

export async function updatePartnerReferralRewardAction(formData: FormData) {
  const session = await requireAdminSession();
  const id = text(formData, "id"); const status = text(formData, "status");
  if (!id || !status) return;
  const before = await db.partnerReferral.findUnique({ where: { id } });
  const after = await db.partnerReferral.update({ where: { id }, data: { status, rewardAmount: Number(text(formData, "rewardAmount")) || null, rewardDescription: text(formData, "rewardDescription") || null, adminNote: text(formData, "adminNote") || null, rewardApprovedAt: status === "reward_pending" ? new Date() : undefined, rewardedAt: status === "rewarded" ? new Date() : undefined } });
  await db.adminAuditLog.create({ data: { actorId: session.adminUserId, partnerId: after.referrerPartnerId, action: "partner_referral.reward_update", entityType: "PartnerReferral", entityId: after.id, beforeJson: before ? { status: before.status, rewardAmount: before.rewardAmount, rewardDescription: before.rewardDescription } : undefined, afterJson: { status: after.status, rewardAmount: after.rewardAmount, rewardDescription: after.rewardDescription }, note: after.adminNote } });
  revalidatePath("/admin/partner-referrals");
}

export { createAdminNotification };
