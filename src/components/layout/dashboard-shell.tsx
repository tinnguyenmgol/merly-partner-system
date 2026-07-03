import Link from "next/link";

import { MerlyLogo } from "@/components/merly-logo";
import { adminLogoutAction } from "@/features/auth/admin-actions";
import { requirePartnerSession } from "@/features/auth/partner-auth";
import { badgeLabel, getAdminUnreadNotificationCount, getPartnerUnreadAnnouncementCount } from "@/features/notifications";

const partner = [
  ["/dashboard", "Tổng quan"],
  ["/dashboard/ma-gioi-thieu", "Mã giới thiệu"],
  ["/dashboard/link-rut-gon", "Link rút gọn"],
  ["/dashboard/kho-noi-dung", "Kho nội dung"],
  ["/dashboard/lich-chuong-trinh", "Lịch chương trình"],
  ["/dashboard/thong-bao", "Thông báo"],
  ["/dashboard/bang-xep-hang", "Bảng xếp hạng"],
  ["/dashboard/thu-thach", "Thử thách"],
  ["/dashboard/don-hang", "Đơn hàng"],
  ["/dashboard/yeu-cau-gan-don", "Yêu cầu gắn đơn"],
  ["/dashboard/doanh-thu", "Doanh thu"],
  ["/dashboard/hoa-hong", "Hoa hồng"],
  ["/dashboard/thanh-toan", "Thanh toán"],
  ["/dashboard/cap-bac", "Cấp bậc"],
  ["/dashboard/tai-khoan", "Tài khoản"],
  ["/dashboard/ho-tro", "Hỗ trợ"],
];
const admin = [
  ["/admin", "Tổng quan"],
  ["/admin/partners", "Quản lý đối tác"],
  ["/admin/orders", "Đơn hàng CTV"],
  ["/admin/announcements", "Thông báo & link"],
  ["/admin/content-library", "Kho nội dung"],
  ["/admin/campaigns", "Lịch chương trình"],
  ["/admin/leaderboards", "Bảng xếp hạng"],
  ["/admin/challenges", "Thử thách"],
  ["/admin/notifications", "Thông báo nội bộ"],
  ["/admin/order-requests", "Yêu cầu gắn đơn"],
  ["/admin/commissions", "Đối soát hoa hồng"],
  ["/admin/payouts", "Thanh toán"],
  ["/admin/settings/commission-rules", "Cài đặt chính sách"],
  ["/admin/settings/partner-levels", "Cấp bậc"],
  ["/admin/settings/haravan", "Haravan"],
  ["/admin/logs", "Audit logs"],
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

function NotificationBell({ href, count, label }: { href: string; count: number; label: string }) {
  return (
    <Link aria-label={label} className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-rose-100 bg-white text-xl text-merly-700 shadow-sm hover:bg-merly-50" href={href}>
      <span aria-hidden="true">🔔</span>
      {count > 0 ? <span className="absolute -right-1 -top-1 min-w-6 rounded-full bg-merly-700 px-1.5 py-0.5 text-center text-xs font-bold text-white">{badgeLabel(count)}</span> : null}
    </Link>
  );
}

export async function DashboardShell({
  children,
  admin: am = false,
}: {
  children: React.ReactNode;
  admin?: boolean;
}) {
  const items = am ? admin : partner;
  const notificationCount = am
    ? await getAdminUnreadNotificationCount()
    : await (async () => { const session = await requirePartnerSession(); return getPartnerUnreadAnnouncementCount(session.account.partner.id, session.account.partner.partnerType.code); })();
  const bellHref = am ? "/admin/notifications" : "/dashboard/thong-bao";
  const bellLabel = am ? "Thông báo nội bộ chưa đọc" : "Thông báo CTV chưa đọc";
  return (
    <div className="min-h-screen bg-rose-50/60 md:flex">
      <aside className="border-b border-rose-100 bg-white p-4 md:min-h-screen md:w-72 md:border-r">
        <div className="flex items-center justify-between gap-3"><MerlyLogo variant={am ? "admin" : "dashboard"} withText={am} href={am ? "/admin" : "/dashboard"} /><NotificationBell href={bellHref} count={notificationCount} label={bellLabel} /></div>
        <nav className="mt-6 grid gap-1">
          {items.map(([href, label]) => (
            <Link
              key={href}
              className="rounded-xl px-3 py-2 text-sm font-medium text-stone-700 hover:bg-merly-50 hover:text-merly-700"
              href={href}
            >
              {label}
            </Link>
          ))}
          {am ? (
            <AdminLogoutButton />
          ) : (
            <Link
              className="mt-6 block rounded-xl px-3 py-2 text-sm font-semibold text-merly-700 hover:bg-merly-50"
              href="/dang-xuat"
            >
              Đăng xuất
            </Link>
          )}
        </nav>
      </aside>
      <main className="flex-1 p-4 md:p-8">
        <div className="mb-6 rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3"><MerlyLogo variant={am ? "admin" : "dashboard"} withText={am} href={am ? "/admin" : "/dashboard"} /><NotificationBell href={bellHref} count={notificationCount} label={bellLabel} /></div>
        </div>
        {children}
      </main>
    </div>
  );
}
