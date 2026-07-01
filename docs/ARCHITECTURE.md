# Architecture

The app uses `src/app` for routes, `src/components` for shared UI/layout, `src/features` for domain modules, and `src/lib` for infrastructure utilities. Partner-first design keeps `Partner`, `PartnerType`, `PartnerOrder`, `PartnerCommissionLedger`, and payout concepts reusable for future partner types.

Routes include public pages, partner dashboard shells, and admin shells. Current Phase 1 extension points include manual Haravan sync, idempotent commission ledger recalculation for referral_ctv orders, and payout-ready balance previews. Future extension points: webhook ingestion, cron automation, payout execution, risk review, Mini Corner inventory, and wholesale/dealer debt modules.
