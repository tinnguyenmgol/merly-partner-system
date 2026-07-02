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

## CTV authentication and dashboard
Approved Phase 1 `referral_ctv` partners now use real partner login accounts. When an admin approves a referral CTV profile, the system creates or links a `PartnerAccount` in `invited` status and the admin manually generates/copies a `/thiet-lap-mat-khau?token=...` setup link. Tokens are stored only as hashes, expire after 7 days, and are single-use.

The CTV sets a password, the account becomes `active`, and they log in at `/dang-nhap` with phone or email plus password. Authenticated dashboard pages read the partner id from the server-side session cookie and show only that partner's referral code, orders, commission ledger summary, payout-minimum status, and read-only profile details. `/dang-xuat` revokes the session and clears the httpOnly cookie.

Out of scope remains full admin auth/RBAC, email/SMS sending, OTP, payout requests, and specialized Mini Corner/wholesale/shop-referral dashboards.

## SMTP email for CTV password reset

Forgot-password email delivery uses SMTP configuration from environment variables. Production Hostinger should be configured with:

```env
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=noreply@merlyshoes.com
SMTP_PASSWORD=<mailbox password>
SMTP_FROM=noreply@merlyshoes.com
APP_BASE_URL=https://partner.merlyshoes.com
```

If the SMTP variables are incomplete, the app does not crash. It still creates eligible one-time reset tokens and keeps the admin/manual reset-link fallback, but transactional email sending is skipped with an internal result. After changing environment variables on Hostinger, restart the Node app so the running process loads the new values.
