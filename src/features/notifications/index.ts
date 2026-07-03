import { revalidatePath } from "next/cache";
import { AdminNotificationSeverity, PartnerTypeCode } from "@prisma/client";
import { requireAdminSession } from "@/features/auth/admin-auth";
import { requirePartnerSession } from "@/features/auth/partner-auth";
import { db } from "@/lib/db";

export function badgeLabel(count: number) {
  return count > 99 ? "99+" : String(count);
}

export async function getPartnerUnreadAnnouncementCount(partnerId: string, partnerTypeCode: PartnerTypeCode) {
  const now = new Date();
  return db.partnerAnnouncement.count({
    where: {
      targetPartnerType: partnerTypeCode,
      archivedAt: null,
      publishAt: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      reads: { none: { partnerId } },
    },
  });
}

export async function getCurrentPartnerUnreadAnnouncementCount() {
  const session = await requirePartnerSession();
  return getPartnerUnreadAnnouncementCount(session.account.partner.id, session.account.partner.partnerType.code);
}

export async function markAllAnnouncementsReadAction() {
  "use server";
  const session = await requirePartnerSession();
  const partner = session.account.partner;
  const now = new Date();
  const unread = await db.partnerAnnouncement.findMany({
    where: { targetPartnerType: partner.partnerType.code, archivedAt: null, publishAt: { lte: now }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }], reads: { none: { partnerId: partner.id } } },
    select: { id: true },
  });
  if (unread.length) {
    await db.partnerAnnouncementRead.createMany({ data: unread.map((item) => ({ announcementId: item.id, partnerId: partner.id })), skipDuplicates: true });
  }
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/thong-bao");
}

export async function createAdminNotification(input: {
  type: string;
  title: string;
  message?: string;
  severity?: AdminNotificationSeverity;
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
}) {
  return db.adminNotification.create({ data: { severity: "info", ...input } });
}

export async function getAdminUnreadNotificationCount() {
  await requireAdminSession();
  return db.adminNotification.count({ where: { status: "unread", archivedAt: null } });
}

export async function markAdminNotificationReadAction(formData: FormData) {
  "use server";
  await requireAdminSession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.adminNotification.update({ where: { id }, data: { status: "read", readAt: new Date() } });
  revalidatePath("/admin/notifications");
  revalidatePath("/admin");
}

export async function markAllAdminNotificationsReadAction() {
  "use server";
  await requireAdminSession();
  await db.adminNotification.updateMany({ where: { status: "unread", archivedAt: null }, data: { status: "read", readAt: new Date() } });
  revalidatePath("/admin/notifications");
  revalidatePath("/admin");
}

export async function archiveAdminNotificationAction(formData: FormData) {
  "use server";
  await requireAdminSession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.adminNotification.update({ where: { id }, data: { status: "archived", archivedAt: new Date() } });
  revalidatePath("/admin/notifications");
  revalidatePath("/admin");
}
