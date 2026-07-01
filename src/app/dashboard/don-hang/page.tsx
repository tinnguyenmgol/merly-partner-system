import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requirePartnerSession } from "@/features/auth/partner-auth";
import { displayOrderCommissionStatus } from "@/features/commissions";
import { formatVnd } from "@/lib/money";
import { VALID_ATTRIBUTION_SOURCES } from "@/features/partners/attribution-sources";
export const dynamic = "force-dynamic";
export default async function Page() {
  const s = await requirePartnerSession();
  const { db } = await import("@/lib/db");
  const orders = await db.partnerOrder.findMany({
    where: { partnerId: s.account.partner.id },
    orderBy: { createdAt: "desc" },
    include: { attributions: { where: { source: { in: VALID_ATTRIBUTION_SOURCES } } } },
  });
  return (
    <DashboardShell>
      <div className="card">
        <h1 className="text-3xl font-bold text-merly-900">Đơn hàng</h1>
        <table className="mt-4 w-full text-sm">
          <tbody>
            {orders.map((o) => (
              <tr className="border-b" key={o.id}>
                <td>{o.orderCode}</td>
                <td>{o.createdAt.toLocaleDateString("vi-VN")}</td>
                <td>{o.attributions[0]?.source ?? "—"}</td>
                <td>{o.attributions[0]?.value ?? "—"}</td>
                <td>{formatVnd(o.eligibleProductRevenue)}</td>
                <td>{displayOrderCommissionStatus(o)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 && (
          <p className="mt-4 text-stone-500">Chưa có đơn.</p>
        )}
      </div>
    </DashboardShell>
  );
}
