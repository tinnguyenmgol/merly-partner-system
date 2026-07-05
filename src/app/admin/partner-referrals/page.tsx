import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireAdminSession } from "@/features/auth/admin-auth";
import { PARTNER_REFERRAL_STATUSES } from "@/features/partner-referrals/validation";
import { db } from "@/lib/db";
import { formatVnd } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams?: Promise<{ status?: string; message?: string }> }) {
  await requireAdminSession();
  const sp = await searchParams;
  const refs = await db.partnerReferral.findMany({
    where: sp?.status ? { status: sp.status } : {},
    include: {
      referrerPartner: { select: { id: true, displayName: true } },
      referredPartner: { select: { id: true, displayName: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <DashboardShell admin>
      <h1 className="text-3xl font-bold text-merly-900">Giới thiệu partner</h1>
      {sp?.message ? <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">{sp.message}</p> : null}
      <form className="mt-4 flex gap-3">
        <select name="status" defaultValue={sp?.status ?? ""} className="input w-auto">
          <option value="">Tất cả trạng thái</option>
          {PARTNER_REFERRAL_STATUSES.map((status) => <option key={status}>{status}</option>)}
        </select>
        <button type="submit" className="btn-secondary">Lọc</button>
      </form>
      <div className="card mt-6 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-stone-500"><tr><th className="py-2">Người giới thiệu</th><th>Partner được giới thiệu</th><th>Trạng thái</th><th>Thưởng</th><th>Cập nhật thủ công</th></tr></thead>
          <tbody>
            {refs.map((referral) => (
              <tr className="border-t align-top" key={referral.id}>
                <td className="py-3"><Link className="font-semibold text-merly-700" href={`/admin/partners/${referral.referrerPartnerId}`}>{referral.referrerPartner.displayName}</Link></td>
                <td>{referral.referredPartner ? <Link className="font-semibold text-merly-700" href={`/admin/partners/${referral.referredPartner.id}`}>{referral.referredPartner.displayName}</Link> : "Chưa gắn partner"}</td>
                <td>{referral.status}</td>
                <td>{referral.rewardAmount ? formatVnd(referral.rewardAmount) : referral.rewardDescription ?? "—"}</td>
                <td>
                  <form method="post" action={`/admin/partner-referrals/${referral.id}/update`} className="grid min-w-56 gap-2">
                    <select name="status" defaultValue={referral.status} className="input">
                      {PARTNER_REFERRAL_STATUSES.map((status) => <option key={status}>{status}</option>)}
                    </select>
                    <input name="rewardAmount" inputMode="numeric" defaultValue={referral.rewardAmount ?? ""} className="input" placeholder="Số tiền" />
                    <input name="rewardDescription" defaultValue={referral.rewardDescription ?? ""} className="input" placeholder="Mô tả thưởng" />
                    <input name="adminNote" defaultValue={referral.adminNote ?? ""} className="input" placeholder="Ghi chú admin" />
                    <button type="submit" className="btn-secondary">Lưu</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {refs.length === 0 ? <p className="p-4 text-stone-500">Chưa có referral phù hợp.</p> : null}
      </div>
    </DashboardShell>
  );
}
