# Production cutover checklist

Use this document on the day you point production traffic at **Supabase + Vercel**. Check each box in order; do not skip **Rollback** prep.

**Related docs:**

- [`SECURITY_CHECKLIST.md`](SECURITY_CHECKLIST.md) — security gate before go-live
- [`MIGRATION_STATUS.md`](MIGRATION_STATUS.md) — architecture and migration history
- [`deployment/vercel.md`](deployment/vercel.md) — Vercel env and SPA rewrites
- [`../supabase/README.md`](../supabase/README.md) — SQL migration order

**Architecture (target):** Vite SPA on Vercel (`frontend/`, root directory **`frontend`**) + serverless routes (`frontend/api/*`) + Supabase Auth, Postgres (RLS), and Storage. **No Express / Render API required.**

---

## Pre-flight (once)

- [ ] Production hostname decided (e.g. `https://app.yourdomain.com`)
- [ ] Supabase **production** project created (separate from dev/staging)
- [ ] Vercel **production** project linked to GitHub `main` (or release branch)
- [ ] Stripe **live** mode account ready (or stay on test until UAT sign-off)
- [ ] [`SECURITY_CHECKLIST.md`](SECURITY_CHECKLIST.md) reviewed; known gaps accepted or fixed

---

## Supabase

### Project & keys

- [ ] **Project URL** confirmed (Dashboard → Project Settings → API → Project URL)
- [ ] **Anon key** configured in Vercel as `VITE_SUPABASE_ANON_KEY` (and optionally duplicated as `SUPABASE_ANON_KEY` for API routes)
- [ ] **Service role key** stored **only** in Vercel (and break-glass password manager) — **never** in `VITE_*`, never in git
- [ ] `SUPABASE_URL` set in Vercel (or duplicate `VITE_SUPABASE_URL`)

### Migrations applied (in order)

Apply all files under `supabase/migrations/` on the **production** project before first user sign-up:

- [ ] `20260513140000_core_application_schema.sql`
- [ ] `20260515120000_auth_profiles_trigger_and_rls.sql` (if not superseded by later profile migration)
- [ ] `20260515180000_row_level_security.sql`
- [ ] `20260516140000_foundation_webhooks_profiles_email.sql` (**`webhook_events`** table)
- [ ] `20260520120000_auth_profile_provisioning.sql`
- [ ] `20260521120000_rls_core_crud_split_policies.sql`
- [ ] `20260523140000_lease_lifecycle_rpcs.sql`
- [ ] `20260523160000_financial_hard_delete_rpcs.sql`
- [ ] `20260524120000_recurring_run_due_rpcs.sql`
- [ ] `20260524140000_invoice_crud_rpcs.sql`
- [ ] `20260524180000_get_dashboard_summary_rpc.sql`
- [ ] `20260525100000_get_property_monthly_statement_rpc.sql`
- [ ] `20260526200000_save_calculation_and_decrement_free_use.sql`
- [ ] `20260527100000_property_documents_storage_bucket.sql`
- [ ] `20260528130000_reports_storage_bucket.sql`
- [ ] `20260529120000_invoices_storage_bucket.sql`
- [ ] `20260529130000_profile_invoice_payment_rpc.sql`
- [ ] `20260529140000_special_operations_rpcs.sql`

**Commands (pick one):**

```bash
# Linked project (recommended)
supabase link --project-ref <ref>
supabase db push

# Or: paste each migration in Dashboard → SQL Editor (dev review first)
```

- [ ] Post-apply: run `supabase/VERIFY_AFTER_MIGRATION.sql` and `supabase/VERIFY_RLS.sql` (or equivalent) on production
- [ ] **RLS enabled** on all application tables (see [`SECURITY_CHECKLIST.md`](SECURITY_CHECKLIST.md) §4)

### Auth

- [ ] **Site URL** = production app URL (Authentication → URL configuration)
- [ ] **Redirect URLs** include production origin + `http://localhost:5173` for local dev
- [ ] Email templates / SMTP (or Supabase built-in) configured for confirm + reset flows
- [ ] Confirm link uses Supabase format (`token_hash` + `type`) — route `/confirm-email` on SPA
- [ ] Test sign-up creates `auth.users` **and** `public.profiles` via `handle_new_user()`

### Storage

- [ ] Buckets exist and are **private** (`public = false`): `reports`, `invoices`, `property-documents`
- [ ] **Storage policies** applied (migrations create `storage.objects` policies per bucket)
- [ ] **Storage policies tested:** upload, list, signed URL open, delete — as owner and as second user (denied)

### Webhooks table

- [ ] **`webhook_events`** table present (`20260516140000_foundation_webhooks_profiles_email.sql`)
- [ ] RLS on `webhook_events` with **no** authenticated policies (service role only)
- [ ] **Note:** Stripe handler should write idempotency rows before processing — see [`SECURITY_CHECKLIST.md`](SECURITY_CHECKLIST.md) §7 if not yet implemented

---

## Vercel

### Project setup

- [ ] **GitHub repo** connected to Vercel project
- [ ] **Root directory** = `frontend` (not repo root)
- [ ] **Build command** = `npm run build` (from `frontend/vercel.json`)
- [ ] **Output directory** = `dist`
- [ ] **Install command** = `npm ci --no-audit --no-fund --ignore-scripts` (from `vercel.json`)
- [ ] **Framework** = Vite (auto via `vercel.json`)

### Environment variables (Production + Preview)

**Client (build-time — redeploy after any change):**

| Variable | Set? | Notes |
|----------|------|-------|
| `VITE_SUPABASE_URL` | [ ] | Project URL |
| `VITE_SUPABASE_ANON_KEY` | [ ] | Anon **public** key only |
| `VITE_API_BASE_URL` | [ ] **Must be unset** | Same-origin `/api` on Vercel |

**Serverless (`frontend/api/*`):**

| Variable | Set? | Notes |
|----------|------|-------|
| `SUPABASE_URL` or `VITE_SUPABASE_URL` | [ ] | |
| `SUPABASE_ANON_KEY` or `VITE_SUPABASE_ANON_KEY` | [ ] | User JWT + RLS in handlers |
| `SUPABASE_SERVICE_ROLE_KEY` | [ ] | Webhook, cron, privileged writes |
| `STRIPE_SECRET_KEY` | [ ] | Live **or** test — one mode per project |
| `STRIPE_WEBHOOK_SECRET` | [ ] | Matching Stripe Dashboard endpoint |
| `FRONTEND_URL` | [ ] | e.g. `https://app.yourdomain.com` (Stripe redirects) |
| `CRON_SECRET` | [ ] | Protects `/api/cron/run-due` |

- [ ] Run `npm run verify:public-env` from `frontend/` after env changes
- [ ] **Vercel Functions** deployed (`frontend/api/**` visible in deployment → Functions)
- [ ] **Frontend** deployed (`dist/` assets + `index.html`)
- [ ] **SPA rewrites** active: `frontend/vercel.json` rewrites non-`/api/*` → `/index.html`
- [ ] **Cron** scheduled: `0 6 * * *` → `/api/cron/run-due` (in `vercel.json`)
- [ ] PDF functions include fonts: `includeFiles` for `api/reports/generate.ts` and `api/invoices/[id]/generate-pdf.ts`
- [ ] Custom domain + TLS configured (DNS → Vercel; prefer DNS-only if using Cloudflare — see [`deployment/vercel.md`](deployment/vercel.md))

**Smoke URLs (replace host):**

```bash
curl -sS https://<host>/api/cron/run-due   # expect 401 without CRON_SECRET
# SPA: https://<host>/login
```

---

## Stripe

- [ ] **Checkout** tested: signed-in user → `POST /api/subscription/checkout` → Stripe Checkout opens
- [ ] **Webhook** tested: `POST /api/subscription/webhook` with Stripe CLI or Dashboard test event
- [ ] **Stripe webhook URL** updated to `https://<production-host>/api/subscription/webhook`
- [ ] **Test mode** events verified in Stripe Dashboard (if still in test)
- [ ] **Live mode** keys not mixed with test mode keys on the same Vercel project (separate Preview project or env scoping if needed)
- [ ] Webhook signing secret in Vercel matches the endpoint’s secret in Stripe Dashboard
- [ ] Checkout metadata uses Supabase **UUID** `userId` (see `stripeSubscriptionServer.ts`)
- [ ] After checkout: `profiles.subscription_status` = `SUBSCRIBED`, row in `subscriptions` (verify in Supabase Table Editor)

---

## Data migration

Skip sections that do not apply (greenfield launch). For cutover from legacy Prisma/Express:

- [ ] Migration plan documented (source DB, target Supabase project, dry-run on staging)
- [ ] **Legacy users** mapped: `auth.users` + `public.profiles` (email, role, subscription fields) — prefer Supabase Auth import or invite flow; do not copy password hashes unless using supported import
- [ ] **Legacy properties** migrated with stable **UUID** `id` and correct `user_id`
- [ ] **Tenants** migrated; `property_id` / links preserved
- [ ] **Leases** migrated; recurring income rules where applicable
- [ ] **Income / expenses** migrated; bond-split and recurring template fields validated
- [ ] **Invoices** + line items migrated; PDF metadata (`pdf_storage_bucket`, `pdf_storage_key`) or plan to regenerate PDFs on Vercel
- [ ] **Reports metadata** migrated if needed (`stored_reports` + upload PDFs to `reports` bucket at `{user_id}/reports/{id}.pdf`)
- [ ] **Documents** migrated if needed (`property_documents` + files in `property-documents` bucket)

**Tools (reference only):**

- `backend/scripts/legacy-prisma-migration/export-portfolio-backup.ts` — export JSON
- Custom ETL or SQL scripts — not part of runtime deploy
- `DATABASE_URL` = Supabase connection string for one-off scripts only

- [ ] Row counts / spot checks vs legacy system
- [ ] At least one real user can log in and see migrated portfolio

---

## Validation

Perform on **production** (or production-like Preview) with two test accounts (User A and User B).

### Auth & profile

- [ ] **Signup** (email + password)
- [ ] **Login** / **logout**
- [ ] **Profile update** (name, UI theme) — billing fields not editable from client
- [ ] Email confirmation link works (`/confirm-email?token_hash=…&type=…`)

### Portfolio

- [ ] **Property CRUD**
- [ ] **Tenant CRUD** + link/unlink to property
- [ ] **Lease CRUD** + cancel
- [ ] **Income / expense CRUD** (including future-dated expense and bond-split PATCH if used)
- [ ] **Dashboards** (portfolio overview KPIs)
- [ ] **Statements** (monthly property statement)

### Calculators & PDFs

- [ ] **Calculator save** (logged in; `free_uses_remaining` decrements when applicable)
- [ ] **Report PDF** (calculation + property summary from workspace)
- [ ] **Invoice PDF** generate + signed download

### Billing

- [ ] **Stripe checkout** (test or live card per mode)
- [ ] **Stripe webhook** (subscription row + profile status after payment)

### Admin & security

- [ ] **Admin-only actions** (non-admin denied on projection defaults UPDATE)
- [ ] **Cross-user access blocked** (User B cannot read/edit User A property, invoice, document, or Storage object)

**Automated gate (before cutover day):**

```bash
cd frontend && npm run verify:public-env && npm run test:ci && npm run build
cd ../backend && npm run verify:public-env && npm test
```

---

## Rollback

Prepare **before** switching DNS or announcing go-live.

- [ ] **Old branch/tag identified** (last known-good commit on `main`, e.g. `git tag pre-supabase-cutover <sha>`)
- [ ] **Database backup created** (Supabase Dashboard → Database → Backups, or point-in-time recovery enabled on Pro plan)
- [ ] **Supabase backup/export created** (pg_dump or `export-portfolio-backup` JSON if still on legacy DB)
- [ ] **Vercel previous deployment** available (Deployments → promote prior deployment)
- [ ] Rollback owner and decision window documented (who can revert DNS / Vercel promote)
- [ ] If rollback: revert Stripe webhook URL to previous endpoint (if any)
- [ ] Communicate: Express/Render is retired — rollback is **frontend deployment + DNS**, not API server restore unless you maintain a legacy stack separately

---

## Sign-off

| Step | Owner | Date | Notes |
|------|-------|------|-------|
| Supabase migrations + RLS | | | |
| Vercel env + deploy | | | |
| Stripe live/test | | | |
| Data migration (if any) | | | |
| Validation checklist | | | |
| Security checklist | | | |
| Go-live / DNS | | | |

---

## After cutover

- [ ] Monitor Vercel Functions logs (Stripe webhook, PDF generation, cron)
- [ ] Monitor Supabase Auth logs and API errors
- [ ] Confirm cron run at 06:00 UTC (or adjust `vercel.json` schedule)
- [ ] Update [`MIGRATION_STATUS.md`](MIGRATION_STATUS.md) changelog with production cutover date
- [ ] Archive or disable legacy Render service (if still running)
