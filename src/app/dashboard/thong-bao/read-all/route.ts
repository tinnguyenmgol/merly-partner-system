import { NextResponse } from "next/server";
import { markAllAnnouncementsReadAction } from "@/features/notifications";

export async function POST(request: Request) {
  try {
    await markAllAnnouncementsReadAction();
    return NextResponse.redirect(new URL("/dashboard/thong-bao", request.url));
  } catch (error) {
    if (typeof error === "object" && error !== null && "digest" in error && String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")) throw error;
    const message = encodeURIComponent(error instanceof Error ? error.message : "Không thể xử lý yêu cầu. Vui lòng thử lại.");
    return NextResponse.redirect(new URL("/dashboard/thong-bao?message=" + message, request.url));
  }
}
