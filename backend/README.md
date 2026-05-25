# Property Guy — Backend (slim API)

Production runtime is **Supabase-first**. This package runs a small **Express** app:

- `GET /api/health`
- `POST /api/subscription/checkout` and `POST /api/subscription/cancel` (Bearer = Supabase access JWT)
- `POST /api/subscription/webhook` (Stripe → updates `public.profiles` + `public.subscriptions` by **profile UUID**)

Portfolio CRUD, PDFs, statements, bond ledger, and admin live in **`frontend/api/*`** (Vercel) and **Supabase RPC/RLS**.

## Local setup

```bash
cp .env.example .env
npm ci
npm run dev    # http://localhost:4000
```

Required for auth on subscription routes:

- `SUPABASE_URL`
- `SUPABASE_JWT_SECRET` (Dashboard → Settings → API → JWT Secret)
- `SUPABASE_SERVICE_ROLE_KEY` (webhook + profile lookup)

Optional: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `FRONTEND_URL` / `FRONTEND_URLS`.

## Build & deploy

```bash
npm run build   # tsc only — no Prisma generate
npm start
```

Docker: `backend/Dockerfile` (repo root context). No Prisma client in the image.

## Legacy Prisma scripts

One-off maintenance scripts live in **`scripts/legacy-prisma-migration/`** (not part of runtime):

```bash
npm run prisma:generate   # devDependency only
npm run reset:portfolio-data -- --email you@example.com --confirm RESET
```

They need `DATABASE_URL` and `@prisma/client` from devDependencies. See `scripts/legacy-prisma-migration/README.md`.

## Schema source of truth

- **SQL:** `supabase/migrations/`
- **Reference only:** `prisma/schema.prisma` (historical; do not use for production deploys)
