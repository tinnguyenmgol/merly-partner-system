import { CommissionStatus } from "@prisma/client";
import { recalculateOpenCommissionsAction } from "@/features/commissions/actions";
import { ACTIVE_LEDGER_STATUSES, describeCommissionLedger, formatCommissionRate, getOrderCommissionBlockReason, MINIMUM_PAYOUT_AMOUNT_VND, summarizeLedgers } from "@/features/commissions";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { db, getDatabaseErrorMessage, hasDatabaseUrl } from "@/lib/db";
import { formatVnd } from "@/lib/money";
import { VALID_ATTRIBUTION_SOURCES } from "@/features/partners/attribution-sources";

export const dynamic = "force-dynamic";

const statuses: CommissionStatus[] = ["temporary", "reconciliation_waiting", "payable", "paid", "rejected", "on_hold"];

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: CommissionStatus; partner?: string }> }) {
  const filters = await searchParams;
  let ledgerWarning: string | null = null;
  const ledgers = [];
  const partners = [];

  if (hasDatabaseUrl()) {
    try {
      partners.push(...(await db.partner.findMany({ orderBy: { displayName: "asc" }, select: { id: true, displayName: true } })));
      ledgers.push(
        ...(await db.partnerCommissionLedger.findMany({
          where: { status: filters.status, partnerId: filters.partner || undefined },
          select: {
            id: true,
            status: true,
            amount: true,
            commissionRateBps: true,
            eligibleProductRevenue: true,
            availableAt: true,
            reason: true,
            partner: { select: { id: true, displayName: true } },
            order: { select: { orderCode: true, status: true, cancelledAt: true, returnedAt: true, disputedAt: true, attributions: { where: { source: { in: VALID_ATTRIBUTION_SOURCES } }, select: { source: true }, take: 1, orderBy: { createdAt: "asc" } } } },
          },
          orderBy: { updatedAt: "desc" },
          take: 100,
        })),
      );
    } catch (error) {
      console.error("Failed to load admin commission ledgers", error);
      ledgerWarning = getDatabaseErrorMessage(error, "Không thể tải commission ledger. Vui lòng thử lại sau.");
    }
  }

  const summary = summarizeLedgers(ledgers);

  return (
    <DashboardShell admin>
      <div className="space-y-6">
        <div className="card">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-merly-900">Commission ledger</h1>
              <p className="mt-3 text-stone-600">Nguồn sự thật hoa hồng referral_ctv. Tính theo bảng hiệu suất tháng của referral_ctv trên eligible_product_revenue, làm tròn xuống VND, chờ đối soát 7 ngày sau giao hàng.</p>
              <p className="mt-2 text-sm font-medium text-stone-500">Ngưỡng thanh toán tối thiểu: {formatVnd(MINIMUM_PAYOUT_AMOUNT_VND)}.</p>
              {ledgerWarning ? <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{ledgerWarning}</p> : null}
            </div>
            <form action={recalculateOpenCommissionsAction}>
              <button className="rounded-full bg-merly-800 px-5 py-3 text-sm font-semibold text-white" type="submit">Recalculate commissions</button>
            </form>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          {statuses.map((status) => <div className="card" key={status}><p className="text-sm text-stone-500">{status}</p><p className="mt-2 text-2xl font-bold text-merly-900">{formatVnd(summary[status])}</p></div>)}
        </div>

        <form className="card grid gap-3 md:grid-cols-3" action="/admin/commissions">
          <label className="grid gap-2 text-sm">Status<select className="input" name="status" defaultValue={filters.status ?? ""}><option value="">Tất cả</option>{statuses.map((status) => <option value={status} key={status}>{status}</option>)}</select></label>
          <label className="grid gap-2 text-sm">Partner<select className="input" name="partner" defaultValue={filters.partner ?? ""}><option value="">Tất cả</option>{partners.map((partner) => <option value={partner.id} key={partner.id}>{partner.displayName}</option>)}</select></label>
          <button className="btn-secondary self-end" type="submit">Lọc</button>
        </form>

        <div className="card overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-stone-500"><tr><th className="py-2">Partner</th><th>Order</th><th>Source</th><th>Eligible revenue</th><th>Rate</th><th>Amount</th><th>Status</th><th>AvailableAt</th><th>Reason</th><th>Warning</th></tr></thead>
            <tbody>
              {ledgers.map((ledger) => { const staleBlocked = ledger.order && ACTIVE_LEDGER_STATUSES.includes(ledger.status) && getOrderCommissionBlockReason(ledger.order); return <tr className="border-t border-stone-100" key={ledger.id}><td className="py-3">{ledger.partner.displayName}</td><td>{ledger.order?.orderCode ?? "Manual"}</td><td>{ledger.order?.attributions[0]?.source ?? "—"}</td><td>{formatVnd(ledger.eligibleProductRevenue)}</td><td>{formatCommissionRate(ledger.commissionRateBps)}</td><td>{formatVnd(ledger.amount)}</td><td>{ledger.status}</td><td>{ledger.availableAt ? ledger.availableAt.toLocaleDateString("vi-VN") : "—"}</td><td>{describeCommissionLedger(ledger) || getOrderCommissionBlockReason(ledger.order!) || "—"}</td><td>{staleBlocked ? <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">Cần đối soát lại - đơn đã hủy nhưng ledger chưa bị loại.</span> : "—"}</td></tr>})}
              {ledgers.length === 0 && <tr><td className="py-4 text-stone-500" colSpan={10}>Chưa có ledger phù hợp.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardShell>
  );
}
