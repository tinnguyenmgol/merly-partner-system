import { NextResponse } from "next/server";
import { createContentAssetAction } from "@/features/partner-os-actions";

export async function POST(request: Request) {
  const formData = await request.formData();
  try {
    await createContentAssetAction(formData);
    return NextResponse.redirect(new URL("/admin/content-library", request.url));
  } catch (error) {
    if (typeof error === "object" && error !== null && "digest" in error && String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")) throw error;
    const message = encodeURIComponent(error instanceof Error ? error.message : "Không thể xử lý yêu cầu. Vui lòng thử lại.");
    return NextResponse.redirect(new URL("/admin/content-library?message=" + message, request.url));
  }
}
