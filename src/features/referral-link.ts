export function appBaseUrl() { return (process.env.APP_BASE_URL ?? "http://localhost:3000").replace(/\/$/, ""); }
export function partnerRecruitmentLink(code: string) { return `${appBaseUrl()}/dang-ky?partner_ref=${encodeURIComponent(code)}`; }
