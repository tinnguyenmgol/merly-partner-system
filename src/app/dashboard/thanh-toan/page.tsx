import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requirePartnerSession } from "@/features/auth/partner-auth";
import { createPayoutRequestAction, getPartnerPayoutDashboard, hasBankInfo, PAYOUT_STATUS_LABELS } from "@/features/payouts";
import { formatVnd } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requirePartnerSession();
  const data = await getPartnerPayoutDashboard(session.account.partnerId);
  const profile = data.partner.profile;
  const bankReady = hasBankInfo(profile);
  const enough = data.payableBalance >= data.minimumPayoutAmount;
  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="card"><h1 className="text-3xl font-bold text-merly-900">Thanh toán</h1><p className="mt-3 text-stone-600">Yêu cầu thanh toán hoa hồng referral_ctv khi số dư khả dụng đạt ngưỡng tối thiểu.</p></div>
        <div className="grid gap-4 md:grid-cols-4">
          <div className="card"><p className="text-sm text-stone-500">Có thể thanh toán</p><p className="mt-2 text-2xl font-bold text-merly-900">{formatVnd(data.payableBalance)}</p></div>
          <div className="card"><p className="text-sm text-stone-500">Ngưỡng tối thiểu</p><p className="mt-2 text-2xl font-bold text-merly-900">{formatVnd(data.minimumPayoutAmount)}</p></div>
          <div className="card"><p className="text-sm text-stone-500">Đang chờ/đã duyệt</p><p className="mt-2 text-2xl font-bold text-merly-900">{formatVnd(data.pendingPayoutAmount)}</p></div>
          <div className="card"><p className="text-sm text-stone-500">Đã thanh toán</p><p className="mt-2 text-2xl font-bold text-merly-900">{formatVnd(data.paidTotal)}</p></div>
        </div>
        <div className="card">
          <h2 className="text-xl font-semibold text-merly-900">Tài khoản ngân hàng</h2>
          <dl className="mt-4 grid gap-3 md:grid-cols-3"><div><dt>Ngân hàng</dt><dd className="font-semibold">{profile?.bankName ?? "—"}</dd></div><div><dt>Số tài khoản</dt><dd className="font-semibold">{profile?.bankAccountNumber ?? "—"}</dd></div><div><dt>Chủ tài khoản</dt><dd className="font-semibold">{profile?.bankAccountHolder ?? "—"}</dd></div></dl>
          {!bankReady ? <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-800">Vui lòng bổ sung thông tin tài khoản ngân hàng trước khi yêu cầu thanh toán.</p> : null}
        </div>
        <div className="card">
          {!enough ? <p className="rounded-xl bg-rose-50 p-3 font-medium text-rose-800">Chưa đủ mức thanh toán tối thiểu 100.000đ, hoa hồng sẽ được cộng dồn.</p> : null}
          <form action={createPayoutRequestAction} className="mt-4"><button disabled={!enough || !bankReady} className="rounded-full bg-merly-800 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-stone-300" type="submit">Yêu cầu thanh toán</button></form>
          {data.rejectedPayoutAmount > 0 ? <p className="mt-3 text-sm text-stone-500">Tổng yêu cầu bị từ chối: {formatVnd(data.rejectedPayoutAmount)}</p> : null}
        </div>
        <div className="card overflow-x-auto"><h2 className="text-xl font-semibold text-merly-900">Lịch sử thanh toán</h2><table className="mt-4 min-w-full text-left text-sm"><thead className="text-stone-500"><tr><th>Ngày yêu cầu</th><th>Số tiền</th><th>Trạng thái</th><th>Ngày thanh toán</th><th>Lý do từ chối</th></tr></thead><tbody>{data.payoutHistory.map((p) => <tr className="border-t border-stone-100" key={p.id}><td className="py-3">{(p.requestedAt ?? p.createdAt).toLocaleString("vi-VN")}</td><td>{formatVnd(p.amount)}</td><td>{PAYOUT_STATUS_LABELS[p.status]}</td><td>{p.paidAt?.toLocaleString("vi-VN") ?? "—"}</td><td>{p.rejectReason ?? "—"}</td></tr>)}{data.payoutHistory.length === 0 ? <tr><td className="py-4 text-stone-500" colSpan={5}>Chưa có yêu cầu thanh toán.</td></tr> : null}</tbody></table></div>
      </div>
    </DashboardShell>
  );
}
