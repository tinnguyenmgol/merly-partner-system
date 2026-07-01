import { DashboardShell } from "@/components/layout/dashboard-shell";
import { displayOrderCommissionStatus, getOrderCommissionBlockReason } from "@/features/commissions";
import { VALID_ATTRIBUTION_SOURCES } from "@/features/partners/attribution-sources";
import { db, getDatabaseErrorMessage, hasDatabaseUrl } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Page() {
  let schemaWarning: string | null = null;
  const orders = [];

  if (hasDatabaseUrl()) {
    try {
      orders.push(
        ...(await db.partnerOrder.findMany({
          select: {
            id: true,
            orderCode: true,
            eligibleProductRevenue: true,
            status: true,
            cancelledAt: true,
            returnedAt: true,
            disputedAt: true,
            partner: {
              select: {
                displayName: true,
                partnerType: { select: { code: true } },
              },
            },
            attributions: {
              where: { source: { in: VALID_ATTRIBUTION_SOURCES } },
              select: {
                source: true,
                value: true,
                partnerCode: { select: { code: true } },
              },
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        })),
      );
    } catch (error) {
      console.error("Failed to load admin orders", error);
      schemaWarning = getDatabaseErrorMessage(
        error,
        "Không thể tải đơn hàng. Nếu schema database đang cũ, hãy chạy npm run db:migrate rồi npm run db:bootstrap.",
      );
    }
  }

  return (
    <DashboardShell admin>
      <div className="card">
        <h1 className="text-3xl font-bold text-merly-900">Đơn hàng đối tác</h1>
        <p className="mt-3 text-stone-600">Theo dõi gắn đối tác theo affiliate link, shop discount code, manual hoặc order request.</p>
        {!hasDatabaseUrl() ? <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">DATABASE_URL chưa được cấu hình.</p> : null}
        {schemaWarning ? <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{schemaWarning}</p> : null}
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-stone-500">
              <tr>
                <th className="p-3">Mã đơn</th>
                <th className="p-3">Đối tác</th>
                <th className="p-3">Loại</th>
                <th className="p-3">Nguồn gắn</th>
                <th className="p-3">Mã khớp</th>
                <th className="p-3">Doanh thu hợp lệ</th>
                <th className="p-3">Trạng thái local</th>
                <th className="p-3">Haravan hủy/hoàn</th>
                <th className="p-3">Lý do chặn hoa hồng</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const attribution = order.attributions[0];
                return (
                  <tr key={order.id} className="border-t border-rose-100">
                    <td className="p-3 font-medium">{order.orderCode}</td>
                    <td className="p-3">{order.partner?.displayName ?? "Chưa gắn CTV/đối tác"}</td>
                    <td className="p-3">{order.partner?.partnerType.code ?? "-"}</td>
                    <td className="p-3">{attribution?.source ?? "Chưa gắn CTV/đối tác"}</td>
                    <td className="p-3">{attribution?.partnerCode?.code ?? attribution?.value ?? "-"}</td>
                    <td className="p-3">{order.eligibleProductRevenue.toLocaleString("vi-VN")} VND</td>
                    <td className="p-3">{order.status}</td>
                    <td className="p-3">{displayOrderCommissionStatus(order)}</td>
                    <td className="p-3">{getOrderCommissionBlockReason(order) ?? "—"}</td>
                  </tr>
                );
              })}
              {orders.length === 0 ? (
                <tr>
                  <td className="p-3 text-stone-500" colSpan={9}>Chưa có đơn hàng.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardShell>
  );
}
