import { PayoutStatus, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recalculateOpenCommissions, isOrderCommissionEligible } from "@/features/commissions";
import { syncHaravanOrders } from "@/features/haravan/order-sync";
import { getCurrentPartnerSession } from "@/features/auth/partner-auth";
import { db } from "@/lib/db";

export const DEFAULT_MINIMUM_PAYOUT_AMOUNT = 100_000;
export const ACTIVE_PAYOUT_STATUSES: PayoutStatus[] = ["pending", "approved"];
export const PAYOUT_STATUS_LABELS: Record<PayoutStatus, string> = {
  draft: "Nháp",
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  paid: "Đã thanh toán",
  rejected: "Từ chối",
  cancelled: "Đã hủy",
};

const INVALID_ORDER_WARNING = "Đơn đã hủy sau khi hoa hồng đã thanh toán - cần đối soát thủ công.";
const APPROVAL_GATE_WARNING = "Cần đồng bộ Haravan và đối soát hoa hồng trước khi duyệt thanh toán.";
const staleMs = 30 * 60 * 1000;

export function hasBankInfo(profile?: { bankName: string | null; bankAccountNumber: string | null; bankAccountHolder: string | null } | null) {
  return Boolean(profile?.bankName && profile.bankAccountNumber && profile.bankAccountHolder);
}

export function isFresh(date?: Date | null) {
  return Boolean(date && Date.now() - date.getTime() <= staleMs);
}

export async function getLastPayoutReconciliationAt() {
  const [sync, recalc] = await Promise.all([
    db.haravanSyncLog.findFirst({ where: { syncType: { in: ["orders", "payout_approval_gate"] }, status: "success" }, orderBy: { finishedAt: "desc" } }),
    db.adminAuditLog.findFirst({ where: { action: { in: ["commission.recalculate", "payout.reconcile_before_approve"] } }, orderBy: { createdAt: "desc" } }),
  ]);
  const lastSyncAt = sync?.finishedAt ?? null;
  const lastRecalculateAt = recalc?.createdAt ?? null;
  return { lastSyncAt, lastRecalculateAt, fresh: isFresh(lastSyncAt) && isFresh(lastRecalculateAt), warning: APPROVAL_GATE_WARNING };
}

async function findPayableLedgers(tx: Prisma.TransactionClient, partnerId: string) {
  const ledgers = await tx.partnerCommissionLedger.findMany({
    where: { partnerId, status: "payable", payoutItems: { none: { payout: { status: { in: ACTIVE_PAYOUT_STATUSES } } } } },
    include: { order: true },
    orderBy: { availableAt: "asc" },
  });
  return ledgers.filter((ledger) => !ledger.order || isOrderCommissionEligible(ledger.order));
}

export async function getPartnerPayoutDashboard(partnerId: string) {
  const partner = await db.partner.findUnique({
    where: { id: partnerId },
    include: {
      profile: true,
      ledgerEntries: { where: { status: "payable", payoutItems: { none: { payout: { status: { in: ACTIVE_PAYOUT_STATUSES } } } } }, include: { order: true } },
      payouts: { include: { items: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!partner) throw new Error("Partner not found");
  const payableLedgers = partner.ledgerEntries.filter((ledger) => !ledger.order || isOrderCommissionEligible(ledger.order));
  const payableBalance = payableLedgers.reduce((sum, ledger) => sum + ledger.amount, 0);
  const paidTotal = partner.payouts.filter((p) => p.status === "paid").reduce((sum, p) => sum + p.amount, 0);
  const pendingPayoutAmount = partner.payouts.filter((p) => ACTIVE_PAYOUT_STATUSES.includes(p.status)).reduce((sum, p) => sum + p.amount, 0);
  const rejectedPayoutAmount = partner.payouts.filter((p) => p.status === "rejected").reduce((sum, p) => sum + p.amount, 0);
  return { partner, payableBalance, minimumPayoutAmount: DEFAULT_MINIMUM_PAYOUT_AMOUNT, paidTotal, pendingPayoutAmount, rejectedPayoutAmount, payoutHistory: partner.payouts };
}

export async function createPayoutRequestAction() {
  "use server";
  const session = await getCurrentPartnerSession();
  if (!session) redirect("/dang-nhap");
  await db.$transaction(async (tx) => {
    const partner = await tx.partner.findUnique({ where: { id: session.account.partnerId }, include: { profile: true } });
    if (!partner || !hasBankInfo(partner.profile)) throw new Error("Vui lòng bổ sung thông tin tài khoản ngân hàng trước khi yêu cầu thanh toán.");
    const ledgers = await findPayableLedgers(tx, partner.id);
    const amount = ledgers.reduce((sum, ledger) => sum + ledger.amount, 0);
    if (amount < DEFAULT_MINIMUM_PAYOUT_AMOUNT) throw new Error("Chưa đủ mức thanh toán tối thiểu 100.000đ, hoa hồng sẽ được cộng dồn.");
    const now = new Date();
    await tx.partnerPayout.create({
      data: { partnerId: partner.id, status: "pending", periodStart: ledgers[0]?.availableAt ?? now, periodEnd: now, amount, minimumPayoutAmount: DEFAULT_MINIMUM_PAYOUT_AMOUNT, requestedAt: now, items: { create: ledgers.map((l) => ({ ledgerId: l.id, amount: l.amount })) } },
    });
  });
  revalidatePath("/dashboard/thanh-toan");
}

export async function reconcilePayoutBeforeApproveAction(formData: FormData) {
  "use server";
  const payoutId = String(formData.get("payoutId") ?? "");
  await syncHaravanOrders();
  await recalculateOpenCommissions();
  await refreshPayoutItems(payoutId);
  await db.adminAuditLog.create({ data: { action: "payout.reconcile_before_approve", entityType: "PartnerPayout", entityId: payoutId, note: "Đồng bộ Haravan và đối soát lại trước khi duyệt thanh toán." } });
  revalidatePath("/admin/payouts");
}

export async function refreshPayoutItems(payoutId: string) {
  await db.$transaction(async (tx) => {
    const payout = await tx.partnerPayout.findUnique({ where: { id: payoutId }, include: { items: { include: { ledger: { include: { order: true } } } } } });
    if (!payout || payout.status !== "pending") return;
    const invalid = payout.items.filter((item) => item.ledger.status !== "payable" || (item.ledger.order && !isOrderCommissionEligible(item.ledger.order)));
    if (invalid.length) await tx.partnerPayoutItem.deleteMany({ where: { id: { in: invalid.map((i) => i.id) } } });
    const remaining = payout.items.filter((item) => !invalid.some((i) => i.id === item.id));
    await tx.partnerPayout.update({ where: { id: payoutId }, data: { amount: remaining.reduce((s, i) => s + i.amount, 0), lastReconciledAt: new Date() } });
  });
}

export async function approvePayoutAction(formData: FormData) {
  "use server";
  const payoutId = String(formData.get("payoutId") ?? "");
  const gate = await getLastPayoutReconciliationAt();
  if (!gate.fresh) throw new Error(APPROVAL_GATE_WARNING);
  await db.$transaction(async (tx) => {
    const payout = await tx.partnerPayout.findUnique({ where: { id: payoutId }, include: { items: { include: { ledger: { include: { order: true } } } } } });
    if (!payout || payout.status !== "pending") throw new Error("Payout không ở trạng thái chờ duyệt.");
    const invalid = payout.items.find((item) => item.ledger.status !== "payable" || (item.ledger.order && !isOrderCommissionEligible(item.ledger.order)));
    if (invalid) throw new Error("Có đơn đã hủy/hoàn/từ chối. Cần đối soát lại trước khi duyệt.");
    await tx.partnerPayout.update({ where: { id: payoutId }, data: { status: "approved", approvedAt: new Date() } });
    await tx.adminAuditLog.create({ data: { partnerId: payout.partnerId, action: "payout.approve", entityType: "PartnerPayout", entityId: payoutId, beforeJson: { status: payout.status }, afterJson: { status: "approved" } } });
  });
  revalidatePath("/admin/payouts");
}

export async function rejectPayoutAction(formData: FormData) {
  "use server"; await closePayout(formData, "rejected", "payout.reject"); }
export async function cancelPayoutAction(formData: FormData) {
  "use server"; await closePayout(formData, "cancelled", "payout.cancel"); }
async function closePayout(formData: FormData, status: "rejected" | "cancelled", action: string) {
  const payoutId = String(formData.get("payoutId") ?? ""); const reason = String(formData.get("reason") ?? "");
  await db.$transaction([db.partnerPayout.update({ where: { id: payoutId }, data: { status, rejectedAt: status === "rejected" ? new Date() : undefined, rejectReason: reason || undefined } }), db.partnerPayoutItem.deleteMany({ where: { payoutId } }), db.adminAuditLog.create({ data: { action, entityType: "PartnerPayout", entityId: payoutId, afterJson: { status, reason }, note: reason || null } })]);
  revalidatePath("/admin/payouts");
}

export async function markPayoutPaidAction(formData: FormData) {
  "use server";
  const payoutId = String(formData.get("payoutId") ?? "");
  await db.$transaction(async (tx) => {
    const payout = await tx.partnerPayout.findUnique({ where: { id: payoutId }, include: { items: true } });
    if (!payout || payout.status !== "approved") throw new Error("Chỉ payout đã duyệt mới được đánh dấu đã thanh toán.");
    const now = new Date();
    await tx.partnerPayout.update({ where: { id: payoutId }, data: { status: "paid", paidAt: now } });
    await tx.partnerCommissionLedger.updateMany({ where: { id: { in: payout.items.map((i) => i.ledgerId) }, status: "payable" }, data: { status: "paid", paidAt: now } });
    await tx.adminAuditLog.create({ data: { partnerId: payout.partnerId, action: "payout.mark_paid", entityType: "PartnerPayout", entityId: payoutId, beforeJson: { status: payout.status }, afterJson: { status: "paid" }, note: INVALID_ORDER_WARNING } });
  });
  revalidatePath("/admin/payouts");
}
