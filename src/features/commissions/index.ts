import crypto from "node:crypto";
import { CommissionStatus, OrderAttributionSource, Prisma, type PartnerCommissionLedger, type PartnerOrder } from "@prisma/client";
import { db } from "@/lib/db";

export const RECONCILIATION_WAIT_DAYS = 7;
export const DEFAULT_REFERRAL_CTV_COMMISSION_RATE_BPS = 1000;
export const MINIMUM_PAYOUT_AMOUNT_VND = 100_000;
const BASIS_POINTS = 10_000;

export const COMMISSIONABLE_REFERRAL_CTV_SOURCES: OrderAttributionSource[] = ["affiliate_link", "manual", "order_request"];
const REJECTED_ORDER_STATUSES = new Set(["cancelled", "returned", "disputed", "refused"]);
const PAID_LEDGER_STATUSES = new Set<CommissionStatus>(["paid"]);

export type CommissionDecision = { status: CommissionStatus; amount: number; commissionRateBps: number | null; reason: string; availableAt: Date | null };
export type RecalculateOrderCommissionResult = { orderId: string; ledger: PartnerCommissionLedger | null; decision: CommissionDecision | null; skippedReason?: string };

export function formatCommissionRate(rateBps: number | null | undefined) { return rateBps == null ? "—" : `${rateBps / 100}%`; }
export function getPublicStatementTokenHash(token: string) { return crypto.createHash("sha256").update(token).digest("hex"); }

function addDays(date: Date, days: number) { const next = new Date(date); next.setUTCDate(next.getUTCDate() + days); return next; }
function lower(value?: string | null) { return value?.trim().toLowerCase() ?? ""; }
function orderRejected(order: Pick<PartnerOrder, "status" | "cancelledAt" | "returnedAt" | "disputedAt">) { return Boolean(order.cancelledAt || order.returnedAt || order.disputedAt || REJECTED_ORDER_STATUSES.has(lower(order.status))); }
function rejectionReason(order: Pick<PartnerOrder, "status" | "cancelledAt" | "returnedAt" | "disputedAt">) { if (order.cancelledAt || lower(order.status) === "cancelled") return "order cancelled"; if (order.returnedAt || lower(order.status) === "returned") return "order returned"; if (lower(order.status) === "refused") return "order refused"; return "order disputed"; }

export function decideCommissionForOrder(order: Pick<PartnerOrder, "partnerId" | "status" | "eligibleProductRevenue" | "deliveredAt" | "cancelledAt" | "returnedAt" | "disputedAt">, now = new Date()): CommissionDecision {
  const base = Math.max(order.eligibleProductRevenue, 0);
  if (!order.partnerId) return { status: "rejected", amount: 0, commissionRateBps: null, reason: "Order has no partner attribution.", availableAt: null };
  if (orderRejected(order)) return { status: "rejected", amount: 0, commissionRateBps: null, reason: rejectionReason(order), availableAt: null };
  if (base <= 0) return { status: "rejected", amount: 0, commissionRateBps: null, reason: "Order has no eligible product revenue for commission.", availableAt: null };
  const amount = Math.floor((base * DEFAULT_REFERRAL_CTV_COMMISSION_RATE_BPS) / BASIS_POINTS);
  if (!order.deliveredAt) return { status: "temporary", amount, commissionRateBps: DEFAULT_REFERRAL_CTV_COMMISSION_RATE_BPS, reason: "Order is not delivered yet.", availableAt: null };
  const availableAt = addDays(order.deliveredAt, RECONCILIATION_WAIT_DAYS);
  if (availableAt > now) return { status: "reconciliation_waiting", amount, commissionRateBps: DEFAULT_REFERRAL_CTV_COMMISSION_RATE_BPS, reason: `Delivered order is waiting ${RECONCILIATION_WAIT_DAYS} days for reconciliation.`, availableAt };
  return { status: "payable", amount, commissionRateBps: DEFAULT_REFERRAL_CTV_COMMISSION_RATE_BPS, reason: "Delivered order passed reconciliation wait.", availableAt };
}

export async function recalculateOrderCommission(orderId: string, now = new Date()): Promise<RecalculateOrderCommissionResult> {
  return db.$transaction(async (tx) => {
    const order = await tx.partnerOrder.findUnique({ include: { partner: { include: { partnerType: true } }, ledgerEntries: true, attributions: true }, where: { id: orderId } });
    if (!order) return { orderId, ledger: null, decision: null, skippedReason: "Order not found." };
    if (!order.partnerId) return { orderId, ledger: null, decision: null, skippedReason: "Order has no partner attribution." };
    if (order.partner?.partnerType.code !== "referral_ctv") return { orderId, ledger: null, decision: null, skippedReason: "Only referral_ctv affiliate/manual/order_request orders are commissionable in Phase 1." };
    if (!order.attributions.some((a) => COMMISSIONABLE_REFERRAL_CTV_SOURCES.includes(a.source))) return { orderId, ledger: null, decision: null, skippedReason: "Order attribution source is not commissionable for referral_ctv." };
    const existing = order.ledgerEntries[0];
    if (existing && PAID_LEDGER_STATUSES.has(existing.status)) return { orderId, ledger: existing, decision: null, skippedReason: "Paid ledger entries are immutable and were not overwritten." };
    const decision = decideCommissionForOrder(order, now);
    const data = { partnerId: order.partnerId, orderId: order.id, status: decision.status, amount: decision.amount, commissionRateBps: decision.commissionRateBps, eligibleProductRevenue: order.eligibleProductRevenue, reason: decision.reason, availableAt: decision.availableAt, paidAt: null } satisfies Prisma.PartnerCommissionLedgerUncheckedCreateInput;
    const ledger = existing ? await tx.partnerCommissionLedger.update({ where: { id: existing.id }, data }) : await tx.partnerCommissionLedger.create({ data });
    const changed = !existing || existing.status !== ledger.status || existing.amount !== ledger.amount || existing.commissionRateBps !== ledger.commissionRateBps || existing.eligibleProductRevenue !== ledger.eligibleProductRevenue || existing.availableAt?.getTime() !== ledger.availableAt?.getTime() || existing.reason !== ledger.reason;
    if (changed) await tx.adminAuditLog.create({ data: { partnerId: order.partnerId, action: "commission.recalculate", entityType: "PartnerCommissionLedger", entityId: ledger.id, beforeJson: existing ? { status: existing.status, amount: existing.amount, commissionRateBps: existing.commissionRateBps } : Prisma.JsonNull, afterJson: { status: ledger.status, amount: ledger.amount, commissionRateBps: ledger.commissionRateBps, availableAt: ledger.availableAt, reason: ledger.reason }, note: "Manual idempotent commission recalculation. Amount uses eligible product revenue × 10%, rounded down to integer VND." } });
    return { orderId, ledger, decision };
  });
}

export async function recalculateOpenCommissions(now = new Date()) { const orders = await db.partnerOrder.findMany({ where: { partnerId: { not: null }, partner: { partnerType: { code: "referral_ctv" } }, attributions: { some: { source: { in: COMMISSIONABLE_REFERRAL_CTV_SOURCES } } } }, select: { id: true } }); const results: RecalculateOrderCommissionResult[] = []; for (const order of orders) results.push(await recalculateOrderCommission(order.id, now)); return results; }

export function summarizeLedgers(ledgers: { status: CommissionStatus; amount: number }[]) { const result: Record<CommissionStatus, number> = { temporary: 0, pending_delivery: 0, reconciliation_waiting: 0, payable: 0, paid: 0, rejected: 0, on_hold: 0 }; for (const ledger of ledgers) result[ledger.status] += ledger.amount; return result; }

export async function createPartnerStatementToken(partnerId: string) { const token = crypto.randomBytes(32).toString("base64url"); const tokenHash = getPublicStatementTokenHash(token); await db.partnerStatementToken.create({ data: { partnerId, tokenHash } }); return token; }
