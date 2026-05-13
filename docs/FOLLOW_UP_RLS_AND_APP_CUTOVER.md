# Follow-up: RLS v2 and application cutover

This checklist tracks **application and API work** deferred while SQL-only RLS was added (`supabase/migrations/20260521120000_rls_core_crud_split_policies.sql`). It does not change Express or Prisma routes by itself.

## Subscriptions and billing

- **Browser / anon-authenticated clients:** must not `INSERT`, `UPDATE`, or `DELETE` `public.subscriptions` (privilege revoked for `authenticated`). Reads remain `SELECT` where `user_id = auth.uid()`.
- **Stripe webhooks and admin jobs:** use the **service role** (or other server-only path) to upsert subscription rows and `subscription_status`.
- **Express / future Vercel handlers:** centralize subscription writes in server code with the service role key; never expose that key to the SPA.

## Financial rows: soft delete and status

- **`income_entries` and `expense_entries`:** `DELETE` is **revoked** for `authenticated`. Implement **archive** flows: set `archived_at` and/or status fields instead of hard delete from the client.
- **`invoices`:** non-draft invoices should move through **status** + **`archived_at`**; **hard `DELETE`** is allowed by RLS only when `status = 'DRAFT'` and `user_id = auth.uid()`. Align UI and APIs with this rule.
- **Prisma / REST:** audit any `delete()` calls on these tables from user-driven code paths.

## Child rows and FK hygiene

- **`invoice_line_items`:** all access is derived from **parent `invoices.user_id`**. Ensure the app never assumes line-item IDs are guessable without an invoice check; RLS already blocks cross-user `invoice_id`.
- **Tables keyed by `property_id` or `lease_id`:** policies require the parent **property** or **lease** (and related **tenant** where applicable) to belong to `auth.uid()`. Keep creating rows with consistent FKs so mobile/web clients do not receive confusing empty results.

## `portfolio_projection_defaults`

- **Read:** any authenticated user may read the singleton row (shared defaults for portfolio metrics).
- **Write:** only users whose **`profiles.role = 'ADMIN'`** may `UPDATE`. Expose an admin-only UI or server action; normal users should get a clear error if they attempt updates.

## `calculator_results` table vs `calculation_results` view

- RLS applies to **`public.calculator_results`** (physical table). The **`public.calculation_results`** view is documented in migrations as a security-invoker read path; confirm client queries target the intended object and respect RLS when using Supabase client libraries.

## Testing

- Run manual isolation checks in `supabase/TEST_RLS_MANUAL.sql` (PostgREST / two JWTs) after applying migrations on a dev project.
- Keep using `supabase/VERIFY_RLS.sql` for metadata sanity in the SQL Editor.

## Query migration (later phases)

- When moving reads/writes from Express+Prisma to Supabase PostgREST or supabase-js, re-run integration tests and add API tests that assert **empty results** or errors for cross-tenant IDs rather than silent data leaks.
