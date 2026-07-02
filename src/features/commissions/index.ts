import crypto from "node:crypto";
import {
  CommissionStatus,
  OrderAttributionSource,
  Prisma,
  type PartnerCommissionLedger,
  type PartnerOrder,
} from "@prisma/client";
import { db } from "@/lib/db";
import { VALID_ATTRIBUTION_SOURCES } from "@/features/partners/attribution-sources";
import { getCtvProgramSettings, type CtvCommissionTierKey } from "@/features/settings";

export const RECONCILIATION_WAIT_DAYS = 7;
export const DEFAULT_REFERRAL_CTV_COMMISSION_RATE_BPS = 1000;
export const DEFAULT_SHOP_REFERRAL_COMMISSION_RATE_BPS = 0;
export const MINIMUM_PAYOUT_AMOUNT_VND = 100_000;
const BASIS_POINTS = 10_000;

export const COMMISSIONABLE_REFERRAL_CTV_SOURCES: OrderAttributionSource[] = [
  "affiliate_link",
  "manual",
  "order_request",
];
export const COMMISSIONABLE_SHOP_REFERRAL_SOURCES: OrderAttributionSource[] = [
  "shop_discount_code",
  "discount_code",
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
  monthlyValidOrderCount?: number;
  appliedTier?: CtvCommissionTierKey;
  orderClass?: string;
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

export function calculateOrderDiscountBps(order: Pick<PartnerOrder, "eligibleProductRevenue" | "discountAmount">) {
  const listedProductRevenue = Math.max(order.eligibleProductRevenue, 0) + Math.max(order.discountAmount, 0);
  if (listedProductRevenue <= 0) return 0;
  return Math.round((Math.max(order.discountAmount, 0) * BASIS_POINTS) / listedProductRevenue);
}

export function getCtvMonthlyTier(validOrderCount: number, thresholds = [{ key: "base" as const, minValidOrders: 0 }, { key: "tier_10" as const, minValidOrders: 10 }, { key: "tier_30" as const, minValidOrders: 30 }]): CtvCommissionTierKey {
  return thresholds.reduce<CtvCommissionTierKey>((selected, tier) => validOrderCount >= tier.minValidOrders ? tier.key : selected, "base");
}

export function getCtvTierLabel(tier: CtvCommissionTierKey) {
  if (tier === "tier_30") return "mốc từ 30 đơn";
  if (tier === "tier_10") return "mốc từ 10 đơn";
  return "mốc dưới 10 đơn";
}

export function classifyCtvOrderForCommission(order: Pick<PartnerOrder, "eligibleProductRevenue" | "discountAmount">) {
  const discountBps = calculateOrderDiscountBps(order);
  if (discountBps === 0) return { key: "normal_price", discountBps } as const;
  if (discountBps >= 500 && discountBps <= 1000) return { key: "merly_discount_5_to_10", discountBps } as const;
  return { key: "over_policy_or_unknown", discountBps } as const;
}

export function isCtvOrderValidForMonthlyTier(order: CommissionOrderSnapshot & Pick<PartnerOrder, "discountAmount">) {
  if (!isOrderCommissionEligible(order)) return false;
  return classifyCtvOrderForCommission(order).key !== "over_policy_or_unknown";
}

export function describeCommissionLedger(ledger: Pick<PartnerCommissionLedger, "commissionRateBps" | "reason">) {
  const reason = ledger.reason ?? "";
  if (reason.startsWith("Không tính hoa hồng") || reason.includes("vượt chính sách") || reason.includes("hủy") || reason.includes("hoàn") || reason.includes("từ chối")) return reason;
  const orderClass = reason.includes("Có ưu đãi 5%–10%") ? "Có ưu đãi 5%–10%" : reason.includes("Bán đúng giá Merly") ? "Bán đúng giá Merly" : null;
  const tier = reason.match(/mốc (dưới 10 đơn|từ 10 đơn|từ 30 đơn)/)?.[0];
  return [orderClass, tier, formatCommissionRate(ledger.commissionRateBps)].filter(Boolean).join(" · ") || reason || "—";
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
  commissionRateBps = DEFAULT_REFERRAL_CTV_COMMISSION_RATE_BPS,
): CommissionDecision {
  const base = Math.max(order.eligibleProductRevenue, 0);
  const rate = Math.max(commissionRateBps, 0);
  const amount = Math.floor((base * rate) / BASIS_POINTS);
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
      amount: 0,
      commissionRateBps: 0,
      reason: `Không tính hoa hồng: ${blockReason}`,
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
      commissionRateBps: rate,
      reason: "Order is not delivered yet.",
      availableAt: null,
    };
  const availableAt = addDays(order.deliveredAt, RECONCILIATION_WAIT_DAYS);
  if (availableAt > now)
    return {
      status: "reconciliation_waiting",
      amount,
      commissionRateBps: rate,
      reason: `Delivered order is waiting ${RECONCILIATION_WAIT_DAYS} days for reconciliation.`,
      availableAt,
    };
  return {
    status: "payable",
    amount,
    commissionRateBps: rate,
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
        attributions: { where: { source: { in: VALID_ATTRIBUTION_SOURCES } }, include: { partnerCode: true }, orderBy: { createdAt: "asc" } },
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
    const partnerTypeCode = order.partner?.partnerType.code;
    const commissionableSources = partnerTypeCode === "shop_referral" ? COMMISSIONABLE_SHOP_REFERRAL_SOURCES : COMMISSIONABLE_REFERRAL_CTV_SOURCES;
    if (partnerTypeCode !== "referral_ctv" && partnerTypeCode !== "shop_referral")
      return {
        orderId,
        ledger: null,
        decision: null,
        skippedReason: "Partner type is not commissionable yet.",
      };
    const primaryAttribution = order.attributions.find((a) => commissionableSources.includes(a.source));
    if (!primaryAttribution)
      return {
        orderId,
        ledger: null,
        decision: null,
        skippedReason: `Order attribution source is not commissionable for ${partnerTypeCode}.`,
      };
    const existing = order.ledgerEntries[0];
    const defaultRate = partnerTypeCode === "shop_referral" ? DEFAULT_SHOP_REFERRAL_COMMISSION_RATE_BPS : DEFAULT_REFERRAL_CTV_COMMISSION_RATE_BPS;
    const typeRule = partnerTypeCode === "shop_referral" ? await tx.partnerCommissionRule.findFirst({
      where: { active: true, partnerTypeId: order.partner!.partnerTypeId, commissionRateBps: { not: null } },
      orderBy: { createdAt: "asc" },
    }) : null;
    let commissionRateBps = primaryAttribution.partnerCode?.commissionRateBps ?? typeRule?.commissionRateBps ?? defaultRate;
    let monthlyValidOrderCount: number | undefined;
    let appliedTier: CtvCommissionTierKey | undefined;
    let orderClassKey: string | undefined;
    let policyReasonPrefix: string | undefined;
    if (partnerTypeCode === "referral_ctv") {
      const settings = await getCtvProgramSettings();
      const policy = settings.ctvNoStockCommissionPolicy;
      const monthStart = new Date(Date.UTC(order.createdAt.getUTCFullYear(), order.createdAt.getUTCMonth(), 1));
      const monthEnd = new Date(Date.UTC(order.createdAt.getUTCFullYear(), order.createdAt.getUTCMonth() + 1, 1));
      const sameMonthOrders = await tx.partnerOrder.findMany({
        where: { partnerId: order.partnerId, id: { not: order.id }, createdAt: { gte: monthStart, lt: monthEnd } },
      });
      monthlyValidOrderCount = sameMonthOrders.filter(isCtvOrderValidForMonthlyTier).length;
      appliedTier = getCtvMonthlyTier(monthlyValidOrderCount, policy.monthlyTierThresholds);
      const classification = classifyCtvOrderForCommission(order);
      orderClassKey = classification.key;
      if (classification.key === "over_policy_or_unknown") {
        commissionRateBps = 0;
        policyReasonPrefix = "Tổng ưu đãi vượt chính sách CTV, cần Merly xét chương trình riêng.";
      } else {
        const orderClass = policy.orderClasses.find((c) => c.key === classification.key);
        commissionRateBps = orderClass?.ratesByTierBps[appliedTier] ?? defaultRate;
        const classLabel = classification.key === "normal_price" ? "Bán đúng giá Merly" : "Có ưu đãi 5%–10%";
        policyReasonPrefix = `${classLabel} · ${getCtvTierLabel(appliedTier)} · ${formatCommissionRate(commissionRateBps)} · ${monthlyValidOrderCount} đơn hợp lệ tháng này tại thời điểm tính`;
      }
    }
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
    let decision = decideCommissionForOrder(order, now, commissionRateBps);
    if (partnerTypeCode === "referral_ctv") {
      if (policyReasonPrefix?.includes("vượt chính sách")) {
        decision = { status: "on_hold", amount: 0, commissionRateBps: 0, reason: policyReasonPrefix, availableAt: null, monthlyValidOrderCount, appliedTier, orderClass: orderClassKey };
      } else if (!decision.reason.startsWith("Không tính hoa hồng")) {
        decision = { ...decision, reason: `${policyReasonPrefix}. ${decision.reason}`, monthlyValidOrderCount, appliedTier, orderClass: orderClassKey };
      } else {
        decision = { ...decision, monthlyValidOrderCount, appliedTier, orderClass: orderClassKey };
      }
    }
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
            monthlyValidOrderCount: decision.monthlyValidOrderCount,
            appliedTier: decision.appliedTier,
            orderClass: decision.orderClass,
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
      OR: [
        { partner: { partnerType: { code: "referral_ctv" } }, attributions: { some: { source: { in: COMMISSIONABLE_REFERRAL_CTV_SOURCES } } } },
        { partner: { partnerType: { code: "shop_referral" } }, attributions: { some: { source: { in: COMMISSIONABLE_SHOP_REFERRAL_SOURCES } } } },
      ],
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
