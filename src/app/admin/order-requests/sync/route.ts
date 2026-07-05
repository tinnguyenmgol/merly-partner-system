import { NextResponse } from "next/server";
import { appUrl } from "@/lib/public-url";
import { adminSyncOrderRequestFromHaravan } from "@/features/order-requests";

export async function POST(request: Request) {
  const formData = await request.formData();
  try {
    await adminSyncOrderRequestFromHaravan(formData);
    return NextResponse.redirect(appUrl("/admin/order-requests"));
  } catch (error) {
    if (typeof error === "object" && error !== null && "digest" in error && String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")) throw error;
    const message = encodeURIComponent(error instanceof Error ? error.message : "Không thể xử lý yêu cầu. Vui lòng thử lại.");
    return NextResponse.redirect(appUrl("/admin/order-requests?message=" + message));
  }
}
