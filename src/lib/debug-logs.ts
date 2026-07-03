export function debugPartnerLogsEnabled() {
  return process.env.DEBUG_PARTNER_LOGS === "true";
}

export function partnerDebugLog(message: string, details: Record<string, unknown>) {
  if (debugPartnerLogsEnabled()) {
    console.info(message, details);
  }
}
