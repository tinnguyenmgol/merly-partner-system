import { NextResponse } from "next/server";
import { appUrl } from "@/lib/public-url";
import { archiveAnnouncementAction } from "@/features/growth/actions";

export async function POST(request: Request) {
  const formData = await request.formData();
  try {
    await archiveAnnouncementAction(formData);
    return NextResponse.redirect(appUrl("/admin/announcements"));
  } catch (error) {
    if (typeof error === "object" && error !== null && "digest" in error && String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")) throw error;
    const message = encodeURIComponent(error instanceof Error ? error.message : "Không thể xử lý yêu cầu. Vui lòng thử lại.");
    return NextResponse.redirect(appUrl("/admin/announcements?message=" + message));
  }
}
