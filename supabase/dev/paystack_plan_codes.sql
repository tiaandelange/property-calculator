-- Link Paystack test-mode subscription plans to Proplytic subscription_plans.
--
-- BEFORE RUNNING:
-- 1. Paystack Dashboard → Plans (Test mode ON) → open each plan → copy Plan code (PLN_…).
-- 2. Replace the three placeholders below with your real codes.
-- 3. Run in Supabase Dashboard → SQL Editor (same project as production/preview app).
--
-- Amounts in Paystack should match Proplytic monthly_price (ZAR):
--   investor      R299
--   portfolio     R599
--   portfolio_pro R999
-- Starter is free — do NOT set a Paystack code on starter.

UPDATE public.subscription_plans
SET paystack_plan_code_monthly = 'REPLACE_WITH_INVESTOR_PLN_CODE'
WHERE code = 'investor';

UPDATE public.subscription_plans
SET paystack_plan_code_monthly = 'REPLACE_WITH_PORTFOLIO_PLN_CODE'
WHERE code = 'portfolio';

UPDATE public.subscription_plans
SET paystack_plan_code_monthly = 'REPLACE_WITH_PORTFOLIO_PRO_PLN_CODE'
WHERE code = 'portfolio_pro';

-- Verify (all three paid rows should show a PLN_ code; starter should stay NULL):
SELECT code, name, monthly_price, paystack_plan_code_monthly
FROM public.subscription_plans
WHERE is_active = true
ORDER BY sort_order;
