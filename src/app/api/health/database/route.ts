import { NextResponse } from "next/server";

import { db, hasDatabaseUrl } from "@/lib/db";

export const dynamic = "force-dynamic";

type DatabaseHealth = {
  status: "ok" | "error";
  service: "merly-partner-system";
  checks: {
    database: "ok" | "missing_database_url" | "unreachable";
  };
  timestamp: string;
  message?: string;
};

export async function GET() {
  const timestamp = new Date().toISOString();

  if (!hasDatabaseUrl()) {
    return NextResponse.json(
      {
        status: "error",
        service: "merly-partner-system",
        checks: { database: "missing_database_url" },
        timestamp,
        message: "DATABASE_URL is not configured.",
      } satisfies DatabaseHealth,
      { status: 503 },
    );
  }

  try {
    await db.$queryRaw`SELECT 1`;

    return NextResponse.json(
      {
        status: "ok",
        service: "merly-partner-system",
        checks: { database: "ok" },
        timestamp,
      } satisfies DatabaseHealth,
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Database health check failed.";

    return NextResponse.json(
      {
        status: "error",
        service: "merly-partner-system",
        checks: { database: "unreachable" },
        timestamp,
        message,
      } satisfies DatabaseHealth,
      { status: 503 },
    );
  }
}
