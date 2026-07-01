import { DashboardShell } from "@/components/layout/dashboard-shell";
import { db, hasDatabaseUrl } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Page() {
  const partner = hasDatabaseUrl()
    ? await db.partner.findFirst({ include: { partnerType: true, codes: { where: { active: true }, take: 1 } }, where: { status: "approved" }, orderBy: { createdAt: "asc" } })
    : null;
  const code = partner?.codes[0]?.code ?? "<PartnerCode>";
  const isShop = partner?.partnerType.code === "shop_referral";

  return (
    <DashboardShell>
      <div className="card space-y-5">
        <h1 className="text-3xl font-bold text-merly-900">Mã giới thiệu</h1>
        {isShop ? (
          <p className="text-stone-600">Shop referral dùng mã giảm giá để ghi nhận đơn. Mã có thể gắn % giảm cho khách và % hoa hồng shop theo cấu hình.</p>
        ) : (
          <>
            <p className="text-stone-600">Link này dùng để ghi nhận doanh thu CTV, không bắt buộc giảm giá cho khách.</p>
            <div className="rounded-xl bg-rose-50 p-4 font-mono text-sm text-merly-900">https://merlyshoes.com/?ref={code}</div>
            <div className="rounded-xl bg-rose-50 p-4 font-mono text-sm text-merly-900">https://merlyshoes.com/products/&lt;handle&gt;?ref={code}</div>
          </>
        )}
        <div className="rounded-xl border border-rose-100 p-4">
          <p className="text-sm text-stone-500">Mã hiện tại</p>
          <p className="mt-1 text-xl font-semibold text-merly-900">{code}</p>
        </div>
      </div>
    </DashboardShell>
  );
}
