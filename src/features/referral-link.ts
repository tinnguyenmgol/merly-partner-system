import { appUrl, getPublicAppBaseUrl } from "@/lib/public-url";

export function appBaseUrl() {
  return getPublicAppBaseUrl();
}

export function partnerRecruitmentLink(code: string) {
  const url = appUrl("/dang-ky");
  url.searchParams.set("partner_ref", code);
  return url.toString();
}
