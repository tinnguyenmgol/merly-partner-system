import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requirePartnerSession } from "@/features/auth/partner-auth";
import { summarizeOrders } from "@/features/commissions";
import { formatVnd } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requirePartnerSession();
  const { db } = await import("@/lib/db");
  const orders = await db.partnerOrder.findMany({
    where: { partnerId: session.account.partner.id },
  });
  const summary = summarizeOrders(orders);
  return (
    <DashboardShell>
      <div className="card">
        <h1 className="text-3xl font-bold text-merly-900">Doanh thu</h1>
        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <div className="rounded-xl bg-rose-50 p-4">
            <p>Tổng đơn ghi nhận</p>
            <b>{summary.totalAttributedOrders}</b>
          </div>
          <div className="rounded-xl bg-rose-50 p-4">
            <p>Đơn hợp lệ</p>
            <b>{summary.eligibleOrders}</b>
          </div>
          <div className="rounded-xl bg-rose-50 p-4">
            <p>Doanh thu hợp lệ</p>
            <b>{formatVnd(summary.eligibleRevenue)}</b>
          </div>
          <div className="rounded-xl bg-rose-50 p-4">
            <p>Đơn đã hủy/không tính hoa hồng</p>
            <b>{summary.cancelledOrBlockedOrders}</b>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
