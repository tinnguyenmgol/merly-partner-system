import { recalculateOrderCommission } from "@/features/commissions";
import { db, hasDatabaseUrl } from "@/lib/db";
import { calculateEligibleProductRevenue } from "@/lib/money";
import { HaravanClient } from "./haravan-client";
import type { HaravanLineItem, HaravanMoney, HaravanOrder, HaravanSyncResult } from "./types";

const REFERRAL_PARTNER_TYPE = "referral_ctv" as const;

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
  return customer.name ?? ([customer.first_name, customer.last_name].filter(Boolean).join(" ") || undefined);
}

function orderCode(order: HaravanOrder) {
  return String(order.order_code ?? order.name ?? order.order_number ?? order.id);
}

function normalizeCode(code?: string | null) {
  return code?.trim().toUpperCase() || undefined;
}

function firstDiscountCode(order: HaravanOrder) {
  return order.discount_codes?.map((discount) => normalizeCode(discount.code)).find(Boolean);
}

function lineDiscountAmount(item: HaravanLineItem) {
  const allocationDiscount = item.discount_allocations?.reduce((sum, allocation) => sum + toVnd(allocation.amount), 0) ?? 0;
  return allocationDiscount || toVnd(item.total_discount);
}

function mapLineItem(item: HaravanLineItem) {
  const quantity = item.quantity && item.quantity > 0 ? item.quantity : 1;
  const unitPrice = toVnd(item.price || (item.line_price ? toVnd(item.line_price) / quantity : 0));
  const discountAmount = lineDiscountAmount(item);

  return {
    sku: item.sku || undefined,
    productName: item.title ?? item.product_title ?? item.name ?? item.sku ?? "Haravan product",
    quantity,
    unitPrice,
    discountAmount,
    eligibleRevenue: Math.max(unitPrice * quantity - discountAmount, 0),
  };
}

function shippingFee(order: HaravanOrder) {
  const shippingSetAmount = toVnd(order.total_shipping_price_set?.shop_money?.amount);
  if (shippingSetAmount > 0) return shippingSetAmount;
  return order.shipping_lines?.reduce((sum, line) => sum + toVnd(line.price), 0) ?? 0;
}

function mapStatus(order: HaravanOrder) {
  if (order.cancelled_at) return "cancelled";
  if (order.fulfillment_status === "fulfilled") return "delivered";
  if (order.financial_status === "paid") return "paid";
  return order.financial_status || order.fulfillment_status || "created";
}

async function importOrder(order: HaravanOrder) {
  const discountCode = firstDiscountCode(order);
  const partnerCode = discountCode
    ? await db.partnerCode.findFirst({
        include: { partner: { include: { partnerType: true } } },
        where: {
          active: true,
          code: discountCode,
          partner: { status: "approved", partnerType: { code: REFERRAL_PARTNER_TYPE, enabled: true } },
        },
      })
    : null;

  const items = (order.line_items ?? []).map(mapLineItem);
  const eligibleProductRevenue = calculateEligibleProductRevenue(items);
  const externalOrderId = String(order.id);
  const code = orderCode(order);

  const partnerOrderId = await db.$transaction(async (tx) => {
    const existing = await tx.partnerOrder.findUnique({ where: { externalOrderId } });
    const partnerOrder = await tx.partnerOrder.upsert({
      where: { externalOrderId },
      update: {
        partnerId: partnerCode?.partnerId,
        orderCode: code,
        customerName: customerName(order),
        status: mapStatus(order),
        eligibleProductRevenue,
        discountAmount: toVnd(order.total_discounts) || items.reduce((sum, item) => sum + item.discountAmount, 0),
        shippingFee: shippingFee(order),
        paidAt: order.financial_status === "paid" ? parseDate(order.processed_at ?? order.updated_at ?? order.created_at) : undefined,
        deliveredAt: order.fulfillment_status === "fulfilled" ? parseDate(order.closed_at ?? order.updated_at) : undefined,
        cancelledAt: parseDate(order.cancelled_at),
      },
      create: {
        partnerId: partnerCode?.partnerId,
        externalOrderId,
        orderCode: code,
        customerName: customerName(order),
        status: mapStatus(order),
        eligibleProductRevenue,
        discountAmount: toVnd(order.total_discounts) || items.reduce((sum, item) => sum + item.discountAmount, 0),
        shippingFee: shippingFee(order),
        paidAt: order.financial_status === "paid" ? parseDate(order.processed_at ?? order.updated_at ?? order.created_at) : undefined,
        deliveredAt: order.fulfillment_status === "fulfilled" ? parseDate(order.closed_at ?? order.updated_at) : undefined,
        cancelledAt: parseDate(order.cancelled_at),
      },
    });

    await tx.partnerOrderItem.deleteMany({ where: { orderId: partnerOrder.id } });
    if (items.length > 0) {
      await tx.partnerOrderItem.createMany({ data: items.map((item) => ({ ...item, orderId: partnerOrder.id })) });
    }

    await tx.partnerOrderAttribution.deleteMany({ where: { orderId: partnerOrder.id, source: "discount_code" } });
    if (discountCode) {
      await tx.partnerOrderAttribution.create({
        data: {
          orderId: partnerOrder.id,
          partnerCodeId: partnerCode?.id,
          source: "discount_code",
          value: discountCode,
          note: partnerCode ? "Matched active approved referral_ctv partner code during Haravan sync." : "No active approved referral_ctv partner code matched during Haravan sync.",
        },
      });
    }

    if (partnerCode && existing?.partnerId !== partnerCode.partnerId) {
      await tx.adminAuditLog.create({
        data: {
          partnerId: partnerCode.partnerId,
          action: "order.attribution.haravan_discount_code",
          entityType: "PartnerOrder",
          entityId: partnerOrder.id,
          beforeJson: { partnerId: existing?.partnerId ?? null },
          afterJson: { partnerId: partnerCode.partnerId, discountCode },
          note: "Haravan order sync attributed order by discount code.",
        },
      });
    }

    return partnerOrder.id;
  });

  if (partnerCode) {
    await recalculateOrderCommission(partnerOrderId);
  }

  return { attributed: Boolean(partnerCode), skipped: Boolean(discountCode && !partnerCode) };
}

export async function syncHaravanOrders(client = new HaravanClient()): Promise<HaravanSyncResult> {
  if (!hasDatabaseUrl()) {
    return { ok: false, message: "DATABASE_URL is required for Haravan order sync.", syncedOrders: 0, attributedOrders: 0, skippedOrders: 0 };
  }

  const log = await db.haravanSyncLog.create({ data: { syncType: "orders", status: "running" } });
  const summary: SyncSummary = { syncedOrders: 0, attributedOrders: 0, skippedOrders: 0 };

  try {
    const orders = await client.listOrders();
    for (const order of orders) {
      const result = await importOrder(order);
      summary.syncedOrders += 1;
      if (result.attributed) summary.attributedOrders += 1;
      if (result.skipped) summary.skippedOrders += 1;
    }

    await db.haravanSyncLog.update({
      where: { id: log.id },
      data: { status: "success", finishedAt: new Date(), message: `Imported ${summary.syncedOrders} Haravan orders.`, metadata: summary },
    });

    return { ok: true, message: `Imported ${summary.syncedOrders} Haravan orders.`, ...summary, logId: log.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Haravan sync error";
    await db.haravanSyncLog.update({ where: { id: log.id }, data: { status: "failed", finishedAt: new Date(), message, metadata: summary } });
    return { ok: false, message, ...summary, logId: log.id };
  }
}
