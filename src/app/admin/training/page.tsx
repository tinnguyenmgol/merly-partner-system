import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireAdminSession } from "@/features/auth/admin-auth";
import { formatVietnamDateTime } from "@/features/partner-os";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const cats = ["Bắt đầu bán cùng Merly", "Cách lấy và chia sẻ link", "Cách tư vấn size", "Cách đăng bài Facebook/Zalo", "Cách xử lý khách hỏi giá/size", "Chính sách hoa hồng và đơn hợp lệ", "Cách gửi yêu cầu gắn đơn", "Cách nhận thanh toán"];
const levels = ["beginner", "intermediate", "advanced"];

function statusBadge(status: string) {
  const label = status === "published" ? "Đã xuất bản" : status === "archived" ? "Đã lưu trữ" : "Bản nháp";
  return <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-merly-700">{label}</span>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm font-semibold text-stone-700"><span>{label}</span><div className="mt-1.5">{children}</div></label>;
}

export default async function Page() {
  await requireAdminSession();
  const lessons = await db.partnerTrainingLesson.findMany({ include: { _count: { select: { progress: true } } }, orderBy: [{ status: "asc" }, { orderIndex: "asc" }, { createdAt: "desc" }] });
  return (
    <DashboardShell admin>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-merly-900">Đào tạo</h1>
        <p className="mt-2 text-stone-600">Quản lý bài học ngắn cho CTV, đại lý và mini corner.</p>
      </div>
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <form method="post" action="/admin/training/save" className="card space-y-6">
          <section className="space-y-4">
            <h2 className="text-lg font-bold text-merly-900">Thông tin cơ bản</h2>
            <Field label="Tiêu đề bài học"><input name="title" required className="input h-12 w-full" placeholder="Ví dụ: 5 bước tư vấn size dễ hiểu" /></Field>
            <Field label="Mô tả ngắn"><textarea name="description" className="input min-h-24 w-full" placeholder="Tóm tắt ngắn hiển thị trên thẻ bài học." /></Field>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-bold text-merly-900">Phân loại</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Chủ đề"><select name="category" className="input h-12 w-full">{cats.map((c) => <option key={c}>{c}</option>)}</select></Field>
              <Field label="Cấp độ"><select name="level" className="input h-12 w-full">{levels.map((level) => <option key={level} value={level}>{level}</option>)}</select></Field>
              <Field label="Số phút ước tính"><input name="estimatedMinutes" type="number" min="1" className="input h-12 w-full" placeholder="10" /></Field>
              <Field label="Thứ tự hiển thị"><input name="orderIndex" type="number" className="input h-12 w-full" placeholder="0" /></Field>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-bold text-merly-900">Media</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Video URL"><input name="videoUrl" className="input h-12 w-full" placeholder="https://..." /></Field>
              <Field label="Thumbnail URL"><input name="thumbnailUrl" className="input h-12 w-full" placeholder="https://..." /></Field>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-bold text-merly-900">Nội dung bài học</h2>
            <Field label="Nội dung chi tiết"><textarea name="body" className="input min-h-[260px] w-full" placeholder="Nhập nội dung bài học, checklist, kịch bản tư vấn hoặc ghi chú cho CTV." /></Field>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-bold text-merly-900">Xuất bản</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Trạng thái"><select name="status" className="input h-12 w-full" defaultValue="draft"><option value="draft">draft</option><option value="published">published</option><option value="archived">archived</option></select></Field>
              <Field label="Thời điểm xuất bản"><input name="publishAt" type="datetime-local" className="input h-12 w-full" /></Field>
            </div>
            <label className="flex items-center gap-3 rounded-2xl border border-rose-100 bg-rose-50/60 p-4 text-sm font-semibold text-stone-700"><input type="checkbox" name="announce" className="h-4 w-4 accent-merly-700" /> Tạo thông báo CTV khi xuất bản</label>
            <label className="flex items-center gap-3 rounded-2xl border border-rose-100 bg-white p-4 text-sm font-semibold text-stone-700"><input type="checkbox" name="sendEmailToPartners" className="h-4 w-4 accent-merly-700" /> Gửi email cho CTV/đối tác</label>
            <button className="btn-primary w-full justify-center md:w-auto">Lưu bài học</button>
          </section>
        </form>

        <section className="card">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-bold text-merly-900">Danh sách bài học</h2><p className="mt-1 text-sm text-stone-600">Mở nhanh bài đã xuất bản để xem như CTV.</p></div><span className="text-sm font-semibold text-stone-500">{lessons.length} bài</span></div>
          <div className="mt-5 space-y-4">{lessons.map((lesson) => {
            const preview = lesson.description || lesson.body || "Chưa có mô tả nội dung.";
            const canView = lesson.status === "published" && !lesson.archivedAt;
            return <article key={lesson.id} className="rounded-2xl border border-rose-100 bg-white p-4 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><Link href={canView ? `/dashboard/dao-tao/${lesson.id}` : "#"} className={`text-lg font-bold text-merly-900 ${canView ? "hover:text-merly-700" : "pointer-events-none"}`}>{lesson.title}</Link><p className="mt-1 text-xs text-stone-500">{lesson.category} · {lesson.level} · {lesson.estimatedMinutes ?? "—"} phút · Thứ tự {lesson.orderIndex}</p></div>{statusBadge(lesson.status)}</div><p className="mt-2 text-xs text-stone-500">Xuất bản: {lesson.publishAt ? formatVietnamDateTime(lesson.publishAt) : "Chưa đặt lịch"} · Hoàn thành: {lesson._count.progress}</p><p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm text-stone-600">{preview}</p><div className="mt-4 flex flex-wrap gap-2">{canView ? <Link className="btn-primary" href={`/dashboard/dao-tao/${lesson.id}`}>Xem bài học</Link> : <button className="rounded-xl border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-400" disabled title="Chưa xuất bản">Xem bài học · Chưa xuất bản</button>}<button className="btn-secondary" disabled>Sửa</button>{lesson.status !== "archived" ? <form method="post" action="/admin/training/archive"><input type="hidden" name="id" value={lesson.id} /><button className="btn-secondary" type="submit">Lưu trữ</button></form> : null}</div></article>;
          })}{lessons.length === 0 ? <p className="rounded-2xl border border-dashed border-rose-200 p-6 text-center text-stone-500">Chưa có bài học nào.</p> : null}</div>
        </section>
      </div>
    </DashboardShell>
  );
}
