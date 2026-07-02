"use server";

import { revalidatePath } from "next/cache";
import { logSmtpTestConfig, sendTransactionalEmail, verifyTransactionalEmailTransport, type SafeSmtpErrorDetails } from "@/lib/mail";

export type TestEmailState = { message?: string; ok?: boolean; details?: SafeSmtpErrorDetails };

function isEmail(value: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }

function formatErrorMessage(prefix: string, details: SafeSmtpErrorDetails) {
  const code535 = details.responseCode === 535;
  const explanation = code535
    ? " SMTP xác thực thất bại. App đã kết nối được SMTP nhưng server từ chối đăng nhập. Kiểm tra SMTP_USER, SMTP_PASSWORD thực tế app đang đọc, khoảng trắng ở mật khẩu, và restart app sau khi đổi env."
    : "";
  return `${prefix}: stage=${details.stage}; name=${details.name}; code=${details.code ?? "—"}; command=${details.command ?? "—"}; responseCode=${details.responseCode ?? "—"}; response=${details.response ?? "—"}; message=${details.message}.${explanation}`;
}

export async function sendTestEmailAction(_prev: TestEmailState, formData: FormData): Promise<TestEmailState> {
  const intent = String(formData.get("intent") ?? "send");
  logSmtpTestConfig();

  if (intent === "verify") {
    const verify = await verifyTransactionalEmailTransport();
    revalidatePath("/admin/settings/ctv");
    if (verify.ok) return { ok: true, message: "SMTP verify thành công." };
    if (verify.skipped) return { ok: false, message: `Chưa kiểm tra SMTP verify: ${verify.reason}` };
    return { ok: false, message: formatErrorMessage("SMTP verify thất bại", verify.details), details: verify.details };
  }

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
  return { ok: false, message: result.details ? formatErrorMessage("Gửi email thử thất bại", result.details) : `Gửi email thử thất bại: ${result.error}`, details: result.details };
}
