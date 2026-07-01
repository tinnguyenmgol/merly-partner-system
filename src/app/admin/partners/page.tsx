import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { db, hasDatabaseUrl } from "@/lib/db";

export const dynamic = "force-dynamic";

type PartnerRow = Prisma.PartnerGetPayload<{
  include: {
    partnerType: true;
    profile: true;
    codes: { select: { code: true } };
  };
}>;

export default async function Page() {
  let schemaWarning: string | null = null;
  const partners: PartnerRow[] = [];

  if (hasDatabaseUrl()) {
    try {
      partners.push(
        ...(await db.partner.findMany({
          include: {
            partnerType: true,
            profile: true,
            codes: { select: { code: true } },
          },
          orderBy: [{ status: "asc" }, { createdAt: "desc" }],
          take: 100,
        })),
      );
    } catch (error) {
      console.error("Failed to load admin partners", error);
      schemaWarning = "Không thể tải danh sách đối tác. Nếu vừa triển khai bản mới, hãy chạy npm run db:migrate rồi npm run db:bootstrap.";
    }
  }

  return (
    <DashboardShell admin>
      <div className="card">
        <h1 className="text-3xl font-bold text-merly-900">Quản lý đối tác</h1>
        <p className="mt-3 text-stone-600">Tiếp nhận đăng ký referral_ctv, duyệt hồ sơ, quản lý mã giới thiệu và theo dõi trạng thái đối tác.</p>
        {!hasDatabaseUrl() ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 font-medium text-amber-800">
            Chưa cấu hình DATABASE_URL nên chưa thể tải danh sách CTV.
          </p>
        ) : null}
        {schemaWarning ? <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">{schemaWarning}</p> : null}
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
