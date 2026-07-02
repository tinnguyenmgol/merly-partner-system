import { requireAdminSession } from "@/features/auth/admin-auth";
import Link from "next/link";
import { CommissionStatus, PartnerStatus, PartnerTypeCode, Prisma } from "@prisma/client";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ACTIVE_LEDGER_STATUSES, getOrderCommissionBlockReason, isOrderCommissionEligible } from "@/features/commissions";
import { parseAttributionSourceFilter } from "@/features/partners/attribution-source-filter";
import { VALID_ATTRIBUTION_SOURCES } from "@/features/partners/attribution-sources";
import { db, getDatabaseErrorMessage, hasDatabaseUrl } from "@/lib/db";
import { formatVnd } from "@/lib/money";

export const dynamic = "force-dynamic";

type RangeKey = "today" | "7d" | "30d" | "month" | "custom";
type SearchParams = { range?: RangeKey; start?: string; end?: string; source?: string };

const BLOCKED_STATUS_VALUES = [
  "cancelled", "canceled", "voided", "void", "closed_cancelled", "returned", "return", "partially_returned",
  "refunded", "partially_refunded", "paid_refunded", "refused", "failed_delivery", "failed delivery",
  "delivery_failed", "rejected", "undelivered", "disputed", "chargeback", "fraud_review",
];
const blockedOrderWhere: Prisma.PartnerOrderWhereInput = {
  OR: [
    { cancelledAt: { not: null } },
    { returnedAt: { not: null } },
    { disputedAt: { not: null } },
    { status: { in: BLOCKED_STATUS_VALUES, mode: "insensitive" } },
  ],
};
const validOrderWhere: Prisma.PartnerOrderWhereInput = {
  partnerId: { not: null },
  eligibleProductRevenue: { gt: 0 },
  NOT: blockedOrderWhere,
};

function parseDate(value?: string) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}
function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}
function getDateRange(params: SearchParams) {
  const now = new Date();
  const today = startOfUtcDay(now);
  const key = params.range ?? "30d";
  if (key === "today") return { key, start: today, end: addDays(today, 1), label: "Hôm nay" };
  if (key === "7d") return { key, start: addDays(today, -6), end: addDays(today, 1), label: "7 ngày gần nhất" };
  if (key === "month") return { key, start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), end: addDays(today, 1), label: "Tháng này" };
  if (key === "custom") {
    const start = parseDate(params.start) ?? addDays(today, -29);
    const end = addDays(parseDate(params.end) ?? today, 1);
    return { key, start, end, label: "Tùy chọn" };
  }
  return { key: "30d" as RangeKey, start: addDays(today, -29), end: addDays(today, 1), label: "30 ngày gần nhất" };
}
function fmtDateTime(date?: Date | null) { return date ? date.toLocaleString("vi-VN") : "Chưa có"; }
function pct(part: number, total: number) { return total > 0 ? `${Math.round((part / total) * 1000) / 10}%` : "0%"; }
type AttributionDisplayOrder = { partnerId?: string | null; attributions?: { source: string }[] };

function getAttributionDisplay(order: AttributionDisplayOrder) {
  if (!order.partnerId && !order.attributions?.length) {
    return "Chưa gắn CTV/đối tác";
  }
  return order.attributions?.[0]?.source ?? "-";
}

function getSourceFilteredOrderWhere(orderRangeWhere: Prisma.PartnerOrderWhereInput, filter: ReturnType<typeof parseAttributionSourceFilter>): Prisma.PartnerOrderWhereInput {
  if (filter.kind === "unattributed") {
    return { ...orderRangeWhere, partnerId: null, attributions: { none: {} } };
  }
  if (filter.kind === "source") {
    return { ...orderRangeWhere, attributions: { some: { source: filter.source } } };
  }
  return orderRangeWhere;
}

function metadataNumber(metadata: Prisma.JsonValue | null | undefined, keys: string[]) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return 0;
  for (const key of keys) {
    const value = (metadata as Record<string, unknown>)[key];
    if (typeof value === "number") return value;
  }
  return 0;
}

export default async function Admin({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdminSession();
  const params = await searchParams;
  const range = getDateRange(params);
  const rawSource = params.source;
  const sourceFilter = parseAttributionSourceFilter(rawSource);
  console.warn("[admin-dashboard] attribution source filter", {
    rawSource,
    parsedKind: sourceFilter.kind,
  });
  const orderRangeWhere = getSourceFilteredOrderWhere({ createdAt: { gte: range.start, lt: range.end } }, sourceFilter);
  let warning: string | null = null;
  let data: Awaited<ReturnType<typeof loadDashboardData>> | null = null;

  if (hasDatabaseUrl()) {
    try { data = await loadDashboardData(orderRangeWhere); }
    catch (error) {
      console.error("Failed to load admin dashboard", error);
      warning = getDatabaseErrorMessage(error, "Không thể tải dashboard vận hành. Vui lòng thử lại sau.");
    }
  }

  const staleSync = !data?.lastSync?.finishedAt || range.end.getTime() - data.lastSync.finishedAt.getTime() > 24 * 60 * 60 * 1000;
  const lastSyncFailed = Boolean(data?.lastSync && data.lastSync.status !== "success");
  const staleRecalc = !data?.lastRecalcAt || range.end.getTime() - data.lastRecalcAt.getTime() > 24 * 60 * 60 * 1000;
  const hasCommissionIssues = (data?.staleProblemLedgerCount ?? 0) > 0;

  return <DashboardShell admin><div className="space-y-6">
    <div className="card flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div><h1 className="text-3xl font-bold text-merly-900">Merly Partner Admin</h1><p className="mt-2 text-stone-600">Dashboard vận hành hằng ngày cho đối tác, Haravan sync, doanh thu hợp lệ và rủi ro hoa hồng.</p>{!hasDatabaseUrl() ? <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">DATABASE_URL chưa được cấu hình.</p> : null}{warning ? <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{warning}</p> : null}</div>
      <div className="flex flex-wrap gap-2"><Link className="btn-secondary" href="/admin/settings/haravan">Sync Haravan now</Link><Link className="btn-secondary" href="/admin/commissions">Recalculate commissions</Link><Link className="btn-secondary" href="/admin/partners?status=pending">View pending partners</Link><Link className="btn-secondary" href="/admin/commissions">View commission issues</Link></div>
    </div>

    <form className="card flex flex-wrap items-end gap-3" action="/admin"><label className="grid gap-1 text-sm font-medium">Khoảng ngày<select className="input" name="range" defaultValue={range.key}><option value="today">Today</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="month">This month</option><option value="custom">Custom</option></select></label><label className="grid gap-1 text-sm font-medium">Start<input className="input" name="start" type="date" defaultValue={params.start ?? ""}/></label><label className="grid gap-1 text-sm font-medium">End<input className="input" name="end" type="date" defaultValue={params.end ?? ""}/></label><button className="btn-secondary" type="submit">Lọc</button><label className="grid gap-1 text-sm font-medium">Nguồn<select className="input" name="source" defaultValue={sourceFilter.kind === "source" ? sourceFilter.source : sourceFilter.kind === "unattributed" ? "unattributed" : "all"}><option value="all">Tất cả</option><option value="unattributed">Chưa gắn CTV/đối tác</option>{VALID_ATTRIBUTION_SOURCES.map((source) => <option key={source} value={source}>{source}</option>)}</select></label><p className="text-sm text-stone-500">Đang xem: {range.label} theo ngày tạo đơn.</p></form>

    <section className="grid gap-4 lg:grid-cols-4"><StatusCard label="Đồng bộ Haravan gần nhất" value={fmtDateTime(data?.lastSync?.finishedAt ?? data?.lastSync?.startedAt)} tone={staleSync || lastSyncFailed ? "warn" : "ok"} hint={`Kết quả: ${data?.lastSync?.status ?? "chưa có"}. Imported/updated: ${metadataNumber(data?.lastSync?.metadata, ["ordersImported", "ordersUpdated", "imported", "updated"])}. Attributed: ${metadataNumber(data?.lastSync?.metadata, ["ordersAttributed", "attributed"])}. Hủy/hoàn cập nhật: ${metadataNumber(data?.lastSync?.metadata, ["cancelledReturnedUpdated", "cancelledUpdated", "blockedUpdated"])}.`}/><StatusCard label="Đối soát hoa hồng gần nhất" value={fmtDateTime(data?.lastRecalcAt)} tone={staleRecalc ? "warn" : "ok"} hint="Dựa trên ledger được cập nhật gần nhất."/><StatusCard label="Cần đồng bộ lại" value={staleSync ? "Có" : "Không"} tone={staleSync ? "warn" : "ok"} hint="Cảnh báo nếu sync cuối quá 24h."/><StatusCard label="Có lỗi cần xử lý" value={lastSyncFailed || hasCommissionIssues ? "Có" : "Không"} tone={lastSyncFailed || hasCommissionIssues ? "warn" : "ok"} hint={hasCommissionIssues ? "Có hoa hồng cần đối soát lại: đơn đã hủy/hoàn nhưng ledger còn hoạt động." : "Không phát hiện ledger lỗi."}/></section>

    <section className="grid gap-4 md:grid-cols-4 xl:grid-cols-8">{Object.entries(data?.partnerFunnel ?? {}).map(([label, value]) => <MiniStat key={label} label={label} value={value}/>)}</section>
    <section className="grid gap-4 md:grid-cols-4 xl:grid-cols-8">{Object.entries(data?.orderSummary ?? {}).map(([label, value]) => <MiniStat key={label} label={label} value={value}/>)}</section>
    <section className="grid gap-4 md:grid-cols-4 xl:grid-cols-8">{Object.entries(data?.financialSummary ?? {}).map(([label, value]) => <MiniStat key={label} label={label} value={typeof value === "number" && label !== "Stale/problem ledgers" ? formatVnd(value) : value}/>)}</section>
    <TwoCol title="Partner model performance" headers={["Model", "Shop/code orders", "Valid revenue", "Blocked/cancelled revenue", "Temporary", "Payable", "Rejected/on_hold"]} rows={(data?.typePerformance ?? []).map(row => [row.type, row.codeOrders, formatVnd(row.validRevenue), formatVnd(row.blockedRevenue), formatVnd(row.temporaryCommission), formatVnd(row.payableCommission), formatVnd(row.rejectedOnHoldCommission)])}/>
    {hasCommissionIssues ? <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 font-semibold text-amber-900">Có hoa hồng cần đối soát lại: đơn đã hủy/hoàn nhưng ledger còn hoạt động.</p> : null}

    <TwoCol title="Recent partner registrations" headers={["Đối tác", "Loại", "Trạng thái", "Account", "Actions"]} rows={(data?.recentPartners ?? []).map(p => [<span key="p"><b>{p.displayName}</b><br/><span className="text-stone-500">{p.phone ?? p.email ?? "—"}</span></span>, p.partnerType.code, p.status, p.account?.status ?? "Chưa có", <span className="flex gap-2" key="a"><Link className="link" href={`/admin/partners/${p.id}`}>View</Link><Link className="link" href={`/admin/partners/${p.id}`}>Approve</Link><Link className="link" href={`/admin/partners/${p.id}`}>Reject</Link>{p.status === "approved" && p.account?.status !== "active" ? <Link className="link" href={`/admin/partners/${p.id}`}>Generate setup password link</Link> : null}</span>])}/>
    <TwoCol title="Top partners" headers={["Partner", "Type", "Code", "Valid orders", "Valid revenue", "Payable", "Blocked", "Last order", "Account"]} rows={(data?.topPartners ?? []).map(p => [<Link className="font-semibold text-merly-700" key="p" href={`/admin/partners/${p.id}`}>{p.name}</Link>, p.type, p.code, p.validOrders, formatVnd(p.validRevenue), formatVnd(p.payableCommission), p.blockedOrders, fmtDateTime(p.lastOrderDate), p.accountStatus])}/>
    <TwoCol title="Recent attributed orders" headers={["Order", "Partner", "Type", "Source", "Matched", "Eligible revenue", "Order status", "Commission", "Warning"]} rows={(data?.recentOrders ?? []).map(o => [o.orderCode, o.partner?.displayName ?? "Chưa gắn CTV/đối tác", o.partner?.partnerType.code ?? "—", getAttributionDisplay(o), o.attributions[0]?.partnerCode?.code ?? o.attributions[0]?.value ?? "—", formatVnd(o.eligibleProductRevenue), o.status, o.ledgerEntries[0]?.status ?? "—", getOrderCommissionBlockReason(o) ?? "—"])}/>
    <TwoCol title="Action queue" headers={["Việc cần làm", "Chi tiết", "Link"]} rows={data?.actions ?? []}/>
  </div></DashboardShell>;
}

async function loadDashboardData(orderRangeWhere: Prisma.PartnerOrderWhereInput) {
  const [lastSync, lastRecalc, partnerCounts, typeCounts, accountCounts, recentPartners, totalOrders, attributedOrders, sourceGroups, blockedAttributedOrders, validRevenueAgg, blockedRevenueAgg, ledgerGroups, staleProblemLedgers, recentOrders, failedSyncLogs, pendingOrderRequestCount, latestPendingOrderRequests] = await Promise.all([
    db.haravanSyncLog.findFirst({ orderBy: { startedAt: "desc" }, select: { status: true, startedAt: true, finishedAt: true, metadata: true, message: true } }),
    db.partnerCommissionLedger.findFirst({ orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
    db.partner.groupBy({ by: ["status"], _count: { _all: true } }),
    db.partner.groupBy({ by: ["partnerTypeId"], _count: { _all: true } }),
    db.partnerAccount.groupBy({ by: ["status"], _count: { _all: true } }),
    db.partner.findMany({ select: { id: true, displayName: true, phone: true, email: true, status: true, createdAt: true, partnerType: { select: { code: true } }, account: { select: { status: true, lastLoginAt: true, passwordSetAt: true } } }, orderBy: { createdAt: "desc" }, take: 10 }),
    db.partnerOrder.count({ where: orderRangeWhere }),
    // none is UI-only, not an OrderAttributionSource enum value. Unattributed orders are counted by partnerId/relations, never source = "none".
    db.partnerOrder.count({ where: { ...orderRangeWhere, partnerId: { not: null } } }),
    db.partnerOrderAttribution.groupBy({ by: ["source"], where: { source: { in: VALID_ATTRIBUTION_SOURCES }, order: orderRangeWhere }, _count: { _all: true } }),
    db.partnerOrder.count({ where: { ...orderRangeWhere, partnerId: { not: null }, ...blockedOrderWhere } }),
    db.partnerOrder.aggregate({ where: { ...orderRangeWhere, ...validOrderWhere }, _sum: { eligibleProductRevenue: true } }),
    db.partnerOrder.aggregate({ where: { ...orderRangeWhere, partnerId: { not: null }, ...blockedOrderWhere }, _sum: { eligibleProductRevenue: true } }),
    db.partnerCommissionLedger.groupBy({ by: ["status"], _sum: { amount: true } }),
    db.partnerCommissionLedger.findMany({ where: { status: { in: ACTIVE_LEDGER_STATUSES }, order: blockedOrderWhere }, select: { id: true, order: { select: { orderCode: true } }, partner: { select: { displayName: true } } }, take: 10 }),
    db.partnerOrder.findMany({ where: { partnerId: { not: null } }, select: { id: true, orderCode: true, eligibleProductRevenue: true, status: true, cancelledAt: true, returnedAt: true, disputedAt: true, createdAt: true, partner: { select: { id: true, displayName: true, partnerType: { select: { code: true } } } }, attributions: { where: { source: { in: VALID_ATTRIBUTION_SOURCES } }, select: { source: true, value: true, partnerCode: { select: { code: true } } }, orderBy: { createdAt: "desc" }, take: 1 }, ledgerEntries: { select: { status: true }, take: 1 } }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.haravanSyncLog.findMany({ where: { status: { not: "success" } }, select: { id: true, status: true, message: true, startedAt: true }, orderBy: { startedAt: "desc" }, take: 10 }),
    db.partnerOrderRequest.count({ where: { status: "pending" } }),
    db.partnerOrderRequest.findMany({ where: { status: "pending" }, select: { id: true, orderCode: true, createdAt: true, partner: { select: { displayName: true } } }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);
  const types = await db.partnerType.findMany({ select: { id: true, code: true } });
  const countStatus = (s: PartnerStatus) => partnerCounts.find(c => c.status === s)?._count._all ?? 0;
  const countAccount = (s: string) => accountCounts.find(c => c.status === s)?._count._all ?? 0;
  const countType = (code: PartnerTypeCode) => { const type = types.find(t => t.code === code); return type ? typeCounts.find(c => c.partnerTypeId === type.id)?._count._all ?? 0 : 0; };
  const ledgerSum = (s: CommissionStatus) => ledgerGroups.find(g => g.status === s)?._sum.amount ?? 0;
  const staleProblemLedgerCount = await db.partnerCommissionLedger.count({ where: { status: { in: ACTIVE_LEDGER_STATUSES }, order: blockedOrderWhere } });
  const topOrders = await db.partnerOrder.findMany({ where: { ...orderRangeWhere, partnerId: { not: null } }, select: { partnerId: true, eligibleProductRevenue: true, createdAt: true, status: true, cancelledAt: true, returnedAt: true, disputedAt: true, deliveredAt: true, partner: { select: { id: true, displayName: true, partnerType: { select: { code: true } }, codes: { select: { code: true }, take: 1 }, account: { select: { status: true } } } }, ledgerEntries: { where: { status: "payable" }, select: { amount: true }, take: 1 } }, orderBy: { createdAt: "desc" }, take: 500 });
  const topPartners = [...topOrders.reduce((map, order) => { if (!order.partnerId || !order.partner) return map; const row = map.get(order.partnerId) ?? { id: order.partner.id, name: order.partner.displayName, type: order.partner.partnerType.code, code: order.partner.codes[0]?.code ?? "—", validOrders: 0, validRevenue: 0, payableCommission: 0, blockedOrders: 0, lastOrderDate: order.createdAt, accountStatus: order.partner.account?.status ?? "Chưa có" }; if (isOrderCommissionEligible(order)) { row.validOrders += 1; row.validRevenue += order.eligibleProductRevenue; row.payableCommission += order.ledgerEntries.reduce((s, l) => s + l.amount, 0); } else if (getOrderCommissionBlockReason(order)) row.blockedOrders += 1; if (order.createdAt > row.lastOrderDate) row.lastOrderDate = order.createdAt; map.set(order.partnerId, row); return map; }, new Map<string, { id: string; name: string; type: PartnerTypeCode; code: string; validOrders: number; validRevenue: number; payableCommission: number; blockedOrders: number; lastOrderDate: Date; accountStatus: string }>()).values()].sort((a, b) => b.validRevenue - a.validRevenue).slice(0, 10);
  const performanceTypes: PartnerTypeCode[] = ["referral_ctv", "shop_referral"];
  const typePerformance = await Promise.all(performanceTypes.map(async (type) => {
    const [orders, validRevenue, blockedRevenue, ledgers] = await Promise.all([
      db.partnerOrder.count({ where: { ...orderRangeWhere, partner: { partnerType: { code: type } }, attributions: { some: { source: { in: type === "shop_referral" ? ["shop_discount_code", "discount_code"] : ["affiliate_link", "manual", "order_request"] } } } } }),
      db.partnerOrder.aggregate({ where: { ...orderRangeWhere, ...validOrderWhere, partner: { partnerType: { code: type } } }, _sum: { eligibleProductRevenue: true } }),
      db.partnerOrder.aggregate({ where: { ...orderRangeWhere, ...blockedOrderWhere, partner: { partnerType: { code: type } } }, _sum: { eligibleProductRevenue: true } }),
      db.partnerCommissionLedger.groupBy({ by: ["status"], where: { partner: { partnerType: { code: type } } }, _sum: { amount: true } }),
    ]);
    const sum = (statuses: CommissionStatus[]) => ledgers.filter((row) => statuses.includes(row.status)).reduce((total, row) => total + (row._sum.amount ?? 0), 0);
    return { type, codeOrders: orders, validRevenue: validRevenue._sum.eligibleProductRevenue ?? 0, blockedRevenue: blockedRevenue._sum.eligibleProductRevenue ?? 0, temporaryCommission: sum(["temporary", "reconciliation_waiting"]), payableCommission: sum(["payable"]), rejectedOnHoldCommission: sum(["rejected", "on_hold"]) };
  }));

  return { lastSync, lastRecalcAt: lastRecalc?.updatedAt ?? null, staleProblemLedgerCount, recentPartners, recentOrders, topPartners, typePerformance,
    partnerFunnel: { "Chờ duyệt": countStatus("pending"), "Đã duyệt/active": countStatus("approved"), "Invited accounts": countAccount("invited"), "Active login accounts": countAccount("active"), "Disabled/suspended": countStatus("suspended") + countStatus("inactive") + countAccount("disabled"), "Rejected": countStatus("rejected"), "referral_ctv": countType("referral_ctv"), "shop_referral": countType("shop_referral") },
    orderSummary: { "Total synced": totalOrders, "Attributed": attributedOrders, "Unattributed": totalOrders - attributedOrders, "Attribution rate": pct(attributedOrders, totalOrders), "affiliate_link": sourceGroups.find(g => g.source === "affiliate_link")?._count._all ?? 0, "shop/discount_code": sourceGroups.filter(g => ["shop_discount_code", "discount_code"].includes(g.source)).reduce((s, g) => s + g._count._all, 0), "manual/order_request": sourceGroups.filter(g => ["manual", "order_request"].includes(g.source)).reduce((s, g) => s + g._count._all, 0), "Cancelled/blocked": blockedAttributedOrders },
    financialSummary: { "Valid revenue": validRevenueAgg._sum.eligibleProductRevenue ?? 0, "Blocked revenue": blockedRevenueAgg._sum.eligibleProductRevenue ?? 0, "Temporary commission": ledgerSum("temporary"), "Reconciliation waiting": ledgerSum("reconciliation_waiting"), "Payable commission": ledgerSum("payable"), "Paid commission": ledgerSum("paid"), "Rejected/on_hold": ledgerSum("rejected") + ledgerSum("on_hold"), "Stale/problem ledgers": staleProblemLedgerCount },
    actions: [
      ["Yêu cầu gắn đơn chờ xử lý", `${pendingOrderRequestCount} yêu cầu - mới nhất: ${latestPendingOrderRequests.map(r => `${r.partner.displayName}${r.orderCode ? ` / ${r.orderCode}` : ""}`).join(", ") || "không có"}`, <Link className="link" href="/admin/order-requests" key="order-requests">Mở</Link>],
      ...recentPartners.filter(p => p.status === "pending").slice(0, 10).map(p => ["Pending partner approval", p.displayName, <Link className="link" href={`/admin/partners/${p.id}`} key={p.id}>Mở</Link>]),
      ...recentPartners.filter(p => p.status === "approved" && p.account?.status !== "active").slice(0, 10).map(p => ["Approved partner without active login", p.displayName, <Link className="link" href={`/admin/partners/${p.id}`} key={p.id}>Thiết lập</Link>]),
      ...staleProblemLedgers.map(l => ["Cancelled order with active ledger", `${l.partner.displayName} / ${l.order?.orderCode ?? "Manual"}`, <Link className="link" href="/admin/commissions" key={l.id}>Đối soát</Link>]),
      ...failedSyncLogs.map(l => ["Failed sync log", `${fmtDateTime(l.startedAt)} - ${l.message ?? l.status}`, <Link className="link" href="/admin/logs" key={l.id}>Logs</Link>]),
    ].slice(0, 40) };
}

function StatusCard({ label, value, hint, tone }: { label: string; value: string; hint: string; tone: "ok" | "warn" }) { return <div className={`rounded-2xl border p-4 ${tone === "warn" ? "border-amber-200 bg-amber-50" : "border-emerald-100 bg-emerald-50"}`}><p className="text-sm font-medium text-stone-600">{label}</p><p className="mt-2 text-xl font-bold text-merly-900">{value}</p><p className="mt-2 text-xs text-stone-600">{hint}</p></div>; }
function MiniStat({ label, value }: { label: string; value: React.ReactNode }) { return <div className="card"><p className="text-xs font-medium uppercase text-stone-500">{label}</p><p className="mt-2 text-2xl font-bold text-merly-900">{value}</p></div>; }
function TwoCol({ title, headers, rows }: { title: string; headers: string[]; rows: React.ReactNode[][] }) { return <section className="card overflow-x-auto"><h2 className="text-xl font-bold text-merly-900">{title}</h2><table className="mt-4 min-w-full text-left text-sm"><thead className="text-stone-500"><tr>{headers.map(h => <th className="whitespace-nowrap p-2" key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr className="border-t border-rose-100" key={i}>{row.map((cell, j) => <td className="whitespace-nowrap p-2" key={j}>{cell}</td>)}</tr>)}{rows.length === 0 ? <tr><td className="p-3 text-stone-500" colSpan={headers.length}>Chưa có dữ liệu.</td></tr> : null}</tbody></table></section>; }
