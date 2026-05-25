# The Property Guy

Full-stack web app for South African property investment analysis: rental
yield, bond repayment, transfer/bond costs, affordability, portfolio cash
flow, plus a workspace for tracking owned properties, leases, tenants,
invoices and documents.

```
React + Vite + TS  ─►  Supabase (Auth, Postgres RLS, Storage, RPCs)
   (Vercel)              ▲
        │                └── Vercel Functions (PDFs, bond, email, cron)
        └── Vercel `/api/*` (Stripe, PDFs, bond, cron, email)
```

---

## Repository layout

```
.
├── frontend/                 React + Vite SPA + Vercel Functions (`frontend/api/`)
├── shared/calculatorShared/  Pure calculator engine (`@calculatorShared` alias)
├── supabase/migrations/      Postgres schema, RLS, RPCs (system of record)
├── backend/                  Legacy Prisma scripts + repo guards (not a runtime API)
├── docs/                     Architecture and deployment docs
│   ├── ARCHITECTURE.md
│   ├── DEPLOYMENT.md
│   ├── MIGRATION_STATUS.md
│   └── deployment/vercel.md
├── docker-compose.yml        Optional local containers
└── frontend/vercel.json      Vercel build + SPA rewrites + function config
```

---

## Local development quick-start

You need **Node 20+** and a **Supabase** project (local CLI or hosted).

```bash
# 1. Clone and install deps
git clone <repo-url> propertyguy
cd propertyguy

# 2. Apply Supabase migrations (hosted or `supabase start` + `supabase db reset`)
#    See supabase/README.md

# 3. Frontend (required: VITE_SUPABASE_*)
cd frontend
cp .env.example .env.local          # set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
npm ci
npm run dev                         # http://localhost:5173 — SPA only

# 4. Vercel Functions locally (PDFs, Stripe, bond, cron)
#    From frontend/: npx vercel dev
#    Do not set VITE_API_BASE_URL — same-origin /api in production and vercel dev
```

### Supabase env (optional until you use the Supabase client)

The frontend includes a Supabase **browser** client (`frontend/src/lib/supabaseClient.ts`)
for **Supabase Auth** and data migration. It reads **only**:

- `VITE_SUPABASE_URL` — Supabase Dashboard → **Project Settings** → **API** → **Project URL**
- `VITE_SUPABASE_ANON_KEY` — same page → **Project API keys** → **anon** `public`

Use **only** the **anon** key in Vite env files. The anon key is public in the bundle and is safe **only with correct Row Level Security (RLS)** on your tables. Never add the **service_role** key, `SUPABASE_JWT_SECRET`, or Stripe **secret** keys to the frontend or any `VITE_*` variable (see [`docs/MIGRATION_STATUS.md`](docs/MIGRATION_STATUS.md)).

For local development, add these to `frontend/.env.local` (gitignored), e.g.:

```bash
cp frontend/.env.example frontend/.env.local
# Edit .env.local: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
```

Production and normal local development **require** `VITE_SUPABASE_*`. Portfolio CRUD, statements, invoices, and calculators use Supabase + Vercel Functions, not the legacy Prisma API.

**Prisma** remains only under `backend/scripts/legacy-prisma-migration/` for one-off data tools (`npm run reset:portfolio-data`, etc.) — not imported by `npm run build` or the Docker image.

### Frontend framework

The SPA is **Vite 5 + React 18 + TypeScript** (not Next.js). Serverless PDF routes live under `frontend/api/` and deploy as Vercel Functions on the same project.

| Script | Purpose |
| ------ | ------- |
| `npm run dev` | Vite dev server (`http://localhost:5173`) |
| `npm run build` | `tsc` + production bundle → `dist/` |
| `npm run preview` | Serve `dist/` locally |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` / `npm run test:ci` | Vitest |
| `npm run verify:public-env` | Fail if server secrets appear in `frontend/src` |

### Tests

```bash
cd frontend
npm run test:ci
npm run build
npm run verify:public-env

cd ../backend
npm run test                # shared calculator unit tests
npm run verify:public-env
```

### Full stack in Docker (optional)

```bash
docker compose up -d --build        # see docker-compose.yml — Supabase is the DB of record
```

---

## Deploy frontend on Vercel

The frontend is a **monorepo subfolder** — set **Root Directory** to `frontend` in the Vercel project (see [`docs/deployment/vercel.md`](docs/deployment/vercel.md)).

| Setting | Value |
| ------- | ----- |
| Framework | Vite (auto-detected via `frontend/vercel.json`) |
| Build command | `npm run build` |
| Output directory | `dist` |
| Install command | `npm ci --no-audit --no-fund --ignore-scripts` (from `vercel.json`) |

**Environment variables** (Vercel → Settings → Environment Variables). Set for **Production** and **Preview** (Preview must not fall back to `localhost`):

| Variable | Required | Notes |
| -------- | -------- | ----- |
| `VITE_SUPABASE_URL` | Yes | Supabase Dashboard → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Same page → **anon** `public` key only |
| `VITE_API_BASE_URL` | No | **Do not set** — use same-origin `/api` via `vercel dev` or production deploy |

**Vercel serverless** (`frontend/api/*` — reports, invoices, bond, subscription, cron) also need (server-side, not `VITE_*`):

| Variable | Notes |
| -------- | ----- |
| `SUPABASE_URL` or duplicate `VITE_SUPABASE_URL` | JWT verification + RLS |
| `SUPABASE_ANON_KEY` or duplicate `VITE_SUPABASE_ANON_KEY` | Same as SPA |
| `SUPABASE_SERVICE_ROLE_KEY` | Webhooks, cron, admin server routes |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | `frontend/api/subscription/*` |
| `FRONTEND_URL` | Stripe checkout success/cancel URLs |
| `CRON_SECRET` | `frontend/api/cron/run-due` |

Do not commit these values; set them only in the Vercel project UI.

**Supabase Auth URLs:** Dashboard → Authentication → URL configuration — set **Site URL** and **Redirect URLs** to your Vercel production domain (and `http://localhost:5173` for local dev).

**SPA routing:** `frontend/vercel.json` rewrites non-`/api/*` paths to `/index.html` for React Router.

**Local production check:**

```bash
cd frontend
cp .env.production.example .env.local   # fill Supabase + API URLs
npm run build
npm run preview                         # http://localhost:4173
```

For PDF serverless routes locally, use `vercel dev` from `frontend/` (plain `vite` does not run `api/*`).

---

## Production deployment

The recommended production architecture uses four managed services that have
generous free tiers and zero operational overhead:

| Layer    | Provider               | What it gives you                              |
| -------- | ---------------------- | ----------------------------------------------- |
| DNS/CDN  | **Cloudflare**         | DNS, WAF, DDoS protection, HTTPS, edge caching  |
| Frontend | **Vercel**             | Static SPA hosting, preview deploys, edge CDN   |
| Backend  | **Vercel** `frontend/api/*` | Serverless routes (Stripe, PDFs, bond, cron) |
| Legacy   | **Render** _(optional)_ | Health-check only; not required for production |
| Database | **Supabase**           | Managed Postgres, daily backups, web SQL editor |

**Follow [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)** for a beginner-friendly
step-by-step walkthrough. Per-platform deep-dives live in
[`docs/deployment/`](docs/deployment/).

### One-line summary of what each provider does

- **Supabase**: managed Postgres, Auth, Storage, and RLS — the only data plane for the live app.
- **Vercel**: SPA + all `/api/*` serverless routes (`frontend/api/`). Requires
  `VITE_SUPABASE_*` at build time and server secrets (`SUPABASE_SERVICE_ROLE_KEY`,
  Stripe, `FRONTEND_URL`, `CRON_SECRET`) in the Vercel UI. **Do not set**
  `VITE_API_BASE_URL` in production.
- **Render** _(optional)_: slim `backend/` health service only; portfolio data and
  Stripe live on Supabase + Vercel.
- **Cloudflare**: holds the DNS records for your domain, sits in front of the
  Render backend (WAF + DDoS), and provides the TLS termination for any custom
  subdomain.

---

## Security posture

The app has gone through a multi-phase security hardening pass — see
[`docs/ARCHITECTURE.md#security-controls`](docs/ARCHITECTURE.md#security-controls).
Highlights:

- JWT auth with bcrypt, generic responses, login throttling, body size caps,
  timing-equalised password compare
- Stripe webhook signature verification with raw-body parsing
- Multer uploads: server-generated filenames, magic-byte sniffing, MIME
  allow-list, path-traversal-safe storage
- Signed short-lived download URLs (HMAC-SHA256) for direct browser links
- Helmet headers + nginx/Vercel response headers + Cloudflare HSTS
- Production fail-closed env handling (server refuses to boot without a
  strong JWT_SECRET, Stripe webhooks return 503 without a webhook secret,
  Compose refuses to start without required env vars)

---

## Disclaimer

This software provides estimates and is not financial, legal, tax, or
investment advice.
