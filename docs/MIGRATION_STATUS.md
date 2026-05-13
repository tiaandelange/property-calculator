# Migration status: Supabase + Vercel cutover

This document is the **safe migration baseline**. It records intent, guardrails, phased work, and a snapshot of automated checks. It does not change runtime behaviour by itself.

## Active branch

Migration work should land on:

**`migration/supabase-vercel-cutover`**

This branch was created from the then-current `main` line as the cutover baseline (2026-05-13). Continue stacking migration commits here until you merge back to `main`.

---

## Current backend (today)

- **Runtime:** Node.js + **Express**
- **Data access:** **Prisma** ORM
- **Database:** **PostgreSQL** (`DATABASE_URL`)
- **Auth:** **Supabase Auth** owns identity (`auth.users`). **`public.profiles`** holds app-specific fields (subscription flags, invoice payment JSON, UI prefs) and is provisioned by **`public.handle_new_user()`** after each `auth.users` insert (see `supabase/migrations/20260520120000_auth_profile_provisioning.sql`). **Legacy Express JWT + bcrypt** remain for existing clients until cutover (`resolveBearerUser`, `authRoutes`).
- **RLS (Postgres):** Phase 4 broad policies in `20260515180000_row_level_security.sql` are refined by **`20260521120000_rls_core_crud_split_policies.sql`** (per-command policies, subscription write lock-down, soft-delete columns on ledger tables). Express + Prisma remain authoritative until queries migrate; deferred app work is listed in [`docs/FOLLOW_UP_RLS_AND_APP_CUTOVER.md`](FOLLOW_UP_RLS_AND_APP_CUTOVER.md).
- **Files:** Local disk for reports PDFs, invoice PDFs, and property document uploads

---

## Target backend

- **Auth:** **Supabase Auth** (primary identity for end users)
- **Database:** **Supabase Postgres** with **Row Level Security (RLS)** aligned to tenant/user ownership
- **Files:** **Supabase Storage** (or equivalent object storage) for documents and generated PDFs where local disk is used today
- **Privileged operations:** Server-side only, using the service role or other secrets **never** shipped to the browser

---

## Target server functions (Vercel)

Use **Vercel Functions** (or equivalent serverless HTTP handlers) for:

- **Stripe:** Checkout session creation, webhook handling (raw body, secret key)
- **PDFs:** Report and invoice generation (heavy libraries, CPU)
- **Email:** Outbound mail with provider API keys or SMTP secrets
- **Other server-only work:** Anything that must not run in the SPA, batch jobs, admin maintenance

The existing Express app remains until feature parity is proven; new surfaces can be added alongside and switched over gradually.

---

## Target frontend hosting

- **Vercel** for the SPA (build output / framework adapter as configured in the repo)

## Current frontend (today)

- **Auth (SPA):** **Supabase Auth** via `@supabase/supabase-js` (`frontend/src/lib/supabaseClient.ts` — **only** `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`). Sign-in and register use `signInWithPassword` / `signUp`; session uses `getSession` + `onAuthStateChange` in `AuthContext`. **`public.profiles`** is read for shell / `fetchMe` after sign-in. **Route guards** (`RequireAuth`) require a Supabase session, not legacy `localStorage` JWTs.
- **Legacy bridge:** Axios still sends **`Authorization: Bearer <Supabase access_token>`** to Express (`frontend/src/api/client.ts`) so existing `/api/*` routes keep working until data access migrates. **Legacy Express auth routes** (`/api/auth/*`) remain on the server for older clients; the SPA does not call `POST /api/auth/login` or `register` for primary auth.
- **Data:** When Supabase env is set, **property list/detail/create/update/delete** use **`frontend/src/services/propertiesSupabase.ts`** (`public.properties`, `user_id = auth.uid()` on insert; updates/deletes also filter `user_id`). **Property detail** merges **leases** from **`frontend/src/services/leasesSupabase.ts`** (`listLeasesForProperty` + `mergeLeaseBundleIntoPropertyDetail`). **Tenant CRUD** uses **`tenantsSupabase.ts`**. **Lease CRUD** (list by property, current lease, create, update, delete/archive, cancel) uses **`leasesSupabase.ts`** with SQL RPCs **`create_property_lease`**, **`cancel_lease`**, **`delete_or_archive_lease`** in `supabase/migrations/20260523140000_lease_lifecycle_rpcs.sql` for multi-table parity (tenant link, recurring rent rule, expected income on cancel). Direct Supabase client updates the lease row and syncs **`recurring_income_rules`** on rent/dates/due-day changes (best-effort multi-step, not a single DB transaction). **Ledger income/expense** (list/create/update/soft-delete/hard-delete/mark-received, and **`GET`-style financials bundle** with a client-computed month summary from Supabase rows) uses **`frontend/src/services/financialsSupabase.ts`** + **`frontend/src/api/financialRowMapping.ts`**, with **`ownedProperties`** delegating when `VITE_SUPABASE_*` is set. **Recurring expense templates**, **future-dated expense validation**, and **PATCH payloads that touch bond splits or recurring schedule shape** still go to **Express**. **`GET /properties/:id/financials/summary`**, **statement**, **dashboard-summary**, **bond backfill**, **recurring-income run/activate**, **invoices** (except `createCurrentInvoiceFromLease` still calls Express), metrics, and other endpoints remain **Express** when not noted above. When Supabase is not configured, property, tenant, lease, and financial paths fall back to **Express** unchanged.

---

## Non-negotiable rules

1. **Service role key:** The Supabase **service_role** key must **never** appear in frontend code, environment variables exposed to the client bundle, or public repositories. It belongs only in server/Vercel secret stores and trusted automation.

2. **Decommission gate:** Do **not** remove **Express**, **Prisma**, or existing HTTP routes until **feature parity** is demonstrated (tests, smoke checks, and agreed sign-off for each domain).

---

## Environment variable contract (Phase 1)

| Surface | Supabase-related vars | Other secrets |
|---------|------------------------|---------------|
| **Backend / server** (`process.env`, `backend/.env*`) | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` (bridge), optional `SUPABASE_ANON_KEY` for future RLS-respecting server calls | `DATABASE_URL`, `JWT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| **Frontend / Vite** (`import.meta.env`, `frontend/.env*`) | **Only** `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` | Never `sk_*`, `whsec_*`, service role, or DB URLs |

- **Anon key:** intentionally public in the bundle; security depends on **RLS** and Auth session, not on hiding the anon string.
- **Service role key:** full database bypass; **server-only** (`backend/src/config/supabaseClient.ts`, future Vercel server functions). Confirmed: no `SUPABASE_SERVICE_ROLE_KEY` string in `frontend/src` runtime sources (see `npm run verify:public-env`).

---

## Migration phases (checklist)

Use this as a living checklist; update row status (`[ ]` → `[x]`) in PRs as phases complete.

- [x] **Phase 1:** Environment and Supabase clients (URLs, anon vs service keys, docs, `verify:public-env`, `env.ts` / README contract — **this commit**)
- [x] **Phase 2 (SQL):** Supabase Auth → `public.profiles` provisioning + profile RLS (`20260520120000_auth_profile_provisioning.sql`). Legacy Express auth **unchanged** until frontend/login cutover and Prisma parity.
- [ ] **Phase 3:** Database schema and RLS (tables, policies, indexes; parity with Prisma models) — **RLS v2 split policies landed in SQL** (`20260521120000_rls_core_crud_split_policies.sql`); app/query cutover still open (see follow-up doc).
- [ ] **Phase 4:** Properties CRUD — **SPA path done** for `GET/POST /properties`, `GET/PUT/DELETE /properties/:id` via `services/propertiesSupabase.ts` when `VITE_SUPABASE_*` set; **dashboard-summary** and property-nested routes remain Express.
- [ ] **Phase 5:** Tenants and leases — **Tenants + lease CRUD/status (SPA) done** when `VITE_SUPABASE_*` set (`tenantsSupabase.ts`, `leasesSupabase.ts`, RPC migration `20260523140000_lease_lifecycle_rpcs.sql`); **lease-adjacent** portfolio metrics and full recurring-income UI still Express.
- [ ] **Phase 6:** Financial entries — **basic income/expense CRUD + financials bundle (ledger + client summary) on SPA** when `VITE_SUPABASE_*` is set (`financialsSupabase.ts`, RPC **`hard_delete_income_entry` / `hard_delete_expense_entry`** in `20260523160000_financial_hard_delete_rpcs.sql`); **recurring expense materialisation**, **financials/summary charts**, **statements**, **bond backfill**, **dashboard-summary**, and **invoices** remain Express.
- [ ] **Phase 7:** Invoices (line items, status, PDF references)
- [ ] **Phase 8:** Dashboards and statements (aggregations, performance)
- [ ] **Phase 9:** Calculator persistence (saved runs, quotas if any)
- [ ] **Phase 10:** Storage and PDFs (upload/download, signed URLs, migration off local disk)
- [ ] **Phase 11:** Stripe and subscriptions (checkout, webhooks, subscription state)
- [ ] **Phase 12:** Frontend Supabase integration — **Auth + profile shell done** (`AuthContext`, `LoginPage`, `RequireAuth`, `fetchProfileForUserId` / `profiles`); list/detail **data** APIs still Express + Bearer bridge until later phases.
- [ ] **Phase 13:** Vercel deployment (env vars, previews, Stripe webhook URL, CORS)
- [ ] **Phase 14:** Decommission Express/Prisma (remove only after parity and soak)

---

## Baseline verification (automated)

Recorded on **2026-05-13** from repo root on branch **`migration/supabase-vercel-cutover`**.

| Scope | Command | Result |
|-------|---------|--------|
| Backend unit tests | `cd backend && npm test` | **Pass** — 8 suites, 71 tests |
| Backend integration tests | `cd backend && npm run test:integration` | **Pass** — 7 suites, 61 tests |
| Backend build | `cd backend && npm run build` | **Pass** — `prisma generate` + `tsc` |
| Frontend unit tests | `cd frontend && npm test -- --run` | **Pass** — 10 files, 56 tests |
| Frontend production build | `cd frontend && npm run build` | **Pass** — `tsc` + `vite build` (chunk size warning only) |
| Env boundary guard | `cd backend && npm run verify:public-env` | **Pass** — no forbidden tokens in `frontend/src` |

**Notes:**

- Integration tests expect a working Postgres + migrations (as already used in this environment).
- Re-run this table before and after major migration PRs to detect regressions early.
- Run `npm run verify:public-env` from `backend/` or `frontend/` after any change that might reference server secrets in the SPA tree.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-05-23 | Frontend **property income & expense ledger** via `frontend/src/services/financialsSupabase.ts` (`income_entries`, `expense_entries`, `recurring_income_rules` list; CRUD + soft archive + hard delete RPCs + `markIncomeReceived`); **`frontend/src/api/financialRowMapping.ts`** for Express-shaped rows; **`ownedProperties`** delegates `getPropertyFinancials`, `createPropertyIncome`, `markPropertyIncomeReceived`, and expense/income mutations (Express kept for recurring templates, `futureExpense`, bond-split patches). SQL: `hard_delete_income_entry`, `hard_delete_expense_entry` (`20260523160000_financial_hard_delete_rpcs.sql`). `OwnedFinancialsPage` / quick income on **`OwnedPropertyDetailPage`** use delegated APIs. Vitest: `financialsSupabase.test.ts`. |
| 2026-05-23 | Frontend **lease CRUD + status** via `frontend/src/services/leasesSupabase.ts` (`listLeasesForProperty`, `getCurrentLease`, `createLease`, `updateLease`, `deleteOrArchiveLease`, `cancelLease`); `ownedProperties` delegates lease helpers + `getPropertyLeases` / `getPropertyCurrentLease`; `propertiesSupabase.getProperty` merges lease bundle for workspace tabs. SQL: `create_property_lease`, `cancel_lease`, `delete_or_archive_lease` (`20260523140000_lease_lifecycle_rpcs.sql`). `OwnedLeasesPage` uses delegated APIs. Vitest: `leasesSupabase.test.ts`. |
| 2026-05-13 | Frontend **tenant CRUD** via `frontend/src/services/tenantsSupabase.ts` and `frontend/src/api/tenantRowMapping.ts`; `ownedProperties` tenant helpers delegate when Supabase env set; Express tenant routes unchanged. Invoice/recurring-invoice pages load property tenants via `getPropertyTenants` (no direct `/properties/:id/tenants` fetch in the SPA). Vitest: `tenantsSupabase.test.ts` (including RLS error surfacing on link). |
| 2026-05-22 | Frontend **properties CRUD** via `frontend/src/services/propertiesSupabase.ts` (`listProperties`, `getProperty`, `createProperty`, `updateProperty`, `deleteProperty`, `dbToProperty`, `propertyToDb`); `ownedProperties` delegates when Supabase env set; `GET /properties/dashboard-summary` unchanged (Express). Vitest coverage in `propertiesSupabase.test.ts`. |
| 2026-05-22 | Frontend auth: Supabase session provider, `profiles` load, login/register/logout via Supabase; Express JWT removed from route guards; axios attaches Supabase access token for legacy API. |
| 2026-05-21 | RLS v2: explicit `SELECT`/`INSERT`/`UPDATE`/`DELETE` policies for core user-owned tables, `archived_at` on income/expense/invoices, authenticated **no write** on `subscriptions`, admin-only update on `portfolio_projection_defaults`, manual test notes in `supabase/TEST_RLS_MANUAL.sql`, app checklist in `docs/FOLLOW_UP_RLS_AND_APP_CUTOVER.md` (`20260521120000_rls_core_crud_split_policies.sql`). |
| 2026-05-20 | Phase 2 SQL: `handle_new_user` full profile provisioning, profile RLS + `profiles_prevent_authenticated_billing_updates` trigger (`20260520120000_auth_profile_provisioning.sql`). |
| 2026-05-13 | Phase 1 env: separated server vs public vars in docs, `env.ts` comments, `verify:public-env`, `getSupabaseAdminClient` alias, README updates. |
| 2026-05-13 | Initial baseline: branch name, targets, rules, phase checklist, first verification snapshot. |
