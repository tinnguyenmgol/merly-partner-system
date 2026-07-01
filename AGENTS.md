# AGENTS.md — Merly Partner System

## Project context

This project is Merly Partner System, starting with the "CTV không ôm hàng" module for Merly Shoes.

The system must be designed as a partner platform, not only a CTV app. Future partner types include:
- referral_ctv
- mini_corner
- wholesale_agent
- shop_referral
- affiliate_creator

Phase 1 only implements referral_ctv.

## Business rules

Commission applies only to referral_ctv orders.

Commission base:
- product revenue actually collected after discount
- exclude shipping
- exclude surcharges
- exclude boxes, bags, or non-product fees
- exclude cancelled, returned, refused, or disputed orders

Default commission rules:
- listed price, no discount: 10%
- 10 successful orders/month: eligible for admin-approved 12%
- 30 successful orders/month: eligible for admin-approved 15%
- discount from 5% to 10%: default 7%
- discount above 10%, deep sale, clearance: manual review or campaign-specific rate
- unauthorized partner discount: 0%

Commission status flow:
- temporary when order is created
- pending_delivery while order is not delivered
- reconciliation_waiting after successful delivery
- payable after 7 days without cancellation, return, refusal, or dispute
- paid after payout
- rejected if invalid
- on_hold if manual review is needed

Minimum payout:
- 100,000 VND
- unpaid commission below this amount rolls over to the next period

Personal/family orders:
- allowed
- still eligible if genuine, paid, delivered, and not returned/cancelled
- suspicious patterns should be flagged, not auto-rejected

## Technical rules

Use TypeScript.
Use clear domain naming:
- partner, not ctv, in backend/database
- referral_ctv as partner_type
- commission_ledger as source of truth for commission movement

Do not hard-code commission rates directly in business logic. Use configurable rules where practical.

Every money value should be stored in VND integer units.

Every admin action that changes partner status, commission, payout, or attribution should create an audit log.

## Testing

Add tests for:
- commission base calculation
- commission status transitions
- payout minimum and rollover
- invalid order rejection
- discounted order commission
