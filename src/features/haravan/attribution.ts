import { ATTRIBUTION_SOURCES } from "@/features/partners/attribution-sources";
import type { Prisma } from "@prisma/client";
import type { HaravanOrder } from "./types";

const PARAMS = ["ref", "aff", "ctv", "partner"];
const SAFE_CODE = /^[A-Z0-9_-]{3,50}$/;

export function normalizePartnerCode(code?: string | null) {
  const normalized = code?.trim().toUpperCase();
  return normalized && SAFE_CODE.test(normalized) ? normalized : undefined;
}

function valuesFromAttributes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const key = String(record.name ?? record.key ?? "").toLowerCase();
    if (
      [
        "merly_partner_code",
        "partner_code",
        "ref",
        "aff",
        "ctv",
        "partner",
      ].includes(key)
    ) {
      const candidate = record.value;
      return typeof candidate === "string" ? [candidate] : [];
    }
    return [];
  });
}

function codesFromUrl(value?: string | null) {
  if (!value) return [];
  try {
    const url = new URL(value, "https://merlyshoes.com");
    return PARAMS.map((param) => url.searchParams.get(param)).filter(
      Boolean,
    ) as string[];
  } catch {
    return [];
  }
}

export function extractHaravanAttributionCandidates(order: HaravanOrder) {
  const explicit = [
    ...valuesFromAttributes(order.attributes),
    ...valuesFromAttributes(order.note_attributes),
  ]
    .map(normalizePartnerCode)
    .filter(Boolean) as string[];
  const landing = [
    ...codesFromUrl(order.landing_site),
    ...codesFromUrl(order.landing_site_ref),
  ]
    .map(normalizePartnerCode)
    .filter(Boolean) as string[];
  const discounts = (order.discount_codes ?? [])
    .map((discount) => normalizePartnerCode(discount.code))
    .filter(Boolean) as string[];
  return {
    explicit: [...new Set(explicit)],
    landing: [...new Set(landing)],
    discounts: [...new Set(discounts)],
  };
}

export async function resolveHaravanAttribution(
  tx: Prisma.TransactionClient,
  order: HaravanOrder,
) {
  const candidates = extractHaravanAttributionCandidates(order);
  const findCode = async (
    code: string,
    partnerType: "referral_ctv" | "shop_referral",
  ) =>
    tx.partnerCode.findFirst({
      include: { partner: { include: { partnerType: true } } },
      where: {
        active: true,
        code,
        partner: {
          status: "approved",
          partnerType: { code: partnerType, enabled: true },
        },
      },
    });

  for (const code of candidates.explicit) {
    const match = await findCode(code, "referral_ctv");
    if (match && candidates.explicit.length === 1)
      return {
        partnerCode: match,
        source: ATTRIBUTION_SOURCES.AFFILIATE_LINK,
        value: code,
        note: "Matched referral_ctv affiliate code from Haravan attributes.",
      };
  }
  for (const code of candidates.landing) {
    const match = await findCode(code, "referral_ctv");
    if (match && candidates.landing.length === 1)
      return {
        partnerCode: match,
        source: ATTRIBUTION_SOURCES.AFFILIATE_LINK,
        value: code,
        note: "Matched referral_ctv affiliate code from landing URL.",
      };
  }
  for (const code of candidates.discounts) {
    const match = await findCode(code, "referral_ctv");
    if (match && candidates.discounts.length === 1)
      return {
        partnerCode: match,
        source: ATTRIBUTION_SOURCES.DISCOUNT_CODE,
        value: code,
        note: "Matched referral_ctv discount code from Haravan discounts.",
      };
  }
  for (const code of candidates.discounts) {
    const match = await findCode(code, "shop_referral");
    if (match && candidates.discounts.length === 1)
      return {
        partnerCode: match,
        source: ATTRIBUTION_SOURCES.SHOP_DISCOUNT_CODE,
        value: code,
        note: "Matched shop_referral discount code.",
      };
  }

  return {
    partnerCode: null,
    source: null,
    value:
      [
        ...candidates.explicit,
        ...candidates.landing,
        ...candidates.discounts,
      ].join(",") || undefined,
    note: "No unambiguous partner attribution matched; leave for manual review.",
  };
}
