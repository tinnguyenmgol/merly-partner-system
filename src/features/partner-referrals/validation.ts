export const PARTNER_REFERRAL_STATUSES = ["invited", "registered", "approved", "first_valid_order", "reward_pending", "rewarded", "rejected"] as const;
export type PartnerReferralStatus = (typeof PARTNER_REFERRAL_STATUSES)[number];

export function parsePartnerReferralRewardAmount(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) throw new Error("INVALID_REWARD_AMOUNT");
  const amount = Number(trimmed);
  if (!Number.isSafeInteger(amount)) throw new Error("INVALID_REWARD_AMOUNT");
  return amount;
}

export function parsePartnerReferralStatus(value: string): PartnerReferralStatus {
  if (PARTNER_REFERRAL_STATUSES.includes(value as PartnerReferralStatus)) return value as PartnerReferralStatus;
  throw new Error("INVALID_REFERRAL_STATUS");
}
