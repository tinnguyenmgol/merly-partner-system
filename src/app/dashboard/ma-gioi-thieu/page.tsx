import { DashboardShell } from "@/components/layout/dashboard-shell";
import { formatCommissionRate } from "@/features/commissions";
import { requirePartnerSession } from "@/features/auth/partner-auth";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requirePartnerSession();
  const partner = session.account.partner;
  const code = partner.codes[0];
  const isShopReferral = partner.partnerType.code === "shop_referral";

  return (
    <DashboardShell>
      <div className="card space-y-5">
        <h1 className="text-3xl font-bold text-merly-900">
          {isShopReferral ? "Mã giảm giá đối tác" : "Mã giới thiệu"}
        </h1>
        <p className="text-stone-600">
          {isShopReferral
            ? "Khách nhập mã giảm giá của shop khi mua hàng để Merly ghi nhận doanh thu và hoa hồng đối tác."
            : "Link này dùng để ghi nhận doanh thu CTV, không bắt buộc giảm giá cho khách."}
        </p>
        {isShopReferral ? (
          <div className="rounded-xl bg-rose-50 p-4">
            <p className="font-mono text-lg font-bold text-merly-900">{code?.code ?? "Chưa có mã"}</p>
            <p className="mt-2 text-sm text-stone-600">Khách giảm {formatCommissionRate(code?.customerDiscountBps)} · Đối tác nhận {formatCommissionRate(code?.commissionRateBps)}</p>
            <p className="mt-1 text-sm text-stone-600">Trạng thái: {code?.active ? "Đang hoạt động" : "Chưa hoạt động"}</p>
          </div>
        ) : (
          <>
            <div className="rounded-xl bg-rose-50 p-4 font-mono text-sm text-merly-900">https://merlyshoes.com/?ref={code?.code ?? "<PartnerCode>"}</div>
            <div className="rounded-xl bg-rose-50 p-4 font-mono text-sm text-merly-900">https://merlyshoes.com/products/&lt;handle&gt;?ref={code?.code ?? "<PartnerCode>"}</div>
            <button className="btn-secondary" type="button">Copy link</button>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
