import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { createPartnerStatementTokenAction } from "@/features/commissions/actions";
import {
  MINIMUM_PAYOUT_AMOUNT_VND,
  formatCommissionRate,
  summarizeLedgers,
} from "@/features/commissions";
import {
  partnerAccountAction,
  reviewPartnerRegistration,
} from "@/features/partners/intake";
import { createShopReferralCodeAction, normalizePartnerCodeAction, updatePartnerCodeAction } from "@/features/partners/codes";
import { db, hasDatabaseUrl } from "@/lib/db";
import { formatVnd } from "@/lib/money";

export const dynamic = "force-dynamic";

function percentValue(rateBps: number | null | undefined) {
  return rateBps == null ? "" : String(rateBps / 100);
}

function codeTypeLabel(partnerTypeCode: string, codePurpose: string) {
  if (partnerTypeCode === "shop_referral" || codePurpose === "shop_discount_code") return "Mã giảm giá shop referral";
  if (codePurpose === "affiliate_tracking") return "Link giới thiệu CTV";
  return codePurpose;
}

function hasInconsistentCodeConfig(code: { codePurpose: string; source: string }) {
  return code.codePurpose === "affiliate_tracking" && ["discount_code", "shop_discount_code"].includes(code.source);
}

function typeLabel(code: string) {
  return { referral_ctv: "CTV cá nhân", shop_referral: "Shop giới thiệu khách", mini_corner: "Mini corner", agency: "Đại lý", wholesale_agent: "Wholesale agent", affiliate_creator: "Affiliate creator" }[code] ?? code;
}

type PartnerDetailProfile = {
  fullName?: string | null;
  contactName?: string | null;
  shopName?: string | null;
  businessName?: string | null;
  storeAddress?: string | null;
  warehouseAddress?: string | null;
  customerSegment?: string | null;
  displayAreaNote?: string | null;
  expectedDisplayQuantity?: number | null;
  expectedOpeningOrderAmount?: number | null;
  coverageArea?: string | null;
  businessModelNote?: string | null;
  salesChannel?: string | null;
  sellingChannel?: string | null;
  socialLink?: string | null;
};

function typeSpecificDetails(partner: { partnerType: { code: string }; profile: PartnerDetailProfile | null; phone: string | null }) {
  const p = partner.profile;
  if (partner.partnerType.code === "shop_referral") return [["Tên shop", p?.shopName], ["Người liên hệ", p?.contactName ?? p?.fullName], ["SĐT", partner.phone], ["Địa chỉ cửa hàng", p?.storeAddress], ["Tệp khách hàng", p?.customerSegment]];
  if (partner.partnerType.code === "mini_corner") return [["Tên shop", p?.shopName], ["Địa chỉ cửa hàng", p?.storeAddress], ["Góc trưng bày", p?.displayAreaNote], ["SL trưng bày dự kiến", p?.expectedDisplayQuantity]];
  if (partner.partnerType.code === "agency") return [["Tên shop / đơn vị", p?.businessName], ["Địa chỉ", p?.storeAddress ?? p?.warehouseAddress], ["Mức nhập ban đầu", p?.expectedOpeningOrderAmount ? `${p.expectedOpeningOrderAmount.toLocaleString("vi-VN")}đ` : undefined], ["Khu vực phân phối", p?.coverageArea], ["Mô hình", p?.businessModelNote]];
  return [["Người liên hệ", p?.contactName ?? p?.fullName], ["SĐT", partner.phone], ["Kênh", p?.salesChannel ?? p?.sellingChannel], ["Link xã hội", p?.socialLink]];
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ statementToken?: string; resetToken?: string }>;
}) {
  const { id } = await params;
  const { statementToken, resetToken } = await searchParams;

  if (!hasDatabaseUrl()) {
    return (
      <DashboardShell admin>
        <div className="card">
          <h1 className="text-3xl font-bold text-merly-900">
            Chi tiết đối tác
          </h1>
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 font-medium text-amber-800">
            Chưa cấu hình DATABASE_URL nên chưa thể tải hồ sơ CTV.
          </p>
        </div>
      </DashboardShell>
    );
  }
  const partner = await db.partner.findUnique({
    include: {
      partnerType: true,
      profile: true,
      codes: { orderBy: { createdAt: "desc" }, include: { attributions: { include: { order: true }, orderBy: { createdAt: "desc" }, take: 5 } } },
      ledgerEntries: { include: { order: true } },
      statementTokens: {
        where: { revokedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      account: true,
      auditLogs: { orderBy: { createdAt: "desc" }, take: 20 },
    },
    where: { id },
  });

  if (!partner) notFound();
  const summary = summarizeLedgers(partner.ledgerEntries);
  const publicStatementUrl = statementToken
    ? `/partners/public-statement/${statementToken}`
    : partner.statementTokens[0]
      ? "Đã có token đang hoạt động. Tạo token mới để copy link đầy đủ."
      : null;

  return (
    <DashboardShell admin>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="card">
          <p className="font-semibold text-merly-700">
            {typeLabel(partner.partnerType.code)}
          </p>
          <h1 className="mt-2 text-3xl font-bold text-merly-900">
            {partner.displayName}
          </h1>
          <p className="mt-2 text-stone-600">
            Hồ sơ đăng ký đối tác, thông tin thanh toán, trạng thái xét duyệt và
            mã giới thiệu.
          </p>

          <dl className="mt-6 grid gap-4 md:grid-cols-2">
            {[
              ["Trạng thái", partner.status],
              ["Số điện thoại", partner.phone ?? "—"],
              ["Email", partner.email ?? "—"],
              ["Zalo", partner.profile?.zalo ?? "—"],
              ["Khu vực", partner.profile?.cityProvince ?? partner.profile?.area ?? "—"],
              ["Kênh bán", partner.profile?.salesChannel ?? partner.profile?.sellingChannel ?? "—"],
              ["Link xã hội", partner.profile?.socialLink ?? "—"],
              [
                "Ngân hàng",
                [partner.profile?.bankName, partner.profile?.bankAccountNumber]
                  .filter(Boolean)
                  .join(" · ") || "—",
              ],
            ].map(([label, value]) => (
              <div className="rounded-xl bg-rose-50/60 p-4" key={label}>
                <dt className="text-sm text-stone-500">{label}</dt>
                <dd className="mt-1 font-semibold text-merly-900">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-6 rounded-xl border border-rose-100 p-4">
            <h2 className="text-xl font-bold text-merly-900">Thông tin trọng tâm theo loại đối tác</h2>
            <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
              {typeSpecificDetails(partner).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-stone-500">{label}</dt>
                  <dd className="font-semibold text-merly-900">{value || "—"}</dd>
                </div>
              ))}
            </dl>
          </div>

          {partner.partnerType.code === "referral_ctv" ? (
          <div className="mt-6 rounded-xl border border-rose-100 p-4">
            <h2 className="text-xl font-bold text-merly-900">
              Tài khoản đăng nhập CTV
            </h2>
            <dl className="mt-4 grid gap-3 text-sm">
              <div>
                <dt className="text-stone-500">Trạng thái account</dt>
                <dd className="font-semibold text-merly-900">
                  {partner.account?.status ?? "not created"}
                </dd>
              </div>
              <div>
                <dt className="text-stone-500">Lần đăng nhập cuối</dt>
                <dd className="font-semibold text-merly-900">
                  {partner.account?.lastLoginAt
                    ? partner.account.lastLoginAt.toLocaleString("vi-VN")
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-stone-500">Trạng thái mật khẩu</dt>
                <dd className="font-semibold text-merly-900">
                  {partner.account?.passwordSetAt ? "Đã thiết lập" : "Chưa thiết lập"}
                </dd>
              </div>
            </dl>
            <form
              action={partnerAccountAction}
              className="mt-4 grid gap-2 md:grid-cols-3"
            >
              <input name="partnerId" type="hidden" value={partner.id} />
              <button
                className="btn-primary"
                name="accountAction"
                value="generate"
              >
                Tạo link đặt lại mật khẩu
              </button>
              <button
                className="btn-secondary"
                name="accountAction"
                value="disable"
              >
                Disable login
              </button>
              <button
                className="btn-secondary"
                name="accountAction"
                value="enable"
              >
                Enable login
              </button>
            </form>
            {resetToken ? (
              <p className="mt-3 rounded-xl bg-stone-50 p-3 text-sm break-all">
                Sao chép link đặt lại mật khẩu: /dat-lai-mat-khau?token={resetToken}
              </p>
            ) : null}
          </div>
          ) : (
            <div className="mt-6 rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm font-medium text-amber-900">Dashboard chuyên biệt cho loại đối tác này đang được hoàn thiện. Hồ sơ vẫn có thể được duyệt và quản lý tại admin.</div>
          )}
          <div className="mt-6 rounded-xl bg-stone-50 p-4">
            <h2 className="font-bold text-merly-900">Ghi chú / kinh nghiệm</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-stone-600">
              {partner.profile?.experienceNote || "Chưa có ghi chú."}
            </p>
          </div>
        </div>
        <aside className="grid gap-6">
          <div className="card">
            <h2 className="text-xl font-bold text-merly-900">Xét duyệt</h2>
            <form
              action={reviewPartnerRegistration}
              className="mt-4 grid gap-3"
            >
              <input name="partnerId" type="hidden" value={partner.id} />
              <label className="grid gap-2 text-sm">
                Mã giới thiệu khi duyệt
                <input
                  className="input"
                  name="partnerCode"
                  placeholder="VD: MERLYANH001"
                />
              </label>
              <label className="grid gap-2 text-sm">
                Ghi chú audit
                <textarea className="input min-h-24" name="note" />
              </label>
              <div className="grid gap-2">
                <button
                  className="btn-primary"
                  name="decision"
                  type="submit"
                  value="approve"
                >
                  Duyệt & kích hoạt
                </button>
                <button
                  className="btn-secondary"
                  name="decision"
                  type="submit"
                  value="reject"
                >
                  Từ chối
                </button>
                <button
                  className="btn-secondary"
                  name="decision"
                  type="submit"
                  value="suspend"
                >
                  Tạm khóa
                </button>
                <button
                  className="btn-secondary"
                  name="decision"
                  type="submit"
                  value="reactivate"
                >
                  Kích hoạt lại
                </button>
              </div>
            </form>
          </div>
          <div className="card">
            <h2 className="text-xl font-bold text-merly-900">{partner.partnerType.code === "shop_referral" ? "Mã giảm giá đối tác" : "Mã giới thiệu / Link giới thiệu"}</h2>
            <div className="mt-4 grid gap-3">
              {partner.codes.length > 0 ? (
                partner.codes.map((code) => {
                  const inconsistent = hasInconsistentCodeConfig(code);
                  const isShopCode = partner.partnerType.code === "shop_referral" || code.codePurpose === "shop_discount_code";
                  const displayCommission = code.commissionRateBps ?? (partner.partnerType.code === "referral_ctv" ? 1000 : null);
                  return (
                  <form action={updatePartnerCodeAction} className="rounded-xl bg-rose-50 p-3" key={code.id}>
                    <input name="partnerId" type="hidden" value={partner.id} />
                    <input name="codeId" type="hidden" value={code.id} />
                    <p className="font-mono font-semibold text-merly-900">{code.code}</p>
                    {inconsistent ? (
                      <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
                        Mã này đang bị lệch cấu hình: loại mã là tracking CTV nhưng nguồn lại là mã giảm giá.
                        <button formAction={normalizePartnerCodeAction} className="btn-secondary mt-2 w-full" type="submit">Chuẩn hóa theo loại đối tác</button>
                      </div>
                    ) : null}
                    <dl className="mt-2 grid gap-1 text-xs text-stone-600">
                      <div>Loại mã: <b>{codeTypeLabel(partner.partnerType.code, code.codePurpose)}</b></div>
                      <div>Nguồn: <b>{isShopCode ? "shop_discount_code" : "affiliate_link"}</b></div>
                      <div>Giảm cho khách: <b>{isShopCode ? formatCommissionRate(code.customerDiscountBps) : "Không áp dụng"}</b></div>
                      <div>Hoa hồng đối tác: <b>{formatCommissionRate(displayCommission)}</b></div>
                      <div>Trạng thái: <b>{code.active ? "Đang hoạt động" : "Đã tắt"}</b></div>
                      <div>Ngày tạo: <b>{code.createdAt.toLocaleDateString("vi-VN")}</b></div>
                    </dl>
                    {isShopCode ? (
                      <div className="mt-3 grid gap-2">
                        <label className="grid gap-1 text-xs">Giảm cho khách (%)<input className="input" name="customerDiscountPercent" type="number" min="0" max="100" step="0.01" defaultValue={percentValue(code.customerDiscountBps)} placeholder="VD: 7" /></label>
                        <label className="grid gap-1 text-xs">Hoa hồng đối tác (%)<input className="input" name="commissionPercent" type="number" min="0" max="100" step="0.01" defaultValue={percentValue(code.commissionRateBps)} placeholder="VD: 7" /></label>
                        <select className="input" name="active" defaultValue={code.active ? "true" : "false"}><option value="true">Đang hoạt động</option><option value="false">Đã tắt</option></select>
                        <button className="btn-secondary" type="submit">Lưu mã</button>
                      </div>
                    ) : (
                      <div className="mt-3 grid gap-2">
                        <select className="input" name="active" defaultValue={code.active ? "true" : "false"}><option value="true">Đang hoạt động</option><option value="false">Đã tắt</option></select>
                        <button className="btn-secondary" type="submit">Lưu trạng thái</button>
                      </div>
                    )}
                    <div className="mt-3 text-xs text-stone-600">
                      <b>Đơn gần đây:</b> {code.attributions.length ? code.attributions.map((a) => a.order.orderCode).join(", ") : "Chưa có"}
                    </div>
                  </form>
                );})
              ) : (
                <p className="text-sm text-stone-500">Chưa tạo mã.</p>
              )}
            </div>
            {partner.partnerType.code === "shop_referral" ? (
              <form action={createShopReferralCodeAction} className="mt-4 grid gap-2 rounded-xl border border-rose-100 p-3">
                <input name="partnerId" type="hidden" value={partner.id} />
                <h3 className="font-bold text-merly-900">Tạo mã giảm giá shop referral</h3>
                <input className="input" name="code" placeholder="SHOPANNA7" />
                <input className="input" name="customerDiscountPercent" type="number" min="0" max="100" step="0.01" placeholder="Giảm cho khách (%), vd 7" />
                <input className="input" name="commissionPercent" type="number" min="0" max="100" step="0.01" placeholder="Hoa hồng đối tác (%), vd 7" />
                <button className="btn-primary" type="submit">Tạo mã</button>
              </form>
            ) : null}
          </div>
        </aside>
      </div>

      <div className="card mt-6">
        <h2 className="text-xl font-bold text-merly-900">Commission summary</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          {(
            [
              "temporary",
              "reconciliation_waiting",
              "payable",
              "paid",
              "rejected",
              "on_hold",
            ] as const
          ).map((status) => (
            <div className="rounded-xl bg-rose-50/60 p-4" key={status}>
              <p className="text-sm text-stone-500">{status}</p>
              <p className="mt-1 font-bold text-merly-900">
                {formatVnd(summary[status])}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4 font-semibold text-merly-900">
          Payable balance: {formatVnd(summary.payable)} / minimum{" "}
          {formatVnd(MINIMUM_PAYOUT_AMOUNT_VND)}
        </p>
        <p className="mt-2 text-sm text-stone-600">
          {summary.payable < MINIMUM_PAYOUT_AMOUNT_VND
            ? "Chưa đủ mức thanh toán tối thiểu 100.000đ, hoa hồng sẽ được cộng dồn."
            : "Đã đủ điều kiện thanh toán, chờ Merly đối soát và chuyển khoản."}
        </p>
        <form action={createPartnerStatementTokenAction} className="mt-4">
          <input name="partnerId" type="hidden" value={partner.id} />
          <button className="btn-primary" type="submit">
            Generate/copy secure statement link
          </button>
        </form>
        {publicStatementUrl ? (
          <p className="mt-3 rounded-xl bg-stone-50 p-3 text-sm break-all">
            {publicStatementUrl.startsWith("/") ? (
              <Link
                className="font-semibold text-merly-700 underline"
                href={publicStatementUrl}
              >
                {publicStatementUrl}
              </Link>
            ) : (
              publicStatementUrl
            )}
          </p>
        ) : null}
      </div>

      <div className="card mt-6">
        <h2 className="text-xl font-bold text-merly-900">Audit logs</h2>
        <div className="mt-4 grid gap-3">
          {partner.auditLogs.map((log) => (
            <div className="rounded-xl border border-rose-100 p-4" key={log.id}>
              <b>{log.action}</b>
              <p className="text-sm text-stone-500">
                {log.createdAt.toLocaleString("vi-VN")} ·{" "}
                {log.note ?? "Không có ghi chú"}
              </p>
            </div>
          ))}
          {partner.auditLogs.length === 0 && (
            <p className="text-sm text-stone-500">Chưa có audit log.</p>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
