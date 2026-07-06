import { requireAdminSession } from "@/features/auth/admin-auth";
import Link from "next/link";
import type { PartnerTypeCode, Prisma } from "@prisma/client";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { db, getDatabaseErrorMessage, hasDatabaseUrl } from "@/lib/db";

export const dynamic = "force-dynamic";

type PartnerRow = Prisma.PartnerGetPayload<{
  select: {
    id: true;
    displayName: true;
    phone: true;
    email: true;
    status: true;
    createdAt: true;
    partnerType: { select: { code: true } };
    profile: { select: { sellingChannel: true; salesChannel: true; salesChannelsJson: true; provinceName: true; wardName: true; taxCode: true; shopName: true; storeAddress: true; customerSegment: true; displayAreaNote: true; expectedDisplayQuantity: true; businessName: true; expectedOpeningOrderAmount: true; coverageArea: true } };
    codes: { select: { code: true } };
  };
}>;

const partnerTypeOptions = ["referral_ctv", "shop_referral", "mini_corner", "agency"] as const;

function typeLabel(code: string) {
  return { referral_ctv: "CTV cá nhân", shop_referral: "Shop giới thiệu khách", mini_corner: "Mini corner", agency: "Đại lý", wholesale_agent: "Wholesale agent", affiliate_creator: "Affiliate creator" }[code] ?? code;
}

function quickInfo(partner: PartnerRow) {
  const profile = partner.profile;
  if (partner.partnerType.code === "shop_referral") return [profile?.shopName, partner.phone, profile?.storeAddress, profile?.customerSegment].filter(Boolean).join(" · ") || "—";
  if (partner.partnerType.code === "mini_corner") return [profile?.shopName, profile?.storeAddress, profile?.displayAreaNote, profile?.expectedDisplayQuantity ? `${profile.expectedDisplayQuantity} sp` : undefined].filter(Boolean).join(" · ") || "—";
  if (partner.partnerType.code === "agency") return [profile?.businessName, profile?.storeAddress, profile?.expectedOpeningOrderAmount ? `${profile.expectedOpeningOrderAmount.toLocaleString("vi-VN")}đ` : undefined, profile?.coverageArea].filter(Boolean).join(" · ") || "—";
  return [partner.phone, [profile?.wardName, profile?.provinceName].filter(Boolean).join(", "), profile?.salesChannel ?? profile?.sellingChannel, profile?.taxCode ? `MST: ${profile.taxCode}` : undefined].filter(Boolean).join(" · ") || "—";
}

export default async function Page({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  await requireAdminSession();
  const { type } = await searchParams;
  const selectedType = partnerTypeOptions.includes(type as typeof partnerTypeOptions[number]) ? type as PartnerTypeCode : undefined;
  let schemaWarning: string | null = null;
  const partners: PartnerRow[] = [];

  if (hasDatabaseUrl()) {
    try {
      partners.push(
        ...(await db.partner.findMany({
          select: {
            id: true,
            displayName: true,
            phone: true,
            email: true,
            status: true,
            createdAt: true,
            partnerType: { select: { code: true } },
            profile: { select: { sellingChannel: true, salesChannel: true, salesChannelsJson: true, provinceName: true, wardName: true, taxCode: true, shopName: true, storeAddress: true, customerSegment: true, displayAreaNote: true, expectedDisplayQuantity: true, businessName: true, expectedOpeningOrderAmount: true, coverageArea: true } },
            codes: { select: { code: true } },
          },
          where: selectedType ? { partnerType: { code: selectedType } } : undefined,
          orderBy: [{ status: "asc" }, { createdAt: "desc" }],
          take: 100,
        })),
      );
    } catch (error) {
      console.error("Failed to load admin partners", error);
      schemaWarning = getDatabaseErrorMessage(
        error,
        "Không thể tải danh sách đối tác. Nếu vừa triển khai bản mới, hãy chạy npm run db:migrate rồi npm run db:bootstrap.",
      );
    }
  }

  return (
    <DashboardShell admin>
      <div className="card">
        <h1 className="text-3xl font-bold text-merly-900">Quản lý đối tác</h1>
        <p className="mt-3 text-stone-600">Tiếp nhận đăng ký nhiều loại đối tác, duyệt hồ sơ, quản lý mã giới thiệu và theo dõi trạng thái đối tác.</p>
        {!hasDatabaseUrl() ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 font-medium text-amber-800">
            Chưa cấu hình DATABASE_URL nên chưa thể tải danh sách CTV.
          </p>
        ) : null}
        {schemaWarning ? <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">{schemaWarning}</p> : null}
        <div className="mt-6 flex flex-wrap gap-2 text-sm">
          <Link className={`rounded-full px-3 py-1 font-semibold ${!selectedType ? "bg-merly-700 text-white" : "bg-rose-50 text-merly-700"}`} href="/admin/partners">Tất cả</Link>
          {partnerTypeOptions.map((code) => (
            <Link className={`rounded-full px-3 py-1 font-semibold ${selectedType === code ? "bg-merly-700 text-white" : "bg-rose-50 text-merly-700"}`} href={`/admin/partners?type=${code}`} key={code}>{typeLabel(code)}</Link>
          ))}
        </div>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-stone-500">
              <tr className="border-b border-rose-100">
                <th className="py-3">Đối tác</th>
                <th>Loại</th>
                <th>Trạng thái</th>
                <th>Thông tin nhanh</th>
                <th>Mã</th>
                <th>Ngày đăng ký</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {partners.map((partner) => (
                <tr className="border-b border-rose-50" key={partner.id}>
                  <td className="py-3"><b>{partner.displayName}</b><p className="text-stone-500">{partner.phone ?? partner.email}</p></td>
                  <td>{typeLabel(partner.partnerType.code)}</td>
                  <td><span className="rounded-full bg-rose-50 px-3 py-1 font-medium text-merly-700">{partner.status}</span></td>
                  <td className="max-w-sm text-stone-600">{quickInfo(partner)}</td>
                  <td>{partner.codes.map((code) => code.code).join(", ") || "Chưa có"}</td>
                  <td>{partner.createdAt.toLocaleDateString("vi-VN")}</td>
                  <td><Link className="font-semibold text-merly-700" href={`/admin/partners/${partner.id}`}>Xem</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
          {partners.length === 0 && <p className="py-8 text-center text-stone-500">Chưa có hồ sơ đối tác.</p>}
        </div>
      </div>
    </DashboardShell>
  );
}
