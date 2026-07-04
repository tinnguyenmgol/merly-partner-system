import { NextResponse } from "next/server";
import { getAdminUnreadNotificationCount } from "@/features/notifications";

export const dynamic = "force-dynamic";

export async function GET() {
  const count = await getAdminUnreadNotificationCount();
  return NextResponse.json({ count });
}
