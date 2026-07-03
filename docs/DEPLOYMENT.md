# Deployment and production database

## Production database
Use a managed PostgreSQL-compatible database and configure `DATABASE_URL` only in the deployment environment. Do not commit real credentials or generated `.env` files.

Before the first production release, apply the committed Prisma migrations:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DB?schema=public" npm run prisma:migrate:deploy
```

For local development, copy `.env.example` to `.env`, point `DATABASE_URL` at a local database, and run:

```bash
npm run prisma:migrate
npm run prisma:seed
```


After each deploy that introduces database schema changes, especially affiliate tracking fields on `PartnerCode` and `PartnerClick`, run:

```bash
npm run db:migrate
npm run db:bootstrap
```

These commands apply the committed Prisma migrations and bootstrap expected partner-code purposes; do not rely only on manual Supabase SQL hotfixes.

## Seed data
The seed keeps the platform partner-first while enabling only the Phase 1 `referral_ctv` partner type. Future partner types are present as disabled catalog records only. Seed data includes default referral commission policy records, partner levels requiring admin approval for higher tiers, sample partners, `MERLYCTV001`, and demo order/ledger rows for development review.

Run seed only against environments where demo partner data is acceptable:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DB?schema=public" npm run prisma:seed
```

## Build and release order
Recommended release sequence:

1. Configure `DATABASE_URL` in the platform secret manager.
2. Run `npm ci`.
3. Run `npx prisma generate`.
4. Run `npm run prisma:migrate:deploy` against the production database.
5. Run `npm run build`.
6. Start the Next.js application.

## Health checks
The application exposes two deployment health endpoints:

- `GET /api/health` verifies the Next.js application can serve requests without requiring database access.
- `GET /api/health/database` verifies `DATABASE_URL` is configured and the database accepts `SELECT 1` through Prisma.

Use `/api/health` for basic container liveness checks and `/api/health/database` for readiness checks where database availability is required.

## Server Action deployment mismatch handling
Each production build writes a non-secret build version from `NEXT_PUBLIC_BUILD_VERSION`, `BUILD_VERSION`, supported git SHA environment variables, or package version. The app exposes only this safe stamp at `GET /api/build-version` so browser tabs can detect when a newer deployment is serving traffic.

After every deploy, restart the Node.js application process so Server Action manifests and the build version are loaded from the same release. Ask operators and support staff to refresh open browser tabs after deployment; stale tabs will show a Vietnamese reload prompt before users continue submitting forms.
