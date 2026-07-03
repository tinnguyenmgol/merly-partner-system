import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requirePartnerSession } from "@/features/auth/partner-auth";
import { appUrl } from "@/lib/public-url";
import { db } from "@/lib/db";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: lessonId } = await params;
  const session = await requirePartnerSession();
  const partnerId = session.account.partner.id;
  const now = new Date();

  const lesson = await db.partnerTrainingLesson.findFirst({
    where: { id: lessonId, status: "published", archivedAt: null, publishAt: { lte: now } },
    select: { id: true },
  });

  if (!lesson) {
    return NextResponse.redirect(appUrl(`/dashboard/dao-tao/${lessonId}`));
  }

  await db.partnerTrainingProgress.upsert({
    where: { lessonId_partnerId: { lessonId, partnerId } },
    create: { lessonId, partnerId, status: "completed", startedAt: now, completedAt: now },
    update: { status: "completed", completedAt: now },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/dao-tao");
  revalidatePath(`/dashboard/dao-tao/${lessonId}`);
  return NextResponse.redirect(appUrl(`/dashboard/dao-tao/${lessonId}`));
}
