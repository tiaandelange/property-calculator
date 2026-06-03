-- =============================================================================
-- Dev tier test users — manual SQL (run in Supabase SQL Editor as postgres)
-- =============================================================================
-- Auth users cannot be created safely from a migration on hosted Supabase.
-- Prefer the Node seed script (service role, server-side only):
--
--   cd backend && npm run dev:seed-subscription-users
--
-- Prerequisites:
--   1. Migrations applied through 20260610140000_dev_subscription_test_users.sql
--   2. Auth users exist for each email (script creates them), OR create in
--      Dashboard → Authentication → Users with the emails below.
--
-- Tier test inboxes (password set by seed script — see docs/dev/SUBSCRIPTION_TEST_USERS.md):
--   proplytic.starter@test.local   → starter
--   proplytic.investor@test.local  → investor
--   proplytic.portfolio@test.local → portfolio
--   proplytic.pro@test.local       → portfolio_pro
--
-- Owner admin (unchanged): delangetiaan13@gmail.com → ADMIN + portfolio_pro
-- =============================================================================

-- Assign plans (postgres / service_role only — will fail for authenticated JWT):
SELECT public.set_user_plan('proplytic.starter@test.local', 'starter');
SELECT public.set_user_plan('proplytic.investor@test.local', 'investor');
SELECT public.set_user_plan('proplytic.portfolio@test.local', 'portfolio');
SELECT public.set_user_plan('proplytic.pro@test.local', 'portfolio_pro');
SELECT public.set_user_plan('delangetiaan13@gmail.com', 'portfolio_pro');

-- Verify
SELECT
  u.email,
  p.role,
  p.subscription_status,
  us.plan_code,
  us.status AS subscription_row_status
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
LEFT JOIN public.user_subscriptions us ON us.user_id = u.id
WHERE lower(u.email) IN (
  'proplytic.starter@test.local',
  'proplytic.investor@test.local',
  'proplytic.portfolio@test.local',
  'proplytic.pro@test.local',
  'delangetiaan13@gmail.com'
)
ORDER BY u.email;
