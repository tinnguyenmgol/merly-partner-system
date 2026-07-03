import { NextResponse } from "next/server";
import { createOrderRequest } from "@/features/order-requests";

export async function POST(request: Request) {
  const formData = await request.formData();
  try {
    await createOrderRequest(formData);
    return NextResponse.redirect(new URL("/dashboard/yeu-cau-gan-don", request.url));
  } catch (error) {
    if (typeof error === "object" && error !== null && "digest" in error && String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")) throw error;
    const message = encodeURIComponent(error instanceof Error ? error.message : "Không thể xử lý yêu cầu. Vui lòng thử lại.");
    return NextResponse.redirect(new URL("/dashboard/yeu-cau-gan-don?message=" + message, request.url));
  }
}
