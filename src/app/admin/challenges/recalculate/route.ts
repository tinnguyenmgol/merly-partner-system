import { NextResponse } from "next/server";
import { appUrl } from "@/lib/public-url";
import { recalculateChallengesAction } from "@/features/challenges";

export async function POST() {
  try {
    await recalculateChallengesAction();
    return NextResponse.redirect(appUrl("/admin/challenges"));
  } catch (error) {
    if (typeof error === "object" && error !== null && "digest" in error && String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")) throw error;
    const message = encodeURIComponent(error instanceof Error ? error.message : "Không thể xử lý yêu cầu. Vui lòng thử lại.");
    return NextResponse.redirect(appUrl("/admin/challenges?message=" + message));
  }
}
