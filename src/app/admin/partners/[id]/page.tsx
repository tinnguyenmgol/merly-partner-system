import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { reviewPartnerRegistration } from "@/features/partners/intake";
import { db } from "@/lib/db";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const partner = await db.partner.findUnique({
    include: { partnerType: true, profile: true, codes: true, auditLogs: { orderBy: { createdAt: "desc" }, take: 20 } },
    where: { id },
  });

  if (!partner) notFound();

  return (
    <DashboardShell admin>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="card">
          <p className="font-semibold text-merly-700">{partner.partnerType.code}</p>
          <h1 className="mt-2 text-3xl font-bold text-merly-900">{partner.displayName}</h1>
          <p className="mt-2 text-stone-600">Hồ sơ đăng ký đối tác, thông tin thanh toán, trạng thái xét duyệt và mã giới thiệu.</p>
          <dl className="mt-6 grid gap-4 md:grid-cols-2">
            {[
              ["Trạng thái", partner.status],
              ["Số điện thoại", partner.phone ?? "—"],
              ["Email", partner.email ?? "—"],
              ["Zalo", partner.profile?.zalo ?? "—"],
              ["Khu vực", partner.profile?.area ?? "—"],
              ["Kênh bán", partner.profile?.sellingChannel ?? "—"],
              ["Link xã hội", partner.profile?.socialLink ?? "—"],
              ["Ngân hàng", [partner.profile?.bankName, partner.profile?.bankAccountNumber].filter(Boolean).join(" · ") || "—"],
            ].map(([label, value]) => (
              <div className="rounded-xl bg-rose-50/60 p-4" key={label}>
                <dt className="text-sm text-stone-500">{label}</dt>
                <dd className="mt-1 font-semibold text-merly-900">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 rounded-xl bg-stone-50 p-4">
            <h2 className="font-bold text-merly-900">Ghi chú / kinh nghiệm</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-stone-600">{partner.profile?.experienceNote || "Chưa có ghi chú."}</p>
          </div>
        </div>
        <aside className="grid gap-6">
          <div className="card">
            <h2 className="text-xl font-bold text-merly-900">Xét duyệt</h2>
            <form action={reviewPartnerRegistration} className="mt-4 grid gap-3">
              <input name="partnerId" type="hidden" value={partner.id} />
              <label className="grid gap-2 text-sm">Mã giới thiệu khi duyệt<input className="input" name="partnerCode" placeholder="VD: MERLYANH001" /></label>
              <label className="grid gap-2 text-sm">Ghi chú audit<textarea className="input min-h-24" name="note" /></label>
              <div className="grid gap-2">
                <button className="btn-primary" name="decision" type="submit" value="approve">Duyệt & kích hoạt</button>
                <button className="btn-secondary" name="decision" type="submit" value="reject">Từ chối</button>
                <button className="btn-secondary" name="decision" type="submit" value="suspend">Tạm khóa</button>
              </div>
            </form>
          </div>
          <div className="card">
            <h2 className="text-xl font-bold text-merly-900">Mã giới thiệu</h2>
            <div className="mt-4 grid gap-2">
              {partner.codes.length > 0 ? partner.codes.map((code) => <span className="rounded-xl bg-rose-50 p-3 font-mono font-semibold" key={code.id}>{code.code}</span>) : <p className="text-sm text-stone-500">Chưa tạo mã.</p>}
            </div>
          </div>
        </aside>
      </div>
      <div className="card mt-6">
        <h2 className="text-xl font-bold text-merly-900">Audit logs</h2>
        <div className="mt-4 grid gap-3">
          {partner.auditLogs.map((log) => <div className="rounded-xl border border-rose-100 p-4" key={log.id}><b>{log.action}</b><p className="text-sm text-stone-500">{log.createdAt.toLocaleString("vi-VN")} · {log.note ?? "Không có ghi chú"}</p></div>)}
          {partner.auditLogs.length === 0 && <p className="text-sm text-stone-500">Chưa có audit log.</p>}
        </div>
      </div>
    </DashboardShell>
  );
}
