import { getPublicAppBaseUrl } from "@/lib/public-url";

export function appBaseUrl() { return getPublicAppBaseUrl(); }
export function partnerRecruitmentLink(code: string) { return `${appBaseUrl()}/dang-ky?partner_ref=${encodeURIComponent(code)}`; }
