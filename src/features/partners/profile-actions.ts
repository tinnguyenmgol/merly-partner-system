"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePartnerSession } from "@/features/auth/partner-auth";
import { db } from "@/lib/db";
import { createAdminNotification } from "@/features/notifications";
import { sendAdminAlertEmail } from "@/features/notification-email";

function optionalText(formData: FormData, key: string, maxLength: number) {
  const value = formData.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function validateBankField(value: string | null, label: string) {
  if (!value) return null;
  if (/[<>]/.test(value)) return `${label} không được chứa ký tự không hợp lệ.`;
  return null;
}

export async function updatePartnerProfileAction(formData: FormData) {
  const session = await requirePartnerSession();
  const partnerId = session.account.partnerId;

  const bankName = optionalText(formData, "bankName", 100);
  const bankAccountNumber = optionalText(formData, "bankAccountNumber", 50);
  const bankAccountHolder = optionalText(formData, "bankAccountHolder", 100);
  const zalo = optionalText(formData, "zalo", 50);
  const area = optionalText(formData, "area", 100);
  const cityProvince = optionalText(formData, "cityProvince", 100);
  const contactName = optionalText(formData, "contactName", 100);

  const validationError =
    validateBankField(bankName, "Tên ngân hàng") ??
    validateBankField(bankAccountNumber, "Số tài khoản") ??
    validateBankField(bankAccountHolder, "Chủ tài khoản");
  if (validationError) {
    redirect(`/dashboard/tai-khoan?message=${encodeURIComponent(validationError)}`);
  }

  const existing = await db.partnerProfile.findUnique({ where: { partnerId } });

  const hasFirstPaidPayout = await db.partnerPayout.findFirst({
    where: { partnerId, status: "paid" },
    select: { id: true },
  });

  const requestedBankUpdate =
    bankName !== (existing?.bankName ?? null) ||
    bankAccountNumber !== (existing?.bankAccountNumber ?? null) ||
    bankAccountHolder !== (existing?.bankAccountHolder ?? null);

  if (hasFirstPaidPayout && requestedBankUpdate) {
    redirect(`/dashboard/tai-khoan?message=${encodeURIComponent("Thông tin nhận thanh toán đã được khóa sau lần thanh toán đầu tiên. Vui lòng liên hệ Merly để xác minh nếu cần thay đổi.")}`);
  }

  await db.partnerProfile.upsert({
    where: { partnerId },
    create: {
      partnerId,
      fullName: session.account.partner.displayName,
      ...(hasFirstPaidPayout ? {} : { bankName, bankAccountNumber, bankAccountHolder }),
      zalo,
      area,
      cityProvince,
      contactName,
    },
    update: {
      ...(hasFirstPaidPayout ? {} : { bankName, bankAccountNumber, bankAccountHolder }),
      zalo,
      area,
      cityProvince,
      contactName,
    },
  });

  if (requestedBankUpdate) {
    await createAdminNotification({ type: "partner.payment_info.updated", title: "CTV cập nhật thông tin thanh toán", actionUrl: `/admin/partners/${partnerId}`, entityType: "Partner", entityId: partnerId, severity: "warning" });
    void sendAdminAlertEmail({ subject: "Merly Partner: CTV cập nhật thông tin thanh toán", lines: [`Partner: ${session.account.partner.displayName}`, `Thời gian cập nhật: ${new Date().toISOString()}`], actionPath: `/admin/partners/${partnerId}` });
  }

  revalidatePath("/dashboard/tai-khoan");
  redirect(`/dashboard/tai-khoan?message=${encodeURIComponent("Đã cập nhật thông tin tài khoản.")}`);
}
