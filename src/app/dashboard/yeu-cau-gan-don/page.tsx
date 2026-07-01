import { createOrderRequest, ORDER_REQUEST_STATUS_LABELS } from "@/features/order-requests";
import { requirePartnerSession } from "@/features/auth/partner-auth";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { db } from "@/lib/db";
import { formatVnd } from "@/lib/money";

export const dynamic = "force-dynamic";

type SearchParams = { created?: string };

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const session = await requirePartnerSession();
  const requests = await db.partnerOrderRequest.findMany({
    where: { partnerId: session.account.partnerId },
    select: { id: true, status: true, orderCode: true, expectedAmount: true, note: true, adminNote: true, rejectReason: true, createdAt: true, matchedOrder: { select: { orderCode: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return <DashboardShell><div className="space-y-6">
    <section className="card">
      <h1 className="text-3xl font-bold text-merly-900">Yêu cầu gắn đơn</h1>
      <p className="mt-3 text-stone-600">Dùng khi khách đã mua nhưng chưa được ghi nhận qua link giới thiệu.</p>
      <p className="mt-1 text-stone-600">Merly sẽ kiểm tra và chỉ tính hoa hồng cho đơn hợp lệ.</p>
      {params.created ? <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800">Đã gửi yêu cầu kiểm tra.</p> : null}
    </section>

    <form action={createOrderRequest} className="card grid gap-4 md:grid-cols-2">
      <h2 className="text-xl font-bold text-merly-900 md:col-span-2">Gửi yêu cầu kiểm tra</h2>
      <label className="grid gap-1 text-sm font-medium">Mã đơn nếu biết<input className="input" name="orderCode" placeholder="VD: #M12345" /></label>
      <label className="grid gap-1 text-sm font-medium">Gợi ý khách hàng/liên hệ nếu có<input className="input" name="contactHint" placeholder="Tên, SĐT rút gọn hoặc kênh liên hệ" /></label>
      <label className="grid gap-1 text-sm font-medium">Giá trị đơn dự kiến nếu biết<input className="input" name="expectedAmount" inputMode="numeric" placeholder="VD: 850000" /></label>
      <label className="grid gap-1 text-sm font-medium md:col-span-2">Ghi chú ngắn<textarea className="input min-h-24" name="note" placeholder="Thông tin giúp Merly kiểm tra nhanh hơn" /></label>
      <button className="btn-primary md:w-fit" type="submit">Gửi yêu cầu kiểm tra</button>
    </form>

    <section className="card overflow-x-auto">
      <h2 className="text-xl font-bold text-merly-900">Yêu cầu của tôi</h2>
      <table className="mt-4 min-w-full text-left text-sm"><thead className="text-stone-500"><tr><th className="p-2">Ngày gửi</th><th className="p-2">Mã đơn</th><th className="p-2">Trạng thái</th><th className="p-2">Đơn đã gắn</th><th className="p-2">Giá trị dự kiến</th><th className="p-2">Ghi chú</th><th className="p-2">Phản hồi Merly</th></tr></thead><tbody>
        {requests.map((request) => <tr className="border-t border-rose-100" key={request.id}><td className="p-2">{request.createdAt.toLocaleString("vi-VN")}</td><td className="p-2">{request.orderCode ?? "—"}</td><td className="p-2 font-semibold">{ORDER_REQUEST_STATUS_LABELS[request.status]}</td><td className="p-2">{request.matchedOrder?.orderCode ?? "—"}</td><td className="p-2">{request.expectedAmount ? formatVnd(request.expectedAmount) : "—"}</td><td className="p-2">{request.note ?? "—"}</td><td className="p-2">{request.rejectReason ?? request.adminNote ?? "—"}</td></tr>)}
        {requests.length === 0 ? <tr><td className="p-3 text-stone-500" colSpan={7}>Chưa có yêu cầu.</td></tr> : null}
      </tbody></table>
    </section>
  </div></DashboardShell>;
}
