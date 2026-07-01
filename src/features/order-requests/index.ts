import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PartnerOrderRequestStatus } from "@prisma/client";
import { recalculateOrderCommission } from "@/features/commissions";
import { requirePartnerSession } from "@/features/auth/partner-auth";
import { db } from "@/lib/db";

export const ORDER_REQUEST_STATUS_LABELS: Record<PartnerOrderRequestStatus, string> = {
  pending: "Chờ kiểm tra",
  matched: "Đã gắn đơn",
  approved: "Đã duyệt",
  rejected: "Từ chối",
  cancelled: "Đã hủy",
};


function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function intValue(formData: FormData, key: string) {
  const raw = text(formData, key);
  if (!raw) return null;
  const parsed = Number.parseInt(raw.replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export async function createOrderRequest(formData: FormData) {
  "use server";
  const session = await requirePartnerSession();
  await db.partnerOrderRequest.create({
    data: {
      partnerId: session.account.partnerId,
      orderCode: text(formData, "orderCode"),
      contactHint: text(formData, "contactHint"),
      expectedAmount: intValue(formData, "expectedAmount"),
      note: text(formData, "note"),
    },
  });
  revalidatePath("/dashboard/yeu-cau-gan-don");
  redirect("/dashboard/yeu-cau-gan-don?created=1");
}

export async function adminMatchOrderRequest(formData: FormData) {
  "use server";
  const requestId = text(formData, "requestId");
  const matchedOrderId = text(formData, "matchedOrderId");
  const adminNote = text(formData, "adminNote");
  if (!requestId || !matchedOrderId) return;
  await db.$transaction(async (tx) => {
    const before = await tx.partnerOrderRequest.findUnique({ where: { id: requestId } });
    if (!before) return;
    const after = await tx.partnerOrderRequest.update({
      where: { id: requestId },
      data: { matchedOrderId, adminNote, status: before.status === "approved" ? "approved" : "matched" },
    });
    await tx.adminAuditLog.create({
      data: {
        partnerId: after.partnerId,
        action: "order_request.match",
        entityType: "PartnerOrderRequest",
        entityId: after.id,
        beforeJson: { status: before.status, matchedOrderId: before.matchedOrderId },
        afterJson: { status: after.status, matchedOrderId: after.matchedOrderId },
        note: adminNote ?? "Matched order request to existing PartnerOrder.",
      },
    });
  });
  revalidatePath("/admin/order-requests");
}

export async function adminApproveOrderRequest(formData: FormData) {
  "use server";
  const requestId = text(formData, "requestId");
  const adminNote = text(formData, "adminNote");
  if (!requestId) return;
  const result = await db.$transaction(async (tx) => {
    const request = await tx.partnerOrderRequest.findUnique({
      where: { id: requestId },
      include: { matchedOrder: { include: { attributions: true } } },
    });
    if (!request?.matchedOrderId || !request.matchedOrder) return { ok: false, reason: "Vui lòng gắn đơn trước khi duyệt." };
    const order = request.matchedOrder;
    const wasUnattributed = !order.partnerId;
    const existingOtherAttribution = order.partnerId && order.partnerId !== request.partnerId;
    const hasManualAttribution = order.attributions.some((a) => a.source === "manual");
    const hasSameOrderRequest = order.partnerId === request.partnerId && order.attributions.some((a) => a.source === "order_request");
    if (existingOtherAttribution || hasManualAttribution) return { ok: false, reason: "Đơn này đã được gắn với CTV/đối tác khác." };
    const beforeRequest = { status: request.status, matchedOrderId: request.matchedOrderId };
    if (!order.partnerId) {
      await tx.partnerOrder.update({ where: { id: order.id }, data: { partnerId: request.partnerId } });
    }
    if (wasUnattributed && !hasSameOrderRequest) {
      await tx.partnerOrderAttribution.create({
        data: { orderId: order.id, source: "order_request", value: request.orderCode ?? order.orderCode, note: `Approved order request ${request.id}` },
      });
    }
    const approved = await tx.partnerOrderRequest.update({
      where: { id: request.id },
      data: { status: "approved", adminNote, approvedAt: new Date(), rejectReason: null },
    });
    await tx.adminAuditLog.create({
      data: {
        partnerId: request.partnerId,
        action: "order_request.approve",
        entityType: "PartnerOrderRequest",
        entityId: request.id,
        beforeJson: beforeRequest,
        afterJson: { status: approved.status, matchedOrderId: approved.matchedOrderId, orderId: order.id, attributionSource: "order_request" },
        note: adminNote ?? "Approved order request and triggered commission recalculation.",
      },
    });
    return { ok: true, orderId: order.id };
  });
  const message = result.ok ? "Đã duyệt yêu cầu." : (result.reason ?? "Không thể duyệt yêu cầu.");
  if (result.ok && result.orderId) await recalculateOrderCommission(result.orderId);
  revalidatePath("/admin/order-requests");
  redirect(`/admin/order-requests?message=${encodeURIComponent(message)}`);
}

export async function adminRejectOrderRequest(formData: FormData) {
  "use server";
  await adminSetTerminalStatus(formData, "rejected");
}
export async function adminCancelOrderRequest(formData: FormData) {
  "use server";
  await adminSetTerminalStatus(formData, "cancelled");
}
async function adminSetTerminalStatus(formData: FormData, status: "rejected" | "cancelled") {
  const requestId = text(formData, "requestId");
  const reason = text(formData, "rejectReason") ?? text(formData, "adminNote");
  if (!requestId) return;
  await db.$transaction(async (tx) => {
    const before = await tx.partnerOrderRequest.findUnique({ where: { id: requestId } });
    if (!before) return;
    const after = await tx.partnerOrderRequest.update({
      where: { id: requestId },
      data: { status, rejectReason: reason, adminNote: text(formData, "adminNote"), rejectedAt: status === "rejected" ? new Date() : before.rejectedAt },
    });
    await tx.adminAuditLog.create({ data: { partnerId: after.partnerId, action: `order_request.${status}`, entityType: "PartnerOrderRequest", entityId: after.id, beforeJson: { status: before.status }, afterJson: { status: after.status }, note: reason } });
  });
  revalidatePath("/admin/order-requests");
}
