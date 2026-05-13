-- =============================================================================
-- Supabase database foundation — incremental layer (Phase 1b).
-- =============================================================================
-- Prerequisite: migrations 20260513140000_core_application_schema,
-- 20260515120000_auth_profiles_trigger_and_rls, and 20260515180000_row_level_security
-- should already be applied so base tables, triggers, and RLS exist.
--
-- This migration does NOT change Prisma schema or application code. Express +
-- Prisma remain authoritative until an explicit cutover; this SQL extends the
-- Supabase target schema only.
--
-- Base tables (profiles, properties, tenants, leases, income_entries,
-- expense_entries, invoices, invoice_line_items, calculator_results,
-- stored_reports, subscriptions, property_documents, recurring_income_rules,
-- recurring_invoice_rules, portfolio_projection_defaults) are created in
-- 20260513140000_core_application_schema.sql — re-run that migration on empty DBs.
--
-- This file adds:
--   * public.profiles.email (+ trigger sync from auth.users)
--   * public.webhook_events (jsonb payload; RLS on, no authenticated policies)
--   * public.stored_reports.metadata jsonb
--   * Dashboard / statement indexes on key date columns
--   * public.calculation_results VIEW → alias for public.calculator_results (read path;
--     writes stay on calculator_results until the app cutover renames the base table)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) profiles — email (denormalized from auth.users)
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text;

COMMENT ON COLUMN public.profiles.email IS
  'Denormalized copy of auth.users.email for API parity during migration. auth.users remains canonical for authentication.';

UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE u.id = p.id
  AND (p.email IS DISTINCT FROM u.email);

ALTER TABLE public.profiles
  ALTER COLUMN free_uses_remaining SET DEFAULT 0;

COMMENT ON COLUMN public.profiles.role IS
  'app_user_role enum (USER | ADMIN) — stricter than plain text; matches legacy Prisma UserRole.';

COMMENT ON COLUMN public.profiles.subscription_status IS
  'app_subscription_status enum (FREE | TRIAL | SUBSCRIBED) — matches legacy Prisma SubscriptionStatus.';

CREATE OR REPLACE FUNCTION public.handle_new_user ()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, free_uses_remaining, email)
  VALUES (new.id, 3, new.email)
  ON CONFLICT (id) DO UPDATE
    SET email = COALESCE(EXCLUDED.email, public.profiles.email),
        updated_at = now();
  RETURN new;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2) webhook_events — provider webhook log / idempotency (jsonb payload)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'stripe',
  external_event_id text,
  event_type text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT webhook_events_provider_external_event_unique UNIQUE (provider, external_event_id)
);

CREATE INDEX IF NOT EXISTS webhook_events_user_id_idx ON public.webhook_events (user_id);
CREATE INDEX IF NOT EXISTS webhook_events_created_at_idx ON public.webhook_events (created_at);
CREATE INDEX IF NOT EXISTS webhook_events_event_type_idx ON public.webhook_events (event_type);

COMMENT ON TABLE public.webhook_events IS
  'External webhook deliveries (e.g. Stripe). Inserts should run from trusted backend/service role. RLS enabled with no authenticated policies.';

DROP TRIGGER IF EXISTS webhook_events_set_updated_at ON public.webhook_events;

CREATE TRIGGER webhook_events_set_updated_at
BEFORE UPDATE ON public.webhook_events
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at ();

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 3) stored_reports — optional jsonb metadata
-- ---------------------------------------------------------------------------

ALTER TABLE public.stored_reports
  ADD COLUMN IF NOT EXISTS metadata jsonb;

COMMENT ON COLUMN public.stored_reports.metadata IS
  'Optional structured metadata (generator, paths, scenario). jsonb preserves arbitrary legacy shapes during cutover.';

-- ---------------------------------------------------------------------------
-- 4) Financial / lease date indexes (dashboards & statements)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS expense_entries_expense_date_idx ON public.expense_entries (expense_date);
CREATE INDEX IF NOT EXISTS expense_entries_user_expense_date_idx ON public.expense_entries (user_id, expense_date DESC);

CREATE INDEX IF NOT EXISTS income_entries_income_date_idx ON public.income_entries (income_date);
CREATE INDEX IF NOT EXISTS income_entries_user_income_date_idx ON public.income_entries (user_id, income_date DESC);

CREATE INDEX IF NOT EXISTS invoices_invoice_date_idx ON public.invoices (invoice_date);
CREATE INDEX IF NOT EXISTS invoices_due_date_idx ON public.invoices (due_date);
CREATE INDEX IF NOT EXISTS invoices_user_invoice_date_idx ON public.invoices (user_id, invoice_date DESC);

CREATE INDEX IF NOT EXISTS leases_start_date_idx ON public.leases (start_date);
CREATE INDEX IF NOT EXISTS leases_fixed_term_end_date_idx ON public.leases (fixed_term_end_date);

CREATE INDEX IF NOT EXISTS calculator_results_created_at_idx ON public.calculator_results (created_at);
CREATE INDEX IF NOT EXISTS stored_reports_created_at_idx ON public.stored_reports (created_at);

-- ---------------------------------------------------------------------------
-- 5) calculation_results — read compatibility VIEW over calculator_results
--     (keeps a single physical table for FKs + RLS until a dedicated rename migration)
-- ---------------------------------------------------------------------------

DROP VIEW IF EXISTS public.calculation_results;

CREATE VIEW public.calculation_results
WITH (security_invoker = on) AS
SELECT *
FROM public.calculator_results;

COMMENT ON VIEW public.calculation_results IS
  'Read alias for public.calculator_results. security_invoker=true applies caller RLS on the base table. INSERT/UPDATE/DELETE still use calculator_results until app migration.';

GRANT SELECT ON public.calculation_results TO authenticated;
