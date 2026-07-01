# Haravan integration plan

Phase 1 supports manual Haravan order import from the admin settings page. The sync fetches orders from Haravan, stores partner-first order and line-item records, writes `HaravanSyncLog` rows, and attributes orders by matching the first Haravan discount code to an active code owned by an approved, enabled `referral_ctv` partner.

The import stores `eligible_product_revenue` as collected product revenue after item discounts and keeps shipping fees separate so the future commission engine can apply the partner policy correctly. It also records unmatched discount-code attribution rows for reconciliation visibility.

Required environment variables are `HARAVAN_ACCESS_TOKEN` and optionally `HARAVAN_API_BASE_URL` (defaults to `https://apis.haravan.com`). Manual sync calls `GET https://apis.haravan.com/com/orders.json` with `Authorization: Bearer ${HARAVAN_ACCESS_TOKEN}` and requires the `com.read_orders` scope. Keep real Haravan credentials in runtime secrets only; do not commit them.

After an attributed referral_ctv order is imported, the commission ledger can be recalculated idempotently. Paid delivered orders wait 7 days before becoming payable; cancelled, returned, disputed, or refused orders are rejected; deep discounts above 10% are put on hold for manual review.

Not implemented yet: webhooks, cron automation, payout execution, Mini Corner, wholesale/dealer workflows, and automated reconciliation jobs. Future webhooks must validate `HARAVAN_WEBHOOK_SECRET` before importing or updating orders.

## Order attribution priority

Haravan import keeps existing admin/manual attribution first and does not overwrite it. New attribution priority is:

1. Existing manual attribution remains unchanged.
2. Explicit affiliate data in `attributes` / `note_attributes` (`merly_partner_code`) attributes to `referral_ctv`.
3. Affiliate query params in `landing_site` / `landing_site_ref` (`ref`, `aff`, `ctv`, `partner`) attribute to `referral_ctv`.
4. Discount codes matching active `shop_referral` codes attribute to `shop_referral`.
5. Ambiguous or multiple matches stay unattributed for manual review.

Discount code attribution is not the default for individual `referral_ctv`; affiliate links, manual attribution, and future order requests are the supported individual CTV flows.
