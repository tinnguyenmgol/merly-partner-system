import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requirePartnerSession } from "@/features/auth/partner-auth";
import {
  MINIMUM_PAYOUT_AMOUNT_VND,
  getCtvMonthlyTier,
  getCtvTierLabel,
  isCtvOrderValidForMonthlyTier,
  summarizeLedgers,
  summarizeOrders,
} from "@/features/commissions";
import { formatVnd } from "@/lib/money";
import { getCtvProgramSettings } from "@/features/settings";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const session = await requirePartnerSession();
  const partner = session.account.partner;
  const { db } = await import("@/lib/db");
  const orders = await db.partnerOrder.findMany({
    where: { partnerId: partner.id },
    include: { ledgerEntries: { include: { order: true } } },
  });
  const ledgerSummary = summarizeLedgers(
    orders.flatMap((order) => order.ledgerEntries),
  );
  const orderSummary = summarizeOrders(orders);
  const code = partner.codes[0]?.code ?? "—";
  const settings = await getCtvProgramSettings();
  const unreadAnnouncements = await db.partnerAnnouncement.findMany({
    where: { targetPartnerType: partner.partnerType.code, archivedAt: null, publishAt: { lte: new Date() }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }], reads: { none: { partnerId: partner.id } } },
    orderBy: [{ pinned: "desc" }, { publishAt: "desc" }],
    take: 3,
  });
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const monthlyValidOrders = orders.filter((order) => order.createdAt >= monthStart && order.createdAt < nextMonth && isCtvOrderValidForMonthlyTier(order)).length;
  const currentTier = getCtvMonthlyTier(monthlyValidOrders, settings.ctvNoStockCommissionPolicy.monthlyTierThresholds);
  const tier10 = settings.ctvNoStockCommissionPolicy.monthlyTierThresholds.find((t) => t.key === "tier_10")!.minValidOrders;
  const tier30 = settings.ctvNoStockCommissionPolicy.monthlyTierThresholds.find((t) => t.key === "tier_30")!.minValidOrders;
  const nextThreshold = monthlyValidOrders < tier10 ? tier10 : monthlyValidOrders < tier30 ? tier30 : null;
  const progressMessage = nextThreshold ? `Tháng này chị có ${monthlyValidOrders} đơn hợp lệ. Còn ${nextThreshold - monthlyValidOrders} đơn nữa để đạt mốc hoa hồng từ ${nextThreshold} đơn/tháng.` : `Chị đang ở mốc cao nhất từ ${tier30} đơn/tháng.`;

  return (
    <DashboardShell>
      <h1 className="text-3xl font-bold text-merly-900">
        Tổng quan {partner.displayName}
      </h1>
      <p className="mt-2 text-stone-600">
        Mã đối tác {code} · https://merlyshoes.com/?ref={code}
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-5">
        <div className="card">
          <p>Tổng đơn ghi nhận</p>
          <b>{orderSummary.totalAttributedOrders}</b>
        </div>
        <div className="card">
          <p>Đơn hợp lệ</p>
          <b>{orderSummary.eligibleOrders}</b>
        </div>
        <div className="card">
          <p>Doanh thu hợp lệ</p>
          <b>{formatVnd(orderSummary.eligibleRevenue)}</b>
        </div>
        <div className="card">
          <p>Hoa hồng có thể trả</p>
          <b>{formatVnd(ledgerSummary.payable)}</b>
          <p className="text-sm text-stone-500">
            Tối thiểu {formatVnd(MINIMUM_PAYOUT_AMOUNT_VND)}
          </p>
        </div>
        <div className="card">
          <p>Đơn đã hủy/không tính hoa hồng</p>
          <b>{orderSummary.cancelledOrBlockedOrders}</b>
        </div>
      </div>
      <div className="card mt-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-rose-50 p-4">
          <div><h2 className="text-xl font-bold text-merly-900">Thông báo chưa đọc</h2><p className="text-sm text-stone-600">Cập nhật mới nhất từ Merly.</p></div>
          <a className="font-semibold text-merly-700" href="/dashboard/thong-bao">Xem tất cả</a>
          <div className="w-full space-y-2">{unreadAnnouncements.map((item) => <div key={item.id} className="rounded-xl bg-white p-3 text-sm"><b>{item.pinned ? "📌 " : ""}{item.title}</b><p className="line-clamp-2 text-stone-600">{item.body}</p></div>)}{unreadAnnouncements.length === 0 ? <p className="text-sm text-stone-500">Không có thông báo chưa đọc.</p> : null}</div>
        </div>
        <h2 className="text-2xl font-bold text-merly-900">Tiến độ hoa hồng tháng này</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-4"><div><p>Đơn hợp lệ tháng này</p><b>{monthlyValidOrders}</b></div><div><p>Hạng hoa hồng hiện tại</p><b>{getCtvTierLabel(currentTier)}</b></div><div><p>Mốc tiếp theo</p><b>{nextThreshold ? `Từ ${nextThreshold} đơn/tháng` : "Mốc cao nhất"}</b></div><div><p>Còn thiếu</p><b>{nextThreshold ? `${nextThreshold - monthlyValidOrders} đơn` : "0 đơn"}</b></div></div>
        <p className="mt-4 rounded-xl bg-rose-50 p-3 text-merly-900">{currentTier === "tier_10" ? `Chị đang ở mốc từ ${tier10} đơn/tháng.` : progressMessage}</p>
        <div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="text-stone-500"><tr><th>Loại đơn</th><th>Dưới {tier10} đơn/tháng</th><th>Từ {tier10} đơn/tháng</th><th>Từ {tier30} đơn/tháng</th></tr></thead><tbody>{settings.ctvNoStockCommissionPolicy.orderClasses.map((c) => <tr className="border-t border-stone-100" key={c.key}><td className="py-3">{c.label}</td><td>{c.ratesByTierBps.base / 100}%</td><td>{c.ratesByTierBps.tier_10 / 100}%</td><td>{c.ratesByTierBps.tier_30 / 100}%</td></tr>)}</tbody></table></div>
      </div>
    </DashboardShell>
  );
}
