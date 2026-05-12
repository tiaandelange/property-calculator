# Production deployment guide

This guide walks you through a full production deployment of The Property Guy
on free / hobby-tier managed services. It assumes you have **never deployed a
full-stack app before** — every UI click is spelled out.

## Architecture you're about to build

```
                          ┌─────────────────────┐
   client (browser) ──►   │  Cloudflare         │  DNS, WAF, DDoS, HTTPS
                          └────────┬────────────┘
                                   │
                  ┌────────────────┴───────────────────┐
                  ▼                                    ▼
       ┌────────────────────┐               ┌────────────────────┐
       │  Vercel            │               │  Render / Railway  │
       │  static SPA bundle │  CORS-allowed │  Express + TS API  │
       │  app.yourdomain    │  ───────────► │  api.yourdomain    │
       └────────────────────┘               └─────────┬──────────┘
                                                      │
                                                      ▼
                                          ┌──────────────────────┐
                                          │  Supabase            │
                                          │  managed Postgres    │
                                          └──────────────────────┘
```

Why this split:

- **Vercel** is free, optimised for static SPA bundles, and gives you a
  global edge CDN plus an automatic preview URL on every pull request.
- **Render** (or Railway) is the cheapest practical way to run a long-lived
  Node container with secrets and healthchecks.
- **Supabase** is the cheapest practical managed Postgres with backups, a
  web SQL editor, and a generous free tier.
- **Cloudflare** sits in front of the whole thing for DNS, TLS, DDoS
  protection, and per-IP rate limiting at the edge — before requests ever
  reach your origin.

---

## Prerequisites

You will need an account at:

1. [GitHub](https://github.com) — to host the repo (Vercel and Render pull
   from here).
2. [Supabase](https://supabase.com) — free tier is fine to start.
3. [Render](https://render.com) **OR** [Railway](https://railway.app) — pick
   one. The instructions below use Render; Railway is essentially identical.
4. [Vercel](https://vercel.com) — free tier ("Hobby") is fine.
5. [Cloudflare](https://cloudflare.com) — free tier is fine. You will also
   need to **own a domain name**. Buy one at any registrar (Namecheap,
   Cloudflare Registrar, etc.).

You will need the following installed locally:

- **Node.js 20+** (run `node --version` to confirm)
- **Docker** (only if you want to test the production build locally first)
- A terminal that can run `npm`, `git`, and `node` commands

---

## Step 0 — Prepare the repository

Push your fork to GitHub if you haven't already. Render and Vercel both
deploy from a GitHub repository, so this is required.

```bash
git clone <your-repo-url> propertyguy
cd propertyguy

# Sanity-check that the test suite is green BEFORE you deploy.
cd backend && npm ci && npm run test && npm run test:integration && cd ..
cd frontend && npm ci && npm run test && cd ..
```

---

## Step 1 — Provision the database (Supabase)

1. Sign in to [supabase.com](https://supabase.com) and click **New project**.
2. Project name: anything (e.g. `propertyguy-prod`).
3. Database password: click the **Generate** button and **save it somewhere
   safe** — Supabase will not show it again. You will paste this into Render
   in Step 2.
4. Region: pick the one nearest your users (e.g. London for EU, Cape Town
   for SA, Oregon for US-West).
5. Click **Create new project** and wait ~2 minutes for provisioning.

### 1.1 — Get the connection string

Once the project is ready:

1. Open **Settings** → **Database** → **Connection string** → tab **URI**.
2. Pick the **Transaction** mode (port 6543, pooled — this is what a
   long-lived Render container should use).
3. Click **Copy**. The string looks like:

   ```
   postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
   ```

4. **Replace `[YOUR-PASSWORD]`** with the password you saved above.
5. **Append** `?sslmode=require` to the end:

   ```
   postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?sslmode=require
   ```

Save the final string — this is your `DATABASE_URL`.

### 1.2 — Run the Prisma migrations against Supabase

From your local terminal, with the DATABASE_URL above:

```bash
cd backend
DATABASE_URL="postgresql://postgres.<ref>:<password>@...?sslmode=require" \
  npx prisma migrate deploy
```

`migrate deploy` is the production-safe migration command: it only applies
pending migrations and never tries to generate new ones.

You should see something like `All migrations have been successfully applied`.

> **Tip:** if you ever need to inspect the schema, the Supabase dashboard's
> **Table Editor** and **SQL Editor** are excellent for ad-hoc queries.

### 1.3 — _Optional_: do you want to use Supabase Auth instead of our JWT?

The app ships with its own hardened JWT auth (rate-limited, generic
responses, timing-equalised). **You do not need to migrate to Supabase Auth
to deploy.** If you do want to, see the future-work note in
[`docs/ARCHITECTURE.md#authentication-decision`](ARCHITECTURE.md#authentication-decision)
— it is a deliberate non-trivial migration, not a flag flip.

---

## Step 2 — Deploy the backend (Render)

1. Sign in to [render.com](https://render.com) → **New** → **Blueprint**.
2. Connect your GitHub account if prompted, then **select the repo**.
3. Render reads `render.yaml` at the repo root and shows you what it'll
   create: one Web Service called `propertyguy-backend`.
4. Click **Apply**.
5. Render prompts you for the `sync: false` env vars:

   | Variable                | Value                                                                    |
   | ----------------------- | ------------------------------------------------------------------------ |
   | `DATABASE_URL`          | the Supabase URI from Step 1                                             |
   | `FRONTEND_URLS`         | leave blank for now — you'll fill this in **after Step 3**               |
   | `STRIPE_SECRET_KEY`     | blank (skip Stripe for now, or paste `sk_live_...` from Stripe dashboard) |
   | `STRIPE_WEBHOOK_SECRET` | blank for now (you set this up _after_ deploy — see Step 4)              |

   `JWT_SECRET` is auto-generated by Render — you don't see or set it.

6. Click **Create resources**. First deploy takes ~5 minutes (Docker image
   build).
7. When the deploy goes green, **copy the `*.onrender.com` URL** Render
   gives you. It looks like `https://propertyguy-backend-abc1.onrender.com`.
   You'll use it in Step 3.
8. Smoke-test it:

   ```bash
   curl https://propertyguy-backend-abc1.onrender.com/api/health
   # → {"status":"ok"}
   ```

If you get `404` here, your service didn't start cleanly — check the
**Logs** tab in Render. The most common cause is a malformed `DATABASE_URL`.

### 2.1 — Where do uploaded files / generated PDFs live?

By default they live on Render's **ephemeral local disk** under
`/app/uploads` and `/app/reports`. **They are wiped on every redeploy.**

For a real production deployment you should attach a [Render Persistent
Disk](https://render.com/docs/disks) (paid plans only), or migrate file
storage to Supabase Storage (see `docs/ARCHITECTURE.md#future-work`).

---

## Step 3 — Deploy the frontend (Vercel)

1. Sign in to [vercel.com](https://vercel.com) → **Add New…** → **Project**.
2. Import the same GitHub repo.
3. On the **Configure Project** screen:
   - **Root Directory** → click **Edit** → choose `frontend`. This is
     important — without it Vercel sees the whole monorepo and won't know
     which `package.json` to build.
   - **Framework Preset** → should auto-detect as **Vite**.
   - **Build Command, Output Directory, Install Command** — leave on the
     defaults (they come from `frontend/vercel.json`).
4. Open the **Environment Variables** section and add:

   | Name                  | Value                                                                | Environments       |
   | --------------------- | -------------------------------------------------------------------- | ------------------ |
   | `VITE_API_BASE_URL`   | `https://propertyguy-backend-abc1.onrender.com/api`                  | Production         |
   | `VITE_API_BASE_URL`   | `https://propertyguy-backend-abc1.onrender.com/api`                  | Preview, Development |

   (Replace with **your** Render URL from Step 2.7.)

5. Click **Deploy**. ~2 minutes later you'll have a
   `*.vercel.app` URL — open it.

6. **Now go back to Render** and fill in `FRONTEND_URLS` with your Vercel
   URL plus any custom domain you plan to add:

   ```
   https://your-project.vercel.app
   ```

   Render redeploys automatically; wait for green.

7. Smoke-test the full chain: open your Vercel URL, sign up, confirm the
   email link from the Render logs, and verify the dashboard loads.

---

## Step 4 — Stripe webhooks (skip if not using payments)

The backend's `/api/subscription/webhook` route refuses to grant any
subscription until you tell it Stripe's webhook secret — by design.

1. Stripe Dashboard → **Developers** → **Webhooks** → **Add endpoint**.
2. Endpoint URL: `https://<your-render-url>/api/subscription/webhook` (or
   your custom api subdomain if you've already done Step 5).
3. Events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.deleted`
4. After creating, copy the **Signing secret** (`whsec_...`) and paste it
   into Render's `STRIPE_WEBHOOK_SECRET` env var.
5. Also paste your Stripe live secret key (`sk_live_...`) into
   `STRIPE_SECRET_KEY`.
6. Render redeploys; smoke-test a checkout from the SPA.

---

## Step 5 — DNS + Cloudflare

Once your app is live on the `*.vercel.app` and `*.onrender.com` URLs, point
your custom domain at them via Cloudflare.

### 5.1 — Bring the domain into Cloudflare

1. In Cloudflare dashboard → **Add a Site** → enter your domain.
2. Pick the **Free** plan.
3. Cloudflare scans your existing DNS and gives you two nameservers to
   configure at your registrar. Follow their on-screen instructions.
4. Wait until Cloudflare shows **Active** (usually < 1 hour).

### 5.2 — Frontend: `app.yourdomain.com` → Vercel

1. In Vercel → your project → **Settings** → **Domains** → **Add**
   → enter `app.yourdomain.com`. Vercel shows you a CNAME target like
   `cname.vercel-dns.com`.
2. In Cloudflare → **DNS** → **Add record**:
   - **Type:** CNAME
   - **Name:** `app`
   - **Target:** `cname.vercel-dns.com`
   - **Proxy status:** **DNS only** (grey cloud). Vercel handles its own
     TLS; a Cloudflare-proxied (orange) record commonly conflicts with
     Vercel's cert.
3. Wait a minute. Vercel will issue a certificate. The domain goes green.

### 5.3 — Backend: `api.yourdomain.com` → Render

1. In Render → your service → **Settings** → **Custom Domains** → **Add
   Custom Domain** → enter `api.yourdomain.com`. Render shows you a CNAME
   target like `propertyguy-backend-abc1.onrender.com`.
2. In Cloudflare → **DNS** → **Add record**:
   - **Type:** CNAME
   - **Name:** `api`
   - **Target:** the Render CNAME target
   - **Proxy status:** **Proxied** (orange cloud). This puts Cloudflare's
     WAF + DDoS + edge cache in front of your API.
3. Render verifies and issues a cert. The domain goes green.

### 5.4 — Tighten Cloudflare's security knobs

In Cloudflare for your domain:

| Section                  | Setting                            | Value                  |
| ------------------------ | ---------------------------------- | ---------------------- |
| **SSL/TLS** → Overview   | Encryption mode                    | **Full (strict)**      |
| **SSL/TLS** → Edge       | Always Use HTTPS                   | **On**                 |
| **SSL/TLS** → Edge       | Automatic HTTPS Rewrites           | **On**                 |
| **SSL/TLS** → Edge       | Minimum TLS Version                | **TLS 1.2**            |
| **SSL/TLS** → Edge       | HSTS                               | **Enable**, 6 months, includeSubDomains |
| **Security** → Settings  | Security Level                     | **Medium** or higher   |
| **Security** → Bots      | Bot Fight Mode                     | **On**                 |
| **Rules** → WAF          | Managed Rules                      | enabled (free tier OK) |

### 5.5 — Repoint the app at the new domains

1. **Vercel** env var `VITE_API_BASE_URL` → `https://api.yourdomain.com/api`
   → trigger a redeploy (Deployments tab → "…" → **Redeploy**).
2. **Render** env var `FRONTEND_URLS` →
   `https://app.yourdomain.com,https://www.yourdomain.com` → autoredeploys.

You now have:

- The SPA at `https://app.yourdomain.com` (Vercel, via Cloudflare DNS).
- The API at `https://api.yourdomain.com` (Render, behind Cloudflare WAF).
- The DB on Supabase, reachable only from the backend.

---

## Step 6 — Rotate any secret that was ever exposed

If you ever pasted a real secret into a chat, screenshot, or PR description,
treat it as compromised:

- **JWT_SECRET** → Render → service → Environment → **Generate** a new one.
  All outstanding JWTs and signed download URLs are immediately invalidated.
- **Supabase database password** → Supabase → Settings → Database → Reset
  database password → update Render's `DATABASE_URL`.
- **Stripe keys** → Stripe → Developers → API keys → Roll, then update
  Render.

---

## Troubleshooting

### "CORS error" in browser console

The backend rejected the Origin header from your SPA. Fix:

1. Open the Render dashboard → service → Environment.
2. `FRONTEND_URLS` must contain the **exact** Origin the browser sends (no
   trailing slash, scheme included): `https://app.yourdomain.com`.
3. If you're testing a Vercel preview deploy, add its URL too:
   `https://app.yourdomain.com,https://propertyguy-frontend-abc.vercel.app`.

### Render service won't start: "JWT_SECRET ... must be at least 32 characters"

`render.yaml` asks Render to auto-generate this. If you cloned the blueprint
without it, set the value manually in Render → Environment:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### Health checks fail with 503 / 502

- **Render side:** look at **Events** + **Logs**. The most common cause is
  the app crashing on boot because of a malformed `DATABASE_URL` or because
  the Supabase pooler is asleep on a free-tier project.
- **Cloudflare side:** confirm the SSL/TLS mode is **Full (strict)** —
  anything less and Cloudflare won't accept Render's origin cert.

### Frontend shows "Network Error" but `/api/health` works in curl

The bundle was built with the wrong `VITE_API_BASE_URL` (or before you set
it). Vercel only inlines env vars at **build time**:

1. Vercel → Settings → Environment Variables → confirm the value.
2. Deployments → "…" → **Redeploy** with **Use existing Build Cache: off**.

### Stripe webhook always returns 400 / "Webhook signature verification failed"

The backend requires the raw request body for signature verification — that
works on Render out of the box, but **fails if you've put any other proxy
in front that buffers or transforms the body** (some API Gateway products
do). If you ever put one in front, give it a "do not parse body" rule on
`/api/subscription/webhook`.

---

## Next steps

- Read [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) to understand the security
  controls, the trust boundary, and what the codebase already protects you
  against.
- Per-platform deep-dives live in [`docs/deployment/`](deployment/):
  [Supabase](deployment/supabase.md),
  [Render](deployment/render.md),
  [Vercel](deployment/vercel.md),
  [Cloudflare](deployment/cloudflare.md).
- Set up an off-platform monitoring uptime check on
  `https://api.yourdomain.com/api/health`
  (UptimeRobot, Better Stack, etc.) — Render's healthchecks only protect you
  against complete container failure, not e.g. a long-running DB hang.
