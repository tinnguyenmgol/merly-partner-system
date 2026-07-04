import { NextResponse } from "next/server";
import { getCurrentPartnerUnreadAnnouncementCount } from "@/features/notifications";

export const dynamic = "force-dynamic";

export async function GET() {
  const count = await getCurrentPartnerUnreadAnnouncementCount();
  return NextResponse.json({ count });
}
