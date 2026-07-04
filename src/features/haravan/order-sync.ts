import { ATTRIBUTION_SOURCES, VALID_ATTRIBUTION_SOURCES } from "@/features/partners/attribution-sources";
import { db, hasDatabaseUrl } from "@/lib/db";
import { recalculateOrderCommission } from "@/features/commissions";
import { calculateEligibleProductRevenue } from "@/lib/money";
import { createAdminNotification } from "@/features/notifications";
import { sendAdminAlertEmail } from "@/features/notification-email";
import { HaravanClient } from "./haravan-client";
import { getHaravanOrderSyncSettings, normalizeSourceValue, type HaravanOrderSyncSettings } from "./settings";
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

type SyncSummary = Omit<HaravanSyncResult, "ok" | "message" | "logId"> & { updatedOrders?: number; reversalOrders?: number; sourceSkippedOrders?: number; noSignalSkippedOrders?: number };

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

export function extractHaravanOrderSourceValues(order: HaravanOrder) {
  const raw = [
    order.source_name, order.source, order.source_identifier, order.gateway, order.processing_method,
    ...(order.tags ? order.tags.split(",") : []),
  ].filter(Boolean).map(String);
  return Array.from(new Set(raw.map((v) => v.trim()).filter(Boolean)));
}

function orderHasPartnerSignal(order: HaravanOrder) {
  const candidates = extractHaravanAttributionCandidates(order);
  return candidates.explicit.length > 0 || candidates.landing.length > 0 || candidates.discounts.length > 0;
}

function isCancellationLike(order: HaravanOrder) { return ["cancelled", "returned", "refunded", "refused", "disputed"].includes(mapStatus(order)); }

async function existingPartnerOrderId(order: HaravanOrder) {
  return db.partnerOrder.findUnique({ where: { externalOrderId: String(order.id) }, select: { id: true } });
}

export async function shouldProcessHaravanOrder(order: HaravanOrder, settings: HaravanOrderSyncSettings) {
  const existing = await existingPartnerOrderId(order);
  if (existing && settings.syncCancelledOrdersForReversal && isCancellationLike(order)) return { process: true, reason: "existing_reversal", existingOrderId: existing.id };
  const sources = extractHaravanOrderSourceValues(order).map(normalizeSourceValue);
  const allowed = settings.allowedOrderSources.map(normalizeSourceValue).filter(Boolean);
  const excluded = settings.excludedOrderSources.map(normalizeSourceValue).filter(Boolean);
  if (excluded.length && sources.some((source) => excluded.includes(source))) return { process: false, reason: "source_excluded", sources };
  if (allowed.length && !sources.some((source) => allowed.includes(source))) return { process: false, reason: "source_not_allowed", sources };
  const financial = normalizeSourceValue(order.financial_status);
  const fulfillment = normalizeSourceValue(order.fulfillment_status);
  if (settings.allowedFinancialStatuses.length && !settings.allowedFinancialStatuses.map(normalizeSourceValue).includes(financial)) return { process: false, reason: "financial_status_not_allowed", sources };
  if (settings.allowedFulfillmentStatuses.length && !settings.allowedFulfillmentStatuses.map(normalizeSourceValue).includes(fulfillment)) return { process: false, reason: "fulfillment_status_not_allowed", sources };
  const hasSignal = orderHasPartnerSignal(order);
  if (settings.onlyOrdersWithPartnerSignals && !hasSignal && !settings.syncUnattributedOrders) return { process: false, reason: "no_partner_signal", sources };
  return { process: true, reason: hasSignal ? "partner_signal" : "scope_allows_unattributed", sources };
}

export async function importHaravanOrder(order: HaravanOrder) {
  const protectedAttributionSources = [ATTRIBUTION_SOURCES.MANUAL, ATTRIBUTION_SOURCES.ORDER_REQUEST] as const;
  const items = (order.line_items ?? []).map(mapLineItem);
  const eligibleProductRevenue = calculateEligibleProductRevenue(items);
  const externalOrderId = String(order.id);
  const code = orderCode(order);

  const result = await db.$transaction(async (tx) => {
    const existing = await tx.partnerOrder.findUnique({
      include: { attributions: { where: { source: { in: VALID_ATTRIBUTION_SOURCES } } } },
      where: { externalOrderId },
    });
    const hasProtectedAttribution = existing?.attributions.some(
      (attribution) => protectedAttributionSources.includes(attribution.source as (typeof protectedAttributionSources)[number]),
    );
    const attribution = hasProtectedAttribution
      ? {
          partnerCode: null,
          source: existing?.attributions.find((row) => protectedAttributionSources.includes(row.source as (typeof protectedAttributionSources)[number]))?.source,
          value: undefined,
          note: "Existing manual/order_request attribution was preserved.",
        }
      : await resolveHaravanAttribution(tx, order);
    const existingAttribution = existing?.attributions[0];
    const hasDifferentExistingAttribution = Boolean(
      !hasProtectedAttribution &&
        existingAttribution &&
        attribution.partnerCode &&
        (existingAttribution.partnerCodeId !== attribution.partnerCode.id || existingAttribution.source !== attribution.source),
    );
    // Attribution priority: manual/order_request are protected. On later syncs, a different
    // automatic candidate is not overwritten silently; preserve existing partnerId and audit.
    const partnerId = hasProtectedAttribution || hasDifferentExistingAttribution
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

    if (!hasProtectedAttribution && !hasDifferentExistingAttribution) {
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

    if (hasDifferentExistingAttribution && existingAttribution && attribution.partnerCode) {
      await tx.adminAuditLog.create({
        data: {
          partnerId: existing?.partnerId ?? attribution.partnerCode.partnerId,
          action: "order.attribution_conflict_preserved",
          entityType: "PartnerOrder",
          entityId: partnerOrder.id,
          beforeJson: { partnerId: existing?.partnerId ?? null, source: existingAttribution.source, partnerCodeId: existingAttribution.partnerCodeId },
          afterJson: { candidatePartnerId: attribution.partnerCode.partnerId, candidateSource: attribution.source, candidateCode: attribution.value },
          note: "Haravan sync found a different non-manual attribution candidate and preserved the existing attribution for manual review.",
        },
      });
    }

    if (
      !hasProtectedAttribution &&
      !hasDifferentExistingAttribution &&
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

export async function syncHaravanOrderByCode(
  orderCode: string,
  client = new HaravanClient(),
): Promise<HaravanSyncResult & { orderId?: string; found: boolean }> {
  if (!hasDatabaseUrl()) {
    return { ok: false, found: false, message: "DATABASE_URL is required for Haravan order sync.", syncedOrders: 0, attributedOrders: 0, skippedOrders: 0 };
  }

  const log = await db.haravanSyncLog.create({
    data: { syncType: "order_by_code", status: "running", metadata: { orderCode } },
  });
  const summary: SyncSummary = { syncedOrders: 0, attributedOrders: 0, skippedOrders: 0, updatedOrders: 0, reversalOrders: 0, sourceSkippedOrders: 0, noSignalSkippedOrders: 0 };

  try {
    const order = await client.findOrderByCode(orderCode);
    if (!order) {
      await db.haravanSyncLog.update({
        where: { id: log.id },
        data: { status: "success", finishedAt: new Date(), message: "Order not found by code.", metadata: { orderCode, found: false, ...summary } },
      });
      return { ok: true, found: false, message: "Order not found by code.", ...summary, logId: log.id };
    }

    const result = await importHaravanOrder(order);
    await recalculateOrderCommission(result.orderId);
    summary.syncedOrders = 1;
    if (result.attributed) summary.attributedOrders = 1;
    if (result.skipped) summary.skippedOrders = 1;

    await db.haravanSyncLog.update({
      where: { id: log.id },
      data: { status: "success", finishedAt: new Date(), message: "Imported one Haravan order by code.", metadata: { orderCode, found: true, orderId: result.orderId, ...summary } },
    });
    return { ok: true, found: true, message: "Imported one Haravan order by code.", ...summary, logId: log.id, orderId: result.orderId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Haravan sync error";
    await db.haravanSyncLog.update({
      where: { id: log.id },
      data: { status: "failed", finishedAt: new Date(), message, metadata: { orderCode, ...summary } },
    });
    return { ok: false, found: false, message, ...summary, logId: log.id };
  }
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
  const settings = await getHaravanOrderSyncSettings();
  const summary: SyncSummary = {
    syncedOrders: 0,
    attributedOrders: 0,
    skippedOrders: 0,
    updatedOrders: 0,
    reversalOrders: 0,
    sourceSkippedOrders: 0,
    noSignalSkippedOrders: 0,
  };

  const observedSources: Record<string, number> = {};

  try {
    if (!settings.orderSyncEnabled) throw new Error("Haravan order sync is disabled in settings.");
    const updatedAtMin = new Date(Date.now() - settings.orderSyncLookbackDays * 24 * 60 * 60 * 1000);
    const orders = await client.listOrders({ updatedAtMin });
    for (const order of orders) {
      for (const source of extractHaravanOrderSourceValues(order)) observedSources[source] = (observedSources[source] ?? 0) + 1;
      const decision = await shouldProcessHaravanOrder(order, settings);
      if (!decision.process) {
        summary.skippedOrders += 1;
        if (decision.reason === "no_partner_signal") summary.noSignalSkippedOrders = (summary.noSignalSkippedOrders ?? 0) + 1;
        else summary.sourceSkippedOrders = (summary.sourceSkippedOrders ?? 0) + 1;
        continue;
      }
      const result = await importHaravanOrder(order);
      await recalculateOrderCommission(result.orderId);
      summary.syncedOrders += 1;
      if (result.attributed) summary.attributedOrders += 1;
      if (result.skipped) summary.skippedOrders += 1;
      if (decision.reason === "existing_reversal") summary.reversalOrders = (summary.reversalOrders ?? 0) + 1;
    }

    await db.haravanSyncLog.update({
      where: { id: log.id },
      data: {
        status: "success",
        finishedAt: new Date(),
        message: `Imported ${summary.syncedOrders} Haravan orders.`,
        metadata: { ...summary, settings, observedSources },
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
        metadata: { ...summary, settings, observedSources },
      },
    });
    await createAdminNotification({ type: "haravan.sync.failed", title: "Haravan sync lỗi", message: "Vui lòng kiểm tra cấu hình hoặc log đồng bộ Haravan.", actionUrl: "/admin/settings/haravan", severity: "urgent" });
    void sendAdminAlertEmail({ subject: "Merly Partner: Haravan sync lỗi", lines: ["Sync type: orders", `Lỗi: ${message.slice(0, 300)}`], actionPath: "/admin/settings/haravan" });
    return { ok: false, message, ...summary, logId: log.id };
  }
}
