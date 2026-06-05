-- Provider-agnostic billing schema prep (Paystack primary; PayFast later).
-- No live payment wiring. Does not remove Stripe code or legacy subscription data.

-- ---------------------------------------------------------------------------
-- 1) subscription_plans — provider plan / price codes (admin + service role only)
-- ---------------------------------------------------------------------------

ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS paystack_plan_code_monthly text,
  ADD COLUMN IF NOT EXISTS paystack_plan_code_annual text,
  ADD COLUMN IF NOT EXISTS payfast_plan_code_monthly text,
  ADD COLUMN IF NOT EXISTS payfast_plan_code_annual text;

COMMENT ON COLUMN public.subscription_plans.paystack_plan_code_monthly IS
  'Paystack plan or price code for monthly billing. NULL until configured in Paystack dashboard.';

COMMENT ON COLUMN public.subscription_plans.paystack_plan_code_annual IS
  'Paystack plan or price code for annual billing. NULL until configured.';

COMMENT ON COLUMN public.subscription_plans.payfast_plan_code_monthly IS
  'PayFast recurring/subscription identifier for monthly billing. NULL until configured.';

COMMENT ON COLUMN public.subscription_plans.payfast_plan_code_annual IS
  'PayFast recurring/subscription identifier for annual billing. NULL until configured.';

-- subscription_plans RLS unchanged: anon/authenticated SELECT active plans only; no client writes.

-- ---------------------------------------------------------------------------
-- 2) user_subscriptions — confirm billing columns (source of truth for entitlements)
-- ---------------------------------------------------------------------------

ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS payment_provider text,
  ADD COLUMN IF NOT EXISTS payment_customer_id text,
  ADD COLUMN IF NOT EXISTS payment_subscription_id text,
  ADD COLUMN IF NOT EXISTS current_period_start timestamptz,
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz;

-- status already NOT NULL from prior migrations; ensure default remains sensible.
ALTER TABLE public.user_subscriptions
  ALTER COLUMN status SET NOT NULL;

COMMENT ON TABLE public.user_subscriptions IS
  'Per-user plan and billing lifecycle. Source of truth for plan tier and payment linkage; populated by signup and future provider webhooks (service role).';

COMMENT ON COLUMN public.user_subscriptions.payment_provider IS
  'Billing provider key (e.g. paystack, payfast). NULL until checkout completes. Writable only via service role / webhooks.';

COMMENT ON COLUMN public.user_subscriptions.payment_customer_id IS
  'Provider customer identifier. Writable only via service role / webhooks.';

COMMENT ON COLUMN public.user_subscriptions.payment_subscription_id IS
  'Provider subscription or authorization reference. Writable only via service role / webhooks.';

-- Existing triggers (payment field guard, admin plan guard) remain unchanged.

-- ---------------------------------------------------------------------------
-- 3) webhook_events — align idempotency schema (table may already exist)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Legacy column renames (20260516140000 used external_event_id / error_message).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'webhook_events'
      AND column_name = 'external_event_id'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'webhook_events'
      AND column_name = 'provider_event_id'
  ) THEN
    ALTER TABLE public.webhook_events
      RENAME COLUMN external_event_id TO provider_event_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'webhook_events'
      AND column_name = 'error_message'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'webhook_events'
      AND column_name = 'processing_error'
  ) THEN
    ALTER TABLE public.webhook_events
      RENAME COLUMN error_message TO processing_error;
  END IF;
END;
$$;

-- Add any columns missing on legacy installs (preserve extra legacy columns like user_id, updated_at).
ALTER TABLE public.webhook_events
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_event_id text,
  ADD COLUMN IF NOT EXISTS event_type text,
  ADD COLUMN IF NOT EXISTS payload jsonb,
  ADD COLUMN IF NOT EXISTS processed_at timestamptz,
  ADD COLUMN IF NOT EXISTS processing_error text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

UPDATE public.webhook_events
SET provider = coalesce(nullif(trim(provider), ''), 'stripe')
WHERE provider IS NULL;

UPDATE public.webhook_events
SET provider_event_id = id::text
WHERE provider_event_id IS NULL;

UPDATE public.webhook_events
SET event_type = 'unknown'
WHERE event_type IS NULL;

UPDATE public.webhook_events
SET payload = '{}'::jsonb
WHERE payload IS NULL;

ALTER TABLE public.webhook_events
  ALTER COLUMN provider SET NOT NULL,
  ALTER COLUMN provider_event_id SET NOT NULL,
  ALTER COLUMN event_type SET NOT NULL,
  ALTER COLUMN payload SET NOT NULL,
  ALTER COLUMN payload SET DEFAULT '{}'::jsonb;

ALTER TABLE public.webhook_events
  DROP CONSTRAINT IF EXISTS webhook_events_provider_external_event_unique;

ALTER TABLE public.webhook_events
  DROP CONSTRAINT IF EXISTS webhook_events_provider_event_unique;

ALTER TABLE public.webhook_events
  ADD CONSTRAINT webhook_events_provider_event_unique UNIQUE (provider, provider_event_id);

CREATE INDEX IF NOT EXISTS webhook_events_provider_idx ON public.webhook_events (provider);
CREATE INDEX IF NOT EXISTS webhook_events_created_at_idx ON public.webhook_events (created_at);
CREATE INDEX IF NOT EXISTS webhook_events_event_type_idx ON public.webhook_events (event_type);

COMMENT ON TABLE public.webhook_events IS
  'Idempotent webhook log for billing providers (Paystack, PayFast, legacy Stripe). Inserts/updates via service role only.';

COMMENT ON COLUMN public.webhook_events.provider_event_id IS
  'Provider-supplied event or delivery id used for deduplication.';

COMMENT ON COLUMN public.webhook_events.processing_error IS
  'Last processing failure message when processed_at is null or handler failed.';

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.webhook_events FROM anon, authenticated;

DROP POLICY IF EXISTS webhook_events_no_client_access ON public.webhook_events;

CREATE POLICY webhook_events_no_client_access ON public.webhook_events
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- 4) checkout_attempts — optional audit trail for hosted checkout (server-created)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.checkout_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  plan_code text NOT NULL REFERENCES public.subscription_plans (code) ON UPDATE CASCADE,
  billing_period text NOT NULL,
  provider text NOT NULL,
  provider_reference text,
  status text NOT NULL DEFAULT 'created',
  checkout_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT checkout_attempts_billing_period_chk CHECK (
    billing_period IN ('monthly', 'annual')
  ),
  CONSTRAINT checkout_attempts_status_chk CHECK (
    status IN ('created', 'redirected', 'completed', 'failed', 'cancelled', 'expired')
  ),
  CONSTRAINT checkout_attempts_provider_chk CHECK (
    provider IN ('paystack', 'payfast', 'stripe', 'mock')
  )
);

CREATE INDEX IF NOT EXISTS checkout_attempts_user_id_idx ON public.checkout_attempts (user_id);
CREATE INDEX IF NOT EXISTS checkout_attempts_status_idx ON public.checkout_attempts (status);
CREATE INDEX IF NOT EXISTS checkout_attempts_created_at_idx ON public.checkout_attempts (created_at DESC);
CREATE INDEX IF NOT EXISTS checkout_attempts_provider_reference_idx ON public.checkout_attempts (provider, provider_reference)
  WHERE provider_reference IS NOT NULL;

COMMENT ON TABLE public.checkout_attempts IS
  'Server-side checkout session audit. Created by billing API (service role); users may read their own rows.';

DROP TRIGGER IF EXISTS checkout_attempts_set_updated_at ON public.checkout_attempts;

CREATE TRIGGER checkout_attempts_set_updated_at
BEFORE UPDATE ON public.checkout_attempts
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.checkout_attempts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.checkout_attempts FROM anon;

GRANT SELECT ON TABLE public.checkout_attempts TO authenticated;

DROP POLICY IF EXISTS checkout_attempts_select_own ON public.checkout_attempts;

CREATE POLICY checkout_attempts_select_own ON public.checkout_attempts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS checkout_attempts_no_client_write ON public.checkout_attempts;

CREATE POLICY checkout_attempts_no_client_insert ON public.checkout_attempts
  FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY checkout_attempts_no_client_update ON public.checkout_attempts
  FOR UPDATE TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY checkout_attempts_no_client_delete ON public.checkout_attempts
  FOR DELETE TO authenticated
  USING (false);

-- Service role writes checkout rows and webhook events (bypasses RLS with table privileges).
GRANT ALL ON TABLE public.webhook_events TO service_role;
GRANT ALL ON TABLE public.checkout_attempts TO service_role;
