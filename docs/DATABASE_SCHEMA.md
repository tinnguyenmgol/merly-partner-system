# Database schema

Core models: `PartnerType`, `Partner`, `PartnerProfile`, `PartnerCode`, `PartnerLevel`, `PartnerLevelRule`, `PartnerOrder`, `PartnerOrderItem`, `PartnerOrderAttribution`, `PartnerCommissionRule`, `PartnerCommissionLedger`, `PartnerPayout`, `PartnerPayoutItem`, `PartnerRiskFlag`, `AdminAuditLog`, and `HaravanSyncLog`.

`PartnerCommissionLedger` is the source of truth for commission movement and has at most one order-backed ledger row per order so manual recalculation remains idempotent. `eligible_product_revenue` is stored on orders and ledger rows. All money fields are `Int` VND. Payable ledger rows are summarized for payout readiness but actual payout execution is not implemented. Audit logs support admin changes; sync logs support future Haravan reconciliation.

## Affiliate tracking additions

`PartnerClick` stores affiliate tracking events with `partnerId`, `partnerCodeId`, normalized `partnerCode`, `clickId`, landing/current URLs, referrer, source, user agent, optional hashed IP, `occurredAt`, and `createdAt`. Indexes cover `partnerCode`, `clickId`, `partnerId`, and `occurredAt` for lookup and reporting.

`PartnerCode` includes `codePurpose` string values such as `affiliate_tracking`, `shop_discount_code`, and `manual_referral`, plus optional `commissionRateBps` and `customerDiscountBps`. These fields document attribution/program intent only; commission calculation remains a later engine by partner type/program.
