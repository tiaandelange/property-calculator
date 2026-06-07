-- Billing checkout runs on Vercel with SUPABASE_SERVICE_ROLE_KEY.
-- The original subscription_plans migration granted SELECT to anon/authenticated only.
-- Without service_role table privileges, POST /api/subscription/checkout fails with:
--   permission denied for table subscription_plans

GRANT SELECT ON TABLE public.subscription_plans TO service_role;

GRANT SELECT, INSERT, UPDATE ON TABLE public.user_subscriptions TO service_role;

COMMENT ON TABLE public.subscription_plans IS
  'Catalog of Proplytic plans. Public read (active rows) via anon/authenticated; Paystack plan codes and checkout via service_role API.';
