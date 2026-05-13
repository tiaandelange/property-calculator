-- =============================================================================
-- TEST_RLS_MANUAL — targeted checks for core user-owned RLS (after
-- 20260521120000_rls_core_crud_split_policies.sql)
-- =============================================================================
--
-- Important: the Supabase SQL Editor usually runs as a privileged database
-- role that **bypasses** RLS. The queries in VERIFY_RLS.sql only prove that
-- RLS is enabled and policies exist; they do **not** prove Alice/Bob isolation.
--
-- For isolation, use one of:
--   (A) Two browser sessions with real JWTs + supabase-js or PostgREST (below), or
--   (B) A non-superuser SQL role with BYPASSRLS = false (advanced; not covered here).
--
-- Replace placeholders: <SUPABASE_URL>, <ANON_KEY>, <JWT_USER_A>, <UUID_USER_B>,
-- <UUID_PROPERTY_B>, <UUID_INVOICE_B>, <UUID_LINE_ITEM_B>.
--
-- =============================================================================
-- 1) User A cannot read user B’s properties (PostgREST)
-- =============================================================================
--
-- As User A, request B’s property primary key directly. Expect JSON [] (zero rows).
--
-- curl -sS \
--   -H "apikey: <ANON_KEY>" \
--   -H "Authorization: Bearer <JWT_USER_A>" \
--   "<SUPABASE_URL>/rest/v1/properties?select=id&id=eq.<UUID_PROPERTY_B>"
--
-- Also: list all properties as A and confirm <UUID_PROPERTY_B> never appears:
--
-- curl -sS \
--   -H "apikey: <ANON_KEY>" \
--   -H "Authorization: Bearer <JWT_USER_A>" \
--   "<SUPABASE_URL>/rest/v1/properties?select=id,name"
--
-- =============================================================================
-- 2) User A cannot INSERT a child row against user B’s property_id
-- =============================================================================
--
-- Pick a table with property_id + required columns (e.g. expense_entries).
-- Use a minimal valid body for your schema. Expect 401 or empty insert (0 rows)
-- depending on client and RLS failure mode.
--
-- curl -sS -X POST \
--   -H "apikey: <ANON_KEY>" \
--   -H "Authorization: Bearer <JWT_USER_A>" \
--   -H "Content-Type: application/json" \
--   -H "Prefer: return=representation" \
--   "<SUPABASE_URL>/rest/v1/expense_entries" \
--   -d '{"property_id":"<UUID_PROPERTY_B>","user_id":"<UUID_USER_A>", ...}'
--
-- Notes:
--   - If user_id is generated server-side only, omit it and rely on DB default;
--     RLS should still reject when property_id is not owned by A.
--   - Never send the service_role key from a browser.
--
-- =============================================================================
-- 3) User A cannot UPDATE another user’s invoice_line_item via invoice_id
-- =============================================================================
--
-- Preconditions: <UUID_LINE_ITEM_B> belongs to an invoice owned by B.
--
-- Attempt to re-parent the line item to an invoice A owns (or tweak amount):
--
-- curl -sS -X PATCH \
--   -H "apikey: <ANON_KEY>" \
--   -H "Authorization: Bearer <JWT_USER_A>" \
--   -H "Content-Type: application/json" \
--   "<SUPABASE_URL>/rest/v1/invoice_line_items?id=eq.<UUID_LINE_ITEM_B>" \
--   -d '{"description":"pivot-attack"}'
--
-- Expect: zero rows updated ([]) or policy error — line item is not visible
-- under A’s JWT because parent invoice.user_id is B.
--
-- Optional stricter pivot test: PATCH the line’s invoice_id to an invoice
-- owned by A. WITH CHECK on invoice_line_items_update_own must reject unless
-- the new invoice_id is also owned by A **and** the row was visible under USING
-- (it should not be for B’s line), so the update should still affect 0 rows.
--
-- =============================================================================
-- SQL Editor — policy presence only (same spirit as VERIFY_RLS.sql)
-- =============================================================================

SELECT tablename, policyname, cmd, roles::text
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'properties',
    'expense_entries',
    'invoice_line_items',
    'invoices',
    'subscriptions'
  )
ORDER BY tablename, policyname;
