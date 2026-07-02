import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requirePartnerSession } from "@/features/auth/partner-auth";
import { CTV_POLICY_EXCLUDED_NOTE, getCtvProgramSettings } from "@/features/settings";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function pct(bps: number) { return `${bps / 100}%`; }

export default async function Page() {
  const s = await requirePartnerSession();
  const settings = await getCtvProgramSettings();
  const start = new Date();
  start.setDate(1); start.setHours(0, 0, 0, 0);
  const nextMonth = new Date(start); nextMonth.setMonth(nextMonth.getMonth() + 1);
  const validOrdersThisMonth = await db.partnerCommissionLedger.count({
    where: {
      partnerId: s.account.partnerId,
      amount: { gt: 0 },
      status: { notIn: ["rejected", "on_hold"] },
      order: { createdAt: { gte: start, lt: nextMonth }, cancelledAt: null, returnedAt: null },
    },
  });
  const thresholds = [...settings.ctvNoStockCommissionPolicy.monthlyTierThresholds].sort((a, b) => a.minValidOrders - b.minValidOrders);
  const currentTier = thresholds.filter((t) => validOrdersThisMonth >= t.minValidOrders).at(-1) ?? thresholds[0];
  const nextTier = thresholds.find((t) => t.minValidOrders > validOrdersThisMonth);
  const tierLabels: Record<string, string> = { base: "Dưới 10 đơn", tier_10: "Từ 10 đơn", tier_30: "Từ 30 đơn" };
  const normalClass = settings.ctvNoStockCommissionPolicy.orderClasses.find((c) => c.key === "normal_price");

  return (
    <DashboardShell>
      <div className="grid gap-6">
        <div className="card">
          <h1 className="text-3xl font-bold text-merly-900">Cấp bậc hoa hồng</h1>
          <p className="mt-3 text-stone-600">Mốc được tính theo số đơn hợp lệ trong từng tháng của CTV không ôm hàng.</p>
          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl bg-rose-50 p-4"><p className="text-sm text-stone-500">Số đơn hợp lệ tháng này</p><p className="text-3xl font-bold text-merly-900">{validOrdersThisMonth}</p></div>
            <div className="rounded-2xl bg-rose-50 p-4"><p className="text-sm text-stone-500">Mốc hiện tại</p><p className="text-xl font-bold text-merly-900">{tierLabels[currentTier.key] ?? currentTier.key}</p></div>
            <div className="rounded-2xl bg-rose-50 p-4"><p className="text-sm text-stone-500">Hoa hồng đúng giá</p><p className="text-xl font-bold text-merly-900">{normalClass ? pct(normalClass.ratesByTierBps[currentTier.key]) : "—"}</p></div>
            <div className="rounded-2xl bg-rose-50 p-4"><p className="text-sm text-stone-500">Mốc tiếp theo</p><p className="text-xl font-bold text-merly-900">{nextTier ? `${tierLabels[nextTier.key]} - còn ${nextTier.minValidOrders - validOrdersThisMonth} đơn` : "Đã đạt mốc cao nhất"}</p></div>
          </div>
        </div>

        <div className="card">
          <h2 className="text-2xl font-bold text-merly-900">Chính sách theo hiệu suất tháng</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {settings.ctvNoStockCommissionPolicy.orderClasses.map((orderClass) => (
              <div className="rounded-2xl border border-rose-100 p-4" key={orderClass.key}>
                <h3 className="font-bold text-merly-900">{orderClass.label}</h3>
                <ul className="mt-3 grid gap-2 text-sm text-stone-700">
                  <li>Dưới 10 đơn hợp lệ/tháng: <strong>{pct(orderClass.ratesByTierBps.base)}</strong></li>
                  <li>Từ 10 đơn hợp lệ/tháng: <strong>{pct(orderClass.ratesByTierBps.tier_10)}</strong></li>
                  <li>Từ 30 đơn hợp lệ/tháng: <strong>{pct(orderClass.ratesByTierBps.tier_30)}</strong></li>
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-800">{CTV_POLICY_EXCLUDED_NOTE}</p>
        </div>
      </div>
    </DashboardShell>
  );
}
