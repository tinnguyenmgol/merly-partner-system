# AGENTS.md — Merly Partner System

## Context
Build Merly Partner System as an extensible partner platform. Phase 1 implements only `referral_ctv` (CTV không ôm hàng); future partner types are `mini_corner`, `wholesale_agent`, `shop_referral`, and `affiliate_creator`.

## Domain rules
Use partner-oriented names in backend/database/code. Public UI may say CTV Merly. Do not create hard-coded CTV-only domain models. Use `/logo/merly-logo.png` in UI with alt text `Merly Shoes` wherever branding appears.

## Logo and binary files
Do not add, edit, or commit binary image files from Codex. Keep the source logo at `logo/merly-logo.png` when it is provided by humans, and use `scripts/sync-logo.js` to copy it into `public/logo/merly-logo.png` for local Next.js static serving. If the logo is missing, keep fallback UI text `Merly Shoes`.

## Commission rules
Commission applies only to valid `referral_ctv` orders. Use `eligible_product_revenue`: collected product revenue after discount, excluding shipping, surcharges, COD/service, boxes, bags, and other non-product fees. Money is integer VND. Commission ledger is the source of truth.

Default policy must be configurable: 10% listed price, 7% for 5–10% discount, 0% unauthorized discount, manual review above 10% discount, and admin-approved eligibility for 12%/15% levels.

## Audit and testing
Admin actions changing partner status, commission, payout, or attribution must create audit logs. Add tests for commission base, status transitions, payout minimum/rollover, invalid order rejection, and discounted commission when business logic is implemented.
