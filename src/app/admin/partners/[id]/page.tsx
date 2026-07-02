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
import { createShopReferralCodeAction, updatePartnerCodeAction } from "@/features/partners/codes";
import { db, hasDatabaseUrl } from "@/lib/db";
import { formatVnd } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ statementToken?: string; setupToken?: string }>;
}) {
  const { id } = await params;
  const { statementToken, setupToken } = await searchParams;

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
            {partner.partnerType.code}
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
              ["Khu vực", partner.profile?.area ?? "—"],
              ["Kênh bán", partner.profile?.sellingChannel ?? "—"],
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
                Generate setup/reset link
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
            {setupToken ? (
              <p className="mt-3 rounded-xl bg-stone-50 p-3 text-sm break-all">
                /thiet-lap-mat-khau?token={setupToken}
              </p>
            ) : null}
          </div>
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
            <h2 className="text-xl font-bold text-merly-900">Mã đối tác</h2>
            <div className="mt-4 grid gap-3">
              {partner.codes.length > 0 ? (
                partner.codes.map((code) => (
                  <form action={updatePartnerCodeAction} className="rounded-xl bg-rose-50 p-3" key={code.id}>
                    <input name="partnerId" type="hidden" value={partner.id} />
                    <input name="codeId" type="hidden" value={code.id} />
                    <p className="font-mono font-semibold text-merly-900">{code.code}</p>
                    <dl className="mt-2 grid gap-1 text-xs text-stone-600">
                      <div>Mã giảm giá / Loại mã: <b>{code.codePurpose}</b></div>
                      <div>Nguồn: <b>{code.source}</b></div>
                      <div>Giảm cho khách: <b>{formatCommissionRate(code.customerDiscountBps)}</b></div>
                      <div>Hoa hồng đối tác: <b>{formatCommissionRate(code.commissionRateBps)}</b></div>
                      <div>Trạng thái: <b>{code.active ? "Đang hoạt động" : "Đã tắt"}</b></div>
                      <div>Ngày tạo: <b>{code.createdAt.toLocaleDateString("vi-VN")}</b></div>
                    </dl>
                    <div className="mt-3 grid gap-2">
                      <label className="grid gap-1 text-xs">Giảm cho khách (bps)<input className="input" name="customerDiscountBps" type="number" min="0" max="10000" defaultValue={code.customerDiscountBps ?? ""} /></label>
                      <label className="grid gap-1 text-xs">Hoa hồng đối tác (bps)<input className="input" name="commissionRateBps" type="number" min="0" max="10000" defaultValue={code.commissionRateBps ?? ""} /></label>
                      <select className="input" name="active" defaultValue={code.active ? "true" : "false"}><option value="true">Đang hoạt động</option><option value="false">Đã tắt</option></select>
                      <button className="btn-secondary" type="submit">Lưu mã</button>
                    </div>
                    <div className="mt-3 text-xs text-stone-600">
                      <b>Đơn gần đây:</b> {code.attributions.length ? code.attributions.map((a) => a.order.orderCode).join(", ") : "Chưa có"}
                    </div>
                  </form>
                ))
              ) : (
                <p className="text-sm text-stone-500">Chưa tạo mã.</p>
              )}
            </div>
            {partner.partnerType.code === "shop_referral" ? (
              <form action={createShopReferralCodeAction} className="mt-4 grid gap-2 rounded-xl border border-rose-100 p-3">
                <input name="partnerId" type="hidden" value={partner.id} />
                <h3 className="font-bold text-merly-900">Tạo mã shop discount</h3>
                <input className="input" name="code" placeholder="SHOPANNA7" />
                <input className="input" name="customerDiscountBps" type="number" min="0" max="10000" placeholder="Giảm cho khách, vd 700" />
                <input className="input" name="commissionRateBps" type="number" min="0" max="10000" placeholder="Hoa hồng đối tác, vd 700" />
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
