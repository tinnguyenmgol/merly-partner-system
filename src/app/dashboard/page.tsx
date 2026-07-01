import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requirePartnerSession } from "@/features/auth/partner-auth";
import {
  MINIMUM_PAYOUT_AMOUNT_VND,
  summarizeLedgers,
  summarizeOrders,
} from "@/features/commissions";
import { formatVnd } from "@/lib/money";

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
    </DashboardShell>
  );
}
