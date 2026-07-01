import { OrderAttributionSource } from "@prisma/client";

const validAttributionSources = new Set<string>(Object.values(OrderAttributionSource));

export type AttributionSourceFilter =
  | { kind: "all" }
  | { kind: "unattributed" }
  | { kind: "source"; source: OrderAttributionSource };

export function parseAttributionSourceFilter(
  value: string | null | undefined,
): AttributionSourceFilter {
  if (!value || value === "all") {
    return { kind: "all" };
  }

  if (value === "unattributed" || value === "none") {
    return { kind: "unattributed" };
  }

  if (validAttributionSources.has(value)) {
    return {
      kind: "source",
      source: value as OrderAttributionSource,
    };
  }

  return { kind: "all" };
}
