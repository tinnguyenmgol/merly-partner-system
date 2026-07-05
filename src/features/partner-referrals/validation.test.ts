import assert from "node:assert/strict";
import { getPublicAppBaseUrl, appUrl } from "@/lib/public-url";
import { parsePartnerReferralRewardAmount, parsePartnerReferralStatus } from "./validation";

assert.equal(parsePartnerReferralStatus("reward_pending"), "reward_pending");
assert.throws(() => parsePartnerReferralStatus("paid"), /INVALID_REFERRAL_STATUS/);
assert.equal(parsePartnerReferralRewardAmount(""), null);
assert.equal(parsePartnerReferralRewardAmount("150000"), 150000);
assert.throws(() => parsePartnerReferralRewardAmount("12.5"), /INVALID_REWARD_AMOUNT/);
assert.throws(() => parsePartnerReferralRewardAmount("-1"), /INVALID_REWARD_AMOUNT/);
assert.equal(getPublicAppBaseUrl(), "https://partner.merlyshoes.com");
assert.equal(appUrl("/admin/partner-referrals?message=ok").toString(), "https://partner.merlyshoes.com/admin/partner-referrals?message=ok");
