# Database schema

Core models: `PartnerType`, `Partner`, `PartnerProfile`, `PartnerCode`, `PartnerLevel`, `PartnerLevelRule`, `PartnerOrder`, `PartnerOrderItem`, `PartnerOrderAttribution`, `PartnerCommissionRule`, `PartnerCommissionLedger`, `PartnerPayout`, `PartnerPayoutItem`, `PartnerRiskFlag`, `AdminAuditLog`, and `HaravanSyncLog`.

`PartnerCommissionLedger` is the source of truth for commission movement. `eligible_product_revenue` is stored on orders and ledger rows. All money fields are `Int` VND. Audit logs support admin changes; sync logs support future Haravan reconciliation.
