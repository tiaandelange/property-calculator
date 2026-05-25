# Migration status: Supabase + Vercel cutover

This document is the **safe migration baseline**. It records intent, guardrails, phased work, and a snapshot of automated checks. It does not change runtime behaviour by itself.

## Active branch

Migration work should land on:

**`migration/supabase-vercel-cutover`**

This branch was created from the then-current `main` line as the cutover baseline (2026-05-13). Continue stacking migration commits here until you merge back to `main`.

---

## Current backend (today)

- **Runtime:** Node.js + **Express** (slim: health + Stripe only on Render)
- **Data access:** **Supabase** Postgres (RLS + RPCs) for all portfolio domains; **no Prisma in production runtime**
- **Database:** **Supabase Postgres** (`supabase/migrations/`). `DATABASE_URL` is optional and used only by `backend/scripts/legacy-prisma-migration/*`
- **Auth:** **Supabase Auth** owns identity (`auth.users`). **`public.profiles`** holds app-specific fields (subscription flags, invoice payment JSON, UI prefs) and is provisioned by **`public.handle_new_user()`** after each `auth.users` insert (see `supabase/migrations/20260520120000_auth_profile_provisioning.sql`). **Legacy Express JWT + bcrypt** remain for existing clients until cutover (`resolveBearerUser`, `authRoutes`).
- **RLS (Postgres):** Phase 4 broad policies in `20260515180000_row_level_security.sql` are refined by **`20260521120000_rls_core_crud_split_policies.sql`** (per-command policies, subscription write lock-down, soft-delete columns on ledger tables). Express + Prisma remain authoritative until queries migrate; deferred app work is listed in [`docs/FOLLOW_UP_RLS_AND_APP_CUTOVER.md`](FOLLOW_UP_RLS_AND_APP_CUTOVER.md).
- **Files:** Local disk for **legacy** calculation/property summary report PDFs (where not yet in Storage), invoice PDFs, and any remaining disk-backed assets

---

## Target backend

- **Auth:** **Supabase Auth** (primary identity for end users)
- **Database:** **Supabase Postgres** with **Row Level Security (RLS)** aligned to tenant/user ownership
- **Files:** **Supabase Storage** for workspace uploads, **generated calculation / property-summary report PDFs** (bucket **`reports`**, path `{user_id}/reports/{report_id}.pdf`), and **invoice PDFs** (bucket **`invoices`**, path `{user_id}/invoices/{invoice_id}.pdf`)
- **Privileged operations:** Server-side only, using the service role or other secrets **never** shipped to the browser

---

## Target server functions (Vercel)

Use **Vercel Functions** (or equivalent serverless HTTP handlers) for:

- **Stripe:** Checkout session creation, webhook handling (raw body, secret key)
- **PDFs:** Report generation (calculation + property summary) on Vercel (`frontend/api/reports/generate.ts`); invoice PDFs still Express until shared
- **Email:** Outbound mail with provider API keys or SMTP secrets (`frontend/api/invoices/[id]/send-email.ts` — invoice send when Supabase is configured)
- **Other server-only work:** Anything that must not run in the SPA, batch jobs, admin maintenance

The existing Express app remains until feature parity is proven; new surfaces can be added alongside and switched over gradually.

---

## Target frontend hosting

- **Vercel** for the SPA (build output / framework adapter as configured in the repo)

## Current frontend (today)

- **Auth (SPA):** **Supabase Auth** via `@supabase/supabase-js` (`frontend/src/lib/supabaseClient.ts` — **only** `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`). Sign-in and register use `signInWithPassword` / `signUp`; session uses `getSession` + `onAuthStateChange` in `AuthContext`. **`public.profiles`** is read for shell / `fetchMe` after sign-in. **Route guards** (`RequireAuth`) require a Supabase session, not legacy `localStorage` JWTs.
- **Legacy bridge:** Axios still sends **`Authorization: Bearer <Supabase access_token>`** to Express (`frontend/src/api/client.ts`) so existing `/api/*` routes keep working until data access migrates. **Legacy Express auth routes** (`/api/auth/*`) remain on the server for older clients; the SPA does not call `POST /api/auth/login` or `register` for primary auth.
- **Data:** When Supabase env is set, **property list/detail/create/update/delete** use **`frontend/src/services/propertiesSupabase.ts`** (`public.properties`, `user_id = auth.uid()` on insert; updates/deletes also filter `user_id`). **Property detail** merges **leases** from **`frontend/src/services/leasesSupabase.ts`** (`listLeasesForProperty` + `mergeLeaseBundleIntoPropertyDetail`) and **invoices** from **`frontend/src/services/invoicesSupabase.ts`** (`listInvoices` merged on `getProperty`). **Tenant CRUD** uses **`tenantsSupabase.ts`**. **Lease CRUD** (list by property, current lease, create, update, delete/archive, cancel) uses **`leasesSupabase.ts`** with SQL RPCs **`create_property_lease`**, **`cancel_lease`**, **`delete_or_archive_lease`** in `supabase/migrations/20260523140000_lease_lifecycle_rpcs.sql` for multi-table parity (tenant link, recurring rent rule, expected income on cancel). Direct Supabase client updates the lease row and syncs **`recurring_income_rules`** on rent/dates/due-day changes (best-effort multi-step, not a single DB transaction). **Ledger income/expense** (list/create/update/soft-delete/hard-delete/mark-received, and **`GET`-style financials bundle** with a client-computed month summary from Supabase rows) uses **`frontend/src/services/financialsSupabase.ts`** + **`frontend/src/api/financialRowMapping.ts`**, with **`ownedProperties`** delegating when `VITE_SUPABASE_*` is set. **Invoice CRUD** (list, get, create with line items via RPC, update header or replace line items via RPC, hard delete via RPC, mark paid) uses **`frontend/src/services/invoicesSupabase.ts`** + **`frontend/src/api/invoiceRowMapping.ts`** and **`ownedProperties`** (`listPropertyInvoices`, `getInvoice`, `createPropertyInvoice`, `updateInvoice`, `hardDeleteInvoice`, `markInvoicePaid`, **`generateInvoicePdf`**) when `VITE_SUPABASE_*` is set; **invoice PDF generate** uses Vercel **`POST /api/invoices/:id/generate-pdf`** (`frontend/api/invoices/[id]/generate-pdf.ts`) — **pdfmake** buffer upload to private bucket **`invoices`**, metadata on **`invoices.pdf_storage_bucket` / `pdf_storage_key`**, signed URL returned; list/detail mint **`createSignedUrl`** client-side; **hard delete** removes Storage object before RPC; **`invoicesVercel.ts`** + **`OwnedInvoicesPage`** / **Financials** workspace use signed URLs (no Express **`sign-download`** / **`download`** when Supabase is configured). **Invoice send email** uses Vercel **`POST /api/invoices/:id/send-email`** when Supabase is configured; **`create-current` invoice from lease** uses RPC **`create_invoice_from_lease`**. **Recurring rules CRUD** (income list/activate/pause, recurring invoice rules CRUD, recurring expense templates CRUD) is in **`frontend/src/services/recurringRulesSupabase.ts`**. **Future-dated expense validation** and **PATCH payloads that touch bond splits or recurring schedule shape** still go to **Express** where they did before. **Portfolio dashboard summary** (`GET /properties/dashboard-summary`) uses **`frontend/src/services/dashboardSupabase.ts`** → **`supabase.rpc('get_dashboard_summary', …)`** when `VITE_SUPABASE_*` is set (`supabase/migrations/20260524180000_get_dashboard_summary_rpc.sql`). **Monthly property statement** (`GET /properties/:id/statement`) uses **`frontend/src/services/statementsSupabase.ts`** → **`supabase.rpc('get_property_monthly_statement', …)`** when `VITE_SUPABASE_*` is set (`supabase/migrations/20260525100000_get_property_monthly_statement_rpc.sql`); **bond statement-row / backfill** use Vercel bond handlers when Supabase is configured. **Admin panel:** when `VITE_SUPABASE_*` is set, **`adminSupabase.ts`** serves **`GET`-equivalent admin status** and **portfolio projection defaults** read/update on **`portfolio_projection_defaults`** (RLS: any authenticated SELECT; UPDATE admin-only); **`POST /api/admin/dev/reset-portfolio-data`** is **not** available over HTTP (**410** — use **`npm run reset:portfolio-data`** in **`backend/`** for local dev). **Profile & saved reports:** when `VITE_SUPABASE_*` is set, **`profileSupabase.ts`** (`getCurrentProfile`, `updateProfile`, `listUserReports`, `deleteUserReport`); invoice payment JSON via RPC **`update_invoice_payment_details`**; trigger blocks JWT writes to billing columns (`20260529130000_profile_invoice_payment_rpc.sql`); **`user.ts`** / **`AccountPage`** / **`AdminPanelPage`** / **`SettingsPage`** delegate; Express **`userRoutes`** + legacy **`GET /api/auth/me`** retained (`@deprecated`). **Calculators** (`/calculators/*`): when `VITE_SUPABASE_*` is set, **`CalculatorPage`** runs **`runCalculatorLocally`** (shared **`backend/src/calculatorShared`** engine) and persists via **`save_calculation_and_decrement_free_use`** + **`public.calculator_results`**; **`DashboardPage`** lists/deletes via **`profileSupabase`**; **calculation PDFs** use same-origin **`POST /api/reports/generate`** (`frontend/api/reports/generate.ts` on **Vercel**) with the Supabase access token — **pdfmake** renders to a buffer (no **`chartjs-node-canvas`**; chart area is a documented placeholder), upload to Storage bucket **`reports`** at **`{user_id}/reports/{report_id}.pdf`**, **`stored_reports`** row with **`storage_bucket` / `storage_key`**, short-lived **`createSignedUrl`** returned to the browser. **`listUserReports`** mints signed URLs when storage metadata is present; legacy rows without storage still use **`/api/reports/:id/download`** (Express). **Property summary PDF** from the workspace: **Financials → Statement** includes **“Property summary PDF”** (same Vercel handler, **`get_property_monthly_statement`** RPC for the current UTC month). **Express** **`POST /api/reports/generate`** remains for Prisma integer ids and is annotated **`@deprecated`** in **`reportRoutes.ts`**. **Property workspace documents** (`OwnedDocumentsPage`): when `VITE_SUPABASE_*` is set, **`frontend/src/services/documentsSupabase.ts`** uploads to Storage bucket **`property-documents`** (`{user_id}/properties/{property_id}/{document_id}-{safe_filename}`), lists/deletes metadata in **`public.property_documents`**, and opens files via **`createSignedUrl`**; **Express** multer routes under **`/api/properties/:id/documents/*`** and **`/api/documents/*`** remain for non-Supabase mode and are marked **`@deprecated`** in code. **`GET /properties/:id/financials/summary`**, equity metrics, property aggregate, and other endpoints remain **Express** when not noted above. **Run-due** (income / invoices / bond-aware expenses) and **cron** use Supabase RPCs + Vercel as documented in the decommission table. When Supabase is not configured, property, tenant, lease, financial, invoice, and dashboard paths fall back to **Express** unchanged.

---

## Non-negotiable rules

1. **Service role key:** The Supabase **service_role** key must **never** appear in frontend code, environment variables exposed to the client bundle, or public repositories. It belongs only in server/Vercel secret stores and trusted automation.

2. **Decommission gate:** **Prisma is removed from production runtime** (2026-05-29). The slim Express app remains for **Stripe** until optionally moved to Vercel. **`prisma/schema.prisma`** and **`scripts/legacy-prisma-migration/`** are retained for one-off data tools only.

---

## Environment variable contract (Phase 1)

| Surface | Supabase-related vars | Other secrets |
|---------|------------------------|---------------|
| **Backend / server** (`process.env`, `backend/.env*`) | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` (bridge), optional `SUPABASE_ANON_KEY` for future RLS-respecting server calls | `DATABASE_URL`, `JWT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| **Frontend / Vite** (`import.meta.env`, `frontend/.env*`) | **Only** `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` | Never `sk_*`, `whsec_*`, service role, or DB URLs |
| **Vercel server functions** (`frontend/api/*`, `process.env`) | Same Supabase URL + **anon** key as the SPA (`SUPABASE_URL` / `SUPABASE_ANON_KEY` **or** the `VITE_*` pair duplicated in the Vercel project) so the handler can verify the user JWT and respect RLS — **not** the service role | Never expose service role to the browser |

- **Anon key:** intentionally public in the bundle; security depends on **RLS** and Auth session, not on hiding the anon string.
- **Service role key:** full database bypass; **server-only** (`backend/src/config/supabaseClient.ts`, future Vercel server functions). Confirmed: no `SUPABASE_SERVICE_ROLE_KEY` string in `frontend/src` runtime sources (see `npm run verify:public-env`).

---

## Migration phases (checklist)

Use this as a living checklist; update row status (`[ ]` → `[x]`) in PRs as phases complete.

- [x] **Phase 1:** Environment and Supabase clients (URLs, anon vs service keys, docs, `verify:public-env`, `env.ts` / README contract — **this commit**)
- [x] **Phase 2 (SQL):** Supabase Auth → `public.profiles` provisioning + profile RLS (`20260520120000_auth_profile_provisioning.sql`). Legacy Express auth **unchanged** until frontend/login cutover and Prisma parity.
- [ ] **Phase 3:** Database schema and RLS (tables, policies, indexes; parity with Prisma models) — **RLS v2 split policies landed in SQL** (`20260521120000_rls_core_crud_split_policies.sql`); app/query cutover still open (see follow-up doc).
- [ ] **Phase 4:** Properties CRUD — **SPA path done** for `GET/POST /properties`, `GET/PUT/DELETE /properties/:id` via `services/propertiesSupabase.ts` when `VITE_SUPABASE_*` set; **portfolio dashboard-summary** on SPA uses **`get_dashboard_summary`** RPC; other property-nested routes remain Express where listed below.
- [ ] **Phase 5:** Tenants and leases — **Tenants + lease CRUD/status (SPA) done** when `VITE_SUPABASE_*` set (`tenantsSupabase.ts`, `leasesSupabase.ts`, RPC migration `20260523140000_lease_lifecycle_rpcs.sql`); **lease-adjacent** portfolio metrics and full recurring-income UI still Express.
- [ ] **Phase 6:** Financial entries — **basic income/expense CRUD + financials bundle (ledger + client summary) on SPA** when `VITE_SUPABASE_*` is set (`financialsSupabase.ts`, RPC **`hard_delete_income_entry` / `hard_delete_expense_entry`** in `20260523160000_financial_hard_delete_rpcs.sql`); **recurring rule CRUD** (`recurringRulesSupabase.ts`); **SQL run-due RPCs** (`20260524120000_recurring_run_due_rpcs.sql`). **Monthly statement read** on SPA via **`get_property_monthly_statement`** (`statementsSupabase.ts`, `20260525100000_get_property_monthly_statement_rpc.sql`). **Recurring expense materialisation** (bond logic), **financials/summary charts**, and **bond backfill** remain Express. **Portfolio dashboard-summary** is implemented in SQL RPC **`get_dashboard_summary`** (SPA) with documented parity gaps vs Express (see changelog 2026-05-24 dashboard entry).
- [ ] **Phase 7:** Invoices — **CRUD + line items + PDF on SPA** when `VITE_SUPABASE_*` is set (`invoicesSupabase.ts`, `invoiceRowMapping.ts`, RPCs in `20260524140000_invoice_crud_rpcs.sql`, Vercel **`/api/invoices/:id/generate-pdf`**, bucket **`invoices`** in `20260529120000_invoices_storage_bucket.sql`); **invoice send email** and **`create-current` invoice from lease** remain Express.
- [ ] **Phase 8:** Dashboards and statements (aggregations, performance) — **portfolio overview dashboard** KPIs/charts on SPA via **`get_dashboard_summary`** when Supabase env is set; **monthly property statement** on SPA via **`get_property_monthly_statement`**; deeper performance parity still Express.
- [x] **Phase 9:** Calculator persistence — **SPA run + save when `VITE_SUPABASE_*` set:** deterministic engine in **`backend/src/calculatorShared/`** (bundled via Vite alias `@calculatorShared`); **`frontend/src/services/calculationsSupabase.ts`** (`runCalculatorLocally`, `saveCalculationResult` → RPC **`save_calculation_and_decrement_free_use`**, `listCalculationResults`, `deleteCalculationResult`); **`CalculatorPage`** / **`DashboardPage`** use local math + Supabase persistence; **calculation PDF** via Vercel **`POST /api/reports/generate`** + Storage **`reports`** (see changelog 2026-05-14). **Express** `POST /api/calculations/:type` unchanged for non-Supabase mode; **Express** `POST /api/reports/generate` retained for legacy Prisma integer ids (`@deprecated` in code).
- [x] **Phase 10 (partial):** Storage and PDFs — **property workspace documents** (`property-documents`); **calculation + property-summary report PDFs** (`reports`, `frontend/api/reports/generate.ts`); **invoice PDFs** (`invoices`, `frontend/api/invoices/[id]/generate-pdf.ts`, `20260529120000_invoices_storage_bucket.sql`). Other disk-backed assets may remain Express until migrated.
- [ ] **Phase 11:** Stripe and subscriptions (checkout, webhooks, subscription state)
- [x] **Phase 12 (partial):** Frontend Supabase integration — **Auth + profile + saved reports on SPA** when `VITE_SUPABASE_*` set (`profileSupabase.ts`, `user.ts` delegates, `AuthContext` + `AccountPage` / `AdminPanelPage` / `SettingsPage`); list/detail **property** data still Express + Bearer bridge where not migrated in earlier phases.
- [x] **Phase 13 (partial):** Vercel deployment — **`frontend/vercel.json`** (Vite build, `dist/`, SPA rewrite excluding `/api/*`, security headers, PDF function `includeFiles`); **Root Directory `frontend`**; env contract **`VITE_SUPABASE_URL`**, **`VITE_SUPABASE_ANON_KEY`**, **`VITE_API_BASE_URL`**; **`resolveApiBaseUrl()`** (no `localhost` in production builds); README + [`docs/deployment/vercel.md`](deployment/vercel.md). **Still open:** Stripe webhook URL on backend, full Express decommission.
- [ ] **Phase 14:** Decommission Express/Prisma — **route-level `@deprecated` + SPA cutover done** for domains in “Replaced” table above; **do not delete backend** until Stripe, bond/backfill, run-due, email, and aggregate migrate

---

## Baseline verification (automated)

Recorded on **2026-05-13** from repo root on branch **`migration/supabase-vercel-cutover`**.

| Scope | Command | Result |
|-------|---------|--------|
| Backend unit tests | `cd backend && npm test` | **Pass** — 8 suites, 71 tests |
| Backend integration tests | `cd backend && npm run test:integration` | **Pass** — 7 suites, 61 tests |
| Backend build | `cd backend && npm run build` | **Pass** — `prisma generate` + `tsc` |
| Frontend unit tests | `cd frontend && npm test -- --run` | **Pass** — 17 files, 94 tests |
| Frontend production build | `cd frontend && npm run build` | **Pass** — `tsc` + `vite build` (chunk size warning only) |
| Env boundary guard | `cd backend && npm run verify:public-env` | **Pass** — no forbidden tokens in `frontend/src` |

**Notes:**

- Integration tests expect a working Postgres + migrations (as already used in this environment).
- Re-run this table before and after major migration PRs to detect regressions early.
- Run `npm run verify:public-env` from `backend/` or `frontend/` after any change that might reference server secrets in the SPA tree.

---

## Invoice PDF cutover checklist

| # | Task | Status | Location / notes |
|---|------|--------|------------------|
| 1 | Locate legacy Express invoice PDF code | Done | `ownedPropertiesRoutes.ts` (`generate-pdf`, `sign-download`, `download`), `invoicePdf.ts`, `pdf_path` on `invoices` |
| 2 | Vercel `POST /api/invoices/:id/generate-pdf` | Done | `frontend/api/invoices/[id]/generate-pdf.ts` |
| 3 | JWT verify, ownership, fetch invoice/tenant/property/profile, pdfmake, Storage upload | Done | Anon client + user Bearer (RLS); no service role |
| 4 | Storage bucket `invoices` (private) | Done | `supabase/migrations/20260529120000_invoices_storage_bucket.sql` |
| 5 | Path `{user_id}/invoices/{invoice_id}.pdf` | Done | `pdf_storage_key` + owner CHECK |
| 6 | SPA generate/download via Vercel + signed URLs | Done | `invoicesVercel.ts`, `ownedProperties.generateInvoicePdf`, `OwnedInvoicesPage`, `WorkspaceFinancialsTab` |
| 7 | Replace sign-download / Express download (Supabase mode) | Done | `invoicesSupabase` `createSignedUrl`; legacy `/api/invoices/:id/download` only without Supabase |
| 8 | Bucket not public | Done | `public: false` on bucket insert |
| 9 | Delete removes Storage object | Done | `invoicesSupabase.deleteInvoice` before `hard_delete_invoice` RPC |
| 10 | Express routes retained | Done | `@deprecated` on generate/sign/download |
| 11 | Tests / build | Done | `invoicePdfBuilder.test.ts`, `invoicesVercel.test.ts`; `npm run test:ci` + `npm run build` in `frontend/` |
| 12 | This document | Done | This section + changelog |

**Local dev:** use `vercel dev` so `/api/invoices/:id/generate-pdf` is served.

---

## Report PDF cutover checklist (calculation + property summary)

Completed on branch **`migration/supabase-vercel-cutover`** / **`main`** (see changelog 2026-05-14). Invoice PDFs are **out of scope** until a shared safe utility exists.

| # | Task | Status | Location / notes |
|---|------|--------|------------------|
| 1 | Locate legacy Express PDF code | Done | `backend/src/routes/reportRoutes.ts`, `backend/src/services/pdf/calculationReportPdf.ts`, `propertySummaryPdf.ts`, `writePdfKitDocument.ts`, `pdfMakePrinter.ts`, `backend/src/config/reportsPaths.ts` |
| 2 | Vercel API `POST /api/reports/generate` | Done | `frontend/api/reports/generate.ts` |
| 3 | Verify JWT, fetch data, pdfmake, Storage upload, `stored_reports`, signed URL | Done | Anon client + user Bearer (RLS); **no service role** in this handler |
| 4 | Storage bucket `reports` | Done | `supabase/migrations/20260528130000_reports_storage_bucket.sql` |
| 5 | Path `{user_id}/reports/{report_id}.pdf` | Done | Matches `stored_reports.storage_key` CHECK |
| 6 | Replace local `reports/` writes (Supabase path) | Done | Vercel uploads to Storage; Express disk path kept for non-Supabase / Prisma ids |
| 7 | No durable local FS for final output | Done | In-memory buffer via `frontend/api/lib/pdfMakeServer.ts` |
| 8 | `chartjs-node-canvas` isolated | Done | Not bundled on Vercel; placeholder + note in `frontend/api/lib/reportPdfBuilders.ts` |
| 9 | SPA calls `/api/reports/generate` | Done | `frontend/src/services/reportsVercel.ts` — `CalculatorPage`, `DashboardPage`, `WorkspaceFinancialsTab` (when `VITE_SUPABASE_*` set) |
| 10 | Express route retained | Done | `reportRoutes.post("/generate")` marked `@deprecated` |
| 11 | Tests / build | Done | `reportPdfBuilders.test.ts`, `reportsVercel.test.ts`; `npm run test:ci` + `npm run build` in `frontend/`; manual: signed URL, cross-user RLS (Storage policies + row ownership) |
| 12 | This document | Done | This section + changelog below |

**Local dev:** use `vercel dev` (or a Vercel preview) so `/api/reports/generate` is served; `vite` alone does not run serverless functions.

---

## Profile & saved reports cutover checklist

| # | Task | Status | Location / notes |
|---|------|--------|------------------|
| 1 | Locate legacy Express routes | Done | `backend/src/routes/userRoutes.ts` (`PATCH /profile`, `GET /reports`, `DELETE /reports/:id`); `authRoutes.get("/me")` for legacy Prisma profile |
| 2 | `frontend/src/services/profileSupabase.ts` | Done | `getCurrentProfile`, `updateProfile`, `listUserReports`, `deleteUserReport`, `fetchProfileForUserId` |
| 3 | Tables `profiles`, `calculator_results`, `stored_reports` | Done | RLS on user-owned rows; list/delete scoped by session |
| 4 | Protect `role`, `subscription_status`, `free_uses_remaining` | Done | Trigger + RPC bypass for `save_calculation_and_decrement_free_use` (`20260529130000_profile_invoice_payment_rpc.sql`) |
| 5 | Invoice payment details via RPC | Done | `update_invoice_payment_details(p_details jsonb)`; SPA `updateProfile` never PATCHes that column directly |
| 6 | Replace SPA profile/reports calls | Done | `user.ts`, `AccountPage`, `AdminPanelPage`, `SettingsPage`, `DashboardPage`, `AuthContext` |
| 7 | Express routes retained | Done | `@deprecated` on `userRoutes` |
| 8 | Tests / build | Done | `profileSupabase.test.ts`, `calculationsSupabase.test.ts`; `npm run test:ci` + `npm run build` in `frontend/` |
| 9 | Cross-user reports | Done (server) | RLS on `calculator_results` / `stored_reports`; manual: second user cannot list/delete another user’s rows |
| 10 | This document | Done | This section + changelog |

**Apply SQL:** run migration `20260529130000_profile_invoice_payment_rpc.sql` on the Supabase project before testing invoice payment saves in production.

---

## Vercel frontend deployment checklist

| # | Task | Status | Location / notes |
|---|------|--------|------------------|
| 1 | Framework | Done | **Vite + React** (`frontend/vite.config.ts`), not Next.js |
| 2 | Build scripts | Done | `build`, `preview`, `typecheck`, `test:ci`, `verify:public-env` in `frontend/package.json` |
| 3 | `vercel.json` | Done | `frontend/vercel.json` — SPA fallback `/(?!api/)` → `/index.html`; `/api/*` → serverless |
| 4 | Root directory | Done | Monorepo: Vercel project **Root Directory = `frontend`** |
| 5 | Public env vars | Done | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`; optional `VITE_API_BASE_URL` for Express bridge |
| 6 | No secrets in bundle | Done | `verify:public-env`; no service role / Stripe secret / Prisma in `frontend/src` |
| 7 | API URL resolution | Done | `frontend/src/lib/apiBase.ts`; Vercel PDF routes use relative `/api/...` |
| 8 | Local prod build | Done | `npm run build` + `npm run preview` in `frontend/` |
| 9 | Docs | Done | README § Deploy frontend on Vercel; this section |

**Vercel serverless env (UI):** `SUPABASE_URL` + `SUPABASE_ANON_KEY` (or `VITE_*` duplicates) for `frontend/api/*`.

---

## Express route decommission (parity confirmed — handlers retained)

The **Express app is not removed**. Migrated routes are marked `@deprecated` in code and are **not invoked by the SPA** when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set. Non-Supabase builds and integration tests still use Express.

### Replaced — SPA uses Supabase or Vercel (Express `@deprecated`)

| Area | Express route(s) | Replacement |
|------|------------------|-------------|
| Auth login / register | `POST /api/auth/login`, `POST /api/auth/register` | Supabase `signInWithPassword` / `signUp` (`LoginPage`) |
| Auth profile | `GET /api/auth/me` | `profileSupabase.getCurrentProfile` / `fetchProfileForUserId` |
| User profile patch | `PATCH /api/user/profile` | `profileSupabase.updateProfile` + RPC `update_invoice_payment_details` |
| Saved reports | `GET /api/user/reports`, `DELETE /api/user/reports/:id` | `profileSupabase.listUserReports` / `deleteUserReport` |
| Calculators | `POST /api/calculations/:type` | `calculationsSupabase` + RPC `save_calculation_and_decrement_free_use` |
| Properties CRUD | `GET/POST /api/properties`, `GET/PUT/DELETE /api/properties/:id` | `propertiesSupabase` via `ownedProperties.ts` |
| Dashboard summary | `GET /api/properties/dashboard-summary` | `dashboardSupabase` → RPC `get_dashboard_summary` |
| Tenants CRUD + link | `/api/tenants/*`, `/api/properties/:id/tenants/*` | `tenantsSupabase` via `ownedProperties.ts` |
| Leases CRUD + cancel | `/api/properties/:id/leases`, `/api/leases/:id` | `leasesSupabase` + lifecycle RPCs |
| Financials ledger | `/api/properties/:id/financials`, income/expense CRUD | `financialsSupabase` (except bond-split / recurring-schedule POST — see below) |
| Monthly statement | `GET /api/properties/:id/statement` | `statementsSupabase` → RPC `get_property_monthly_statement` |
| Invoices CRUD | `/api/properties/:id/invoices`, `/api/invoices/:id` | `invoicesSupabase` |
| Invoice PDF | `POST /api/invoices/:id/generate-pdf`, sign/download | Vercel `POST /api/invoices/:id/generate-pdf` + Storage signed URLs |
| Report PDF generate | `POST /api/reports/generate` | Vercel `POST /api/reports/generate` |
| Property documents | multer upload/list/sign/download/delete | `documentsSupabase` + bucket `property-documents` |
| Admin metrics | `GET/PATCH /api/admin/portfolio-projection-metrics` | `adminSupabase` |
| Admin status | `GET /api/admin/status` | `adminSupabase.getAdminStatus` |
| Recurring income activate | `POST /api/recurring-income/:id/activate` | `recurringRulesSupabase.activateRecurringIncomeRule` |
| Recurring invoice rules list/create | `GET/POST /api/properties/:id/recurring-invoices` | `recurringRulesSupabase` |
| Admin portfolio reset | `POST /api/admin/dev/reset-portfolio-data` | **410 Gone** — `npm run reset:portfolio-data` script only |
| Bond preview / statement-row / backfill | `GET/POST .../bond/*` | Vercel `frontend/api/properties/[propertyId]/bond/*` + `bondLedgerServer.ts` |
| Financial historical backfill | `POST .../financials/backfill` | RPC `run_financial_historical_backfill` (`operationsSupabase.ts`) |
| Invoice from lease (current month) | `POST .../invoices/create-current` | RPC `create_invoice_from_lease` (`operationsSupabase.ts`) |
| Invoice send email | `POST /api/invoices/:id/send-email` | Vercel `frontend/api/invoices/[id]/send-email.ts` (SMTP secrets server-only) |
| Recurring run-due (income / invoices) | `POST /api/recurring-*-income|invoices/run-due` | RPCs `run_due_recurring_income` / `run_due_recurring_invoices` (`recurringRunDueSupabase.ts`) |
| Recurring run-due (expenses) | `POST /api/recurring-expenses/run-due` | Vercel `frontend/api/recurring-expenses/run-due.ts` (bond-aware TS) |
| Cron run-due (all users) | — | Vercel `GET|POST /api/cron/run-due` + `CRON_SECRET` + `SUPABASE_SERVICE_ROLE_KEY` (`vercel.json` daily 06:00 UTC) |
| Equity metrics | `GET/PATCH /api/properties/metrics/equity` | `equityMetricsSupabase.ts` |
| Property aggregate (workspace) | `GET /api/properties/:id/aggregate` | `getProperty` / Supabase detail bundle |
| Recurring expense schedule create | `POST .../expenses` + `recurringSchedule` | `financialsSupabase` + `buildExpenseInsert` schedule shape |

### Still active on slim Express (Supabase configured)

| Route / area | Reason |
|--------------|--------|
| `POST /api/subscription/checkout`, `POST /api/subscription/webhook`, `POST /api/subscription/cancel` | Stripe secrets on Render; metadata uses **profile UUID**; updates `profiles` + `subscriptions` via service role |
| `GET /api/health` | Render/Railway healthcheck |

### Retired from Express runtime (handlers removed)

All former `ownedPropertiesRoutes`, `authRoutes`, `calculatorRoutes`, `reportRoutes`, `userRoutes`, and `adminRoutes` Prisma handlers. SPA with `VITE_SUPABASE_*` must not depend on them. Legacy disk report download: use Storage signed URLs from `profileSupabase.listUserReports`.

### Frontend audit (Supabase mode)

With `VITE_SUPABASE_*` set, migrated screens go through `ownedProperties.ts` delegates or dedicated `*Supabase.ts` / `*Vercel.ts` modules. **No** SPA calls to `POST /api/auth/login`, `register`, or Prisma-only profile paths. Remaining `api.*` calls are listed in the “Still active” table above.

**Localhost:** only `apiBase.ts` defaults to `http://localhost:4000/api` in `MODE=development` when `VITE_API_BASE_URL` is unset.

---

## Admin cutover checklist

| # | Task | Status | Location / notes |
|---|------|--------|------------------|
| 1 | Locate legacy Express admin routes | Done | `backend/src/routes/adminRoutes.ts` (`GET /status`, `GET/PATCH /portfolio-projection-metrics`, `POST /dev/reset-portfolio-data`) |
| 2 | `portfolio_projection_defaults` + admin RLS | Done | `20260521120000_rls_core_crud_split_policies.sql` — authenticated SELECT; UPDATE only when `profiles.role = 'ADMIN'` |
| 3 | `frontend/src/services/adminSupabase.ts` | Done | `getAdminStatus`, `getPortfolioProjectionMetrics`, `updatePortfolioProjectionMetrics`, `isCurrentUserAdmin` |
| 4 | Replace SPA admin API calls | Done | `frontend/src/api/admin.ts` delegates when `VITE_SUPABASE_*` set; **`AdminPanelPage`** unchanged import path |
| 5 | Destructive reset not on HTTP | Done | `POST /api/admin/dev/reset-portfolio-data` → **410 Gone**; use **`cd backend && npm run reset:portfolio-data`** (non-production, `--confirm RESET`) |
| 6 | No public Vercel reset | Done | Not implemented (script-only; avoids service-role HTTP surface) |
| 7 | Tests / build | Done | `adminSupabase.test.ts`; Express `admin-dev-reset.test.ts` expects 410; `npm run test:ci` + `npm run build` in `frontend/` |
| 8 | Access control | Done (server + SPA) | SPA checks `profiles.role` before admin UI; RLS blocks non-admin UPDATE on defaults row |
| 9 | This document | Done | This section + changelog |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-05-29 | **Prisma removed from production runtime:** Deleted `src/config/db.ts` and all Prisma-backed Express route modules. **Slim API:** health + Stripe (`subscriptionRoutes` → Supabase `profiles`/`subscriptions` with UUID metadata). Auth bridge: `resolveBearerUser` reads `public.profiles` by JWT `sub`. **Legacy:** `backend/scripts/legacy-prisma-migration/` + `prisma/schema.prisma` (dev scripts only; `prisma` + `@prisma/client` are devDependencies). **Build:** `npm run build` = `tsc` only; Docker image has no Prisma generate. **Frontend:** equity metrics + recurring expense schedules on Supabase; `fetchPropertyAggregate` → `getProperty`. Tests: backend unit + `api-slim` integration; frontend 127 Vitest. |
| 2026-05-29 | **Phase 23 — special operations:** Bond ledger on **Vercel** (`frontend/api/properties/[propertyId]/bond/preview-at-date`, `statement-row`, `backfill-statement-rows`; `bondHelpers.ts` + `bondLedgerServer.ts`). **SQL RPCs** `create_invoice_from_lease`, `run_financial_historical_backfill` (`20260529140000_special_operations_rpcs.sql`) via **`operationsSupabase.ts`**. **Invoice email** Vercel handler + **`invoicesEmailVercel.ts`**. **Run-due:** income/invoices → existing RPCs (`recurringRunDueSupabase.ts`); expenses → Vercel bond-aware materialiser; **cron** `/api/cron/run-due` (income + invoice RPCs at scale; expense stub RPC in cron — call expense Vercel separately for full bond splits). **`ownedProperties.ts`** delegates bond/backfill/create-current/send-email; **Financials / Recurring Invoices / Invoices** pages wired. Express routes **`@deprecated`**. Vitest: `recurringRunDueSupabase.test.ts`, `invoicesEmailVercel.test.ts`, `bondOperationsVercel.test.ts`, `bondYmd.test.ts`, `supabaseServiceRole.test.ts`. **Vercel env:** `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, optional `SMTP_*` for send-email. |
| 2026-05-29 | **Express route decommission (partial):** `@deprecated` on migrated handlers (`authRoutes`, `userRoutes`, `calculatorRoutes`, `reportRoutes`, `adminRoutes`, key `ownedPropertiesRoutes`). **SPA fixes:** metrics pages use `getPortfolioDashboardSummary`; recurring invoice list/create + recurring income activate use Supabase when configured. **Docs:** “Express route decommission” table (replaced vs still active). Backend **not** removed. |
| 2026-05-29 | **Vercel frontend readiness:** Documented **Vite + React** deploy (`frontend/` root, `dist/`, `vercel.json` SPA rewrites). **`resolveApiBaseUrl()`** — dev → `localhost:4000/api`, production without env → `/api`. Required **`VITE_SUPABASE_*`** in README / `.env.production.example`; **`typecheck`** script. No `localhost` baked into production when env vars set. Vitest: **`apiBase.test.ts`**. |
| 2026-05-29 | **Admin (Supabase):** **`frontend/src/services/adminSupabase.ts`** — `getAdminStatus`, `getPortfolioProjectionMetrics`, `updatePortfolioProjectionMetrics` on **`portfolio_projection_defaults`** (growth rates clamped ±50%); admin gate via **`profiles.role = 'ADMIN'`** (matches RLS **`portfolio_defaults_update_admin`**). **`frontend/src/api/admin.ts`** delegates when Supabase configured. **Reset:** **`POST /api/admin/dev/reset-portfolio-data`** removed from HTTP API (**410**); local only **`backend/scripts/reset-portfolio-data.ts`** / **`npm run reset:portfolio-data`**. Express admin read/write routes **`@deprecated`**. Vitest: **`adminSupabase.test.ts`**. |
| 2026-05-29 | **Profile & saved reports (Supabase):** **`frontend/src/services/profileSupabase.ts`** — `getCurrentProfile` (Auth + `profiles`), `updateProfile` (`full_name`, `ui_color_scheme`; invoice JSON via RPC **`update_invoice_payment_details`**), `listUserReports` / `deleteUserReport` (`calculator_results` + `stored_reports` + Storage cleanup). SQL **`20260529130000_profile_invoice_payment_rpc.sql`** hardens **`profiles_prevent_authenticated_billing_updates`** (blocks JWT writes to `role`, `subscription_status`, `free_uses_remaining`, `invoice_payment_details`; **`app.bypass_profile_guard`** for RPCs). **`calculationsSupabase`** re-exports list/delete aliases. **`DashboardPage`** uses `profileSupabase` directly. Express **`userRoutes`** + legacy **`GET /api/auth/me`** retained (`@deprecated`). Vitest: **`profileSupabase.test.ts`**. |
| 2026-05-29 | **Invoice PDFs (Vercel + Supabase Storage):** Private bucket **`invoices`** + **`invoices.pdf_storage_bucket` / `pdf_storage_key`** (`20260529120000_invoices_storage_bucket.sql`). **Serverless:** `frontend/api/invoices/[id]/generate-pdf.ts` — verifies Bearer JWT, loads invoice + line items + tenant + property + profile **`invoice_payment_details`**, builds ledger window (3-month history + open balances) via **`invoicePdfBuilder.ts`**, **pdfmake** upload to **`{user_id}/invoices/{invoice_id}.pdf`** (`upsert`), clears legacy **`pdf_path`**. **SPA:** `invoicesVercel.ts`, `ownedProperties.generateInvoicePdf`, **`OwnedInvoicesPage`** / **Financials** workspace; list/detail attach **`createSignedUrl`**; delete removes Storage object. **Express** `generate-pdf` / `sign-download` / `download` retained (`@deprecated`). **Still Express:** `send-email`, `create-current` from lease. Vitest: `invoicePdfBuilder.test.ts`, `invoicesVercel.test.ts`. |
| 2026-05-14 | **Report PDFs (Vercel + Supabase Storage):** Private bucket **`reports`** + **`storage.objects`** RLS (`{uid}/reports/…`); **`stored_reports`** columns **`storage_bucket`**, **`storage_key`** (`20260528130000_reports_storage_bucket.sql`). **Serverless:** `frontend/api/reports/generate.ts` — verifies **`Authorization: Bearer`** with Supabase (**anon** client + user JWT, no service role), loads **`CALCULATION`** from **`calculator_results`** or **`PROPERTY_SUMMARY`** via **`get_property_monthly_statement`** + **`properties`** header row, builds PDF with **pdfmake** + Roboto fonts under **`frontend/assets/fonts/`** (bundled via **`vercel.json`** `includeFiles`), uploads to **`{user_id}/reports/{report_id}.pdf`**, inserts **`stored_reports`**, returns **`reportId`** + **`createSignedUrl`**. **Charts:** **`chartjs-node-canvas`** is **not** used on Vercel; the calculation PDF uses a **placeholder image** and an explicit note (parity gap vs Express). **SPA:** `reportsVercel.ts`, **`fetchPdfBlob`** for signed HTTPS URLs, **`CalculatorPage`** / **`DashboardPage`** / **Financials → Statement** (`WorkspaceFinancialsTab`) call the new route when Supabase is configured; **`listCalculationResults`** signs Storage-backed rows. **Express** `POST /api/reports/generate` kept, marked **`@deprecated`**. **Manual checks:** generate calculation PDF; property summary PDF; DB row; signed URL opens; cross-user blocked by RLS; `npm run build` / `npm run test:ci` in **`frontend/`**. **Local:** use **`vercel dev`** (or deploy preview) so **`/api/reports/generate`** runs — plain **`vite`** does not serve Vercel functions. |
| 2026-05-27 | **Property documents (Supabase Storage):** Private bucket **`property-documents`** + **`storage.objects`** RLS (`split_part(name,'/',1) = auth.uid()::text` for SELECT/INSERT/UPDATE/DELETE). **`public.property_documents`** extended with **`storage_bucket`**, **`storage_key`**, **`original_filename`**, **`size_bytes`** (+ CHECK that `storage_key` first segment matches **`user_id`**). **`frontend/src/services/documentsSupabase.ts`:** `uploadPropertyDocument` (pre-generated UUID id, upload then DB insert with rollback on failure), `listPropertyDocuments`, `getSignedDocumentUrl` (`createSignedUrl`), `deletePropertyDocument` (DB row then Storage remove). **`OwnedDocumentsPage`** branches on **`isSupabaseConfigured`**. **Express** `uploads/property-documents` + multer routes kept, annotated **`@deprecated`** in **`ownedPropertiesRoutes.ts`**. **Manual tests:** upload PDF/image; list; signed open in new tab; delete; cross-user denial (RLS + Storage policies); refresh shows metadata. Vitest: **`documentsSupabase.test.ts`**. |
| 2026-05-26 | **Calculators (Supabase path):** Canonical deterministic engine lives in **`backend/src/calculatorShared/`** (`calculatorEngine`, `calculatorHelpers`, `calculatorTypes`, `irrSolver`, `saTransferBondCosts`, `saPropertyCostTables`). **`backend/src/utils/*.ts`** re-export for existing imports/tests. **Frontend** resolves `@calculatorShared` via **`frontend/vite.config.ts`** + **`tsconfig` paths** (read-only import from repo; `server.fs.allow` parent dir). **`frontend/src/services/calculationsSupabase.ts`:** `runCalculatorLocally`, `saveCalculationResult` (RPC **`public.save_calculation_and_decrement_free_use`** in **`supabase/migrations/20260526200000_save_calculation_and_decrement_free_use.sql`** — `SECURITY DEFINER`, locks profile row, enforces `ADMIN` / `SUBSCRIBED` unlimited vs `free_uses_remaining`, inserts **`public.calculator_results`**), `listCalculationResults` (joins **`stored_reports`** for `hasPdf` / download URL shape), `deleteCalculationResult`. **`CalculatorPage`** / **`DashboardPage`** branch on **`isSupabaseConfigured`**; anonymous users still run locally without save; logged-in SPA saves no longer hit **`POST /api/calculations/:type`** in Supabase mode. **PDF:** Express **`POST /api/reports/generate`** still expected Prisma integer **`calculationId`** — SPA deferred UUID PDFs until the **2026-05-14** Vercel + Storage cutover (see newer changelog row). **Manual tests:** anonymous run; logged-in run + save; list/delete on dashboard; free tier exhaust message; subscribed/admin no decrement. **Vitest:** `calculationsSupabase.test.ts`. **Dependency:** `zod` added to **`frontend/package.json`** (engine uses Zod). **Removed:** duplicate **`backend/src/data/saPropertyCostTables.ts`** (tables live under `calculatorShared`). |
| 2026-05-25 | **Property monthly statement (Supabase):** SQL RPC **`public.get_property_monthly_statement(p_property_id, p_year, p_month, p_include_expected default true)`** in **`supabase/migrations/20260525100000_get_property_monthly_statement_rpc.sql`** — `SECURITY INVOKER`, property ownership `user_id = auth.uid()`, JSON payload aligned with Express `buildPropertyStatement` + route extras (`bondFinance`, `property`, `summary`, `statementRows`, `currentInvoice`, `deposits`, `futureCharges`, `recurringCharges`, `warnings`). **`frontend/src/services/statementsSupabase.ts`** calls the RPC and maps **`currentInvoice`** through **`dbInvoiceBundleToClient`**. **`ownedProperties.getPropertyStatement`** delegates when `VITE_SUPABASE_*` is set (property id must be UUID). **Parity vs Express** (`GET /properties/:propertyId/statement`): matches merged ledger ordering, running balance (unpaid invoices excluded from balance), UTC month bounds for summary rows (`utcCalendarMonthBounds`), summary formulas (`receivedThisMonth` includes PAID invoices in month, `bondFromProfile` when no bond ledger in month, `netCashFlow`, `balanceDue`, `depositHeld`), `computePropertyBondFinance`-style **`bondFinance`** (including calendar months elapsed on bond vs `calendarMonthsElapsedBond`), future/recurring charge filters. **Gaps:** (1) RPC does **not** run **`materializeDueRecurringExpenses`** or **`applyDepositGrowthForCurrentPropertyLeases`** — `warnings` explains; run Express statement load or separate materialisers first if you need identical rows. (2) **`currentInvoice` window:** RPC uses the **same UTC `[month_start, month_end)`** as the statement summary; Express **`getCurrentInvoiceForMonth`** used **server local** month bounds when `month` is set — edge-of-month TZ differences possible vs legacy. (3) **`sourceId` / `leaseId`** in JSON are **strings** (UUID/bigint text) vs legacy Express numbers; SPA already accepts `string \| number` in several paths. (4) **`actions`** on statement rows are empty arrays from RPC. Vitest: **`statementsSupabase.test.ts`**. Manual parity matrix: empty ledger; income-only; expense-only; both; invoice row; materialised recurring; cross-user → `Property not found` / RLS denial. |
| 2026-05-24 | **Portfolio dashboard (Supabase):** `frontend/src/services/dashboardSupabase.ts` calls **`public.get_dashboard_summary(p_month, p_property_types, p_property_id, p_portfolio_irr_horizon_years, p_iana_timezone)`** (`supabase/migrations/20260524180000_get_dashboard_summary_rpc.sql`). **`ownedProperties.getPortfolioDashboardSummary`** delegates when `VITE_SUPABASE_*` is set; Express route unchanged for non-Supabase mode. **`OwnedPropertiesPortfolioDashboardPage`** accepts UUID `propertyId` in query and property filter (no `Number()` coercion). **Parity vs Express** (`GET /properties/dashboard-summary` in `backend/src/routes/ownedPropertiesRoutes.ts`): RPC matches documented formulas for property counts, STR net (`adr * occ * nights * (1 - platformFee) - gross * mgmtFee + cleaningFeesMonthly` portfolio sum), ledger month windows, invoice paid-in-month income, expense snapshot (ACTIVE, `expense_date` in `[month_start, month_end)` excluding bond split), NOI / cash-on-cash inputs (`annualPreTaxCashFlow = monthlyNOI*12 - totalMonthlyDebtService*12`, cash invested = `total_cash_invested` or `estimateCashInvested` equivalent), cap rate / OER from trailing-12 received income and non-bond expenses, lease display status (ACTIVE + past `fixed_term_end_date` → MONTH_TO_MONTH), occupancy / rent-due keys, charts (monthly income/expense series, expense breakdown, cash flow by property with `name` + `monthlyIncome` / `monthlyExpenses` for charts, equity, lease timeline, STR rows, vacant land holding costs, monthly NOI trend, income/expense composition). **Gaps:** (1) **No `materializeDueRecurringExpensesForProperties`** before reads — totals can trail Express until recurring rows exist. (2) **Portfolio IRR** and **`portfolioAnalysisOverTime.columns`** are **not** computed in SQL; RPC returns stubs (`canCalculate: false`, `diagnostics.statusCode: DEFERRED`) and warnings; use Express or a future Vercel function for full IRR. (3) **Month boundaries** use **`p_iana_timezone`** (SPA passes `Intl.DateTimeFormat().resolvedOptions().timeZone`); Express uses **`monthBounds`** from the **Node host’s local timezone** when `month` is set — align server TZ with browser TZ for closest parity. (4) **Trailing 12 / last-5 windows** anchor on **“now” in `p_iana_timezone`**, matching Express’s use of `now` for `twelveStart`/`twelveEnd` and last-5 NOI trend (not on the selected `month` param). (5) **`filters.propertyId`** is a **UUID string** in JSON when set, not a legacy numeric id. Vitest: `dashboardSupabase.test.ts`. Manual smoke: `supabase/TEST_DASHBOARD_SUMMARY_MANUAL.sql`. |
| 2026-05-24 | **Invoices (Supabase):** `frontend/src/services/invoicesSupabase.ts` — `listInvoices`, `getInvoice`, `createInvoice` (RPC `create_invoice_with_line_items`), `updateInvoice` (table patch or RPC `update_invoice_with_line_items` when `lineItems` present), `deleteInvoice` (RPC `hard_delete_invoice`), `markInvoicePaid`. `frontend/src/api/invoiceRowMapping.ts` maps DB/RPC payloads to Express-shaped rows (`hasPdf`, `downloadUrl`, `lineItems`, optional `tenant`). `ownedProperties.ts` delegates `listPropertyInvoices`, `getInvoice`, `createPropertyInvoice`, `updateInvoice`, `markInvoicePaid`, `hardDeleteInvoice`; `propertiesSupabase.getProperty` merges `invoices`. UI: **`OwnedInvoicesPage`** and **`WorkspaceFinancialsTab`** (invoice statement save) use delegates when Supabase env is set; **PDF / email** still call Express `/api/invoices/:id/*`. SQL: `20260524140000_invoice_crud_rpcs.sql` (`invoice_number_seq`, **`generate_invoice_number()`**, atomic create/update, **`hard_delete_invoice`** for any status). **RLS:** line items and invoices remain scoped to `auth.uid()` (existing policies); standalone line-item reads without an owned parent return no rows. **Note:** Express invoice PDF handlers still assume legacy numeric ids in places; UUID invoices from Postgres may need an Express bridge before PDFs work end-to-end — tracked for follow-up. Vitest: `invoicesSupabase.test.ts`. |
| 2026-05-24 | **Recurring rules (Supabase):** `frontend/src/services/recurringRulesSupabase.ts` — `listRecurringIncomeRules` (filter by `propertyId` or `leaseId`), `activateRecurringIncomeRule`, `pauseRecurringIncomeRule`, recurring invoice list/create/update/delete, recurring **expense template** list/create/update on `expense_entries` (no separate `recurring_expense_rules` table). `recurringInvoiceRuleToCamel` in `financialRowMapping.ts`; `financialsSupabase` re-exports `listRecurringIncomeRulesForProperty` from the new module. **SQL (optional server/cron):** `run_due_recurring_income()`, `run_due_recurring_invoices()` (SECURITY DEFINER, `auth.uid()` scope unless `service_role`; invoice path advances `next_run_date`; income path dedupes by existing `LEASE_EXPECTED` row per lease + UTC calendar day; **no tenant email** in SQL), and **`run_due_recurring_expenses()`** safe no-op stub — full bond-aware materialisation stays in **`backend/src/domains/properties/property.recurringExpenseMaterialize.ts`** + **`POST /api/recurring-expenses/run-due`**. Legacy Express routes for reference: **`backend/src/routes/ownedPropertiesRoutes.ts`** (`/properties/:id/recurring-income`, `/recurring-income/:id/activate` and `pause`, `/recurring-income/run-due`, `/properties/:id/recurring-invoices`, `/recurring-invoices/*`, `/recurring-invoices/run-due`, `/recurring-expenses/run-due`, `/properties/:id/recurring-charges`). Vitest: `recurringRulesSupabase.test.ts`. Migration: `20260524120000_recurring_run_due_rpcs.sql`. |
| 2026-05-23 | Frontend **property income & expense ledger** via `frontend/src/services/financialsSupabase.ts` (`income_entries`, `expense_entries`, `recurring_income_rules` list; CRUD + soft archive + hard delete RPCs + `markIncomeReceived`); **`frontend/src/api/financialRowMapping.ts`** for Express-shaped rows; **`ownedProperties`** delegates `getPropertyFinancials`, `createPropertyIncome`, `markPropertyIncomeReceived`, and expense/income mutations (Express kept for recurring templates, `futureExpense`, bond-split patches). SQL: `hard_delete_income_entry`, `hard_delete_expense_entry` (`20260523160000_financial_hard_delete_rpcs.sql`). `OwnedFinancialsPage` / quick income on **`OwnedPropertyDetailPage`** use delegated APIs. Vitest: `financialsSupabase.test.ts`. |
| 2026-05-23 | Frontend **lease CRUD + status** via `frontend/src/services/leasesSupabase.ts` (`listLeasesForProperty`, `getCurrentLease`, `createLease`, `updateLease`, `deleteOrArchiveLease`, `cancelLease`); `ownedProperties` delegates lease helpers + `getPropertyLeases` / `getPropertyCurrentLease`; `propertiesSupabase.getProperty` merges lease bundle for workspace tabs. SQL: `create_property_lease`, `cancel_lease`, `delete_or_archive_lease` (`20260523140000_lease_lifecycle_rpcs.sql`). `OwnedLeasesPage` uses delegated APIs. Vitest: `leasesSupabase.test.ts`. |
| 2026-05-13 | Frontend **tenant CRUD** via `frontend/src/services/tenantsSupabase.ts` and `frontend/src/api/tenantRowMapping.ts`; `ownedProperties` tenant helpers delegate when Supabase env set; Express tenant routes unchanged. Invoice/recurring-invoice pages load property tenants via `getPropertyTenants` (no direct `/properties/:id/tenants` fetch in the SPA). Vitest: `tenantsSupabase.test.ts` (including RLS error surfacing on link). |
| 2026-05-22 | Frontend **properties CRUD** via `frontend/src/services/propertiesSupabase.ts` (`listProperties`, `getProperty`, `createProperty`, `updateProperty`, `deleteProperty`, `dbToProperty`, `propertyToDb`); `ownedProperties` delegates when Supabase env set; `GET /properties/dashboard-summary` unchanged (Express). Vitest coverage in `propertiesSupabase.test.ts`. |
| 2026-05-22 | Frontend auth: Supabase session provider, `profiles` load, login/register/logout via Supabase; Express JWT removed from route guards; axios attaches Supabase access token for legacy API. |
| 2026-05-21 | RLS v2: explicit `SELECT`/`INSERT`/`UPDATE`/`DELETE` policies for core user-owned tables, `archived_at` on income/expense/invoices, authenticated **no write** on `subscriptions`, admin-only update on `portfolio_projection_defaults`, manual test notes in `supabase/TEST_RLS_MANUAL.sql`, app checklist in `docs/FOLLOW_UP_RLS_AND_APP_CUTOVER.md` (`20260521120000_rls_core_crud_split_policies.sql`). |
| 2026-05-20 | Phase 2 SQL: `handle_new_user` full profile provisioning, profile RLS + `profiles_prevent_authenticated_billing_updates` trigger (`20260520120000_auth_profile_provisioning.sql`). |
| 2026-05-13 | Phase 1 env: separated server vs public vars in docs, `env.ts` comments, `verify:public-env`, `getSupabaseAdminClient` alias, README updates. |
| 2026-05-13 | Initial baseline: branch name, targets, rules, phase checklist, first verification snapshot. |
