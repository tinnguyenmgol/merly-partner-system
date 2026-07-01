# Merly Partner System

Merly Partner System is a Next.js partner platform for Merly Shoes. Phase 1 builds the foundation for **CTV Merly / referral_ctv**: partners introduce or close orders while Merly handles stock, delivery, collection, reconciliation, and payouts.

## Tech stack
- Next.js App Router, TypeScript, Tailwind CSS
- Prisma with PostgreSQL-compatible schema
- Money values are integer VND
- Partner-first domain naming; `referral_ctv` is one partner type

## Local setup
```bash
npm install
cp .env.example .env
npx prisma generate
npm run dev # runs sync-logo before next dev
```


## Logo handling
Place the Merly source logo at `logo/merly-logo.png`. Codex should not add, edit, or commit binary PNG files; the repository keeps `public/logo/.gitkeep` only. The `sync-logo` script creates `public/logo` when needed and copies `logo/merly-logo.png` to `public/logo/merly-logo.png` for Next.js static serving. If the source logo is missing, the script prints a warning and the UI falls back to text branding (`Merly Shoes`).

## Environment variables
See `.env.example`, including `DATABASE_URL` and Haravan placeholders.

## Database setup and seed
```bash
npm run prisma:migrate
npm run prisma:seed
```
The Prisma client generation flow is: `npm install`, `npx prisma generate`, then `npm run build`.

Seed data includes partner types, default commission rules, partner levels, sample approved/pending partners, `MERLYCTV001`, and demo order/ledger rows.

## Development commands
```bash
npm run lint
npm run typecheck
npm run build # runs sync-logo before next build
```

## Current phase scope
Implemented: route shells, responsive UI, Merly logo usage, Prisma schema, seed data, docs, and Haravan placeholder structure.

## Not implemented yet
No Mini Corner, wholesale/dealer workflows, payment automation, full Haravan sync, production auth, or complex analytics are implemented in Phase 1.
