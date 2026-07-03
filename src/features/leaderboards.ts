import { db } from "@/lib/db";
import { COMMISSIONABLE_REFERRAL_CTV_SOURCES, isCtvOrderValidForMonthlyTier } from "@/features/commissions";

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
export type LeaderboardMetric = "revenue" | "orders";
export type LeaderboardRangeKey = "week" | "month";

function vnParts(date: Date) {
  const shifted = new Date(date.getTime() + VN_OFFSET_MS);
  return { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth(), d: shifted.getUTCDate(), day: shifted.getUTCDay() || 7 };
}
function utcFromVn(y: number, m: number, d: number) { return new Date(Date.UTC(y, m, d) - VN_OFFSET_MS); }
export function getVietnamWeekRange(date = new Date()) { const p = vnParts(date); const start = utcFromVn(p.y, p.m, p.d - p.day + 1); return { start, end: new Date(start.getTime() + 7 * 86400000), label: `${start.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })} - ${new Date(start.getTime()+6*86400000).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}` }; }
export function getVietnamMonthRange(date = new Date()) { const p = vnParts(date); const start = utcFromVn(p.y, p.m, 1); const end = utcFromVn(p.y, p.m + 1, 1); return { start, end, label: new Intl.DateTimeFormat("vi-VN", { month: "long", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).format(date) }; }

export async function getValidPartnerOrdersForRange(partnerType = "referral_ctv", start: Date, end: Date) {
  const orders = await db.partnerOrder.findMany({
    where: { partnerId: { not: null }, createdAt: { gte: start, lt: end }, partner: { partnerType: { code: partnerType as never } }, attributions: { some: { source: { in: COMMISSIONABLE_REFERRAL_CTV_SOURCES } } } },
    include: { partner: true, ledgerEntries: true },
  });
  return orders.filter(isCtvOrderValidForMonthlyTier);
}

export async function getLeaderboard(metric: LeaderboardMetric, range: { start: Date; end: Date }, partnerType = "referral_ctv", limit = 10, currentPartnerId?: string) {
  const orders = await getValidPartnerOrdersForRange(partnerType, range.start, range.end);
  const map = new Map<string, { partnerId: string; displayName: string; orderCount: number; revenue: number; commission: number }>();
  for (const order of orders) {
    if (!order.partnerId || !order.partner) continue;
    const row = map.get(order.partnerId) ?? { partnerId: order.partnerId, displayName: order.partner.displayName, orderCount: 0, revenue: 0, commission: 0 };
    row.orderCount += 1; row.revenue += order.eligibleProductRevenue; row.commission += order.ledgerEntries.reduce((s, l) => s + (l.amount > 0 && l.status !== "rejected" ? l.amount : 0), 0);
    map.set(order.partnerId, row);
  }
  const rows = [...map.values()].sort((a,b) => metric === "revenue" ? b.revenue - a.revenue || b.orderCount - a.orderCount : b.orderCount - a.orderCount || b.revenue - a.revenue).map((r, i) => ({ ...r, rank: i + 1 }));
  return { rows: rows.slice(0, limit), current: currentPartnerId ? rows.find(r => r.partnerId === currentPartnerId) : undefined, total: rows.length };
}

export async function getEmergingLeaderboard(currentPartnerId?: string) {
  const now = new Date(); const approvedAfter = new Date(now.getTime() - 30 * 86400000); const range = { start: approvedAfter, end: now };
  const board = await getLeaderboard("orders", range, "referral_ctv", 10, currentPartnerId);
  const eligibleIds = new Set((await db.partner.findMany({ where: { createdAt: { gte: approvedAfter }, partnerType: { code: "referral_ctv" } }, select: { id: true } })).map(p => p.id));
  const filter = (r: NonNullable<typeof board.current>) => eligibleIds.has(r.partnerId);
  return { rows: board.rows.filter(filter), current: board.current && filter(board.current) ? board.current : undefined, total: board.total };
}
