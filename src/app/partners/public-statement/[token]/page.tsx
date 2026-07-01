import { notFound } from "next/navigation";
import { MerlyLogo } from "@/components/merly-logo";
import { formatCommissionRate, getPublicStatementTokenHash, MINIMUM_PAYOUT_AMOUNT_VND, summarizeLedgers } from "@/features/commissions";
import { db, hasDatabaseUrl } from "@/lib/db";
import { formatVnd } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!hasDatabaseUrl()) notFound();
  const statementToken = await db.partnerStatementToken.findUnique({
    where: { tokenHash: getPublicStatementTokenHash(token) },
    include: {
      partner: {
        include: {
          codes: { where: { active: true }, orderBy: { createdAt: "desc" } },
          orders: { include: { attributions: { orderBy: { createdAt: "asc" } }, ledgerEntries: true }, orderBy: { createdAt: "desc" }, take: 100 },
          ledgerEntries: { include: { order: { include: { attributions: { orderBy: { createdAt: "asc" }, take: 1 } } } }, orderBy: { updatedAt: "desc" }, take: 100 },
        },
      },
    },
  });
  if (!statementToken || statementToken.revokedAt) notFound();
  const partner = statementToken.partner;
  const summary = summarizeLedgers(partner.ledgerEntries);
  const primaryCode = partner.codes[0]?.code;
  const referralLink = primaryCode ? `https://merly.vn/?ref=${encodeURIComponent(primaryCode)}` : "Chưa có mã giới thiệu";

  return (
    <main className="min-h-screen bg-rose-50/60 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="card"><MerlyLogo variant="public" withText href="/" /><h1 className="mt-6 text-3xl font-bold text-merly-900">Sao kê hoa hồng tạm thời</h1><p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 font-medium text-amber-800">Đây là trang sao kê tạm thời. Tài khoản CTV đăng nhập riêng sẽ được triển khai ở bước sau.</p><dl className="mt-6 grid gap-4 md:grid-cols-3"><div><dt className="text-sm text-stone-500">Tên đối tác</dt><dd className="font-bold text-merly-900">{partner.displayName}</dd></div><div><dt className="text-sm text-stone-500">Mã đối tác</dt><dd className="font-mono font-bold text-merly-900">{primaryCode ?? "—"}</dd></div><div><dt className="text-sm text-stone-500">Referral link</dt><dd className="break-all font-semibold text-merly-700">{referralLink}</dd></div></dl></div>

        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">{(["temporary", "reconciliation_waiting", "payable", "paid", "rejected", "on_hold"] as const).map((status) => <div className="card" key={status}><p className="text-sm text-stone-500">{status}</p><p className="mt-2 text-xl font-bold text-merly-900">{formatVnd(summary[status])}</p></div>)}</div>
        <div className="card"><h2 className="text-xl font-bold text-merly-900">Trạng thái thanh toán</h2><p className="mt-2 font-semibold">Payable balance: {formatVnd(summary.payable)} / {formatVnd(MINIMUM_PAYOUT_AMOUNT_VND)}</p><p className="mt-2 text-stone-600">{summary.payable < MINIMUM_PAYOUT_AMOUNT_VND ? "Chưa đủ mức thanh toán tối thiểu 100.000đ, hoa hồng sẽ được cộng dồn." : "Đã đủ điều kiện thanh toán, chờ Merly đối soát và chuyển khoản."}</p></div>

        <div className="card overflow-x-auto"><h2 className="text-xl font-bold text-merly-900">Attributed orders</h2><table className="mt-4 min-w-full text-left text-sm"><thead className="text-stone-500"><tr><th className="py-2">Order</th><th>Source</th><th>Eligible revenue</th><th>Status</th><th>Delivered</th></tr></thead><tbody>{partner.orders.map((order) => <tr className="border-t border-stone-100" key={order.id}><td className="py-3">{order.orderCode}</td><td>{order.attributions[0]?.source ?? "—"}</td><td>{formatVnd(order.eligibleProductRevenue)}</td><td>{order.status}</td><td>{order.deliveredAt ? order.deliveredAt.toLocaleDateString("vi-VN") : "—"}</td></tr>)}</tbody></table></div>
        <div className="card overflow-x-auto"><h2 className="text-xl font-bold text-merly-900">Commission ledgers</h2><table className="mt-4 min-w-full text-left text-sm"><thead className="text-stone-500"><tr><th className="py-2">Order</th><th>Source</th><th>Base</th><th>Rate</th><th>Amount</th><th>Status</th><th>AvailableAt</th><th>Reason</th></tr></thead><tbody>{partner.ledgerEntries.map((ledger) => <tr className="border-t border-stone-100" key={ledger.id}><td className="py-3">{ledger.order?.orderCode ?? "Manual"}</td><td>{ledger.order?.attributions[0]?.source ?? "—"}</td><td>{formatVnd(ledger.eligibleProductRevenue)}</td><td>{formatCommissionRate(ledger.commissionRateBps)}</td><td>{formatVnd(ledger.amount)}</td><td>{ledger.status}</td><td>{ledger.availableAt ? ledger.availableAt.toLocaleDateString("vi-VN") : "—"}</td><td>{ledger.reason ?? "—"}</td></tr>)}</tbody></table></div>
      </div>
    </main>
  );
}
