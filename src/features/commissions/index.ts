import crypto from "node:crypto";
import {
  CommissionStatus,
  OrderAttributionSource,
  Prisma,
  type PartnerCommissionLedger,
  type PartnerOrder,
} from "@prisma/client";
import { db } from "@/lib/db";

export const RECONCILIATION_WAIT_DAYS = 7;
export const DEFAULT_REFERRAL_CTV_COMMISSION_RATE_BPS = 1000;
export const MINIMUM_PAYOUT_AMOUNT_VND = 100_000;
const BASIS_POINTS = 10_000;

export const COMMISSIONABLE_REFERRAL_CTV_SOURCES: OrderAttributionSource[] = [
  "affiliate_link",
  "manual",
  "order_request",
];
export const ACTIVE_LEDGER_STATUSES: CommissionStatus[] = [
  "temporary",
  "reconciliation_waiting",
  "payable",
  "on_hold",
];
const PAID_LEDGER_STATUSES = new Set<CommissionStatus>(["paid"]);
const CANCELLED_STATUSES = new Set([
  "cancelled",
  "canceled",
  "voided",
  "void",
  "closed_cancelled",
]);
const RETURNED_STATUSES = new Set(["returned", "return", "partially_returned"]);
const REFUNDED_STATUSES = new Set([
  "refunded",
  "partially_refunded",
  "paid_refunded",
]);
const REFUSED_STATUSES = new Set([
  "refused",
  "failed_delivery",
  "failed delivery",
  "delivery_failed",
  "rejected",
  "undelivered",
]);
const DISPUTED_STATUSES = new Set(["disputed", "chargeback", "fraud_review"]);

export type CommissionOrderSnapshot = Pick<
  PartnerOrder,
  | "partnerId"
  | "status"
  | "eligibleProductRevenue"
  | "deliveredAt"
  | "cancelledAt"
  | "returnedAt"
  | "disputedAt"
>;
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

export function formatCommissionRate(rateBps: number | null | undefined) {
  return rateBps == null ? "—" : `${rateBps / 100}%`;
}
export function getPublicStatementTokenHash(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}
function lower(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}
function blockedAmount(order: Pick<PartnerOrder, "eligibleProductRevenue">) {
  return Math.floor(
    (Math.max(order.eligibleProductRevenue, 0) *
      DEFAULT_REFERRAL_CTV_COMMISSION_RATE_BPS) /
      BASIS_POINTS,
  );
}

export function isOrderCancelledOrReturned(
  order: Pick<
    PartnerOrder,
    "status" | "cancelledAt" | "returnedAt" | "disputedAt"
  >,
) {
  const status = lower(order.status);
  return Boolean(
    order.cancelledAt ||
    order.returnedAt ||
    order.disputedAt ||
    CANCELLED_STATUSES.has(status) ||
    RETURNED_STATUSES.has(status) ||
    REFUNDED_STATUSES.has(status) ||
    REFUSED_STATUSES.has(status) ||
    DISPUTED_STATUSES.has(status),
  );
}

export function getOrderCommissionBlockReason(
  order: Pick<
    PartnerOrder,
    "status" | "cancelledAt" | "returnedAt" | "disputedAt"
  >,
) {
  const status = lower(order.status);
  if (order.cancelledAt || CANCELLED_STATUSES.has(status))
    return "Đơn hàng đã hủy trên Haravan";
  if (order.returnedAt || RETURNED_STATUSES.has(status))
    return "Đơn hàng đã hoàn trên Haravan";
  if (REFUNDED_STATUSES.has(status))
    return "Đơn hàng đã hoàn tiền trên Haravan";
  if (REFUSED_STATUSES.has(status))
    return "Đơn hàng giao thất bại/từ chối nhận";
  if (order.disputedAt || DISPUTED_STATUSES.has(status))
    return "Đơn hàng đang tranh chấp trên Haravan";
  return null;
}

export function isOrderCommissionEligible(order: CommissionOrderSnapshot) {
  return Boolean(
    order.partnerId &&
    order.eligibleProductRevenue > 0 &&
    !isOrderCancelledOrReturned(order),
  );
}

export function displayOrderCommissionStatus(
  order: Pick<
    PartnerOrder,
    "status" | "cancelledAt" | "returnedAt" | "disputedAt"
  >,
) {
  const reason = getOrderCommissionBlockReason(order);
  if (!reason) return order.status;
  if (reason.includes("hủy")) return "Đã hủy - không tính hoa hồng";
  if (reason.includes("hoàn")) return "Đã hoàn - không tính hoa hồng";
  return "Không tính hoa hồng";
}

export function summarizeOrders(orders: CommissionOrderSnapshot[]) {
  return orders.reduce(
    (summary, order) => {
      summary.totalAttributedOrders += 1;
      if (isOrderCommissionEligible(order)) {
        summary.eligibleOrders += 1;
        summary.eligibleRevenue += order.eligibleProductRevenue;
      }
      if (isOrderCancelledOrReturned(order))
        summary.cancelledOrBlockedOrders += 1;
      return summary;
    },
    {
      totalAttributedOrders: 0,
      eligibleOrders: 0,
      eligibleRevenue: 0,
      cancelledOrBlockedOrders: 0,
    },
  );
}

export function decideCommissionForOrder(
  order: CommissionOrderSnapshot,
  now = new Date(),
): CommissionDecision {
  const base = Math.max(order.eligibleProductRevenue, 0);
  const amount = blockedAmount(order);
  if (!order.partnerId)
    return {
      status: "rejected",
      amount: 0,
      commissionRateBps: null,
      reason: "Order has no partner attribution.",
      availableAt: null,
    };
  const blockReason = getOrderCommissionBlockReason(order);
  if (blockReason)
    return {
      status: "rejected",
      amount,
      commissionRateBps: DEFAULT_REFERRAL_CTV_COMMISSION_RATE_BPS,
      reason: blockReason,
      availableAt: null,
    };
  if (base <= 0)
    return {
      status: "rejected",
      amount: 0,
      commissionRateBps: null,
      reason: "Order has no eligible product revenue for commission.",
      availableAt: null,
    };
  if (!order.deliveredAt)
    return {
      status: "temporary",
      amount,
      commissionRateBps: DEFAULT_REFERRAL_CTV_COMMISSION_RATE_BPS,
      reason: "Order is not delivered yet.",
      availableAt: null,
    };
  const availableAt = addDays(order.deliveredAt, RECONCILIATION_WAIT_DAYS);
  if (availableAt > now)
    return {
      status: "reconciliation_waiting",
      amount,
      commissionRateBps: DEFAULT_REFERRAL_CTV_COMMISSION_RATE_BPS,
      reason: `Delivered order is waiting ${RECONCILIATION_WAIT_DAYS} days for reconciliation.`,
      availableAt,
    };
  return {
    status: "payable",
    amount,
    commissionRateBps: DEFAULT_REFERRAL_CTV_COMMISSION_RATE_BPS,
    reason: "Delivered order passed reconciliation wait.",
    availableAt,
  };
}

export async function recalculateOrderCommission(
  orderId: string,
  now = new Date(),
): Promise<RecalculateOrderCommissionResult> {
  return db.$transaction(async (tx) => {
    const order = await tx.partnerOrder.findUnique({
      include: {
        partner: { include: { partnerType: true } },
        ledgerEntries: true,
        attributions: true,
      },
      where: { id: orderId },
    });
    if (!order)
      return {
        orderId,
        ledger: null,
        decision: null,
        skippedReason: "Order not found.",
      };
    if (!order.partnerId)
      return {
        orderId,
        ledger: null,
        decision: null,
        skippedReason: "Order has no partner attribution.",
      };
    if (order.partner?.partnerType.code !== "referral_ctv")
      return {
        orderId,
        ledger: null,
        decision: null,
        skippedReason:
          "Only referral_ctv affiliate/manual/order_request orders are commissionable in Phase 1.",
      };
    if (
      !order.attributions.some((a) =>
        COMMISSIONABLE_REFERRAL_CTV_SOURCES.includes(a.source),
      )
    )
      return {
        orderId,
        ledger: null,
        decision: null,
        skippedReason:
          "Order attribution source is not commissionable for referral_ctv.",
      };
    const existing = order.ledgerEntries[0];
    if (existing && PAID_LEDGER_STATUSES.has(existing.status)) {
      if (isOrderCancelledOrReturned(order)) {
        const priorManualReview = await tx.adminAuditLog.findFirst({
          where: {
            action: "commission.paid_manual_review_required",
            entityType: "PartnerCommissionLedger",
            entityId: existing.id,
          },
        });
        if (!priorManualReview)
          await tx.adminAuditLog.create({
            data: {
              partnerId: order.partnerId,
              action: "commission.paid_manual_review_required",
              entityType: "PartnerCommissionLedger",
              entityId: existing.id,
              beforeJson: { status: existing.status, amount: existing.amount },
              afterJson: {
                orderStatus: order.status,
                blockReason: getOrderCommissionBlockReason(order),
              },
              note: "Đơn đã hủy sau khi hoa hồng đã thanh toán - cần đối soát thủ công.",
            },
          });
      }
      return {
        orderId,
        ledger: existing,
        decision: null,
        skippedReason:
          "Paid ledger entries are immutable and were not overwritten. Đơn đã hủy sau khi hoa hồng đã thanh toán - cần đối soát thủ công.",
      };
    }
    const decision = decideCommissionForOrder(order, now);
    const data = {
      partnerId: order.partnerId,
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
      ? await tx.partnerCommissionLedger.update({
          where: { id: existing.id },
          data,
        })
      : await tx.partnerCommissionLedger.create({ data });
    const changed =
      !existing ||
      existing.status !== ledger.status ||
      existing.amount !== ledger.amount ||
      existing.commissionRateBps !== ledger.commissionRateBps ||
      existing.eligibleProductRevenue !== ledger.eligibleProductRevenue ||
      existing.availableAt?.getTime() !== ledger.availableAt?.getTime() ||
      existing.reason !== ledger.reason;
    if (changed)
      await tx.adminAuditLog.create({
        data: {
          partnerId: order.partnerId,
          action: "commission.recalculate",
          entityType: "PartnerCommissionLedger",
          entityId: ledger.id,
          beforeJson: existing
            ? {
                status: existing.status,
                amount: existing.amount,
                commissionRateBps: existing.commissionRateBps,
                reason: existing.reason,
              }
            : Prisma.JsonNull,
          afterJson: {
            status: ledger.status,
            amount: ledger.amount,
            commissionRateBps: ledger.commissionRateBps,
            availableAt: ledger.availableAt,
            reason: ledger.reason,
          },
          note: "Manual idempotent commission recalculation. Cancelled/returned Haravan orders are rejected and excluded from active commission.",
        },
      });
    return { orderId, ledger, decision };
  });
}

export async function recalculateOpenCommissions(now = new Date()) {
  const orders = await db.partnerOrder.findMany({
    where: {
      partnerId: { not: null },
      partner: { partnerType: { code: "referral_ctv" } },
      attributions: {
        some: { source: { in: COMMISSIONABLE_REFERRAL_CTV_SOURCES } },
      },
    },
    select: { id: true },
  });
  const results: RecalculateOrderCommissionResult[] = [];
  for (const order of orders)
    results.push(await recalculateOrderCommission(order.id, now));
  return results;
}

export function summarizeLedgers(
  ledgers: {
    status: CommissionStatus;
    amount: number;
    order?: Pick<
      PartnerOrder,
      "status" | "cancelledAt" | "returnedAt" | "disputedAt"
    > | null;
  }[],
) {
  const result: Record<CommissionStatus, number> = {
    temporary: 0,
    pending_delivery: 0,
    reconciliation_waiting: 0,
    payable: 0,
    paid: 0,
    rejected: 0,
    on_hold: 0,
  };
  for (const ledger of ledgers) {
    const staleBlocked =
      ledger.order &&
      isOrderCancelledOrReturned(ledger.order) &&
      ACTIVE_LEDGER_STATUSES.includes(ledger.status);
    result[staleBlocked ? "rejected" : ledger.status] += ledger.amount;
  }
  return result;
}

export async function createPartnerStatementToken(partnerId: string) {
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = getPublicStatementTokenHash(token);
  await db.partnerStatementToken.create({ data: { partnerId, tokenHash } });
  return token;
}
