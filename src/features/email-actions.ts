"use server";

import { revalidatePath } from "next/cache";
import { sendTransactionalEmail } from "@/lib/mail";

export type TestEmailState = { message?: string; ok?: boolean };

function isEmail(value: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }

export async function sendTestEmailAction(_prev: TestEmailState, formData: FormData): Promise<TestEmailState> {
  const to = String(formData.get("to") ?? "").trim().toLowerCase();
  if (!isEmail(to)) return { ok: false, message: "Vui lòng nhập email nhận hợp lệ." };
  const result = await sendTransactionalEmail({
    to,
    subject: "Email thử từ Merly Partner System",
    text: "Merly gửi email thử để kiểm tra cấu hình SMTP cho hệ thống CTV.",
    html: "<p>Merly gửi email thử để kiểm tra cấu hình SMTP cho hệ thống CTV.</p>",
  });
  revalidatePath("/admin/settings/ctv");
  if (result.ok) return { ok: true, message: "Đã gửi email thử thành công." };
  if (result.skipped) return { ok: false, message: `Chưa gửi email thử: ${result.reason}` };
  return { ok: false, message: `Gửi email thử thất bại: ${result.error}` };
}
