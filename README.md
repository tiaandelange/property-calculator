# The Property Guy

Full-stack web app for South African property investment analysis: rental
yield, bond repayment, transfer/bond costs, affordability, portfolio cash
flow, plus a workspace for tracking owned properties, leases, tenants,
invoices and documents.

```
React + Vite + TS  ─►  Express + TS  ─►  PostgreSQL (Supabase)
   (Vercel)           (Render/Railway)        (Supabase)
        ▲
        └── DNS + WAF: Cloudflare
```

---

## Repository layout

```
.
├── backend/                  Express + TypeScript API, Prisma ORM
├── frontend/                 React + Vite SPA
├── docs/                     Architecture and deployment docs
│   ├── ARCHITECTURE.md        ← read this first to understand the system
│   ├── DEPLOYMENT.md          ← step-by-step production deploy
│   ├── SECRETS.md             ← inventory, rotation cadence, CI/CD pattern
│   └── deployment/            per-platform deep-dives
├── render.yaml               Render blueprint (provisions the backend)
├── railway.json              Railway config (alternative to Render)
├── docker-compose.yml        Local dev — full stack in containers
├── docker-compose.prod.yml   Self-hosted production reference
└── frontend/vercel.json      Vercel build + routing + headers config
```

---

## Local development quick-start

You need **Node 20+** and a Postgres database (Docker is easiest).

```bash
# 1. Clone and install deps
git clone <repo-url> propertyguy
cd propertyguy

# 2. Bring up Postgres in the background
docker compose up -d db

# 3. Backend
cd backend
cp .env.example .env                # default values are fine for local
npm ci
npx prisma migrate dev              # creates the schema in your dev DB
npm run dev                         # http://localhost:4000

# 4. Frontend (in another terminal)
cd ../frontend
cp .env.example .env                # default points at http://localhost:4000/api
npm ci
npm run dev                         # http://localhost:5173
```

That's it. Sign up at <http://localhost:5173>, confirm your email via the
link printed in the backend console, and the app is ready to use.

### Tests

```bash
# Backend
cd backend
npm run test                # unit tests
npm run test:integration    # full route-level integration tests

# Frontend
cd frontend
npm run test
```

### Full stack in Docker

```bash
docker compose up -d --build        # backend + frontend (Vite dev) + Postgres
```

---

## Production deployment

The recommended production architecture uses four managed services that have
generous free tiers and zero operational overhead:

| Layer    | Provider               | What it gives you                              |
| -------- | ---------------------- | ----------------------------------------------- |
| DNS/CDN  | **Cloudflare**         | DNS, WAF, DDoS protection, HTTPS, edge caching  |
| Frontend | **Vercel**             | Static SPA hosting, preview deploys, edge CDN   |
| Backend  | **Render** _(or_ Railway _)_ | Docker host, autoscale, healthchecks, TLS |
| Database | **Supabase**           | Managed Postgres, daily backups, web SQL editor |

**Follow [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)** for a beginner-friendly
step-by-step walkthrough. Per-platform deep-dives live in
[`docs/deployment/`](docs/deployment/).

### One-line summary of what each provider does

- **Supabase**: provisions Postgres; you copy the connection string into Render
  or Railway. We do _not_ use Supabase Auth — the app ships with its own
  hardened JWT auth (see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)).
- **Render / Railway**: builds `backend/Dockerfile` from the repo and runs it
  with secrets injected via the platform's env-var UI. Health-checked at
  `/api/health`.
- **Vercel**: builds the SPA from `frontend/` per `vercel.json`. The bundle
  reads `VITE_API_BASE_URL` at build time — point it at your backend's public
  URL.
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
