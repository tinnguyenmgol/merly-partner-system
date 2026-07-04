import Link from "next/link";
import { SidebarNav, type NavGroup } from "@/components/layout/sidebar-nav";

import { MerlyLogo } from "@/components/merly-logo";
import { adminLogoutAction } from "@/features/auth/admin-actions";
import { displayBuildVersion } from "@/lib/build-version";
import { requirePartnerSession } from "@/features/auth/partner-auth";
import { getAdminUnreadNotificationCount, getPartnerUnreadAnnouncementCount } from "@/features/notifications";
import { NotificationBell } from "@/components/layout/notification-bell";

const partnerGroups: NavGroup[] = [
  { label: "Tổng quan", items: [{ href: "/dashboard", label: "Tổng quan" }] },
  { label: "Bán hàng", items: [{ href: "/dashboard/ma-gioi-thieu", label: "Mã giới thiệu" }, { href: "/dashboard/link-rut-gon", label: "Link rút gọn" }, { href: "/dashboard/kho-noi-dung", label: "Kho nội dung" }, { href: "/dashboard/lich-chuong-trinh", label: "Lịch chương trình" }, { href: "/dashboard/thong-bao", label: "Thông báo" }] },
  { label: "Đơn & hoa hồng", items: [{ href: "/dashboard/don-hang", label: "Đơn hàng" }, { href: "/dashboard/yeu-cau-gan-don", label: "Yêu cầu gắn đơn" }, { href: "/dashboard/doanh-thu", label: "Doanh thu" }, { href: "/dashboard/hoa-hong", label: "Hoa hồng" }, { href: "/dashboard/thanh-toan", label: "Thanh toán" }] },
  { label: "Tăng trưởng", items: [{ href: "/dashboard/cap-bac", label: "Cấp bậc" }, { href: "/dashboard/bang-xep-hang", label: "Bảng xếp hạng" }, { href: "/dashboard/thu-thach", label: "Thử thách" }, { href: "/dashboard/dao-tao", label: "Đào tạo" }, { href: "/dashboard/gioi-thieu-partner", label: "Giới thiệu partner" }] },
  { label: "Tài khoản", items: [{ href: "/dashboard/tai-khoan", label: "Tài khoản" }, { href: "/dashboard/ho-tro", label: "Hỗ trợ" }] },
];
const adminGroups: NavGroup[] = [
  { label: "Tổng quan", items: [{ href: "/admin", label: "Tổng quan" }, { href: "/admin/notifications", label: "Việc cần xử lý" }] },
  { label: "Đối tác", items: [{ href: "/admin/partners", label: "Quản lý đối tác" }, { href: "/admin/order-requests", label: "Yêu cầu gắn đơn" }] },
  { label: "Đơn & đối soát", items: [{ href: "/admin/orders", label: "Đơn hàng CTV" }, { href: "/admin/commissions", label: "Đối soát hoa hồng" }, { href: "/admin/payouts", label: "Thanh toán" }] },
  { label: "Marketing & tăng trưởng", items: [{ href: "/admin/announcements", label: "Thông báo & link" }, { href: "/admin/content-library", label: "Kho nội dung" }, { href: "/admin/campaigns", label: "Lịch chương trình" }, { href: "/admin/leaderboards", label: "Bảng xếp hạng" }, { href: "/admin/challenges", label: "Thử thách" }, { href: "/admin/training", label: "Đào tạo" }, { href: "/admin/partner-referrals", label: "Giới thiệu partner" }] },
  { label: "Cài đặt & hệ thống", items: [{ href: "/admin/settings/ctv", label: "Cài đặt CTV" }, { href: "/admin/settings/commission-rules", label: "Cài đặt chính sách" }, { href: "/admin/settings/partner-levels", label: "Cấp bậc" }, { href: "/admin/settings/haravan", label: "Haravan" }, { href: "/admin/logs", label: "Audit logs" }] },
];
function AdminLogoutButton() {
  return (
    <form action={adminLogoutAction} className="mt-6">
      <button
        type="submit"
        className="block w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-merly-700 hover:bg-merly-50"
      >
        Đăng xuất
      </button>
    </form>
  );
}

export async function DashboardShell({
  children,
  admin: am = false,
}: {
  children: React.ReactNode;
  admin?: boolean;
}) {
  const groups = am ? adminGroups : partnerGroups;
  const notificationCount = am
    ? await getAdminUnreadNotificationCount()
    : await (async () => { const session = await requirePartnerSession(); return getPartnerUnreadAnnouncementCount(session.account.partner.id, session.account.partner.partnerType.code); })();
  const bellHref = am ? "/admin/notifications" : "/dashboard/thong-bao";
  const bellLabel = am ? "Thông báo nội bộ chưa đọc" : "Thông báo CTV chưa đọc";
  return (
    <div className="min-h-screen bg-rose-50/60 md:flex">
      <aside className="border-b border-rose-100 bg-white p-4 md:min-h-screen md:w-72 md:border-r">
        <div className="flex items-center justify-between gap-3"><MerlyLogo variant={am ? "admin" : "dashboard"} withText={am} href={am ? "/admin" : "/dashboard"} /><NotificationBell href={bellHref} count={notificationCount} label={bellLabel} countUrl={am ? "/api/admin/notifications/count" : "/api/dashboard/notifications/count"} /></div>
        <SidebarNav groups={groups} footer={<div className="space-y-3">{am ? <AdminLogoutButton /> : <Link className="block rounded-xl px-3 py-2 text-sm font-semibold text-merly-700 hover:bg-merly-50" href="/dang-xuat">Đăng xuất</Link>}<p className="px-3 text-xs font-medium text-stone-400">Phiên bản {displayBuildVersion}</p></div>} />
      </aside>
      <main className="flex-1 p-4 md:p-8">
        <div className="mb-6 rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3"><MerlyLogo variant={am ? "admin" : "dashboard"} withText={am} href={am ? "/admin" : "/dashboard"} /><NotificationBell href={bellHref} count={notificationCount} label={bellLabel} countUrl={am ? "/api/admin/notifications/count" : "/api/dashboard/notifications/count"} /></div>
        </div>
        {children}
      </main>
    </div>
  );
}
