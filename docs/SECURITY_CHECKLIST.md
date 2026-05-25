# Security checklist (post-migration)

Last audited: **2026-05-29** (Supabase + Vercel architecture; Express retired).

Use this as a release gate before production deploys and after any auth, RLS, Storage, or Stripe change.

---

## 1. Secret scan (repo)

| Check | Status | Notes |
|-------|--------|-------|
| No committed `.env` files | **Pass** | Only `*.example` templates in repo |
| No hardcoded `sk_live` / `sk_test` / `whsec_*` | **Pass** | Grep clean in source |
| `SUPABASE_SERVICE_ROLE_KEY` not in `frontend/src` | **Pass** | `npm run verify:public-env` |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` not in SPA | **Pass** | Server env + `frontend/api/*` only |
| `DATABASE_URL` / `JWT_SECRET` not in SPA | **Pass** | Legacy scripts/docs only |
| `localhost:4000` / Render URLs in **runtime** code | **Pass** | Removed from SPA; **docs only** still mention Render (update when convenient) |

**Automation:** from `frontend/` or `backend/`:

```bash
npm run verify:public-env
```

**Scope note:** `verify-public-frontend-env.mjs` scans **`frontend/src` only**. Vercel Functions under `frontend/api/` intentionally reference `SUPABASE_SERVICE_ROLE_KEY` — those files are **not** bundled into the Vite client.

---

## 2. Service role key usage

| Location | Allowed | Verified |
|----------|---------|----------|
| `frontend/api/lib/supabaseServiceRole.ts` | Yes | Vercel serverless only |
| `frontend/api/cron/run-due.ts` | Yes | Requires `CRON_SECRET` |
| `frontend/api/lib/stripeSubscriptionServer.ts` (webhook, cancel DB writes) | Yes | Not exposed to browser |
| `frontend/src/**` | **No** | **Pass** |
| `backend/scripts/legacy-prisma-migration/*` | Yes (local ops) | Not deployed to Vercel |

---

## 3. Browser / SPA

| Check | Status | Implementation |
|-------|--------|----------------|
| Only `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` | **Pass** | `frontend/src/lib/supabaseClient.ts` |
| No `VITE_API_BASE_URL` in production | **Required** | Same-origin `/api` on Vercel |
| Session via Supabase Auth | **Pass** | `AuthContext`, `RequireAuth` |
| Portfolio data via Supabase client + RLS | **Pass** | `*Supabase.ts` services |
| Privileged HTTP via Bearer to same-origin `/api/*` | **Pass** | `authFetch`, `*Vercel.ts` |

---

## 4. Postgres RLS (private tables)

All application tables in `supabase/migrations` have **RLS enabled**:

| Table | RLS | Authenticated access |
|-------|-----|----------------------|
| `profiles` | Yes | Own row; billing columns guarded by trigger |
| `properties`, `tenants`, `leases`, ledger, invoices, rules | Yes | Own `user_id` / FK ownership chains |
| `calculator_results`, `stored_reports` | Yes | Own `user_id` |
| `subscriptions` | Yes | **SELECT own only**; INSERT/UPDATE/DELETE **revoked** |
| `portfolio_projection_defaults` | Yes | **SELECT all authenticated**; **UPDATE admin only** |
| `webhook_events` | Yes | **No policies** → only service role / superuser |

**No `TO anon` policies** on application data (grep clean).

Grants: `GRANT … TO authenticated` only on user-facing tables (`20260515180000_row_level_security.sql`).

---

## 5. Profiles & billing (client cannot self-subscribe)

| Control | Status |
|---------|--------|
| Trigger `profiles_prevent_authenticated_billing_updates` blocks `role`, `subscription_status`, `free_uses_remaining`, direct `invoice_payment_details` writes from JWT `authenticated` | **Pass** |
| `update_invoice_payment_details()` RPC with `SECURITY DEFINER` + guard bypass | **Pass** (`20260529130000_profile_invoice_payment_rpc.sql`) |
| SPA `updateProfile` does not send billing fields | **Pass** (`profileSupabase.ts`) |

Subscription state changes: **Stripe webhook** or **service role** (`stripeSubscriptionServer.ts`) only.

---

## 6. Supabase Storage

| Bucket | `public` | Policies | Signed URLs |
|--------|----------|----------|-------------|
| `reports` | `false` | `{uid}/reports/…` prefix = `auth.uid()` | 600s (`reports/generate`, `profileSupabase`) |
| `invoices` | `false` | `{uid}/invoices/…` | 600s (`generate-pdf`, `invoicesSupabase`) |
| `property-documents` | `false` | First path segment = `auth.uid()` | Default 3600s (`documentsSupabase`) |

Cross-user access: blocked by Storage RLS + table RLS; object keys include owner UUID.

**No predictable public URLs** — downloads use `createSignedUrl`, not static paths.

---

## 7. Stripe

| Check | Status | Location |
|-------|--------|----------|
| Webhook signature verification | **Pass** | `stripe.webhooks.constructEvent` in `frontend/api/subscription/webhook.ts`; 503 if secret missing |
| Checkout metadata `userId` = Supabase UUID | **Pass** | `parseUuidUserId` in `stripeSubscriptionServer.ts` |
| User-initiated checkout/cancel require Bearer session | **Pass** | `authenticateSupabaseRequest` on checkout/cancel routes |
| Client cannot set `subscription_status` | **Pass** | DB trigger + no SPA patch |

### Gap — webhook idempotency

| Check | Status |
|-------|--------|
| `public.webhook_events` table + unique `(provider, external_event_id)` | **Schema exists** |
| Handler inserts/logs events before processing | **Not implemented** |

**Risk:** Stripe retries can duplicate `subscriptions` rows or re-apply profile updates. **Recommended fix:** in `handleStripeWebhookEvent`, `INSERT INTO webhook_events … ON CONFLICT DO NOTHING RETURNING id`; skip processing if conflict.

---

## 8. PDF / reports

| Check | Status |
|-------|--------|
| `POST /api/reports/generate` requires Bearer JWT | **Pass** |
| Calculation PDF loads row via user-scoped Supabase client (RLS) | **Pass** |
| Property summary uses `get_property_monthly_statement` RPC (invoker + ownership) | **Pass** |
| Storage path `{uid}/reports/{randomUUID}.pdf` | **Pass** |
| Signed URL TTL 600 seconds | **Pass** |
| Legacy disk `/api/reports/:id/download` | **Removed** — SPA rejects old paths |

---

## 9. Vercel Functions (auth matrix)

| Route | Auth |
|-------|------|
| `/api/subscription/checkout`, `/cancel` | Supabase Bearer |
| `/api/subscription/webhook` | Stripe signature (no user JWT) |
| `/api/reports/generate`, `/api/invoices/*/generate-pdf`, `/send-email` | Supabase Bearer + RLS |
| `/api/properties/*/bond/*`, `/api/recurring-expenses/run-due` | Supabase Bearer + RLS |
| `/api/cron/run-due` | `CRON_SECRET` Bearer + service role |

Bond/materialisation handlers use **anon key + user JWT** (RLS enforced), not service role.

---

## 10. Admin & destructive ops

| Check | Status |
|-------|--------|
| Admin UI gated on `profiles.role = 'ADMIN'` | **Pass** (`adminSupabase.ts`) |
| `portfolio_projection_defaults` UPDATE requires admin (RLS) | **Pass** |
| HTTP portfolio reset | **Blocked** (no route; was 410 on Express) |
| `npm run reset:portfolio-data` | **Local only** — `assertPortfolioResetAllowed` refuses `NODE_ENV=production` |

**Note:** Legacy reset script still imports removed `backend/src/config/env.js` — fix before running locally (see § Remaining concerns).

---

## 11. CI / release commands

```bash
# SPA secret boundary
cd frontend && npm run verify:public-env && npm run test:ci && npm run build

# Shared calculator tests
cd backend && npm run verify:public-env && npm test
```

**Vercel production env (required):**

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (if billing live)
- `FRONTEND_URL`
- `CRON_SECRET`

**Do not set:** `VITE_API_BASE_URL`, any `VITE_*` secret, service role in client env.

**Supabase:** apply all migrations through `20260529140000_special_operations_rpcs.sql` on hosted project.

---

## 12. Remaining concerns (action items)

| Priority | Issue | Recommendation |
|----------|-------|----------------|
| **High** | Stripe webhook does not write to `webhook_events` / dedupe by `event.id` | Implement idempotent handler before relying on billing in production |
| **Medium** | `cancel` API updates profile to FREE via service role without cancelling Stripe subscription object | Call `stripe.subscriptions.cancel` when `STRIPE_SECRET_KEY` is set |
| **Medium** | Mock Stripe checkout when `STRIPE_SECRET_KEY` unset | Ensure production Vercel env always has live/test key; fail closed in production |
| **Low** | `CRON_SECRET` compared with `===` (not timing-safe) | Use `crypto.timingSafeEqual` for defense in depth |
| **Low** | `verify-public-env` does not scan `frontend/api/` | Optional: add separate rule “no `VITE_` secrets in api/” or document as server-only |
| **Low** | Docs (`DEPLOYMENT.md`, `ARCHITECTURE.md`) still describe Render/JWT/Express | Update docs to avoid misconfiguration |
| **Dev** | `reset-portfolio-data.ts` imports deleted `backend/src/config/env.js` | Point script at `dotenv` + `process.env` only |

---

## 13. Sign-off template

| Role | Name | Date | Notes |
|------|------|------|-------|
| Engineering | | | Migrations applied on hosted Supabase |
| Engineering | | | Vercel env reviewed; no `VITE_API_BASE_URL` in prod |
| Engineering | | | Stripe webhook URL → `https://<domain>/api/subscription/webhook` |
| Product | | | Accept idempotency gap or track fix in backlog |

---

## Related docs

- [`docs/SECRETS.md`](SECRETS.md) — rotation cadence
- [`docs/MIGRATION_STATUS.md`](MIGRATION_STATUS.md) — architecture state
- [`docs/deployment/vercel.md`](deployment/vercel.md) — Vercel env contract
- [`supabase/TEST_RLS_MANUAL.sql`](../supabase/TEST_RLS_MANUAL.sql) — manual RLS smoke tests
