# Haravan integration plan

Phase 1 only creates placeholders. Future sync will import Haravan orders, line items, payment/delivery/cancel/return/dispute states, discount codes, shipping fees, surcharges, and timestamps. Attribution will match discount code, referral link, manual admin mapping, or imported metadata.

Webhooks should validate `HARAVAN_WEBHOOK_SECRET`. Every sync writes `HaravanSyncLog` with status, timing, message, and metadata. Errors should be retriable and visible in `/admin/settings/haravan`.
