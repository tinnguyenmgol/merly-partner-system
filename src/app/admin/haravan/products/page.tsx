import { Prisma } from "@prisma/client";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireAdminSession } from "@/features/auth/admin-auth";
import { CopyButton } from "@/features/growth/copy-button";
import { db, hasDatabaseUrl } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdminSession();
  const { q = "" } = await searchParams;
  const where: Prisma.HaravanProductWhereInput = q ? { OR: [
    { title: { contains: q, mode: "insensitive" } }, { handle: { contains: q, mode: "insensitive" } },
    { variants: { some: { OR: [{ sku: { contains: q, mode: "insensitive" } }, { title: { contains: q, mode: "insensitive" } }] } } },
  ] } : {};
  const [products, count, lastLog] = hasDatabaseUrl() ? await Promise.all([
    db.haravanProduct.findMany({ where, include: { variants: { select: { sku: true, title: true }, take: 3 } }, orderBy: { syncedAt: "desc" }, take: 50 }),
    db.haravanProduct.count(),
    db.haravanSyncLog.findFirst({ where: { syncType: "products" }, orderBy: { startedAt: "desc" } }),
  ]) : [[], 0, null] as const;
  return <DashboardShell admin><div className="card"><div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-bold text-merly-900">Sản phẩm Haravan</h1><p className="mt-2 text-stone-600">Đồng bộ catalog để admin/CTV lấy link sản phẩm nhanh, không hiển thị giá vốn hoặc dữ liệu nội bộ.</p><p className="mt-2 text-sm text-stone-500">Tổng: {count} · Sync gần nhất: {lastLog?.finishedAt?.toLocaleString("vi-VN") ?? "—"}</p></div><form method="post" action="/admin/haravan/products/sync"><button className="btn-primary" disabled={!hasDatabaseUrl()}>Đồng bộ sản phẩm Haravan</button></form></div><form className="mt-6 flex gap-2"><input className="input flex-1" name="q" defaultValue={q} placeholder="Tìm title, handle, SKU, mã sản phẩm"/><button className="btn-secondary">Tìm</button></form></div><div className="card mt-6 overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="text-stone-500"><tr><th>Ảnh</th><th>Sản phẩm</th><th>Handle/SKU</th><th>Trạng thái</th><th>Sync</th><th>URL</th></tr></thead><tbody>{products.map((p)=><tr key={p.id} className="border-t border-rose-50"><td className="py-3">{p.imageUrl ? <div aria-label={p.title} role="img" className="h-14 w-14 rounded-xl bg-cover bg-center" style={{ backgroundImage: `url(${p.imageUrl})` }}/> : <div className="h-14 w-14 rounded-xl bg-rose-50"/>}</td><td><b>{p.title}</b><p className="text-xs text-stone-500">{p.vendor} {p.productType ? `· ${p.productType}` : ""}</p></td><td><div>{p.handle ?? "—"}</div><p className="text-xs text-stone-500">{p.variants.map(v=>v.sku || v.title).filter(Boolean).join(", ")}</p></td><td>{p.status ?? "—"}</td><td>{p.syncedAt.toLocaleString("vi-VN")}</td><td>{p.productUrl ? <div className="flex items-center gap-2"><a className="link max-w-xs truncate" href={p.productUrl} target="_blank" rel="noreferrer">{p.productUrl}</a><CopyButton value={p.productUrl}/></div> : "—"}</td></tr>)}</tbody></table>{products.length===0?<p className="p-6 text-center text-stone-500">Chưa có sản phẩm hoặc không tìm thấy kết quả.</p>:null}</div></DashboardShell>;
}
