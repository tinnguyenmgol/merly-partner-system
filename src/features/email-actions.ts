"use server";

import { revalidatePath } from "next/cache";
import { getSmtpRuntimeDiagnostics, logSmtpTestConfig, sendTransactionalEmail, verifyTransactionalEmailTransport, type SmtpAuthMethod, type SafeSmtpErrorDetails } from "@/lib/mail";

export type TestEmailState = {
  to?: string;
  message?: string;
  ok?: boolean;
  details?: SafeSmtpErrorDetails;
  messageId?: string;
  acceptedCount?: number;
  rejectedCount?: number;
  providerResponse?: string;
  selfSendWarning?: string;
};

function isEmail(value: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }

function formatErrorMessage(prefix: string, details: SafeSmtpErrorDetails) {
  const code535 = details.responseCode === 535;
  const explanation = code535
    ? details.authMethod === "LOGIN"
      ? " Hostinger vẫn từ chối đăng nhập SMTP sau khi ép AUTH LOGIN. Vui lòng kiểm tra lại mailbox/password bằng Apple Mail hoặc Thunderbird. Nếu mail client cũng lỗi, cần liên hệ Hostinger."
      : " SMTP xác thực thất bại. App đã kết nối được SMTP nhưng server từ chối đăng nhập. Kiểm tra SMTP_USER, SMTP_PASSWORD thực tế app đang đọc, khoảng trắng ở mật khẩu, và restart app sau khi đổi env."
    : "";
  return `${prefix}: authMethod=${details.authMethod}; stage=${details.stage}; name=${details.name}; code=${details.code ?? "—"}; command=${details.command ?? "—"}; responseCode=${details.responseCode ?? "—"}; response=${details.response ?? "—"}; message=${details.message}.${explanation}`;
}

function sameMailbox(to: string) {
  const diagnostics = getSmtpRuntimeDiagnostics();
  const candidates = [diagnostics.user, diagnostics.from]
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase());
  return candidates.includes(to.trim().toLowerCase());
}

export async function sendTestEmailAction(_prev: TestEmailState, formData: FormData): Promise<TestEmailState> {
  const intent = String(formData.get("intent") ?? "send");
  const authMethod: SmtpAuthMethod = formData.get("authMethod") === "DEFAULT" ? "DEFAULT" : "LOGIN";
  const to = String(formData.get("to") ?? "").trim().toLowerCase();
  logSmtpTestConfig(authMethod);

  if (intent === "verify") {
    const verify = await verifyTransactionalEmailTransport(authMethod);
    revalidatePath("/admin/settings/ctv");
    if (verify.ok) return { to, ok: true, message: "SMTP verify thành công." };
    if (verify.skipped) return { to, ok: false, message: `Chưa kiểm tra SMTP verify: ${verify.reason}` };
    return { to, ok: false, message: formatErrorMessage("SMTP verify thất bại", verify.details), details: verify.details };
  }

  if (!isEmail(to)) return { to, ok: false, message: "Vui lòng nhập email nhận hợp lệ." };
  const result = await sendTransactionalEmail({
    to,
    subject: "Email thử từ Merly Partner System",
    text: "Merly gửi email thử để kiểm tra cấu hình SMTP cho hệ thống CTV.",
    html: "<p>Merly gửi email thử để kiểm tra cấu hình SMTP cho hệ thống CTV.</p>",
  });
  revalidatePath("/admin/settings/ctv");
  if (result.ok) {
    return {
      to,
      ok: true,
      message: "Đã gửi email thử thành công.",
      messageId: result.messageId,
      acceptedCount: result.accepted?.length,
      rejectedCount: result.rejected?.length,
      providerResponse: result.response,
      selfSendWarning: sameMailbox(to) ? "Đang gửi từ chính mailbox này đến chính mailbox này. Nếu không thấy inbox, hãy kiểm tra Sent/Spam hoặc thử gửi sang Gmail cá nhân." : undefined,
    };
  }
  if (result.skipped) return { to, ok: false, message: `Chưa gửi email thử: ${result.reason}` };
  return { to, ok: false, message: result.details ? formatErrorMessage("Gửi email thử thất bại", result.details) : `Gửi email thử thất bại: ${result.error}`, details: result.details, providerResponse: result.details?.response };
}
