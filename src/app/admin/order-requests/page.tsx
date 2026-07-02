import { requireAdminSession } from "@/features/auth/admin-auth";
import Link from "next/link";
import { PartnerOrderRequestStatus, Prisma } from "@prisma/client";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { adminApproveOrderRequest, adminCancelOrderRequest, adminMatchOrderRequest, adminRejectOrderRequest, adminSyncOrderRequestFromHaravan, ORDER_REQUEST_STATUS_LABELS } from "@/features/order-requests";
import { db, getDatabaseErrorMessage, hasDatabaseUrl } from "@/lib/db";
import { orderCodeVariants } from "@/features/haravan/order-code";
import { formatVnd } from "@/lib/money";

export const dynamic = "force-dynamic";

type SearchParams = { status?: string; q?: string; id?: string; message?: string };
const statuses: (PartnerOrderRequestStatus | "all")[] = ["pending", "matched", "approved", "rejected", "cancelled", "all"];

function statusFilter(value?: string): PartnerOrderRequestStatus | undefined {
  return statuses.includes(value as PartnerOrderRequestStatus) && value !== "all" ? value as PartnerOrderRequestStatus : undefined;
}

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdminSession();
  const params = await searchParams;
  const status = statusFilter(params.status) ?? (params.status ? undefined : "pending");
  const q = params.q?.trim();
  const where: Prisma.PartnerOrderRequestWhereInput = {
    ...(status ? { status } : {}),
    ...(q ? { OR: [{ orderCode: { contains: q, mode: "insensitive" } }, { partner: { displayName: { contains: q, mode: "insensitive" } } }] } : {}),
  };
  let warning: string | null = null;
  let requests: Awaited<ReturnType<typeof loadRequests>> = [];
  let selected: Awaited<ReturnType<typeof loadSelected>> = null;
  let matches: Awaited<ReturnType<typeof loadMatches>> = [];
  if (hasDatabaseUrl()) {
    try {
      requests = await loadRequests(where);
      selected = params.id ? await loadSelected(params.id) : requests[0] ? await loadSelected(requests[0].id) : null;
      matches = selected ? await loadMatches(selected.orderCode) : [];
    } catch (error) {
      console.error("Failed to load order requests", error);
      warning = getDatabaseErrorMessage(error, "Không thể tải yêu cầu gắn đơn. Vui lòng kiểm tra migration.");
    }
  }

  return <DashboardShell admin><div className="space-y-6">
    <section className="card">
      <h1 className="text-3xl font-bold text-merly-900">Yêu cầu gắn đơn</h1>
      <p className="mt-3 text-stone-600">Admin kiểm tra yêu cầu từ CTV, gắn với PartnerOrder hiện có rồi duyệt để tạo attribution nguồn order_request.</p>
      {!hasDatabaseUrl() ? <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">DATABASE_URL chưa được cấu hình.</p> : null}
      {warning ? <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{warning}</p> : null}
      {params.message ? <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-900">{params.message}</p> : null}
    </section>

    <form className="card flex flex-wrap items-end gap-3" action="/admin/order-requests">
      <label className="grid gap-1 text-sm font-medium">Trạng thái<select className="input" name="status" defaultValue={status ?? "all"}>{statuses.map((s) => <option key={s} value={s}>{s === "all" ? "Tất cả" : ORDER_REQUEST_STATUS_LABELS[s]}</option>)}</select></label>
      <label className="grid gap-1 text-sm font-medium">Tìm kiếm<input className="input" name="q" defaultValue={q ?? ""} placeholder="Mã đơn / đối tác" /></label>
      <button className="btn-secondary" type="submit">Lọc</button>
    </form>

    <div className="grid gap-6 xl:grid-cols-2">
      <section className="card overflow-x-auto">
        <h2 className="text-xl font-bold text-merly-900">Danh sách (tối đa 50)</h2>
        <table className="mt-4 min-w-full text-left text-sm"><thead className="text-stone-500"><tr><th className="p-2">Ngày</th><th className="p-2">Đối tác</th><th className="p-2">Mã đơn</th><th className="p-2">Trạng thái</th><th className="p-2">Mở</th></tr></thead><tbody>
          {requests.map((r) => <tr className="border-t border-rose-100" key={r.id}><td className="p-2">{r.createdAt.toLocaleString("vi-VN")}</td><td className="p-2">{r.partner.displayName}</td><td className="p-2">{r.orderCode ?? "—"}</td><td className="p-2">{ORDER_REQUEST_STATUS_LABELS[r.status]}</td><td className="p-2"><Link className="link" href={`/admin/order-requests?id=${r.id}&status=${status ?? "all"}&q=${encodeURIComponent(q ?? "")}`}>Chi tiết</Link></td></tr>)}
          {requests.length === 0 ? <tr><td className="p-3 text-stone-500" colSpan={5}>Không có yêu cầu.</td></tr> : null}
        </tbody></table>
      </section>

      <section className="card">
        <h2 className="text-xl font-bold text-merly-900">Chi tiết yêu cầu</h2>
        {selected ? <div className="mt-4 space-y-4 text-sm">
          <dl className="grid gap-2 md:grid-cols-2"><Info label="Đối tác" value={selected.partner.displayName}/><Info label="Trạng thái" value={ORDER_REQUEST_STATUS_LABELS[selected.status]}/><Info label="Mã đơn yêu cầu" value={selected.orderCode ?? "—"}/><Info label="Giá trị dự kiến" value={selected.expectedAmount ? formatVnd(selected.expectedAmount) : "—"}/><Info label="Gợi ý liên hệ" value={selected.contactHint ?? "—"}/><Info label="Đơn đã match" value={selected.matchedOrder?.orderCode ?? "—"}/></dl>
          <p><b>Ghi chú CTV:</b> {selected.note ?? "—"}</p>
          <p><b>Phản hồi admin:</b> {selected.rejectReason ?? selected.adminNote ?? "—"}</p>
          <form action={adminSyncOrderRequestFromHaravan} className="flex flex-wrap items-center gap-2 rounded-2xl border border-rose-100 p-4"><input type="hidden" name="requestId" value={selected.id}/><button className="btn-secondary" type="submit">Đồng bộ đơn này từ Haravan</button><span className="text-sm text-stone-500">Chỉ tìm và nhập một đơn theo mã yêu cầu.</span></form>
          {selected.matchedOrder?.partnerId && selected.matchedOrder.partnerId !== selected.partnerId ? <p className="rounded-xl bg-amber-50 p-3 font-semibold text-amber-900">Đơn này đã được gắn với CTV/đối tác khác.</p> : null}

          <div className="rounded-2xl border border-rose-100 p-4">
            <h3 className="font-bold text-merly-900">Kết quả tìm đơn (tối đa 20)</h3>
            <div className="mt-3 grid gap-2">{matches.length === 0 ? <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Chưa tìm thấy đơn trong dữ liệu đã đồng bộ. Hãy bấm Đồng bộ đơn này từ Haravan.</p> : null}{matches.map((order) => <form action={adminMatchOrderRequest} className="flex flex-wrap items-center gap-2 rounded-xl bg-rose-50 p-3" key={order.id}><input type="hidden" name="requestId" value={selected.id}/><input type="hidden" name="matchedOrderId" value={order.id}/><span className="font-semibold">{order.orderCode}</span><span>{formatVnd(order.eligibleProductRevenue)}</span><span>{order.partner?.displayName ?? "Chưa gắn"}</span><input className="input max-w-xs" name="adminNote" placeholder="Ghi chú admin"/><button className="btn-secondary" type="submit">Gắn đơn này</button></form>)}</div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <form action={adminApproveOrderRequest} className="grid gap-2"><input type="hidden" name="requestId" value={selected.id}/><input className="input" name="adminNote" placeholder="Ghi chú duyệt"/><button className="btn-primary" type="submit">Duyệt</button></form>
            <form action={adminRejectOrderRequest} className="grid gap-2"><input type="hidden" name="requestId" value={selected.id}/><input className="input" name="rejectReason" required placeholder="Lý do từ chối"/><button className="btn-secondary" type="submit">Từ chối</button></form>
            <form action={adminCancelOrderRequest} className="grid gap-2"><input type="hidden" name="requestId" value={selected.id}/><input className="input" name="adminNote" placeholder="Lý do hủy"/><button className="btn-secondary" type="submit">Hủy yêu cầu</button></form>
          </div>
        </div> : <p className="mt-4 text-stone-500">Chọn một yêu cầu để xem chi tiết.</p>}
      </section>
    </div>
  </div></DashboardShell>;
}

async function loadRequests(where: Prisma.PartnerOrderRequestWhereInput) {
  return db.partnerOrderRequest.findMany({ where, select: { id: true, createdAt: true, orderCode: true, status: true, partner: { select: { displayName: true } } }, orderBy: { createdAt: "desc" }, take: 50 });
}
async function loadSelected(id: string) {
  return db.partnerOrderRequest.findUnique({ where: { id }, include: { partner: { select: { displayName: true } }, matchedOrder: { select: { id: true, orderCode: true, partnerId: true } } } });
}
async function loadMatches(orderCode?: string | null) {
  const variants = orderCodeVariants(orderCode);
  return db.partnerOrder.findMany({ where: variants.length ? { OR: variants.map((code) => ({ orderCode: { equals: code, mode: "insensitive" as const } })) } : {}, select: { id: true, orderCode: true, eligibleProductRevenue: true, partner: { select: { displayName: true } } }, orderBy: { createdAt: "desc" }, take: 20 });
}
function Info({ label, value }: { label: string; value: string }) { return <div><dt className="text-stone-500">{label}</dt><dd className="font-semibold text-stone-800">{value}</dd></div>; }
