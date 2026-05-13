-- =============================================================================
-- VERIFY_RLS — how to check Row Level Security after applying Phase 4 migration
-- =============================================================================
--
-- READ THIS FIRST (plain language)
-- ----------------------------
-- Row Level Security only runs for normal database users — the same role your
-- logged-in app uses when it talks to Supabase over HTTPS (the "anon" key plus
-- a user session JWT). That role is called `authenticated`.
--
-- The Supabase Dashboard "SQL Editor" almost always runs as a privileged role
-- (e.g. postgres) that IGNORES RLS on purpose, so admins can fix data. So:
--
--   SELECT * FROM properties;   -- in SQL Editor → you may see EVERYONE's rows
--
-- That does NOT mean RLS is broken. It only means you are not testing as a
-- normal user. To prove User A cannot see User B's data, you must query the
-- same way the app does: signed in as A or B (see "Real test" below).
--
-- What you CAN use SQL Editor for: the two SELECT queries at the bottom of
-- this file — they only check that RLS is turned on and that policies exist,
-- not that isolation works between users.
--
-- =============================================================================

-- ---------------------------------------------------------------------------
-- REAL TEST — two accounts + your app (or Table Editor with user context)
-- ---------------------------------------------------------------------------
--
-- Goal: prove three things:
--   (1) User A only sees A's data.
--   (2) User B only sees B's data (never A's).
--   (3) Nobody signed in cannot read private tables through the API.
--
-- Steps (browsers: normal window = User A, Incognito/second browser = User B):
--
-- 1) Create two users (sign up as "alice@..." and "bob@..." or use existing).
--
-- 2) As User A: in your app, create something obvious only A has, e.g. a
--    property named "ONLY_ALICE_PROPERTY". Confirm it appears in A's list.
--
-- 3) Sign out. Sign in as User B. Open the same screen (properties list).
--    You must NOT see "ONLY_ALICE_PROPERTY". If you see it, RLS or the query
--    path is wrong (e.g. using service role on the client — do not do that).
--
-- 4) Optional — cross-user update: in Dashboard → Table Editor you can see
--    alice's property row id as an admin. As User B in the app, if you ever
--    call update on that id, PostgREST should not change Alice's row (0 rows
--    updated or a policy error). Your UI might not expose this; a quick check
--    is enough that B's list never shows A's rows.
--
-- 5) Unauthenticated: sign out completely. Open the app and trigger any flow
--    that reads `properties` (or another private table) via supabase-js with
--    NO session. You should get an empty result set and/or an error, not B's
--    or A's private rows. (We did not add "public read" policies.)
--
-- If the app does not read `properties` from Supabase yet, use the Dashboard
-- "API" docs or a one-off HTML file with supabase-js: signInWithPassword,
-- then .from('properties').select('*'), compare Alice vs Bob.
--
-- ---------------------------------------------------------------------------
-- SQL Editor — metadata only (RLS bypass; does NOT prove user isolation)
-- ---------------------------------------------------------------------------

-- Every listed table should show rls_enabled = true
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'profiles', 'properties', 'portfolio_projection_defaults', 'tenants',
    'leases', 'property_documents', 'expense_entries', 'income_entries',
    'recurring_income_rules', 'invoices', 'invoice_line_items',
    'recurring_invoice_rules', 'calculator_results', 'stored_reports',
    'subscriptions'
  )
ORDER BY c.relname;

-- Policies that should exist (names vary; you should see one row per policy)
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles', 'properties', 'portfolio_projection_defaults', 'tenants',
    'leases', 'property_documents', 'expense_entries', 'income_entries',
    'recurring_income_rules', 'invoices', 'invoice_line_items',
    'recurring_invoice_rules', 'calculator_results', 'stored_reports',
    'subscriptions'
  )
ORDER BY tablename, policyname;
