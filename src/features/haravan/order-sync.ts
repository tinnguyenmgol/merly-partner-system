import { ATTRIBUTION_SOURCES, VALID_ATTRIBUTION_SOURCES } from "@/features/partners/attribution-sources";
import { db, hasDatabaseUrl } from "@/lib/db";
import { recalculateOrderCommission } from "@/features/commissions";
import { calculateEligibleProductRevenue } from "@/lib/money";
import { HaravanClient } from "./haravan-client";
import {
  extractHaravanAttributionCandidates,
  resolveHaravanAttribution,
} from "./attribution";
import type {
  HaravanLineItem,
  HaravanMoney,
  HaravanOrder,
  HaravanSyncResult,
} from "./types";

type SyncSummary = Omit<HaravanSyncResult, "ok" | "message" | "logId">;

function toVnd(value: HaravanMoney) {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

function parseDate(value?: string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function customerName(order: HaravanOrder) {
  const customer = order.customer;
  if (!customer) return undefined;
  return (
    customer.name ??
    ([customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
      undefined)
  );
}

function orderCode(order: HaravanOrder) {
  return String(
    order.order_code ?? order.name ?? order.order_number ?? order.id,
  );
}

function lineDiscountAmount(item: HaravanLineItem) {
  const allocationDiscount =
    item.discount_allocations?.reduce(
      (sum, allocation) => sum + toVnd(allocation.amount),
      0,
    ) ?? 0;
  return allocationDiscount || toVnd(item.total_discount);
}

function mapLineItem(item: HaravanLineItem) {
  const quantity = item.quantity && item.quantity > 0 ? item.quantity : 1;
  const unitPrice = toVnd(
    item.price || (item.line_price ? toVnd(item.line_price) / quantity : 0),
  );
  const discountAmount = lineDiscountAmount(item);

  return {
    sku: item.sku || undefined,
    productName:
      item.title ??
      item.product_title ??
      item.name ??
      item.sku ??
      "Haravan product",
    quantity,
    unitPrice,
    discountAmount,
    eligibleRevenue: Math.max(unitPrice * quantity - discountAmount, 0),
  };
}

function shippingFee(order: HaravanOrder) {
  const shippingSetAmount = toVnd(
    order.total_shipping_price_set?.shop_money?.amount,
  );
  if (shippingSetAmount > 0) return shippingSetAmount;
  return (
    order.shipping_lines?.reduce((sum, line) => sum + toVnd(line.price), 0) ?? 0
  );
}

function normalized(value?: string | null) { return value?.trim().toLowerCase().replace(/\s+/g, "_") ?? ""; }

function mapStatus(order: HaravanOrder) {
  const financial = normalized(order.financial_status);
  const fulfillment = normalized(order.fulfillment_status);
  if (order.cancelled_at || ["cancelled", "canceled", "voided", "void"].includes(financial) || ["cancelled", "canceled", "voided", "void"].includes(fulfillment)) return "cancelled";
  if (["refunded", "partially_refunded"].includes(financial)) return "refunded";
  if (["returned", "return", "partially_returned"].includes(fulfillment)) return "returned";
  if (["refused", "failed_delivery", "delivery_failed", "undelivered"].includes(fulfillment)) return "refused";
  if (["disputed", "chargeback"].includes(financial)) return "disputed";
  if (fulfillment === "fulfilled") return "delivered";
  if (financial === "paid") return "paid";
  return financial || fulfillment || "created";
}

async function importOrder(order: HaravanOrder) {
  const items = (order.line_items ?? []).map(mapLineItem);
  const eligibleProductRevenue = calculateEligibleProductRevenue(items);
  const externalOrderId = String(order.id);
  const code = orderCode(order);

  const result = await db.$transaction(async (tx) => {
    const existing = await tx.partnerOrder.findUnique({
      include: { attributions: { where: { source: { in: VALID_ATTRIBUTION_SOURCES } } } },
      where: { externalOrderId },
    });
    const hasManualAttribution = existing?.attributions.some(
      (attribution) => attribution.source === ATTRIBUTION_SOURCES.MANUAL,
    );
    const attribution = hasManualAttribution
      ? {
          partnerCode: null,
          source: ATTRIBUTION_SOURCES.MANUAL,
          value: undefined,
          note: "Existing manual attribution was preserved.",
        }
      : await resolveHaravanAttribution(tx, order);
    const partnerId = hasManualAttribution
      ? existing?.partnerId
      : attribution.partnerCode?.partnerId;

    const partnerOrder = await tx.partnerOrder.upsert({
      where: { externalOrderId },
      update: {
        ...(partnerId !== undefined ? { partnerId } : {}),
        orderCode: code,
        customerName: customerName(order),
        status: mapStatus(order),
        eligibleProductRevenue,
        discountAmount:
          toVnd(order.total_discounts) ||
          items.reduce((sum, item) => sum + item.discountAmount, 0),
        shippingFee: shippingFee(order),
        paidAt:
          order.financial_status === "paid"
            ? parseDate(
                order.processed_at ?? order.updated_at ?? order.created_at,
              )
            : undefined,
        deliveredAt:
          order.fulfillment_status === "fulfilled"
            ? parseDate(order.closed_at ?? order.updated_at)
            : undefined,
        cancelledAt: parseDate(order.cancelled_at),
      },
      create: {
        partnerId,
        externalOrderId,
        orderCode: code,
        customerName: customerName(order),
        status: mapStatus(order),
        eligibleProductRevenue,
        discountAmount:
          toVnd(order.total_discounts) ||
          items.reduce((sum, item) => sum + item.discountAmount, 0),
        shippingFee: shippingFee(order),
        paidAt:
          order.financial_status === "paid"
            ? parseDate(
                order.processed_at ?? order.updated_at ?? order.created_at,
              )
            : undefined,
        deliveredAt:
          order.fulfillment_status === "fulfilled"
            ? parseDate(order.closed_at ?? order.updated_at)
            : undefined,
        cancelledAt: parseDate(order.cancelled_at),
      },
    });

    await tx.partnerOrderItem.deleteMany({
      where: { orderId: partnerOrder.id },
    });
    if (items.length > 0) {
      await tx.partnerOrderItem.createMany({
        data: items.map((item) => ({ ...item, orderId: partnerOrder.id })),
      });
    }

    if (!hasManualAttribution) {
      await tx.partnerOrderAttribution.deleteMany({
        where: {
          orderId: partnerOrder.id,
          source: {
            in: [
              ATTRIBUTION_SOURCES.AFFILIATE_LINK,
              ATTRIBUTION_SOURCES.DISCOUNT_CODE,
              ATTRIBUTION_SOURCES.SHOP_DISCOUNT_CODE,
              ATTRIBUTION_SOURCES.REFERRAL_LINK,
              ATTRIBUTION_SOURCES.IMPORTED,
              ATTRIBUTION_SOURCES.ORDER_REQUEST,
            ],
          },
        },
      });
      if (attribution.partnerCode && attribution.source) {
        await tx.partnerOrderAttribution.create({
          data: {
            orderId: partnerOrder.id,
            partnerCodeId: attribution.partnerCode.id,
            source: attribution.source,
            value: attribution.value,
            note: attribution.note,
          },
        });
      }
    }

    if (
      !hasManualAttribution &&
      attribution.partnerCode &&
      existing?.partnerId !== attribution.partnerCode.partnerId
    ) {
      await tx.adminAuditLog.create({
        data: {
          partnerId: attribution.partnerCode.partnerId,
          action: `order.attribution.${attribution.source}`,
          entityType: "PartnerOrder",
          entityId: partnerOrder.id,
          beforeJson: { partnerId: existing?.partnerId ?? null },
          afterJson: {
            partnerId: attribution.partnerCode.partnerId,
            code: attribution.value,
            source: attribution.source,
          },
          note: "Haravan order sync attributed order by configured attribution priority.",
        },
      });
    }

    const candidates = extractHaravanAttributionCandidates(order);
    const hadCandidate = candidates.explicit.length > 0 || candidates.landing.length > 0 || candidates.discounts.length > 0;

    return {
      orderId: partnerOrder.id,
      attributed: Boolean(attribution.partnerCode),
      skipped: !attribution.partnerCode && hadCandidate,
    };
  });

  return result;
}

export async function syncHaravanOrders(
  client = new HaravanClient(),
): Promise<HaravanSyncResult> {
  if (!hasDatabaseUrl()) {
    return {
      ok: false,
      message: "DATABASE_URL is required for Haravan order sync.",
      syncedOrders: 0,
      attributedOrders: 0,
      skippedOrders: 0,
    };
  }

  const log = await db.haravanSyncLog.create({
    data: { syncType: "orders", status: "running" },
  });
  const summary: SyncSummary = {
    syncedOrders: 0,
    attributedOrders: 0,
    skippedOrders: 0,
  };

  try {
    const orders = await client.listOrders();
    for (const order of orders) {
      const result = await importOrder(order);
      await recalculateOrderCommission(result.orderId);
      summary.syncedOrders += 1;
      if (result.attributed) summary.attributedOrders += 1;
      if (result.skipped) summary.skippedOrders += 1;
    }

    await db.haravanSyncLog.update({
      where: { id: log.id },
      data: {
        status: "success",
        finishedAt: new Date(),
        message: `Imported ${summary.syncedOrders} Haravan orders.`,
        metadata: summary,
      },
    });

    return {
      ok: true,
      message: `Imported ${summary.syncedOrders} Haravan orders.`,
      ...summary,
      logId: log.id,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Haravan sync error";
    await db.haravanSyncLog.update({
      where: { id: log.id },
      data: {
        status: "failed",
        finishedAt: new Date(),
        message,
        metadata: summary,
      },
    });
    return { ok: false, message, ...summary, logId: log.id };
  }
}
