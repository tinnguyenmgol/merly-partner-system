import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requirePartnerSession } from "@/features/auth/partner-auth";
import { updatePartnerProfileAction } from "@/features/partners/profile-actions";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams?: Promise<{ message?: string }> }) {
  const s = await requirePartnerSession();
  const p = s.account.partner;
  const params = await searchParams;
  const hasFirstPaidPayout = Boolean(await db.partnerPayout.findFirst({ where: { partnerId: p.id, status: "paid" }, select: { id: true } }));
  const profile = p.profile;

  return (
    <DashboardShell>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="card">
          <h1 className="text-3xl font-bold text-merly-900">Tài khoản</h1>
          <dl className="mt-4 grid gap-3">
            {[
              ["Tên", p.displayName],
              ["Số điện thoại", p.phone ?? "—"],
              ["Email", p.email ?? "—"],
              ["Ngân hàng", profile?.bankName ?? "—"],
              ["Số tài khoản", profile?.bankAccountNumber ?? "—"],
              ["Chủ tài khoản", profile?.bankAccountHolder ?? "—"],
              ["Zalo", profile?.zalo ?? "—"],
              ["Khu vực/tỉnh thành", profile?.cityProvince ?? profile?.area ?? "—"],
              ["Trạng thái", s.account.status],
              ["Lần đăng nhập cuối", s.account.lastLoginAt?.toLocaleString("vi-VN") ?? "—"],
            ].map(([l, v]) => (
              <div className="rounded-xl bg-rose-50 p-3" key={l}>
                <dt className="text-sm text-stone-500">{l}</dt>
                <dd className="font-semibold text-stone-800">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="card">
          <h2 className="text-2xl font-bold text-merly-900">Cập nhật thông tin</h2>
          {params?.message && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-800">{params.message}</p>}
          <p className="mt-3 rounded-xl bg-merly-50 p-3 text-sm text-merly-800">
            {hasFirstPaidPayout
              ? "Thông tin nhận thanh toán đã được khóa sau lần thanh toán đầu tiên. Nếu cần thay đổi, vui lòng liên hệ Merly để xác minh."
              : "Chị có thể cập nhật thông tin nhận thanh toán trước khi Merly thực hiện lần thanh toán đầu tiên."}
          </p>
          <form action={updatePartnerProfileAction} className="mt-5 grid gap-4">
            <label className="grid gap-1 text-sm font-medium text-stone-700">
              Tên hiển thị/liên hệ
              <input className="input" name="contactName" defaultValue={profile?.contactName ?? ""} placeholder={p.displayName} />
            </label>
            <label className="grid gap-1 text-sm font-medium text-stone-700">
              Zalo
              <input className="input" name="zalo" defaultValue={profile?.zalo ?? ""} placeholder="Số Zalo hỗ trợ liên hệ" />
            </label>
            <label className="grid gap-1 text-sm font-medium text-stone-700">
              Khu vực
              <input className="input" name="area" defaultValue={profile?.area ?? ""} placeholder="VD: Miền Nam" />
            </label>
            <label className="grid gap-1 text-sm font-medium text-stone-700">
              Tỉnh/thành
              <input className="input" name="cityProvince" defaultValue={profile?.cityProvince ?? ""} placeholder="VD: TP. Hồ Chí Minh" />
            </label>
            <div className="grid gap-3 rounded-2xl border border-rose-100 p-4">
              <label className="grid gap-1 text-sm font-medium text-stone-700">
                Ngân hàng
                <input className="input" name="bankName" defaultValue={profile?.bankName ?? ""} readOnly={hasFirstPaidPayout} />
              </label>
              <label className="grid gap-1 text-sm font-medium text-stone-700">
                Số tài khoản
                <input className="input" name="bankAccountNumber" defaultValue={profile?.bankAccountNumber ?? ""} readOnly={hasFirstPaidPayout} />
              </label>
              <label className="grid gap-1 text-sm font-medium text-stone-700">
                Chủ tài khoản
                <input className="input" name="bankAccountHolder" defaultValue={profile?.bankAccountHolder ?? ""} readOnly={hasFirstPaidPayout} />
              </label>
            </div>
            <div className="rounded-xl bg-stone-50 p-3 text-sm text-stone-600">Số điện thoại và email hiện đang chỉ đọc để bảo vệ tài khoản. Nếu cần đổi, vui lòng liên hệ Merly.</div>
            <button className="btn-primary w-fit px-5 py-3" type="submit">Lưu thay đổi</button>
          </form>
        </div>
      </div>
    </DashboardShell>
  );
}
