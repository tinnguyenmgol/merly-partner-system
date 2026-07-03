import { NextResponse } from "next/server";
import { buildVersion } from "@/lib/build-version";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { buildVersion },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
