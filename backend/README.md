# Property Guy — Backend

Express API, Prisma ORM, and Postgres. For **Supabase-first** SQL migrations and RLS, see the repo root `supabase/` folder.

## Local setup

1. Copy env template and adjust values:

   ```bash
   cp .env.example .env
   ```

2. Install dependencies and generate Prisma client:

   ```bash
   npm install
   npx prisma generate
   ```

3. Run migrations against your database (local Docker or hosted Postgres):

   ```bash
   npx prisma migrate deploy
   ```

4. Start the API:

   ```bash
   npm run dev
   ```

## Environment variables

Values are loaded in development via `src/config/env.ts` (see file header for **server-only vs public** rules). Production hosts inject `process.env` directly.

### Server-only (never `VITE_*`, never under `frontend/src` except guarded docs)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Postgres connection string for Prisma. |
| `JWT_SECRET` | Yes in production | Legacy app JWT signing + signed download HMAC. |
| `JWT_EXPIRES_IN` | No | Legacy JWT lifetime (default `1h`). |
| `SUPABASE_JWT_SECRET` | If using Supabase Auth with Express | Dashboard → **Settings** → **API** → **JWT Secret**. Verifies Supabase access tokens during the **legacy bridge** (`resolveBearerUser`). **Server-only.** |
| `SUPABASE_SERVICE_ROLE_KEY` | If using `supabaseClient` | **service_role** key. **Bypasses RLS** — trusted backend / Vercel **server** functions only; **never** expose to the SPA. |
| `STRIPE_SECRET_KEY` | If billing enabled | Stripe **secret** API key (`sk_…`). **Server-only.** |
| `STRIPE_WEBHOOK_SECRET` | If webhooks enabled | Webhook signing secret (`whsec_…`). **Server-only.** |

### Backend public / shared with SPA (not secret, still use `process.env` on server)

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | If using Supabase JS on the server | Project URL (same value as `VITE_SUPABASE_URL` on the frontend). |
| `SUPABASE_ANON_KEY` | Optional on this server | **anon** key for future **RLS-respecting** server calls with a user JWT. The browser uses `VITE_SUPABASE_ANON_KEY`; **RLS** must protect data. |

### CORS / runtime

| Variable | Description |
|----------|-------------|
| `FRONTEND_URL` / `FRONTEND_URLS` | Allowed browser origins. |
| `PORT`, `NODE_ENV`, `TRUST_PROXY` | Standard runtime (see `.env.example`). |

Production: set secrets in your host (Render, Railway, Vercel server, etc.); do not rely on committed `.env` files.

## Supabase client (server — service role)

`src/config/supabaseClient.ts` exports:

- **`supabaseClient`** — `SupabaseClient | null` from `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)` when both are set; otherwise `null` so tests and DB-only dev still run.
- **`getSupabaseServiceClient()`** / **`getSupabaseAdminClient()`** — same accessor; throws if not configured.
- **`isSupabaseServiceConfigured`** — boolean guard.

Use this for admin operations (backfills, webhooks, jobs that must bypass RLS). End-user flows should use the **anon** key + user session on the client with **RLS**, or Prisma until migrated.

## Scripts

See `package.json`. Notable:

| Script | Purpose |
|--------|---------|
| `dev` / `start` | Run Express locally / production build. |
| `build` | `prisma generate` + `tsc`. |
| `test` / `test:integration` | Jest suites. |
| `verify:public-env` | Fails if forbidden server-only token strings appear under `frontend/src` (guards against accidental `SUPABASE_SERVICE_ROLE_KEY` / Stripe secrets in the bundle). |

Maintenance: `confirm:admin`, cleanup scripts, portfolio backup/reset, etc.
