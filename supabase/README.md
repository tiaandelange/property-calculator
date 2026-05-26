# Supabase (Phase 2 — schema planning)

SQL migrations in `migrations/` define the **target** Postgres schema for the Supabase-first architecture. They are **not** applied automatically by this repo’s CI unless you wire that up.

## Where these files come from

Migrations are derived from `backend/prisma/schema.prisma` plus what the Express routes and frontend actually use (properties, tenants, leases, financials, invoices, documents, calculators, stored reports, subscriptions, admin projection defaults).

## How to apply (when you approve)

From the project root, with the [Supabase CLI](https://supabase.com/docs/guides/cli) linked to your project:

```bash
supabase db push
# or, for local Supabase:
supabase start && supabase migration up
```

Or paste the contents of `migrations/20260513140000_core_application_schema.sql` into the **Supabase Dashboard → SQL Editor** on a **development / pre-launch** project (never paste untrusted DDL into production without review).

After a successful apply, run the read-only checks in `VERIFY_AFTER_MIGRATION.sql` in the same SQL editor.

## Phase 3 — Auth profile trigger + RLS

Run `migrations/20260515120000_auth_profiles_trigger_and_rls.sql` after the core schema so each new `auth.users` row gets a `public.profiles` row and authenticated clients can `select` / `update` their own profile for the SPA.

## Phase 4 — Full RLS (user-owned tables)

Run `migrations/20260515180000_row_level_security.sql` **after** Phase 2 and Phase 3. It enables RLS on all user-owned tables, adds `GRANT` for `authenticated`, and defines policies so each user only sees and mutates their own data (with child tables constrained via `property_id` / parent rows as described in the migration comments).

## Phase 1b — Foundation gaps (webhooks, profile email, indexes, calculation_results view)

Run `migrations/20260516140000_foundation_webhooks_profiles_email.sql` **after** Phases 2–4 (or at minimum after `20260513140000` so `set_updated_at` and base tables exist). It adds `webhook_events`, `profiles.email`, `stored_reports.metadata`, dashboard date indexes, and a `calculation_results` **view** over `calculator_results` (read path; physical table name unchanged for FK/RLS stability).

## Phase 2 (SQL) — Auth profile provisioning

Run `migrations/20260520120000_auth_profile_provisioning.sql` **after** Phase 1b (and earlier core + RLS migrations). It replaces `public.handle_new_user()` to insert full `profiles` rows (`email`, `role`, `subscription_status`, `free_uses_remaining = 3`), re-binds `on_auth_user_created` on `auth.users`, ensures `set_updated_at`, adds a **BEFORE UPDATE** guard so **authenticated** JWTs cannot change `role` / `subscription_status` (service role still can), and refreshes **RLS** on `profiles` (SELECT/UPDATE own row; INSERT self with safe defaults).

## Phase 4b — RLS v2 (split policies, subscriptions, soft-delete columns)

Run `migrations/20260521120000_rls_core_crud_split_policies.sql` **after** Phase 4 (`20260515180000_row_level_security.sql`) and Phase 2 SQL above. It replaces broad `FOR ALL` policies with per-command policies, adds nullable `archived_at` on ledger tables, restricts **`subscriptions`** to **SELECT** for `authenticated` (billing via service role), tightens child-table checks (`invoice_line_items`, recurring rules, invoices `UPDATE`/`DELETE`), and documents each policy with `COMMENT ON POLICY` where not already inline.

After apply, use `TEST_RLS_MANUAL.sql` (JWT / PostgREST isolation scenarios) alongside `VERIFY_RLS.sql` (metadata). Application tasks deferred during SQL-only work live in `docs/FOLLOW_UP_RLS_AND_APP_CUTOVER.md`.

## Bootstrap admin (owner, no Stripe)

Run `migrations/20260530120000_bootstrap_admin_delangetiaan.sql` after auth profile provisioning. It:

- Promotes `delangetiaan13@gmail.com` to `profiles.role = ADMIN` and `subscription_status = SUBSCRIBED` (unlimited calculators + admin panel + projection defaults).
- Updates `handle_new_user()` so the same email gets those defaults on signup.

To add another bootstrap admin later, append their email to the array inside `public.is_bootstrap_admin_email()` and re-run the migration’s `UPDATE` block (or run an equivalent `UPDATE` in the SQL editor).

## Validation

There is no `supabase/config.toml` in this repo yet. Validate by:

1. Applying migrations in order on a **development** Supabase project (SQL Editor or `supabase db push` once the CLI is linked), then
2. Running `VERIFY_AFTER_MIGRATION.sql` and `VERIFY_RLS.sql` as appropriate.

If the [Supabase CLI](https://supabase.com/docs/guides/cli) is installed: `supabase db lint` (requires a linked project or local stack).
