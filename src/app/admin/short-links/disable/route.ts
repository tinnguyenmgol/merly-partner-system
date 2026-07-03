import { NextResponse } from "next/server";
import { disableShortLinkAction } from "@/features/growth/actions";

export async function POST(request: Request) {
  const formData = await request.formData();
  try {
    await disableShortLinkAction(formData);
    return NextResponse.redirect(new URL("/admin/announcements", request.url));
  } catch (error) {
    if (typeof error === "object" && error !== null && "digest" in error && String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")) throw error;
    return NextResponse.redirect(new URL("/admin/announcements?message=Kh%C3%B4ng%20th%E1%BB%83%20t%E1%BA%AFt%20link.", request.url));
  }
}
