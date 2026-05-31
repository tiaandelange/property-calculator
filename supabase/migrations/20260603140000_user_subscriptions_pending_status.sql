-- Extend user_subscriptions.status for pre-payment signup (no provider wiring yet).

ALTER TABLE public.user_subscriptions
  DROP CONSTRAINT IF EXISTS user_subscriptions_status_chk;

ALTER TABLE public.user_subscriptions
  ADD CONSTRAINT user_subscriptions_status_chk CHECK (
    status IN (
      'trialing',
      'active',
      'active_manual',
      'pending_payment',
      'past_due',
      'cancelled',
      'expired'
    )
  );

COMMENT ON COLUMN public.user_subscriptions.status IS
  'trialing: free trial window; pending_payment: plan chosen, billing not connected; active_manual: granted without provider; active: paid via provider (future).';
