import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireAdminSession } from "@/features/auth/admin-auth";
import { archiveAnnouncementAction, createAnnouncementAction, disableShortLinkAction, } from "@/features/growth/actions"
import { shortUrl } from "@/features/growth/utils";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireAdminSession();
  const [announcements, suspiciousLinks] = await Promise.all([
    db.partnerAnnouncement.findMany({ orderBy: [{ pinned: "desc" }, { publishAt: "desc" }], take: 50, include: { _count: { select: { reads: true } } } }),
    db.shortLink.findMany({ where: { disabledAt: null }, orderBy: { createdAt: "desc" }, take: 50, include: { partner: { select: { displayName: true } }, _count: { select: { clicks: true } } } }),
  ]);
  return <DashboardShell admin><div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
    <form action={createAnnouncementAction} className="card space-y-4">
      <h1 className="text-3xl font-bold text-merly-900">Thông báo CTV</h1>
      <input name="title" required className="w-full rounded-xl border p-3" placeholder="Tiêu đề" />
      <textarea name="body" required className="min-h-40 w-full rounded-xl border p-3" placeholder="Nội dung" />
      <div className="grid gap-3 md:grid-cols-2"><input name="category" className="rounded-xl border p-3" placeholder="Danh mục" defaultValue="general" /><select name="priority" className="rounded-xl border p-3" defaultValue="normal"><option value="normal">Thường</option><option value="high">Quan trọng</option><option value="urgent">Khẩn</option></select></div>
      <div className="grid gap-3 md:grid-cols-2"><label className="text-sm">Publish at<input name="publishAt" type="datetime-local" className="mt-1 w-full rounded-xl border p-3" /></label><label className="text-sm">Expires at<input name="expiresAt" type="datetime-local" className="mt-1 w-full rounded-xl border p-3" /></label></div>
      <div className="grid gap-3 md:grid-cols-2"><input name="ctaLabel" className="rounded-xl border p-3" placeholder="CTA label" /><input name="ctaUrl" className="rounded-xl border p-3" placeholder="CTA URL" /></div>
      <label className="flex gap-2 text-sm"><input name="pinned" type="checkbox" /> Ghim thông báo</label><button className="btn-primary">Tạo thông báo</button>
    </form>
    <div className="card"><h2 className="text-2xl font-bold text-merly-900">Danh sách</h2><div className="mt-4 space-y-3">{announcements.map((item) => <div key={item.id} className="rounded-xl border border-rose-100 p-4"><div className="flex justify-between gap-3"><b>{item.pinned ? "📌 " : ""}{item.title}</b><span className="text-sm text-stone-500">{item.priority} · {item._count.reads} đã đọc</span></div><p className="mt-2 whitespace-pre-wrap text-sm text-stone-600">{item.body}</p><p className="mt-2 text-xs text-stone-500">Xuất bản {item.publishAt.toLocaleString("vi-VN")} {item.expiresAt ? `· Hết hạn ${item.expiresAt.toLocaleString("vi-VN")}` : ""} {item.archivedAt ? "· Đã lưu trữ" : ""}</p>{!item.archivedAt ? <form action={archiveAnnouncementAction} className="mt-2"><input type="hidden" name="id" value={item.id} /><button className="text-sm font-semibold text-merly-700">Lưu trữ</button></form> : null}</div>)}</div></div>
    <div className="card lg:col-span-2"><h2 className="text-2xl font-bold text-merly-900">Link rút gọn mới tạo</h2><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th>CTV</th><th>Short URL</th><th>Đích</th><th>Clicks</th><th /></tr></thead><tbody>{suspiciousLinks.map((link) => <tr className="border-t" key={link.id}><td className="py-3">{link.partner.displayName}</td><td>{shortUrl(link.slug)}</td><td className="max-w-md truncate">{link.destinationUrl}</td><td>{link._count.clicks}</td><td><form action={disableShortLinkAction}><input type="hidden" name="id" value={link.id} /><button className="font-semibold text-merly-700">Disable</button></form></td></tr>)}</tbody></table></div></div>
  </div></DashboardShell>;
}
