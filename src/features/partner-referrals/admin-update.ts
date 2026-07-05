"server-only";

import { revalidatePath } from "next/cache";
import { createAdminNotification } from "@/features/notifications";
import { sendAdminAlertEmail } from "@/features/notification-email";
import { db } from "@/lib/db";

import { parsePartnerReferralRewardAmount, parsePartnerReferralStatus, type PartnerReferralStatus } from "@/features/partner-referrals/validation";

const IMPORTANT_REWARD_STATUSES = new Set<PartnerReferralStatus>(["reward_pending", "rewarded"]);

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function notifyImportantReferralChange(input: { id: string; status: PartnerReferralStatus; rewardAmount: number | null; rewardDescription: string | null }) {
  if (!IMPORTANT_REWARD_STATUSES.has(input.status)) return;
  try {
    await createAdminNotification({
      type: "partner.referral.reward_update",
      title: "Cập nhật thưởng giới thiệu partner",
      message: `Referral ${input.id} chuyển sang ${input.status}.`,
      actionUrl: "/admin/partner-referrals",
      entityType: "PartnerReferral",
      entityId: input.id,
      severity: "warning",
    });
    void sendAdminAlertEmail({
      subject: "Merly Partner: Cập nhật thưởng giới thiệu partner",
      lines: [
        `Referral: ${input.id}`,
        `Trạng thái: ${input.status}`,
        `Thưởng: ${input.rewardAmount ?? input.rewardDescription ?? "—"}`,
      ],
      actionPath: "/admin/partner-referrals",
    });
  } catch (error) {
    console.warn("[partner-referral-update-notification] failed", error);
  }
}

export async function updatePartnerReferralFromForm(formData: FormData, actorId: string) {
  const id = text(formData, "referralId") || text(formData, "id");
  if (!id) throw new Error("MISSING_REFERRAL_ID");

  const status = parsePartnerReferralStatus(text(formData, "status"));
  const rewardAmount = parsePartnerReferralRewardAmount(text(formData, "rewardAmount"));
  const rewardDescription = text(formData, "rewardDescription") || null;
  const adminNote = text(formData, "adminNote") || null;

  const before = await db.partnerReferral.findUnique({ where: { id } });
  if (!before) throw new Error("REFERRAL_NOT_FOUND");

  const after = await db.partnerReferral.update({
    where: { id },
    data: {
      status,
      rewardAmount,
      rewardDescription,
      adminNote,
      rewardApprovedAt: status === "reward_pending" ? new Date() : before.rewardApprovedAt,
      rewardedAt: status === "rewarded" ? new Date() : before.rewardedAt,
      updatedAt: new Date(),
    },
  });

  await db.adminAuditLog.create({
    data: {
      actorId,
      partnerId: after.referrerPartnerId,
      action: "partner_referral.reward_update",
      entityType: "PartnerReferral",
      entityId: after.id,
      beforeJson: { status: before.status, rewardAmount: before.rewardAmount, rewardDescription: before.rewardDescription, adminNote: before.adminNote },
      afterJson: { status: after.status, rewardAmount: after.rewardAmount, rewardDescription: after.rewardDescription, adminNote: after.adminNote },
      note: after.adminNote,
    },
  });

  if (before.status !== after.status || before.rewardAmount !== after.rewardAmount || before.rewardDescription !== after.rewardDescription) {
    await notifyImportantReferralChange({ id: after.id, status, rewardAmount: after.rewardAmount, rewardDescription: after.rewardDescription });
  }

  revalidatePath("/admin/partner-referrals");
  return after;
}
