import { NextResponse } from "next/server";
import { requireAdminSession } from "@/features/auth/admin-auth";
import { sendAdminAlertEmail } from "@/features/notification-email";
export async function POST(request: Request) { await requireAdminSession(); const result = await sendAdminAlertEmail({ subject: "Merly Partner: Email test", lines: ["Đây là email test từ cài đặt thông báo.", `Thời gian: ${new Date().toISOString()}`], actionPath: "/admin/settings/notifications" }); const message = result.skippedReason ? `Bỏ qua: ${result.skippedReason}` : `Đã thử gửi ${result.attempted}, thành công ${result.sent}, lỗi ${result.failed}`; return NextResponse.redirect(new URL(`/admin/settings/notifications?message=${encodeURIComponent(message)}`, request.url)); }
