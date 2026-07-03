import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requirePartnerSession } from "@/features/auth/partner-auth";
import { markAnnouncementReadAction } from "@/features/growth/actions";
import { markAllAnnouncementsReadAction } from "@/features/notifications";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const vietnamDateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Asia/Ho_Chi_Minh",
});

function formatVietnamDateTime(date: Date) {
  return vietnamDateTimeFormatter.format(date);
}

export default async function Page() {
  const session = await requirePartnerSession();
  const partner = session.account.partner;
  const now = new Date();
  const baseWhere = { targetPartnerType: partner.partnerType.code, archivedAt: null };
  const [countBeforeTimeFilter, items] = await Promise.all([
    db.partnerAnnouncement.count({ where: baseWhere }),
    db.partnerAnnouncement.findMany({ where: { ...baseWhere, publishAt: { lte: now }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }, orderBy: [{ pinned: "desc" }, { publishAt: "desc" }], include: { reads: { where: { partnerId: partner.id }, select: { readAt: true } } } }),
  ]);
  const firstItem = items[0];
  console.info("[partner-announcements] CTV query", {
    partnerType: partner.partnerType.code,
    countBeforeTimeFilter,
    countAfterTimeFilter: items.length,
    nowIso: now.toISOString(),
    firstItemPublishAtIso: firstItem?.publishAt.toISOString(),
    firstItemExpiresAtIso: firstItem?.expiresAt?.toISOString() ?? null,
  });
  return <DashboardShell><div className="card"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-3xl font-bold text-merly-900">Thông báo</h1><p className="mt-2 text-stone-600">Cập nhật mới nhất dành cho CTV Merly.</p></div><form action={markAllAnnouncementsReadAction}><button className="btn-secondary" type="submit">Đánh dấu tất cả đã đọc</button></form></div><div className="mt-6 space-y-4">{items.map((item) => { const read = item.reads[0]; return <article key={item.id} className="rounded-2xl border border-rose-100 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold text-merly-900">{item.pinned ? "📌 " : ""}{item.title}</h2><span className="rounded-full bg-rose-50 px-3 py-1 text-sm font-semibold text-merly-700">{read ? "Đã đọc" : "Chưa đọc"}</span></div><p className="mt-1 text-sm text-stone-500">{item.category} · {item.priority} · {formatVietnamDateTime(item.publishAt)}</p><p className="mt-3 whitespace-pre-wrap text-stone-700">{item.body}</p>{item.ctaUrl && item.ctaLabel ? <a className="mt-3 inline-block font-semibold text-merly-700" href={item.ctaUrl}>{item.ctaLabel}</a> : null}{!read ? <form action={markAnnouncementReadAction} className="mt-4"><input type="hidden" name="announcementId" value={item.id} /><button className="btn-secondary">Đánh dấu đã đọc</button></form> : null}</article>; })}{items.length === 0 ? <p className="py-8 text-center text-stone-500">Chưa có thông báo mới.</p> : null}</div></div></DashboardShell>;
}
