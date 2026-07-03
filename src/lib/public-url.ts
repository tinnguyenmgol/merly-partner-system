const DEFAULT_PUBLIC_APP_BASE_URL = "https://partner.merlyshoes.com";

export function getPublicAppBaseUrl() {
  const value = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_BASE_URL || DEFAULT_PUBLIC_APP_BASE_URL;
  return value.replace(/\/$/, "");
}

export function appUrl(path: string) {
  const base = getPublicAppBaseUrl();
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(cleanPath, base);
}
