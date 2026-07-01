import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type HealthStatus = "ok";

export function GET() {
  return NextResponse.json(
    {
      status: "ok" satisfies HealthStatus,
      service: "merly-partner-system",
      checks: {
        app: "ok",
      },
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  );
}
