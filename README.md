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

## Database setup, migrations, and seed
```bash
npm run prisma:migrate # local development only
npm run prisma:migrate:deploy # production / CI deployment
npm run prisma:seed
```


After deploying application code that includes affiliate tracking schema changes, run the long-term Prisma migration/bootstrap commands instead of relying on manual Supabase SQL hotfixes:

```bash
npm run db:migrate
npm run db:bootstrap
```

The Prisma client generation flow is: `npm install`, `npx prisma generate`, then `npm run build`. The initial production migration is committed in `prisma/migrations`.

Seed data includes partner types with only `referral_ctv` enabled, default commission rules, partner levels, sample approved/pending partners, `MERLYCTV001`, and demo order/ledger rows. Do not run seed against production unless demo data is intended.


## Deployment
- Recommended production Node runtime: **Node 20 LTS** when keeping Prisma Client 5.22. The repository includes `.nvmrc` with `20` for hosts that support nvm.
- Prisma Client is instantiated through `src/lib/db.ts` and cached on `globalThis`, including production, to avoid multiple query-engine clients if Hostinger loads separate server chunks in the same Node process.
- If production logs show a Prisma query engine panic such as `PrismaClientRustPanicError` or `PANIC: timer has gone away`, restart the Hostinger Node app after switching to Node 20 LTS.
- After schema changes, run `npm run db:migrate` and `npm run db:bootstrap` over SSH. If SSH is unavailable during an incident, apply the reviewed Supabase SQL hotfix first, then run the migration/bootstrap commands when access is restored so Prisma migrations remain the long-term source of truth.
- Configure `DATABASE_URL` in the hosting/runtime environment before using partner registration or admin review features.
- Apply production migrations with `DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DB?schema=public" npm run prisma:migrate:deploy`; keep real credentials out of git.
- Admin partner management and public CTV registration require a live PostgreSQL database at runtime.
- Production builds should not require database access; database-backed pages run dynamically and runtime features use `DATABASE_URL` when handling requests or server actions.
- Health checks: `GET /api/health` for application liveness and `GET /api/health/database` for database readiness. See `docs/DEPLOYMENT.md`.

## Development commands
```bash
npm run lint
npm run typecheck
npm run build # runs sync-logo before next build
```

## Current phase scope
Implemented: route shells, responsive UI, Merly logo usage, Prisma schema, seed data, docs, partner intake/review, manual Haravan order sync with split affiliate-link/shop-discount attribution, affiliate click tracking, commission ledger recalculation, 7-day reconciliation wait, and payout-ready balance previews.

## Not implemented yet
No Mini Corner, wholesale/dealer workflows, webhooks, new commission engine, payout engine, payment automation, production auth, or complex analytics are implemented in Phase 1.


## Attribution model
Individual `referral_ctv` partners use affiliate links (`https://merlyshoes.com/?ref=MERLYCTV001`), admin/manual attribution, or future order requests; customers do not need discount codes. `shop_referral` partners use discount codes where customer discount and shop commission can be tied to the code. Future commission work must calculate by partner type/program instead of assuming one attribution method. See `docs/MERLY_WEBSITE_AFFILIATE_TRACKING.md` for the paste-ready website script.
