export function normalizeOrderCode(input?: string | number | null) {
  const value = String(input ?? "").trim();
  if (!value) return "";
  return value.replace(/^#+/, "").trim().toUpperCase();
}

export function orderCodeVariants(input?: string | number | null) {
  const normalized = normalizeOrderCode(input);
  return normalized ? [normalized, `#${normalized}`] : [];
}
