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
- **Auth:** Legacy app JWT and/or Supabase access token verification against Prisma `User` (see backend `resolveBearerUser`); some routes remain for legacy flows
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
- [ ] **Phase 2:** Supabase Auth and profiles (link `auth.users` to app profile; retire legacy auth paths when unused)
- [ ] **Phase 3:** Database schema and RLS (tables, policies, indexes; parity with Prisma models)
- [ ] **Phase 4:** Properties CRUD
- [ ] **Phase 5:** Tenants and leases
- [ ] **Phase 6:** Financial entries (income, expenses, recurring materialisation)
- [ ] **Phase 7:** Invoices (line items, status, PDF references)
- [ ] **Phase 8:** Dashboards and statements (aggregations, performance)
- [ ] **Phase 9:** Calculator persistence (saved runs, quotas if any)
- [ ] **Phase 10:** Storage and PDFs (upload/download, signed URLs, migration off local disk)
- [ ] **Phase 11:** Stripe and subscriptions (checkout, webhooks, subscription state)
- [ ] **Phase 12:** Frontend Supabase integration (client, RLS-safe patterns, feature flags)
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
| Frontend unit tests | `cd frontend && npm test -- --run` | **Pass** — 6 files, 20 tests |
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
| 2026-05-13 | Phase 1 env: separated server vs public vars in docs, `env.ts` comments, `verify:public-env`, `getSupabaseAdminClient` alias, README updates. |
| 2026-05-13 | Initial baseline: branch name, targets, rules, phase checklist, first verification snapshot. |
