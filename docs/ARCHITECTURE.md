# Architecture

This document describes the production topology, the trust boundary, and the
deliberate decisions about authentication, file storage, and CORS. If you
want the click-by-click deploy steps instead, read
[`DEPLOYMENT.md`](DEPLOYMENT.md).

## Topology

```
                                  HTTPS
       ┌─────────────────┐    ┌─────────────────────┐    ┌──────────────────┐
       │                 │───►│ Cloudflare (free)   │───►│  Vercel          │
       │  client browser │    │ DNS · WAF · DDoS    │    │  static SPA      │
       │                 │    │ HSTS · cache · TLS  │    │  app.example.com │
       └─────────────────┘    └──────────┬──────────┘    └────────┬─────────┘
                                         │                        │
                                         │       cross-origin     │
                                         │       fetch with       │
                                         │       Bearer JWT       │
                                         ▼                        │
                              ┌─────────────────────┐             │
                              │ Cloudflare (free)   │             │
                              │ proxied API subdomain│            │
                              │ api.example.com     │             │
                              └──────────┬──────────┘             │
                                         │                        │
                                         ▼                        │
                              ┌─────────────────────┐             │
                              │  Render / Railway   │◄────────────┘
                              │  backend container  │  CORS origin = SPA origin
                              │  Express + Prisma   │
                              └──────────┬──────────┘
                                         │
                                         ▼ TLS
                              ┌─────────────────────┐
                              │  Supabase           │
                              │  managed Postgres   │
                              │  pooler:6543        │
                              └─────────────────────┘
```

### Why this split

- **Browser-only secrets stay in the browser.** Anything baked into the
  Vercel bundle is public (`VITE_API_BASE_URL`, public Stripe key). The
  bundle never contains the JWT secret, the DB password, or the Stripe
  secret key.
- **Server-only secrets stay on Render.** The backend container is the only
  thing that can read `DATABASE_URL`, `JWT_SECRET`, `STRIPE_SECRET_KEY`,
  `STRIPE_WEBHOOK_SECRET`. They never appear in git, in the bundle, or in
  Cloudflare config.
- **The database is private.** Supabase exposes a single TLS port on a
  domain the public can resolve, but the only thing that has the password
  is the Render container. The database accepts no other client.
- **The CDN owns TLS termination + abuse mitigation.** Cloudflare absorbs
  most malicious traffic before it ever reaches Render.

## Trust boundary

| Where the request lives                                  | What you trust                              |
| -------------------------------------------------------- | ------------------------------------------- |
| Browser DOM / localStorage                               | Nothing — assume XSS could happen           |
| HTTPS request between browser and Cloudflare             | TLS, plus you trust Cloudflare              |
| Between Cloudflare and Render                            | TLS (origin cert) — set Cloudflare to **Full (strict)** |
| Inside the Render container (memory + env)               | The platform's secret storage               |
| Between Render and Supabase                              | TLS (`sslmode=require`)                     |
| Inside Supabase                                          | The platform's at-rest encryption           |

The dotted line in the diagram between the SPA and the API is the **CORS
boundary**. The backend explicitly allow-lists the SPA origin
(`FRONTEND_URLS`) and rejects everything else. There are no cookies in this
flow — the SPA attaches the JWT in an `Authorization: Bearer` header.

## Authentication decision

The app ships with **its own JWT auth**, not Supabase Auth, even though
both database and auth services live in the same Supabase account. This is
a deliberate choice.

### What we have

- `bcryptjs` password hashes
- Zod-validated registration/login
- Rate limiters keyed by (IP, email) on `/login` and (IP) on `/confirm-email`
- Generic error responses + timing-equalised password compare to prevent
  account enumeration
- JWTs default to 1 h expiry, signed with `JWT_SECRET` (32+ bytes required
  in production — server refuses to boot otherwise)
- Signed download URLs (HMAC-SHA256) for direct browser links to PDFs

### Why not Supabase Auth out of the box

Migrating to Supabase Auth would require:

1. Replacing the `User` model with `auth.users` (foreign-key changes
   throughout the schema).
2. Replacing the entire `/api/auth/*` surface with Supabase JS client calls
   on the frontend.
3. Replacing the backend middleware with Supabase JWT verification.
4. Rewriting every integration test that signs a JWT today.

That migration is well worth doing if you want federated auth (Google,
Apple) or magic-link flows; this guide does not block you from doing it,
but it is **a deliberate sprint of work** and not a flag flip.

### If you decide to migrate later

The cleanest path is:

1. Add Supabase Auth as a **second** identity source in the backend; verify
   Supabase JWTs alongside the existing ones in `requireAuth`.
2. Backfill `auth.users` with the existing emails; let users continue
   signing in with passwords on the existing endpoint.
3. Once all live users have migrated, retire `/api/auth/register` and
   `/api/auth/login`.

## File storage decision

Uploaded documents (`/app/uploads`) and generated PDFs (`/app/reports`)
currently live on the backend container's local disk.

- **In dev / Docker Compose:** persistent named volumes (`backend_uploads`,
  `backend_reports`).
- **On Render free tier:** ephemeral — wiped on every redeploy.
- **On Render with a paid Persistent Disk:** persistent until you delete
  the disk.

**Recommendation for production:** migrate file storage to Supabase Storage
(S3-compatible), keep the existing signed-URL flow but mint URLs against
Supabase's signed-URL endpoint. The upload pipeline already produces UUID
filenames and validates magic bytes, so the migration is mostly swapping
out the `fs` calls in `routes/ownedPropertiesRoutes.ts` and
`routes/reportRoutes.ts` for `supabase.storage.from(...).upload(...)`.

## Security controls

What the codebase already protects you against:

| Class                             | Control                                                           | Where                              |
| --------------------------------- | ----------------------------------------------------------------- | ---------------------------------- |
| Weak / placeholder JWT secret     | Fail-closed boot in production                                    | `backend/src/config/env.ts`        |
| Account enumeration on register   | Always return generic 201                                         | `backend/src/routes/authRoutes.ts` |
| Account enumeration on login      | Generic 401 + dummy bcrypt to equalise timing                     | `backend/src/routes/authRoutes.ts` |
| Brute-force login                 | `loginLimiter` keyed by (IP, email), 10 / 15 min                  | `backend/src/middleware/rateLimiters.ts` |
| JSON body DoS                     | 200 KB cap globally; 1 MB for Stripe raw body only                | `backend/src/app.ts`               |
| Cross-site framing                | `X-Frame-Options: SAMEORIGIN` from Helmet (API) + Vercel + nginx  | three layers                       |
| Stripe webhook forgery            | `stripe.webhooks.constructEvent` on raw body                      | `backend/src/routes/subscriptionRoutes.ts` |
| Path traversal on PDFs / uploads  | `resolveWithinRoot` rejects absolute + `..` + null bytes          | `backend/src/utils/safePaths.ts`   |
| MIME-type spoofing on upload      | Magic-byte sniff after multer write; mismatch deletes the file    | `backend/src/utils/mimeSniff.ts`   |
| Filename injection                | UUID basenames on disk; RFC 6266 `Content-Disposition`            | `backend/src/utils/safeFileNames.ts` |
| Cross-user file download (IDOR)   | `findFirst({ where: { id, userId } })` on every download route    | `backend/src/routes/*`             |
| Replayable download URLs          | HMAC-SHA256 signature bound to `(kind, id, userId, exp)`          | `backend/src/utils/downloadSignatures.ts` |
| IP spoofing for rate limiters     | `app.set('trust proxy', n)` configurable per topology             | `backend/src/app.ts`               |
| Leaked stack traces in 5xx        | Generic `errorId` to client; full stack to server logs            | `backend/src/middleware/errorHandler.ts` |
| Container compromise → host       | Non-root user, `cap_drop: ALL`, `no-new-privileges`, read-only FS | `docker-compose.prod.yml`          |

## Production env contract

| Variable                 | Scope    | Required               | Notes                                              |
| ------------------------ | -------- | ---------------------- | -------------------------------------------------- |
| `NODE_ENV`               | backend  | yes                    | Must be `production` for fail-closed boot to trigger |
| `PORT`                   | backend  | platform-injected      | Render / Railway set this; don't hard-code         |
| `DATABASE_URL`           | backend  | yes                    | Supabase pooled URI with `sslmode=require`         |
| `JWT_SECRET`             | backend  | yes                    | ≥ 32 chars, not a known placeholder                |
| `JWT_EXPIRES_IN`         | backend  | no (default `1h`)      | Increase only with a refresh-token flow            |
| `FRONTEND_URLS`          | backend  | yes (or `FRONTEND_URL`) | Comma-separated CORS allow-list                    |
| `TRUST_PROXY`            | backend  | no                     | Number of upstream proxy hops to trust             |
| `STRIPE_SECRET_KEY`      | backend  | only if using payments | `sk_live_...`                                      |
| `STRIPE_WEBHOOK_SECRET`  | backend  | only if using payments | `whsec_...`; webhook returns 503 without it        |
| `EMAIL_FROM`             | backend  | no                     | "From" address used by emailService once SMTP is wired |
| `SMTP_HOST`              | backend  | only if sending mail   | All four `SMTP_*` vars must be set together         |
| `SMTP_PORT`              | backend  | only if sending mail   |                                                    |
| `SMTP_USER`              | backend  | only if sending mail   |                                                    |
| `SMTP_PASS`              | backend  | only if sending mail   | **Secret**                                         |
| `SMTP_FROM`              | backend  | only if sending mail   | RFC 5322 "From:" header                            |
| `REPORTS_ROOT_OVERRIDE`  | backend  | **dev/test only**      | Integration suite sets this automatically. Never set in prod. |
| `TRUST_PROXY`            | backend  | no (default `1`)       | Hops to peel off X-Forwarded-For                    |
| `VITE_API_BASE_URL`      | frontend | yes                    | **PUBLIC** — inlined into bundle                   |

Anything **not** in this table is either dev-only or already wrong if it's
in your env. Audit the list before each deploy. The canonical inventory and
rotation cadence live in [`SECRETS.md`](SECRETS.md).

## Future work

- **Refresh tokens + cookie-based session.** Move JWT off `localStorage`
  into an HttpOnly cookie pair. Removes the XSS-token-theft risk.
- **Supabase Storage for files.** See "File storage decision" above.
- **Per-user IP-based rate limit at Cloudflare.** Cloudflare WAF rules
  before the request reaches Render.
- **Bot Fight Mode + Turnstile on register.** Cloudflare's CAPTCHA, no
  cost.
- **OpenTelemetry → Honeycomb / Better Stack.** Free tiers exist; gives
  you per-request latency breakdown without log spelunking.
