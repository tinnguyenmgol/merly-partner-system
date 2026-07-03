import { NextResponse } from "next/server";
import { createShortLinkAction } from "@/features/growth/actions";
import { appUrl } from "@/lib/public-url";

export async function POST(request: Request) {
  const formData = await request.formData();
  try {
    await createShortLinkAction(formData);
    return NextResponse.redirect(appUrl("/dashboard/link-rut-gon"));
  } catch (error) {
    if (typeof error === "object" && error !== null && "digest" in error && String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")) throw error;
    const message = encodeURIComponent(error instanceof Error ? error.message : "Không thể xử lý yêu cầu. Vui lòng thử lại.");
    return NextResponse.redirect(appUrl("/dashboard/link-rut-gon?message=" + message));
  }
}
