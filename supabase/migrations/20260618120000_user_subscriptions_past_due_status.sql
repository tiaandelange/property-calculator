-- Re-add past_due as a valid subscription lifecycle status (payment failures).
ALTER TABLE public.user_subscriptions
  DROP CONSTRAINT IF EXISTS user_subscriptions_status_chk;

ALTER TABLE public.user_subscriptions
  ADD CONSTRAINT user_subscriptions_status_chk CHECK (
    status IN ('active', 'trialing', 'pending_payment', 'past_due', 'cancelled', 'expired')
  );

COMMENT ON COLUMN public.user_subscriptions.status IS
  'active: entitled; trialing: trial window; pending_payment: plan chosen, billing not connected; past_due: payment failed; cancelled/expired: not entitled.';
