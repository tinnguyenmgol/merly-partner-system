# Database schema

Core models: `PartnerType`, `Partner`, `PartnerProfile`, `PartnerCode`, `PartnerLevel`, `PartnerLevelRule`, `PartnerOrder`, `PartnerOrderItem`, `PartnerOrderAttribution`, `PartnerCommissionRule`, `PartnerCommissionLedger`, `PartnerPayout`, `PartnerPayoutItem`, `PartnerRiskFlag`, `AdminAuditLog`, and `HaravanSyncLog`.

`PartnerCommissionLedger` is the source of truth for commission movement and has at most one order-backed ledger row per order so manual recalculation remains idempotent. `eligible_product_revenue` is stored on orders and ledger rows. All money fields are `Int` VND. Payable ledger rows are summarized for payout readiness but actual payout execution is not implemented. Audit logs support admin changes; sync logs support future Haravan reconciliation.
