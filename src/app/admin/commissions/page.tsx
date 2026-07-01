import { recalculateOpenCommissionsAction } from "@/features/commissions/actions";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { db, getDatabaseErrorMessage, hasDatabaseUrl } from "@/lib/db";
import { formatVnd } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function Page() {
  let ledgerWarning: string | null = null;
  const ledgers = [];

  if (hasDatabaseUrl()) {
    try {
      ledgers.push(
        ...(await db.partnerCommissionLedger.findMany({
          select: {
            id: true,
            status: true,
            amount: true,
            commissionRateBps: true,
            eligibleProductRevenue: true,
            availableAt: true,
            partner: { select: { displayName: true } },
            order: { select: { orderCode: true } },
          },
          orderBy: { updatedAt: "desc" },
          take: 50,
        })),
      );
    } catch (error) {
      console.error("Failed to load admin commission ledgers", error);
      ledgerWarning = getDatabaseErrorMessage(error, "Không thể tải commission ledger. Vui lòng thử lại sau.");
    }
  }

  return (
    <DashboardShell admin>
      <div className="space-y-6">
        <div className="card">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-merly-900">Commission ledger</h1>
              <p className="mt-3 text-stone-600">Nguồn sự thật hoa hồng đối tác referral_ctv, chờ đối soát 7 ngày trước khi payable.</p>
              {ledgerWarning ? <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{ledgerWarning}</p> : null}
            </div>
            <form action={recalculateOpenCommissionsAction}>
              <button className="rounded-full bg-merly-800 px-5 py-3 text-sm font-semibold text-white" type="submit">Recalculate open orders</button>
            </form>
          </div>
        </div>
        <div className="card overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-stone-500"><tr><th className="py-2">Order</th><th>Partner</th><th>Status</th><th>Base</th><th>Rate</th><th>Amount</th><th>Available</th></tr></thead>
            <tbody>
              {ledgers.map((ledger) => (
                <tr className="border-t border-stone-100" key={ledger.id}>
                  <td className="py-3">{ledger.order?.orderCode ?? "Manual"}</td><td>{ledger.partner.displayName}</td><td>{ledger.status}</td><td>{formatVnd(ledger.eligibleProductRevenue)}</td><td>{ledger.commissionRateBps ? `${ledger.commissionRateBps / 100}%` : "—"}</td><td>{formatVnd(ledger.amount)}</td><td>{ledger.availableAt ? ledger.availableAt.toLocaleDateString("vi-VN") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardShell>
  );
}
