# Architecture

The app uses `src/app` for routes, `src/components` for shared UI/layout, `src/features` for domain modules, and `src/lib` for infrastructure utilities. Partner-first design keeps `Partner`, `PartnerType`, `PartnerOrder`, `PartnerCommissionLedger`, and payout concepts reusable for future partner types.

Routes include public pages, partner dashboard shells, and admin shells. Future extension points: Haravan sync, commission engine, payout workflow, risk review, Mini Corner inventory, and wholesale/dealer debt modules.
