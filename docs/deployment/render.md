# Render setup deep-dive

The high-level steps live in [`../DEPLOYMENT.md` § Step 2](../DEPLOYMENT.md#step-2--deploy-the-backend-render).
This page covers the parts you'll only hit on the second or third deploy.

## How the blueprint works

`render.yaml` at the repo root is a [Render
Blueprint](https://render.com/docs/blueprint-spec) — a declarative service
definition. Render reads it at "Create Blueprint" time and provisions the
listed services. Subsequent pushes to `main` redeploy whichever services
changed.

The blueprint:

- Builds from `backend/Dockerfile` with the **repo root** as the build context
  (so `.dockerignore` and `COPY backend/...` paths match local).
- Sets `NODE_ENV=production`, `TRUST_PROXY=2`, `JWT_EXPIRES_IN=1h`,
  `EMAIL_FROM` to compile-time-constant values.
- Asks Render to **generate** `JWT_SECRET` automatically — you never see or
  set it.
- Asks **you** for `DATABASE_URL`, `FRONTEND_URLS`, `STRIPE_SECRET_KEY`,
  `STRIPE_WEBHOOK_SECRET` at apply time.
- Pings `/api/health` for the route healthcheck.

If you ever want to change the blueprint, edit `render.yaml`, commit, push;
on the next Render → Manual Sync the service picks up the change.

## Region selection

Render lets you choose a region at service creation. **You cannot change it
later** — you have to destroy + recreate the service. Pick the region
closest to your Supabase region:

| Supabase region    | Closest Render region |
| ------------------ | --------------------- |
| EU (London)        | Frankfurt             |
| US-East            | Ohio                  |
| US-West            | Oregon                |
| Asia-Northeast     | Singapore             |

Same-region keeps your DB query latency in the single-digit ms range. Cross
-region adds ~80–200 ms _per query_.

## Persistent disks

The free plan ships **no persistent disk**. `/app/uploads` and `/app/reports`
are wiped on every redeploy.

For the paid plan: Render → service → **Disks** → **Add Disk**:

- Mount path: `/app/uploads` (one disk) and `/app/reports` (a second disk).
- Size: 1 GB to start; you can grow it but can't shrink it.

Once added, the disk persists across redeploys and restarts.

> **Better long term:** move file storage to Supabase Storage and skip
> persistent disks altogether. See
> [`../ARCHITECTURE.md#file-storage-decision`](../ARCHITECTURE.md#file-storage-decision).

## Health checks and zero-downtime deploys

The Docker `HEALTHCHECK` directive in `backend/Dockerfile` runs every 30 s
**inside the container** — if it fails three times, Render restarts the
container.

Separately, the `healthCheckPath: /api/health` in `render.yaml` tells
Render's router when a new instance is **ready to receive traffic** during
a rolling deploy. Render starts the new instance, polls `/api/health`, and
only swaps the routing once it sees a 200.

If a deploy hangs at "healthcheck pending":

1. **Logs tab.** Most common cause is the app crashing at boot (look for
   `Error:` near the top of the run).
2. **Confirm PORT is correct.** Render injects `PORT`; our app uses it via
   `env.PORT`. Don't override it manually.
3. **Confirm the path.** Hit `https://<your-service>.onrender.com/api/health`
   directly in a browser. If you get a 404, the route isn't mounted (check
   your `app.ts`).

## Logs

Render keeps the last 7 days of logs on the free plan. Useful filters in
the Logs tab:

- `level:error` — for crash diagnostics
- `[auth]` — for our auth middleware log lines
- `[reports]` — for PDF download problems
- `[ownedProperties]` — for upload/document issues

For longer retention, pipe logs to Better Stack / Datadog / Loki via
Render's **Log Streams** integration.

## Custom domain pitfalls

When you add `api.yourdomain.com` in Render, Render gives you a CNAME
target like `propertyguy-backend-abc1.onrender.com`. Things to watch:

- **Don't proxy through Cloudflare without setting SSL/TLS mode to "Full
  (strict)".** Anything less and Cloudflare rejects Render's origin cert.
- **Render's free tier sleeps after 15 min of inactivity.** The first
  request after sleep takes ~30 s while the container cold-starts; everyone
  after that is fast. Upgrade to Starter ($7/mo) to keep it warm.
- **Egress IPs are dynamic on the free plan.** If you ever lock down
  Supabase Network Restrictions by IP, you'll lock yourself out on the next
  deploy. Use the password for auth and leave Supabase open.

## Switching to Railway

Both `render.yaml` and `railway.json` ship in the repo. If you'd rather use
Railway:

1. New project → Deploy from GitHub repo.
2. Railway reads `railway.json`, sees it's a Dockerfile build, runs it.
3. Add the same env vars (Project → Variables) — paste the values from your
   secrets manager.
4. Railway auto-assigns a `*.up.railway.app` domain; map your custom domain
   the same way you would on Render.

Railway charges by usage (CPU + RAM × time). For a low-traffic API this
typically comes out cheaper than Render Starter; for any sustained
throughput it's the other way around.
