import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getPayoutReadyBalances } from "@/features/payouts";
import { hasDatabaseUrl } from "@/lib/db";
import { formatVnd } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function Page() {
  const balances = hasDatabaseUrl() ? await getPayoutReadyBalances() : [];
  return <DashboardShell admin><div className="space-y-6"><div className="card"><h1 className="text-3xl font-bold text-merly-900">Payout-ready balances</h1><p className="mt-3 text-stone-600">Chỉ hiển thị số dư payable đủ ngưỡng; chưa thực thi thanh toán.</p></div><div className="grid gap-4 md:grid-cols-2">{balances.map((balance)=><div className="card" key={balance.partnerId}><h2 className="font-semibold text-merly-900">{balance.partnerDisplayName}</h2><p className="mt-2 text-sm text-stone-500">{balance.payableLedgerCount} payable ledger entries</p><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><span>Ready</span><strong>{formatVnd(balance.payoutReadyAmount)}</strong><span>Rollover</span><strong>{formatVnd(balance.rolloverAmount)}</strong><span>Minimum</span><strong>{formatVnd(balance.minimumPayoutAmount)}</strong></div></div>)}</div></div></DashboardShell>;
}
