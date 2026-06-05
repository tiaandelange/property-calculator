# Security checklist (post-migration)

Last audited: **2026-06-04** (Paystack billing + env validation; Stripe deprecated).

Use this as a release gate before production deploys and after any auth, RLS, Storage, or **billing** change.

---

## 1. Secret scan (repo)

| Check | Status | Notes |
|-------|--------|-------|
| No committed `.env` files | **Pass** | Only `*.example` templates in repo |
| No hardcoded `sk_live` / `sk_test` / `whsec_*` | **Pass** | Grep clean in source |
| `SUPABASE_SERVICE_ROLE_KEY` not in `frontend/src` | **Pass** | `npm run verify:public-env` |
| `PAYSTACK_SECRET_KEY` not in SPA | **Pass** | `verify-public-frontend-env.mjs` |
| No `VITE_PAYSTACK_*` / `VITE_BILLING_*` in SPA | **Pass** | Same script |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` not in SPA | **Pass** | Server env + `frontend/api/*` only (legacy) |
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
| `frontend/api/lib/stripeSubscriptionServer.ts` (legacy Stripe — deprecated) | Yes | Ack-only webhooks; no legacy DB writes |
| `frontend/api/lib/billing/billingSubscriptionSync.ts` | Yes | Paystack webhook + checkout sync |
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

Subscription state changes: **Paystack webhook** (via `billingSubscriptionSync.ts`) or **service role** billing APIs only. Legacy `profiles.subscription_status` is not updated by new checkout flows.

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

## 7. Paystack billing

| Check | Status | Location |
|-------|--------|----------|
| Checkout via provider-agnostic API | **Pass** | `POST /api/subscription/checkout` → `handleSubscriptionCheckout.ts` |
| Webhook HMAC verification (Paystack) | **Pass** | `paystackProvider.ts` + `x-paystack-signature` |
| Webhook idempotency | **Pass** | `webhook_events` in `billingSubscriptionSync.ts` |
| User-initiated checkout/cancel require Bearer session | **Pass** | `authenticateSupabaseRequest` |
| Client cannot set `subscription_status` | **Pass** | DB trigger + no SPA patch |
| `assertBillingCheckoutConfig()` before checkout | **Pass** | `billingEnv.ts` |
| Mock provider blocked in production | **Pass** | `BILLING_PROVIDER=mock` → HTTP 503 |
| Missing `FRONTEND_URL` / `PAYSTACK_SECRET_KEY` fail closed | **Pass** | HTTP 503 on checkout |

### Legacy Stripe (deprecated)

| Check | Status |
|-------|--------|
| Stripe webhook signature still verified if `Stripe-Signature` present | **Pass** |
| Legacy handler does not write `profiles` / `subscriptions` | **Pass** |
| `createCheckoutSession` in `stripeSubscriptionServer.ts` throws | **Pass** |

Remove Stripe env vars and module after Paystack is confirmed live in production.

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
| `/api/subscription/webhook` | Paystack HMAC (`x-paystack-signature`) or legacy Stripe sig (deprecated, ack-only) |
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
- `BILLING_PROVIDER=paystack`
- `PAYSTACK_SECRET_KEY` (`sk_live_…`)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `FRONTEND_URL` (`https://www.proplytic.co.za`)
- `CRON_SECRET`

**Vercel development / local:**

- `BILLING_PROVIDER=mock`
- `FRONTEND_URL=http://localhost:5173` (or your Vite port)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

**Do not set:** `VITE_API_BASE_URL`, any `VITE_*` payment secret, service role in client env, `BILLING_PROVIDER=mock` in production.

**Supabase:** apply all migrations through `20260529140000_special_operations_rpcs.sql` on hosted project.

---

## 12. Remaining concerns (action items)

| Priority | Issue | Recommendation |
|----------|-------|----------------|
| **Low** | Legacy Stripe module still in repo | Remove after Paystack confirmed live in production |
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
| Engineering | | | Paystack webhook URL → `https://<domain>/api/subscription/webhook` |
| Product | | | `BILLING_PROVIDER=paystack` + `PAYSTACK_SECRET_KEY` set in production |

---

## Related docs

- [`docs/SECRETS.md`](SECRETS.md) — rotation cadence
- [`docs/billing/paystack-setup.md`](billing/paystack-setup.md) — Paystack dashboard + env
- [`docs/MIGRATION_STATUS.md`](MIGRATION_STATUS.md) — architecture state
- [`docs/deployment/vercel.md`](deployment/vercel.md) — Vercel env contract
- [`supabase/TEST_RLS_MANUAL.sql`](../supabase/TEST_RLS_MANUAL.sql) — manual RLS smoke tests
