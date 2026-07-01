import { DashboardShell } from "@/components/layout/dashboard-shell";
import { approvePayoutAction, cancelPayoutAction, getLastPayoutReconciliationAt, markPayoutPaidAction, PAYOUT_STATUS_LABELS, reconcilePayoutBeforeApproveAction, rejectPayoutAction } from "@/features/payouts";
import { getOrderCommissionBlockReason } from "@/features/commissions";
import { db, hasDatabaseUrl } from "@/lib/db";
import { formatVnd } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function Page() {
  const payouts = hasDatabaseUrl()
    ? await db.partnerPayout.findMany({
        include: {
          partner: { include: { profile: true, codes: { take: 1 } } },
          items: {
            include: {
              ledger: {
                include: {
                  order: {
                    include: {
                      attributions: { take: 1, orderBy: { createdAt: "asc" } },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      })
    : [];
  const gate = hasDatabaseUrl() ? await getLastPayoutReconciliationAt() : { lastSyncAt: null, lastRecalculateAt: null, fresh: false, warning: "" };
  return <DashboardShell admin><div className="space-y-6">
    <div className="card"><h1 className="text-3xl font-bold text-merly-900">Payouts</h1><p className="mt-3 text-stone-600">Duyệt yêu cầu thanh toán an toàn. Ledger được khóa bằng PartnerPayoutItem khi payout ở pending/approved; khi paid, ledger chuyển sang paid và không bị recalculation ghi đè.</p>{!gate.fresh ? <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">Cần đồng bộ Haravan và đối soát hoa hồng trước khi duyệt thanh toán.</p> : null}<p className="mt-2 text-sm text-stone-500">Last sync: {gate.lastSyncAt?.toLocaleString("vi-VN") ?? "—"} · Last recalculate: {gate.lastRecalculateAt?.toLocaleString("vi-VN") ?? "—"}</p></div>
    <div className="card overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="text-stone-500"><tr><th>Mã</th><th>CTV</th><th>Partner code</th><th>Số tiền</th><th>Status</th><th>Requested</th><th>Approved</th><th>Paid</th><th>Bank</th><th>Items</th><th>Actions</th></tr></thead><tbody>{payouts.map((p) => { const invalid = p.items.some((i) => i.ledger.order && getOrderCommissionBlockReason(i.ledger.order)); return <tr className="border-t border-stone-100 align-top" key={p.id}><td className="py-3 font-mono text-xs">{p.id.slice(-8)}</td><td>{p.partner.displayName}</td><td>{p.partner.codes[0]?.code ?? "—"}</td><td>{formatVnd(p.amount)}</td><td>{PAYOUT_STATUS_LABELS[p.status]}</td><td>{(p.requestedAt ?? p.createdAt).toLocaleString("vi-VN")}</td><td>{p.approvedAt?.toLocaleString("vi-VN") ?? "—"}</td><td>{p.paidAt?.toLocaleString("vi-VN") ?? "—"}</td><td>{[p.partner.profile?.bankName, p.partner.profile?.bankAccountNumber, p.partner.profile?.bankAccountHolder].filter(Boolean).join(" · ") || "—"}</td><td>{p.items.length}</td><td className="space-y-2">{p.status === "pending" ? <><form action={reconcilePayoutBeforeApproveAction}><input type="hidden" name="payoutId" value={p.id}/><button className="btn-secondary" type="submit">Đồng bộ & đối soát lại trước khi duyệt</button></form><form action={approvePayoutAction}><input type="hidden" name="payoutId" value={p.id}/><button disabled={!gate.fresh || invalid} className="btn-secondary disabled:opacity-50" type="submit">Approve</button></form><form action={rejectPayoutAction} className="flex gap-2"><input type="hidden" name="payoutId" value={p.id}/><input className="input" name="reason" placeholder="Lý do"/><button className="btn-secondary" type="submit">Reject</button></form></> : null}{p.status === "approved" ? <form action={markPayoutPaidAction}><input type="hidden" name="payoutId" value={p.id}/><button className="btn-secondary" type="submit">Mark paid</button></form> : null}{["pending", "approved"].includes(p.status) ? <form action={cancelPayoutAction}><input type="hidden" name="payoutId" value={p.id}/><button className="btn-secondary" type="submit">Cancel</button></form> : null}{invalid ? <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">Có đơn hủy/hoàn/từ chối: cần đối soát lại, chặn duyệt.</p> : null}</td></tr>})}{payouts.length === 0 ? <tr><td colSpan={11} className="py-4 text-stone-500">Chưa có payout.</td></tr> : null}</tbody></table></div>
    {payouts.map((p) => <div className="card overflow-x-auto" key={`${p.id}-detail`}><h2 className="text-xl font-semibold text-merly-900">Chi tiết payout {p.id.slice(-8)} · {p.partner.displayName}</h2><p className="mt-2 text-sm text-stone-500">Bank: {[p.partner.profile?.bankName, p.partner.profile?.bankAccountNumber, p.partner.profile?.bankAccountHolder].filter(Boolean).join(" · ") || "—"}</p><table className="mt-4 min-w-full text-left text-sm"><thead className="text-stone-500"><tr><th>Order</th><th>Order status</th><th>Source</th><th>Eligible revenue</th><th>Commission</th><th>Ledger status</th><th>AvailableAt</th><th>Warning</th></tr></thead><tbody>{p.items.map((i) => <tr className="border-t border-stone-100" key={i.id}><td className="py-3">{i.ledger.order?.orderCode ?? "Manual"}</td><td>{i.ledger.order?.status ?? "—"}</td><td>{i.ledger.order?.attributions[0]?.source ?? "—"}</td><td>{formatVnd(i.ledger.eligibleProductRevenue)}</td><td>{formatVnd(i.amount)}</td><td>{i.ledger.status}</td><td>{i.ledger.availableAt?.toLocaleDateString("vi-VN") ?? "—"}</td><td>{i.ledger.order ? getOrderCommissionBlockReason(i.ledger.order) ?? "—" : "—"}</td></tr>)}</tbody></table></div>)}
  </div></DashboardShell>;
}
