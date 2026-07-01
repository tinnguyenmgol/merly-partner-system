# Haravan integration plan

Phase 1 supports manual Haravan order import from the admin settings page. The sync fetches orders from Haravan, stores partner-first order and line-item records, writes `HaravanSyncLog` rows, and attributes orders by matching the first Haravan discount code to an active code owned by an approved, enabled `referral_ctv` partner.

The import stores `eligible_product_revenue` as collected product revenue after item discounts and keeps shipping fees separate so the future commission engine can apply the partner policy correctly. It also records unmatched discount-code attribution rows for reconciliation visibility.

Required environment variables are `HARAVAN_ACCESS_TOKEN` and optionally `HARAVAN_API_BASE_URL` (defaults to `https://apis.haravan.com`). Manual sync calls `GET https://apis.haravan.com/com/orders.json` with `Authorization: Bearer ${HARAVAN_ACCESS_TOKEN}` and requires the `com.read_orders` scope. Keep real Haravan credentials in runtime secrets only; do not commit them.

After an attributed referral_ctv order is imported, the commission ledger can be recalculated idempotently. Paid delivered orders wait 7 days before becoming payable; cancelled, returned, disputed, or refused orders are rejected; deep discounts above 10% are put on hold for manual review.

Not implemented yet: webhooks, cron automation, payout execution, Mini Corner, wholesale/dealer workflows, and automated reconciliation jobs. Future webhooks must validate `HARAVAN_WEBHOOK_SECRET` before importing or updating orders.
