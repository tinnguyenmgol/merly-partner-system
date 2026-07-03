import Image from "next/image";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requirePartnerSession } from "@/features/auth/partner-auth";
import { db } from "@/lib/db";
import { partnerDebugLog } from "@/lib/debug-logs";

export const dynamic = "force-dynamic";

function isVisibleLesson(lesson: { status: string; archivedAt: Date | null; publishAt: Date | null } | null, now: Date): lesson is { status: string; archivedAt: Date | null; publishAt: Date | null } {
  return Boolean(
    lesson &&
      lesson.status === "published" &&
      !lesson.archivedAt &&
      (!lesson.publishAt || lesson.publishAt <= now),
  );
}

function EmptyLessonState() {
  return (
    <DashboardShell>
      <div className="mx-auto max-w-2xl rounded-2xl bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-merly-900">Bài học không tồn tại hoặc chưa được xuất bản.</h1>
        <p className="mt-3 text-stone-600">Chị quay lại Trung tâm đào tạo để xem các bài học đang mở nhé.</p>
        <Link href="/dashboard/dao-tao" className="btn-primary mt-6 inline-flex">
          Quay lại trung tâm đào tạo
        </Link>
      </div>
    </DashboardShell>
  );
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requirePartnerSession();
  const partnerId = session.account.partner.id;
  const now = new Date();
  const lesson = await db.partnerTrainingLesson.findUnique({
    where: { id },
    include: { progress: { where: { partnerId } } },
  });

  partnerDebugLog("[training-lesson] detail lookup", {
    lessonId: id,
    partnerType: session.account.partner.partnerType.code,
    found: Boolean(lesson),
    status: lesson?.status,
    archived: Boolean(lesson?.archivedAt),
    publishAtIso: lesson?.publishAt?.toISOString() ?? null,
  });

  if (!isVisibleLesson(lesson, now)) return <EmptyLessonState />;

  const progress = lesson.progress[0]?.status ?? "not_started";
  const done = progress === "completed";

  return (
    <DashboardShell>
      <article className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow-sm">
        <Link href="/dashboard/dao-tao" className="text-sm font-semibold text-merly-700">
          ← Quay lại trung tâm đào tạo
        </Link>
        {lesson.thumbnailUrl ? (
          <div className="relative mt-5 aspect-video overflow-hidden rounded-2xl bg-rose-50">
            <Image src={lesson.thumbnailUrl} alt={lesson.title} fill className="object-cover" sizes="(min-width: 768px) 768px, 100vw" />
          </div>
        ) : null}
        <p className="mt-5 text-sm font-bold uppercase text-merly-700">
          {lesson.category} · {lesson.level} · {lesson.estimatedMinutes ?? 10} phút
        </p>
        <h1 className="mt-2 text-3xl font-bold text-merly-900">{lesson.title}</h1>
        {lesson.description ? <p className="mt-3 text-stone-600">{lesson.description}</p> : null}
        <p className="mt-4 rounded-full bg-rose-50 px-4 py-2 text-sm font-semibold text-merly-700">
          Trạng thái: {done ? "Đã hoàn thành" : progress === "in_progress" ? "Đang học" : "Chưa học"}
        </p>
        {lesson.videoUrl ? (
          <a className="mt-4 inline-block font-semibold text-merly-700" href={lesson.videoUrl} target="_blank" rel="noreferrer">
            Mở video đào tạo →
          </a>
        ) : null}
        <div className="prose prose-stone mt-6 max-w-none whitespace-pre-wrap">{lesson.body || "Merly sẽ cập nhật nội dung bài học chi tiết."}</div>
        <form method="post" action={`/dashboard/dao-tao/${lesson.id}/complete`} className="mt-6">
          <button className="btn-primary" disabled={done}>{done ? "Đã hoàn thành" : "Đánh dấu đã hoàn thành"}</button>
        </form>
      </article>
    </DashboardShell>
  );
}
