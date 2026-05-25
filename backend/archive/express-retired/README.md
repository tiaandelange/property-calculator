# Express runtime (retired)

The Node.js Express API was removed after the Supabase + Vercel cutover (2026-05).

**Production stack:**

- **SPA:** Vercel (`frontend/`)
- **Serverless:** `frontend/api/*` (Stripe, PDFs, bond, cron, email)
- **Data:** Supabase Auth, Postgres (RLS), Storage
- **Shared math:** `shared/calculatorShared/` (bundled by Vite as `@calculatorShared`)

**Legacy tooling still in `backend/`:**

- `prisma/` + `scripts/legacy-prisma-migration/` — one-off data migration scripts only (not production runtime)
- `scripts/verify-public-frontend-env.mjs` — ensures no service-role keys in `frontend/src`

For historical Express route implementations, see git history before the Express retirement commit.
