import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requirePartnerSession } from "@/features/auth/partner-auth";
import { createShortLinkAction, } from "@/features/growth/actions"
import { CopyButton } from "@/features/growth/copy-button";
import { shortUrl } from "@/features/growth/utils";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requirePartnerSession();
  const partner = session.account.partner;
  const links = await db.shortLink.findMany({ where: { partnerId: partner.id }, orderBy: { createdAt: "desc" }, include: { _count: { select: { clicks: true } } } });
  return <DashboardShell><div className="card space-y-5"><h1 className="text-3xl font-bold text-merly-900">Link rút gọn CTV Merly</h1><p className="text-stone-600">Chỉ dùng URL merlyshoes.com. Hệ thống tự thêm mã ref của chị nếu link chưa có.</p><form action={createShortLinkAction} className="flex flex-col gap-3 md:flex-row"><input required name="destinationUrl" className="flex-1 rounded-xl border p-3" placeholder="https://merlyshoes.com/products/..." /><button className="btn-primary">Tạo link</button></form><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="text-stone-500"><tr><th>Short URL</th><th>URL đích</th><th>Clicks</th><th>Ngày tạo</th><th>Trạng thái</th><th /></tr></thead><tbody>{links.map((link) => { const url = shortUrl(link.slug); return <tr className="border-t border-rose-50" key={link.id}><td className="py-3 font-mono">{url}</td><td className="max-w-sm truncate">{link.destinationUrl}</td><td>{link._count.clicks}</td><td>{link.createdAt.toLocaleDateString("vi-VN")}</td><td>{link.disabledAt ? "Đã tắt" : "Đang bật"}</td><td><CopyButton value={url} /></td></tr>; })}</tbody></table></div></div></DashboardShell>;
}
