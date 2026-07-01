import { CommissionStatus, Prisma, type PartnerCommissionLedger, type PartnerOrder } from "@prisma/client";
import { db } from "@/lib/db";

export const RECONCILIATION_WAIT_DAYS = 7;
const BASIS_POINTS = 10_000;

const REJECTED_ORDER_STATUSES = new Set(["cancelled", "returned", "disputed", "refused"]);
const PAYABLE_ORDER_STATUSES = new Set(["delivered", "fulfilled", "completed"]);
const PAID_LEDGER_STATUSES = new Set<CommissionStatus>(["paid"]);

export type CommissionDecision = {
  status: CommissionStatus;
  amount: number;
  commissionRateBps: number | null;
  reason: string;
  availableAt: Date | null;
};

export type RecalculateOrderCommissionResult = {
  orderId: string;
  ledger: PartnerCommissionLedger | null;
  decision: CommissionDecision | null;
  skippedReason?: string;
};

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function lower(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function orderRejected(order: Pick<PartnerOrder, "status" | "cancelledAt" | "returnedAt" | "disputedAt">) {
  return Boolean(order.cancelledAt || order.returnedAt || order.disputedAt || REJECTED_ORDER_STATUSES.has(lower(order.status)));
}

function discountBps(order: Pick<PartnerOrder, "eligibleProductRevenue" | "discountAmount">) {
  if (order.discountAmount <= 0) return 0;
  const listedProductRevenue = order.eligibleProductRevenue + order.discountAmount;
  if (listedProductRevenue <= 0) return 0;
  return Math.round((order.discountAmount / listedProductRevenue) * BASIS_POINTS);
}

function reconciliationAvailableAt(order: Pick<PartnerOrder, "deliveredAt">) {
  return order.deliveredAt ? addDays(order.deliveredAt, RECONCILIATION_WAIT_DAYS) : null;
}

export function decideCommissionForOrder(order: Pick<PartnerOrder, "partnerId" | "status" | "eligibleProductRevenue" | "discountAmount" | "paidAt" | "deliveredAt" | "cancelledAt" | "returnedAt" | "disputedAt">, now = new Date()): CommissionDecision {
  const base = Math.max(order.eligibleProductRevenue, 0);

  if (!order.partnerId) {
    return { status: "rejected", amount: 0, commissionRateBps: null, reason: "Order has no approved referral_ctv partner attribution.", availableAt: null };
  }

  if (orderRejected(order)) {
    return { status: "rejected", amount: 0, commissionRateBps: null, reason: "Order is cancelled, returned, disputed, or refused.", availableAt: null };
  }

  if (base <= 0) {
    return { status: "rejected", amount: 0, commissionRateBps: null, reason: "Order has no eligible product revenue for commission.", availableAt: null };
  }

  const bps = discountBps(order);
  if (bps > 1000) {
    return { status: "on_hold", amount: 0, commissionRateBps: null, reason: "Discount is above 10% or ambiguous; manual review required.", availableAt: null };
  }

  if (bps > 0 && bps < 500) {
    return { status: "on_hold", amount: 0, commissionRateBps: null, reason: "Discount is below the configured member perk range; manual review required.", availableAt: null };
  }

  const commissionRateBps = bps >= 500 ? 700 : 1000;
  const amount = Math.round((base * commissionRateBps) / BASIS_POINTS);

  if (!order.paidAt) {
    return { status: "pending_delivery", amount, commissionRateBps, reason: "Order is not marked paid yet.", availableAt: null };
  }

  if (!order.deliveredAt || !PAYABLE_ORDER_STATUSES.has(lower(order.status))) {
    return { status: "pending_delivery", amount, commissionRateBps, reason: "Order is paid but not delivered yet.", availableAt: null };
  }

  const availableAt = reconciliationAvailableAt(order);
  if (availableAt && availableAt > now) {
    return { status: "reconciliation_waiting", amount, commissionRateBps, reason: `Delivered order is waiting ${RECONCILIATION_WAIT_DAYS} days for reconciliation.`, availableAt };
  }

  return { status: "payable", amount, commissionRateBps, reason: "Delivered paid order passed reconciliation wait.", availableAt };
}

export async function recalculateOrderCommission(orderId: string, now = new Date()): Promise<RecalculateOrderCommissionResult> {
  return db.$transaction(async (tx) => {
    const order = await tx.partnerOrder.findUnique({
      include: { partner: { include: { partnerType: true } }, ledgerEntries: true },
      where: { id: orderId },
    });

    if (!order) return { orderId, ledger: null, decision: null, skippedReason: "Order not found." };
    if (order.partner?.partnerType.code !== "referral_ctv") return { orderId, ledger: null, decision: null, skippedReason: "Only referral_ctv orders are commissionable in Phase 1." };

    const existing = order.ledgerEntries[0];
    if (existing && PAID_LEDGER_STATUSES.has(existing.status)) {
      return { orderId, ledger: existing, decision: null, skippedReason: "Paid ledger entries are immutable and were not overwritten." };
    }

    const decision = decideCommissionForOrder(order, now);
    const data = {
      partnerId: order.partnerId!,
      orderId: order.id,
      status: decision.status,
      amount: decision.amount,
      commissionRateBps: decision.commissionRateBps,
      eligibleProductRevenue: order.eligibleProductRevenue,
      reason: decision.reason,
      availableAt: decision.availableAt,
      paidAt: null,
    } satisfies Prisma.PartnerCommissionLedgerUncheckedCreateInput;

    const ledger = existing
      ? await tx.partnerCommissionLedger.update({ where: { id: existing.id }, data })
      : await tx.partnerCommissionLedger.create({ data });

    const changed =
      !existing ||
      existing.status !== ledger.status ||
      existing.amount !== ledger.amount ||
      existing.commissionRateBps !== ledger.commissionRateBps ||
      existing.eligibleProductRevenue !== ledger.eligibleProductRevenue ||
      existing.availableAt?.getTime() !== ledger.availableAt?.getTime();

    if (changed) {
      await tx.adminAuditLog.create({
        data: {
          partnerId: order.partnerId,
          action: "commission.recalculate",
          entityType: "PartnerCommissionLedger",
          entityId: ledger.id,
          beforeJson: existing ? { status: existing.status, amount: existing.amount, commissionRateBps: existing.commissionRateBps } : Prisma.JsonNull,
          afterJson: { status: ledger.status, amount: ledger.amount, commissionRateBps: ledger.commissionRateBps, availableAt: ledger.availableAt },
          note: "Manual idempotent commission recalculation.",
        },
      });
    }

    return { orderId, ledger, decision };
  });
}

export async function recalculateOpenCommissions(now = new Date()) {
  const orders = await db.partnerOrder.findMany({
    where: { partner: { partnerType: { code: "referral_ctv", enabled: true } } },
    select: { id: true },
  });

  const results: RecalculateOrderCommissionResult[] = [];
  for (const order of orders) results.push(await recalculateOrderCommission(order.id, now));
  return results;
}
