const TRUSTED_HOSTS = new Set(["merlyshoes.com", "www.merlyshoes.com"]);
function appBase() { return (process.env.APP_BASE_URL ?? "http://localhost:3000").replace(/\/$/, ""); }
export function ensureTrustedMerlyUrl(input: string, refCode: string) {
  const url = new URL(input.trim());
  if (!TRUSTED_HOSTS.has(url.hostname.toLowerCase())) throw new Error("Chỉ cho phép URL thuộc Merly Shoes.");
  if (!url.searchParams.has("ref")) url.searchParams.set("ref", refCode);
  return url.toString();
}
export function shortUrl(slugValue: string) { return `${appBase()}/s/${slugValue}`; }
