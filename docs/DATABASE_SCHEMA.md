# Database schema

Core models: `PartnerType`, `Partner`, `PartnerProfile`, `PartnerCode`, `PartnerLevel`, `PartnerLevelRule`, `PartnerOrder`, `PartnerOrderItem`, `PartnerOrderAttribution`, `PartnerCommissionRule`, `PartnerCommissionLedger`, `PartnerPayout`, `PartnerPayoutItem`, `PartnerRiskFlag`, `AdminAuditLog`, and `HaravanSyncLog`.

`PartnerCommissionLedger` is the source of truth for commission movement and has at most one order-backed ledger row per order so manual recalculation remains idempotent. `eligible_product_revenue` is stored on orders and ledger rows. All money fields are `Int` VND. Payable ledger rows are summarized for payout readiness but actual payout execution is not implemented. Audit logs support admin changes; sync logs support future Haravan reconciliation.

## Affiliate tracking additions

`PartnerClick` stores affiliate tracking events with `partnerId`, `partnerCodeId`, normalized `partnerCode`, `clickId`, landing/current URLs, referrer, source, user agent, optional hashed IP, `occurredAt`, and `createdAt`. Indexes cover `partnerCode`, `clickId`, `partnerId`, and `occurredAt` for lookup and reporting.

`PartnerCode` includes `codePurpose` string values such as `affiliate_tracking`, `shop_discount_code`, and `manual_referral`, plus optional `commissionRateBps` and `customerDiscountBps`. These fields document attribution/program intent only; commission calculation remains a later engine by partner type/program.

## Partner authentication additions
`PartnerAccount` links one login account to one partner (`partnerId` unique) with optional unique normalized `email`/`phone`, salted `passwordHash`, string `status` (`invited`, `active`, `disabled`), `lastLoginAt`, and `passwordSetAt` timestamps.

`PartnerAuthSession` stores only hashed session tokens (`tokenHash` unique), account relation, expiry, optional revocation timestamp, user agent, and optional hashed IP metadata. The browser receives an httpOnly cookie with the raw session token; raw session secrets are never persisted.

`PartnerAuthToken` stores only hashed setup/reset tokens (`tokenHash` unique), account relation, string `purpose` (`setup_password` or `reset_password`), expiry, and `usedAt`. Setup links expire after 7 days and are single-use. Existing approved `referral_ctv` partners are not auto-activated; admins can create/regenerate invited setup links manually.
