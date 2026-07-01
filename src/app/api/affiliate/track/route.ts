import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db, hasDatabaseUrl } from "@/lib/db";

const ALLOWED_ORIGIN = "https://merlyshoes.com";
const SAFE_CODE = /^[A-Z0-9_-]{3,50}$/;

type TrackPayload = {
  partnerCode?: unknown;
  clickId?: unknown;
  landingUrl?: unknown;
  currentUrl?: unknown;
  referrer?: unknown;
  source?: unknown;
  occurredAt?: unknown;
};

function corsHeaders(origin: string | null): Record<string, string> {
  return origin === ALLOWED_ORIGIN
    ? { "Access-Control-Allow-Origin": ALLOWED_ORIGIN, Vary: "Origin" }
    : {};
}

function stringValue(value: unknown, max = 2048) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, max)
    : undefined;
}

function hashIp(request: NextRequest) {
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const ip = request.headers.get("x-real-ip") ?? forwarded;
  return ip ? createHash("sha256").update(ip).digest("hex") : undefined;
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...corsHeaders(request.headers.get("origin")),
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function POST(request: NextRequest) {
  const headers = corsHeaders(request.headers.get("origin"));

  try {
    if (!hasDatabaseUrl()) {
      return NextResponse.json(
        { ok: false, message: "Tracking database is not configured." },
        { status: 503, headers },
      );
    }

    const payload = (await request
      .json()
      .catch(() => null)) as TrackPayload | null;
    const partnerCode = stringValue(payload?.partnerCode, 50)?.toUpperCase();
    const clickId =
      stringValue(payload?.clickId, 100) ?? `merly_${crypto.randomUUID()}`;

    if (!partnerCode || !SAFE_CODE.test(partnerCode)) {
      return NextResponse.json(
        { ok: false, message: "Invalid partnerCode." },
        { status: 400, headers },
      );
    }

    const code = await db.partnerCode.findFirst({
      include: { partner: true },
      where: {
        active: true,
        code: partnerCode,
        partner: { status: "approved" },
      },
    });

    if (!code) {
      return NextResponse.json(
        { ok: false, message: "Partner code was not found or inactive." },
        { status: 404, headers },
      );
    }

    const occurredAtValue = stringValue(payload?.occurredAt, 80);
    const occurredAt = occurredAtValue ? new Date(occurredAtValue) : new Date();

    await db.partnerClick.create({
      data: {
        partnerId: code.partnerId,
        partnerCodeId: code.id,
        partnerCode,
        clickId,
        landingUrl: stringValue(payload?.landingUrl),
        currentUrl: stringValue(payload?.currentUrl),
        referrer: stringValue(payload?.referrer),
        source: stringValue(payload?.source, 100),
        userAgent: stringValue(request.headers.get("user-agent"), 512),
        ipHash: hashIp(request),
        occurredAt: Number.isNaN(occurredAt.getTime())
          ? new Date()
          : occurredAt,
      },
    });

    return NextResponse.json({ ok: true }, { headers });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Tracking event was not recorded." },
      { status: 400, headers },
    );
  }
}
