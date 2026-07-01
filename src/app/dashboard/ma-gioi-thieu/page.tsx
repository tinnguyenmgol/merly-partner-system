import { DashboardShell } from "@/components/layout/dashboard-shell";
import { db, hasDatabaseUrl } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Page() {
  let schemaWarning: string | null = null;
  let partner = null;

  if (hasDatabaseUrl()) {
    try {
      partner = await db.partner.findFirst({
        include: { partnerType: true, codes: { select: { code: true }, where: { active: true }, take: 1 } },
        where: { status: "approved" },
        orderBy: { createdAt: "asc" },
      });
    } catch (error) {
      console.error("Failed to load referral code dashboard", error);
      schemaWarning = "Không thể tải mã giới thiệu. Nếu vừa triển khai bản mới, hãy chạy npm run db:migrate rồi npm run db:bootstrap.";
    }
  }
  const code = partner?.codes[0]?.code ?? "<PartnerCode>";
  const isShop = partner?.partnerType.code === "shop_referral";

  return (
    <DashboardShell>
      <div className="card space-y-5">
        <h1 className="text-3xl font-bold text-merly-900">Mã giới thiệu</h1>
        {schemaWarning ? <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{schemaWarning}</p> : null}
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
