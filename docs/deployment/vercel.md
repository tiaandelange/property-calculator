# Vercel setup deep-dive

The high-level steps live in [`../DEPLOYMENT.md` § Step 3](../DEPLOYMENT.md#step-3--deploy-the-frontend-vercel).

## What `frontend/vercel.json` does

| Section            | Purpose                                                                                                   |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| `framework`        | Tells Vercel "this is a Vite project" so its defaults match.                                              |
| `buildCommand`     | Runs `npm run build` → emits `dist/`.                                                                     |
| `installCommand`   | `npm ci --ignore-scripts` — lockfile-only install, blocks any postinstall hooks.                          |
| `rewrites`         | SPA fallback: non-file routes re-serve `/index.html` (`/api/*` stays on serverless).                      |
| `headers (/(.*))` | Security headers on every response: HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, etc. |
| `headers (/assets/(.*))` | Long-cache (`immutable, 1 year`) for the hashed Vite bundle assets.                                  |
| `headers (/index.html)`  | `Cache-Control: no-store` — the bootstrap HTML is never cached.                                      |

## Refresh shows `404: NOT_FOUND` (SPA routing)

That Vercel error on **hard refresh** or **direct URL** (e.g. `/dashboard`) means the
deployment is not serving `index.html` for client-side routes.

**Fix:**

1. Vercel project → **Settings** → **General** → **Root Directory** must be **`frontend`**
   (not the repo root). Redeploy after changing.
2. Confirm `frontend/vercel.json` includes the SPA rewrite to `/index.html` (see below).
3. **Redeploy** without build cache: Deployments → … → Redeploy → uncheck **Use existing
   Build Cache**.

If Root Directory is accidentally the monorepo root, a root-level `vercel.json` can still
serve the SPA, but **`/api/*` serverless routes require Root Directory = `frontend`** (they
live in `frontend/api/`).

## The Root-Directory step is important

Our repo is a monorepo (`backend/` + `frontend/` at the top level). Vercel
needs to know which directory holds the `package.json` it should build.

If you skip this step, Vercel either fails the build outright ("No
package.json found") or — worse — builds from the repo root, picking up
`./package.json` (which has only a single dev dep). You'd then deploy an
empty static site.

In the "Configure Project" wizard:

- **Root Directory** → click **Edit** → choose `frontend`.

Once set, this persists across deployments.

## Environment variables — the bake-in trap

Vite environment variables are read **at build time** and inlined into the
JavaScript bundle. If you change `VITE_API_BASE_URL` in Vercel's UI:

- New deployments use the new value.
- **Already-deployed bundles still hit the OLD URL.**

To roll a new value out to existing users:

1. Vercel → Settings → Environment Variables → change `VITE_API_BASE_URL`.
2. Deployments → most recent → **"…" menu** → **Redeploy** → uncheck **Use
   existing Build Cache** → confirm.

Three environments live in Vercel:

| Environment   | Where it applies                                              |
| ------------- | ------------------------------------------------------------- |
| Production    | `main` branch deployments + your custom domain                |
| Preview       | Any non-`main` push or pull request                           |
| Development   | The `vercel dev` local CLI (not used here — we use `npm run dev`) |

For our app, **set the same variables for Production AND Preview** (unless you
have a separate staging backend):

| Variable | Required |
| -------- | -------- |
| `VITE_SUPABASE_URL` | Yes — Auth + Supabase client |
| `VITE_SUPABASE_ANON_KEY` | Yes — anon key only |
| `VITE_API_BASE_URL` | **Do not set** in production — use same-origin `/api` on Vercel |

Production and preview builds should **omit** `VITE_API_BASE_URL` so the SPA calls
`/api/*` on the same Vercel deployment (reports, invoices, bond, subscription, cron).
Local dev may leave it unset and use `vercel dev` for serverless routes, or set
`http://localhost:4000/api` only if running the legacy health-only Express shim.

**Serverless env** (Vercel project → Environment Variables):

| Variable | Purpose |
| -------- | ------- |
| `SUPABASE_URL` / `VITE_SUPABASE_URL` | Auth + data (handlers accept either) |
| `SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY` | User JWT verification in API routes |
| `SUPABASE_SERVICE_ROLE_KEY` | Stripe webhook, cron, privileged writes |
| `STRIPE_SECRET_KEY` | Checkout session creation |
| `STRIPE_WEBHOOK_SECRET` | `POST /api/subscription/webhook` |
| `FRONTEND_URL` | e.g. `https://app.yourdomain.com` for Stripe success/cancel URLs |
| `CRON_SECRET` | `GET/POST /api/cron/run-due` |
| `RESEND_API_KEY` | Invoice email + contact form notifications (**never** `VITE_*`) |
| `CONTACT_FROM_EMAIL` | **Required** for `POST /api/contact` — verified Resend sender |

**Contact form delivery:** notifications go to `delangetiaanoffice@gmail.com` by default. Set optional `CONTACT_TO_EMAIL` to override. Apply migration `20260612120000_contact_submissions.sql` before enabling the form in production.

**Stripe webhook URL in Dashboard:** `https://<your-domain>/api/subscription/webhook`

Render/Railway backend is **optional** (health check only); subscription no longer lives there.

## Custom domain

Vercel handles its own TLS certificate via Let's Encrypt. When you add a
custom domain:

- Vercel gives you a CNAME target (`cname.vercel-dns.com`).
- Cloudflare DNS for that subdomain should be **DNS-only (grey cloud)**, not
  proxied. Reasoning: proxying through Cloudflare with `Full (strict)` and
  Vercel's edge cert sometimes works, sometimes doesn't (Vercel rotates
  certs frequently). DNS-only is the supported configuration.

If you really want Cloudflare in front of Vercel (for the WAF), the
documented path is to use Cloudflare's **"Argo Tunnel / Authenticated Origin
Pulls"** with a Vercel-issued origin cert. That's beyond this guide.

## Preview deploys + CORS

Every pull request gets a preview URL like
`propertyguy-frontend-git-fix-foo-yourname.vercel.app`. To let those URLs
talk to your backend, add the **stem** to `FRONTEND_URLS` on Render —
unfortunately the API does not support wildcards.

The pragmatic approach: keep one fixed Vercel "preview stub" URL allowed
(`https://propertyguy-frontend-git-main-yourname.vercel.app`) and only
manually test PRs by visiting that one stub URL. For real per-PR testing
you'll need to expand the allow-list logic to support `*.vercel.app` —
that's a 3-line tweak in `backend/src/app.ts`, intentionally not enabled
out of the box because permissive wildcards can hide bugs in CORS config.

## Build performance

Vercel caches `node_modules` between builds by default. First build of a
fresh repo: ~2 min. Subsequent builds: ~30–60 s.

If your build randomly slows down or fails to install, try a redeploy with
**Use existing Build Cache: off** — clears stale lockfile state.
