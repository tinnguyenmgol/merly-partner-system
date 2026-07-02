import { DashboardShell } from "@/components/layout/dashboard-shell";
import { updateCtvProgramSettingsAction } from "@/features/settings-actions";
import { getCtvProgramSettings } from "@/features/settings";
import { formatVnd } from "@/lib/money";
import { getTransactionalEmailStatus } from "@/lib/mail";
import { TestEmailForm } from "./test-email-form";

export const dynamic = "force-dynamic";
function percent(bps: number) { return String(bps / 100); }

export default async function Page() {
  const settings = await getCtvProgramSettings();
  const emailStatus = getTransactionalEmailStatus();

  return (
    <DashboardShell admin>
      <div className="grid max-w-4xl gap-6">
        <div className="card">
          <p className="font-semibold text-merly-700">Referral CTV</p>
          <h1 className="mt-2 text-3xl font-bold text-merly-900">Cài đặt chương trình CTV</h1>
          <p className="mt-2 text-stone-600">Cấu hình nội dung công khai, điều kiện hoa hồng và thanh toán cho CTV cá nhân.</p>
          <form action={updateCtvProgramSettingsAction} className="mt-6 grid gap-5">
            <label className="flex items-center gap-3 font-semibold"><input name="ctvProgramEnabled" type="checkbox" defaultChecked={settings.ctvProgramEnabled}/> Bật chương trình CTV</label>
            <label className="grid gap-2">Hoa hồng mặc định (%)<input className="input" name="defaultCommissionRatePercent" type="number" step="0.01" min="0" defaultValue={percent(settings.defaultCommissionRateBps)}/></label>
            <label className="grid gap-2">Số tiền thanh toán tối thiểu<input className="input" name="minimumPayoutAmount" type="number" min="0" step="1000" defaultValue={settings.minimumPayoutAmount}/><span className="text-sm text-stone-500">Hiện tại: {formatVnd(settings.minimumPayoutAmount)}</span></label>
            <label className="grid gap-2">Số ngày chờ đối soát<input className="input" name="reconciliationWaitDays" type="number" min="0" defaultValue={settings.reconciliationWaitDays}/></label>
            <label className="grid gap-2">Zalo/SĐT hỗ trợ<input className="input" name="supportPhoneOrZalo" defaultValue={settings.supportPhoneOrZalo}/></label>
            <label className="grid gap-2">Nội dung chính sách CTV<textarea className="input min-h-36" name="publicPolicyText" defaultValue={settings.publicPolicyText}/></label>
            <label className="flex items-center gap-3"><input name="bankInfoRequiredBeforePayout" type="checkbox" defaultChecked={settings.bankInfoRequiredBeforePayout}/> Bắt buộc thông tin ngân hàng trước khi thanh toán</label>
            <label className="flex items-center gap-3"><input name="orderRequestEnabled" type="checkbox" defaultChecked={settings.orderRequestEnabled}/> Cho phép gửi yêu cầu gắn đơn</label>
            <label className="flex items-center gap-3"><input name="affiliateLinkEnabled" type="checkbox" defaultChecked={settings.affiliateLinkEnabled}/> Cho phép dùng link giới thiệu</label>
            <button className="btn-primary w-fit">Lưu cài đặt</button>
          </form>
        </div>

        <section className="card" aria-labelledby="system-email-settings-title">
          <h2 id="system-email-settings-title" className="text-xl font-bold text-merly-900">Cấu hình email hệ thống</h2>
          <p className="mt-2 text-sm text-stone-600">Kiểm tra gửi email từ SMTP_FROM trước khi dùng chức năng quên mật khẩu. Mật khẩu SMTP không hiển thị trong admin.</p>
          <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
            Hostinger production hiện nên dùng: SMTP_HOST=smtp.hostinger.com, SMTP_PORT=465, SMTP_SECURE=true, SMTP_USER=noreply@merlyshoes.com, SMTP_FROM=noreply@merlyshoes.com.
          </p>
          <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
            {[
              ["Trạng thái SMTP", emailStatus.configured ? "Đã cấu hình" : "Thiếu cấu hình"],
              ["SMTP_HOST", emailStatus.host ?? "—"],
              ["SMTP_PORT", emailStatus.port?.toString() ?? "—"],
              ["SMTP_SECURE", emailStatus.secure ? "true" : "false"],
              ["SMTP_USER", emailStatus.user ?? "—"],
              ["SMTP_FROM", emailStatus.from ?? "—"],
              ["passwordPresent", emailStatus.passwordPresent ? "true" : "false"],
              ["passwordLength", emailStatus.passwordLength.toString()],
              ["passwordHasLeadingOrTrailingWhitespace", emailStatus.passwordHasLeadingOrTrailingWhitespace ? "true" : "false"],
              ["fromHasLiteralQuotes", emailStatus.fromHasLiteralQuotes ? "true" : "false"],
              ["fromHasAngleBrackets", emailStatus.fromHasAngleBrackets ? "true" : "false"],
              ["nodeEnv", emailStatus.nodeEnv ?? "—"],
            ].map(([label, value]) => (
              <div className="rounded-xl bg-stone-50 p-3" key={label}>
                <dt className="text-stone-500">{label}</dt>
                <dd className="break-all font-semibold text-merly-900">{value}</dd>
              </div>
            ))}
          </dl>
          <TestEmailForm />
        </section>
      </div>
    </DashboardShell>
  );
}
