import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { db } from "@/lib/db";

export default async function Page() {
  const partners = await db.partner.findMany({
    include: { partnerType: true, profile: true, codes: true },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
  });

  return (
    <DashboardShell admin>
      <div className="card">
        <h1 className="text-3xl font-bold text-merly-900">Quản lý đối tác</h1>
        <p className="mt-3 text-stone-600">Tiếp nhận đăng ký referral_ctv, duyệt hồ sơ, quản lý mã giới thiệu và theo dõi trạng thái đối tác.</p>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-stone-500">
              <tr className="border-b border-rose-100">
                <th className="py-3">Đối tác</th>
                <th>Loại</th>
                <th>Trạng thái</th>
                <th>Kênh</th>
                <th>Mã</th>
                <th>Ngày đăng ký</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {partners.map((partner) => (
                <tr className="border-b border-rose-50" key={partner.id}>
                  <td className="py-3"><b>{partner.displayName}</b><p className="text-stone-500">{partner.phone ?? partner.email}</p></td>
                  <td>{partner.partnerType.code}</td>
                  <td><span className="rounded-full bg-rose-50 px-3 py-1 font-medium text-merly-700">{partner.status}</span></td>
                  <td>{partner.profile?.sellingChannel ?? "—"}</td>
                  <td>{partner.codes.map((code) => code.code).join(", ") || "Chưa có"}</td>
                  <td>{partner.createdAt.toLocaleDateString("vi-VN")}</td>
                  <td><Link className="font-semibold text-merly-700" href={`/admin/partners/${partner.id}`}>Xem</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
          {partners.length === 0 && <p className="py-8 text-center text-stone-500">Chưa có hồ sơ đối tác.</p>}
        </div>
      </div>
    </DashboardShell>
  );
}
