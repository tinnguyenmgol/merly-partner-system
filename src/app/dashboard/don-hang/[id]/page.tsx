import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requirePartnerSession } from "@/features/auth/partner-auth";
import { db } from "@/lib/db";
import { displayOrderCommissionStatus } from "@/features/commissions";
import { formatVnd } from "@/lib/money";
import { notFound } from "next/navigation";
import { VALID_ATTRIBUTION_SOURCES } from "@/features/partners/attribution-sources";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; const session = await requirePartnerSession(); const order = await db.partnerOrder.findFirst({ where: { id, partnerId: session.account.partner.id }, include: { attributions: { where: { source: { in: VALID_ATTRIBUTION_SOURCES } } }, ledgerEntries: true } }); if (!order) notFound(); return <DashboardShell><div className="card"><h1 className="text-3xl font-bold text-merly-900">Đơn hàng {order.orderCode}</h1><dl className="mt-4 grid gap-3 md:grid-cols-2"><div><dt>Trạng thái</dt><dd className="font-semibold">{displayOrderCommissionStatus(order)}</dd></div><div><dt>Doanh thu hợp lệ</dt><dd className="font-semibold">{formatVnd(order.eligibleProductRevenue)}</dd></div><div><dt>Nguồn</dt><dd className="font-semibold">{order.attributions[0]?.source ?? "—"}</dd></div><div><dt>Hoa hồng</dt><dd className="font-semibold">{formatVnd(order.ledgerEntries.reduce((sum, row) => sum + row.amount, 0))}</dd></div></dl></div></DashboardShell>; }
