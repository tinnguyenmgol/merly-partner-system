import Link from "next/link";
import { AdminNotificationStatus, Prisma } from "@prisma/client";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireAdminSession } from "@/features/auth/admin-auth";
import { archiveAdminNotificationAction, markAdminNotificationReadAction, markAllAdminNotificationsReadAction } from "@/features/notifications";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const filters = ["unread", "read", "all"] as const;
const severityLabels = { info: "Thông tin", warning: "Cảnh báo", urgent: "Khẩn cấp" } as const;
const statusLabels = { unread: "Chưa đọc", read: "Đã đọc", archived: "Đã lưu trữ" } as const;

export default async function Page({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  await requireAdminSession();
  const { filter: rawFilter } = await searchParams;
  const filter = filters.includes(rawFilter as (typeof filters)[number]) ? rawFilter as (typeof filters)[number] : "unread";
  const where: Prisma.AdminNotificationWhereInput = filter === "all" ? { archivedAt: null } : { status: filter as AdminNotificationStatus, archivedAt: null };
  const notifications = await db.adminNotification.findMany({ where, orderBy: [{ status: "desc" }, { createdAt: "desc" }], take: 100 });

  return <DashboardShell admin><div className="card"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-3xl font-bold text-merly-900">Thông báo nội bộ</h1><p className="mt-2 text-stone-600">Operational alerts cho admin/staff. Không hiển thị cho CTV hoặc public user.</p></div><form action={markAllAdminNotificationsReadAction}><button className="btn-secondary" type="submit">Đánh dấu tất cả đã đọc</button></form></div><div className="mt-5 flex flex-wrap gap-2">{filters.map((item) => <Link className={`rounded-full px-4 py-2 text-sm font-semibold ${filter === item ? "bg-merly-700 text-white" : "bg-rose-50 text-merly-700"}`} href={`/admin/notifications?filter=${item}`} key={item}>{item === "all" ? "Tất cả" : item === "unread" ? "Chưa đọc" : "Đã đọc"}</Link>)}</div><div className="mt-6 space-y-3">{notifications.map((item) => <article className="rounded-2xl border border-rose-100 p-4" key={item.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold text-merly-900">{item.title}</h2><p className="mt-1 text-sm text-stone-500">{severityLabels[item.severity]} · {statusLabels[item.status]} · {item.createdAt.toLocaleString("vi-VN")}</p>{item.message ? <p className="mt-2 text-stone-700">{item.message}</p> : null}</div><span className="rounded-full bg-rose-50 px-3 py-1 text-sm font-semibold text-merly-700">{severityLabels[item.severity]}</span></div><div className="mt-4 flex flex-wrap gap-2">{item.actionUrl ? <Link className="btn-primary" href={item.actionUrl}>Mở xử lý</Link> : null}{item.status === "unread" ? <form action={markAdminNotificationReadAction}><input name="id" type="hidden" value={item.id} /><button className="btn-secondary">Đã đọc</button></form> : null}<form action={archiveAdminNotificationAction}><input name="id" type="hidden" value={item.id} /><button className="btn-secondary">Lưu trữ</button></form></div></article>)}{notifications.length === 0 ? <p className="py-8 text-center text-stone-500">Không có thông báo phù hợp.</p> : null}</div></div></DashboardShell>;
}
