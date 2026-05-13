-- =============================================================================
-- Phase 2: core application schema (Supabase Postgres / public).
-- Maps legacy Prisma models to UUID PKs and auth.users via public.profiles.
-- =============================================================================
-- Apply via Supabase SQL Editor or `supabase db push` / migration pipeline.
-- After apply: enable RLS + policies (Phase 4); backfill profiles from auth.users.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ENUM types (match Prisma enums; names prefixed with app_ where ambiguous)
-- ---------------------------------------------------------------------------

CREATE TYPE app_user_role AS ENUM ('USER', 'ADMIN');

CREATE TYPE app_subscription_status AS ENUM ('FREE', 'TRIAL', 'SUBSCRIBED');

CREATE TYPE app_property_type AS ENUM (
  'HOUSE', 'APARTMENT', 'TOWNHOUSE', 'DUPLEX', 'ROOM', 'COMMERCIAL', 'OTHER'
);

CREATE TYPE app_investment_property_type AS ENUM (
  'LONG_TERM_RENTAL', 'SHORT_TERM_RENTAL', 'PRIMARY_RESIDENCE', 'HOUSE_HACK',
  'BRRRR', 'FLIP', 'VACANT_LAND', 'COMMERCIAL', 'MIXED_USE', 'OTHER'
);

CREATE TYPE app_flip_project_stage AS ENUM (
  'ACQUISITION', 'RENOVATION', 'FOR_SALE', 'SOLD'
);

CREATE TYPE app_brrrr_stage AS ENUM (
  'ACQUISITION', 'RENOVATION', 'RENTED', 'REFINANCED'
);

CREATE TYPE app_land_use AS ENUM (
  'RESIDENTIAL', 'AGRICULTURAL', 'COMMERCIAL', 'INDUSTRIAL', 'OTHER'
);

CREATE TYPE app_tenant_status AS ENUM (
  'ACTIVE', 'PAST', 'APPLICANT'
);

CREATE TYPE app_lease_status AS ENUM (
  'ACTIVE', 'MONTH_TO_MONTH', 'CANCELLED', 'EXPIRED', 'TERMINATED', 'DRAFT', 'ARCHIVED'
);

CREATE TYPE app_lease_type AS ENUM ('FIXED_TERM', 'MONTH_TO_MONTH');

CREATE TYPE app_lease_cancelled_by AS ENUM ('LANDLORD', 'TENANT', 'MUTUAL');

CREATE TYPE app_property_document_type AS ENUM (
  'LEASE_AGREEMENT', 'ID_DOCUMENT', 'PROOF_OF_PAYMENT', 'MUNICIPAL_ACCOUNT',
  'INSURANCE', 'INSPECTION', 'OTHER'
);

CREATE TYPE app_property_expense_category AS ENUM (
  'RATES_TAXES', 'WATER', 'ELECTRICITY', 'LEVIES', 'INSURANCE', 'MAINTENANCE',
  'REPAIRS', 'MANAGEMENT_FEES', 'BOND_PAYMENT', 'ACCOUNTING', 'OTHER'
);

CREATE TYPE app_recurring_frequency AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUALLY');

CREATE TYPE app_recurring_expense_month_anchor AS ENUM (
  'FIRST_OF_MONTH', 'LAST_OF_MONTH', 'DAY_OF_MONTH'
);

CREATE TYPE app_property_expense_source AS ENUM (
  'PROPERTY_SETUP', 'MANUAL_FINANCIAL_ENTRY', 'INVOICE', 'IMPORT', 'SYSTEM', 'HISTORICAL_BACKFILL'
);

CREATE TYPE app_property_expense_status AS ENUM ('ACTIVE', 'CANCELLED', 'ARCHIVED');

CREATE TYPE app_property_income_category AS ENUM (
  'RENT', 'DEPOSIT', 'LATE_FEE', 'UTILITIES_RECOVERY', 'OTHER'
);

CREATE TYPE app_property_income_source AS ENUM (
  'LEASE_EXPECTED', 'MANUAL_FINANCIAL_ENTRY', 'INVOICE', 'IMPORT', 'SYSTEM', 'HISTORICAL_BACKFILL'
);

CREATE TYPE app_property_income_status AS ENUM (
  'EXPECTED', 'RECEIVED', 'CANCELLED', 'ARCHIVED'
);

CREATE TYPE app_invoice_status AS ENUM (
  'DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED'
);

CREATE TYPE app_recurring_income_rule_status AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED');

-- ---------------------------------------------------------------------------
-- Profiles: one row per auth user — app fields only (no password, no email)
-- ---------------------------------------------------------------------------

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  full_name text,
  role app_user_role NOT NULL DEFAULT 'USER',
  subscription_status app_subscription_status NOT NULL DEFAULT 'FREE',
  free_uses_remaining integer,
  subscription_start timestamptz,
  subscription_end timestamptz,
  invoice_payment_details jsonb,
  ui_color_scheme text NOT NULL DEFAULT 'dark',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_ui_color_scheme_check CHECK (ui_color_scheme IN ('dark', 'light'))
);

CREATE INDEX profiles_role_idx ON public.profiles (role);

COMMENT ON TABLE public.profiles IS
  'Application profile linked 1:1 to auth.users. Email lives in auth.users only.';

-- ---------------------------------------------------------------------------
-- Singleton: portfolio-wide IRR projection growth (admin-editable)
-- ---------------------------------------------------------------------------

CREATE TABLE public.portfolio_projection_defaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  rental_income_growth_percent_annual double precision NOT NULL DEFAULT 6,
  total_expenses_growth_percent_annual double precision NOT NULL DEFAULT 6,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.portfolio_projection_defaults IS
  'Single logical row (enforce in app or with a fixed id); replaces Prisma PortfolioProjectionDefaults id=1.';

-- ---------------------------------------------------------------------------
-- Properties
-- ---------------------------------------------------------------------------

CREATE TABLE public.properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  name text NOT NULL,
  property_type app_property_type NOT NULL,
  investment_type app_investment_property_type NOT NULL DEFAULT 'LONG_TERM_RENTAL',
  address_line1 text NOT NULL,
  address_line2 text,
  suburb text,
  city text NOT NULL,
  province text NOT NULL,
  postal_code text,
  country text NOT NULL DEFAULT 'South Africa',
  erf_number text,
  size_sqm double precision,
  bedrooms integer,
  bathrooms integer,
  parking_bays integer,
  purchase_price double precision NOT NULL,
  purchase_date timestamptz,
  current_estimated_value double precision,
  outstanding_bond_balance double precision,
  monthly_bond_payment double precision,
  bond_annual_interest_rate_percent double precision,
  bond_term_years integer,
  bond_start_date date,
  bond_remaining_term_months integer,
  bond_interest_portion_override double precision,
  bond_principal_portion_override double precision,
  total_cash_invested double precision,
  bond_costs double precision,
  transfer_costs double precision,
  holding_period_years integer,
  estimated_selling_cost_percent double precision,
  expected_monthly_income double precision,
  expected_monthly_expenses double precision,
  status text,
  notes text,
  land_use app_land_use,
  zoning text,
  rates_and_taxes_monthly double precision,
  levies_monthly double precision,
  security_monthly double precision,
  maintenance_monthly double precision,
  expected_annual_appreciation_percent double precision,
  average_daily_rate double precision,
  occupancy_rate double precision,
  available_nights_per_month integer,
  platform_fee_percent double precision,
  cleaning_fees_monthly double precision,
  management_fee_percent double precision,
  furnishing_value double precision,
  monthly_utilities double precision,
  rehab_budget double precision,
  holding_costs_monthly double precision,
  expected_sale_price double precision,
  target_sale_date timestamptz,
  project_stage app_flip_project_stage,
  after_repair_value double precision,
  refinance_amount double precision,
  brrrr_stage app_brrrr_stage,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX properties_user_id_idx ON public.properties (user_id);

-- ---------------------------------------------------------------------------
-- Tenants
-- ---------------------------------------------------------------------------

CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.properties (id) ON DELETE SET NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text,
  id_number text,
  emergency_contact_name text,
  emergency_contact_phone text,
  status app_tenant_status NOT NULL DEFAULT 'APPLICANT',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX tenants_user_id_idx ON public.tenants (user_id);
CREATE INDEX tenants_property_id_idx ON public.tenants (property_id);

-- ---------------------------------------------------------------------------
-- Leases (lease_document_id FK added after property_documents exists)
-- ---------------------------------------------------------------------------

CREATE TABLE public.leases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  start_date timestamptz NOT NULL,
  fixed_term_end_date timestamptz,
  lease_type app_lease_type NOT NULL DEFAULT 'FIXED_TERM',
  monthly_rent double precision NOT NULL,
  deposit_amount double precision NOT NULL,
  deposit_annual_growth_percent double precision,
  deposit_growth_last_applied_month text,
  rent_due_day integer NOT NULL DEFAULT 1,
  escalation_percent double precision,
  escalation_date timestamptz,
  status app_lease_status NOT NULL DEFAULT 'DRAFT',
  cancellation_date timestamptz,
  cancellation_reason text,
  cancelled_by app_lease_cancelled_by,
  lease_document_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT leases_lease_document_id_unique UNIQUE (lease_document_id)
);

CREATE INDEX leases_user_id_idx ON public.leases (user_id);
CREATE INDEX leases_property_id_idx ON public.leases (property_id);
CREATE INDEX leases_tenant_id_idx ON public.leases (tenant_id);

-- ---------------------------------------------------------------------------
-- Property documents (file_path = Storage object key or legacy basename)
-- ---------------------------------------------------------------------------

CREATE TABLE public.property_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  lease_id uuid REFERENCES public.leases (id) ON DELETE SET NULL,
  document_type app_property_document_type NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  mime_type text NOT NULL,
  file_size integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX property_documents_user_id_idx ON public.property_documents (user_id);
CREATE INDEX property_documents_property_id_idx ON public.property_documents (property_id);

ALTER TABLE public.leases
  ADD CONSTRAINT leases_lease_document_id_fkey
  FOREIGN KEY (lease_document_id) REFERENCES public.property_documents (id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Expense entries (Prisma PropertyExpense)
-- ---------------------------------------------------------------------------

CREATE TABLE public.expense_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  category app_property_expense_category NOT NULL,
  description text NOT NULL,
  amount double precision NOT NULL,
  bond_interest_amount double precision,
  bond_principal_amount double precision,
  expense_date timestamptz NOT NULL,
  is_recurring boolean NOT NULL DEFAULT false,
  recurring_frequency app_recurring_frequency,
  recurring_schedule_parent_id uuid,
  recurring_start_date date,
  recurring_end_date date,
  recurring_open_ended boolean NOT NULL DEFAULT false,
  recurring_month_anchor app_recurring_expense_month_anchor,
  recurring_day_of_month integer,
  source app_property_expense_source NOT NULL DEFAULT 'MANUAL_FINANCIAL_ENTRY',
  status app_property_expense_status NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT expense_entries_recurring_schedule_parent_id_fkey
    FOREIGN KEY (recurring_schedule_parent_id) REFERENCES public.expense_entries (id) ON DELETE CASCADE
);

CREATE INDEX expense_entries_user_id_idx ON public.expense_entries (user_id);
CREATE INDEX expense_entries_property_id_idx ON public.expense_entries (property_id);
CREATE INDEX expense_entries_status_idx ON public.expense_entries (status);
CREATE INDEX expense_entries_recurring_parent_idx ON public.expense_entries (recurring_schedule_parent_id);

-- ---------------------------------------------------------------------------
-- Income entries (Prisma PropertyIncome)
-- ---------------------------------------------------------------------------

CREATE TABLE public.income_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants (id) ON DELETE SET NULL,
  lease_id uuid REFERENCES public.leases (id) ON DELETE SET NULL,
  category app_property_income_category NOT NULL,
  description text NOT NULL,
  amount double precision NOT NULL,
  income_date timestamptz NOT NULL,
  source app_property_income_source NOT NULL DEFAULT 'MANUAL_FINANCIAL_ENTRY',
  status app_property_income_status NOT NULL DEFAULT 'RECEIVED',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX income_entries_user_id_idx ON public.income_entries (user_id);
CREATE INDEX income_entries_property_id_idx ON public.income_entries (property_id);
CREATE INDEX income_entries_tenant_id_idx ON public.income_entries (tenant_id);
CREATE INDEX income_entries_lease_id_idx ON public.income_entries (lease_id);
CREATE INDEX income_entries_status_idx ON public.income_entries (status);

-- ---------------------------------------------------------------------------
-- Recurring income rules (one row per lease — unique lease_id)
-- ---------------------------------------------------------------------------

CREATE TABLE public.recurring_income_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  lease_id uuid NOT NULL REFERENCES public.leases (id) ON DELETE CASCADE,
  category app_property_income_category NOT NULL DEFAULT 'RENT',
  amount double precision NOT NULL,
  frequency app_recurring_frequency NOT NULL DEFAULT 'MONTHLY',
  day_of_month integer NOT NULL DEFAULT 1,
  start_date timestamptz NOT NULL,
  end_date timestamptz,
  status app_recurring_income_rule_status NOT NULL DEFAULT 'ACTIVE',
  auto_create_expected_entries boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recurring_income_rules_lease_id_key UNIQUE (lease_id)
);

CREATE INDEX recurring_income_rules_user_id_idx ON public.recurring_income_rules (user_id);
CREATE INDEX recurring_income_rules_property_id_idx ON public.recurring_income_rules (property_id);
CREATE INDEX recurring_income_rules_tenant_id_idx ON public.recurring_income_rules (tenant_id);
CREATE INDEX recurring_income_rules_status_idx ON public.recurring_income_rules (status);

-- ---------------------------------------------------------------------------
-- Invoices + line items
-- ---------------------------------------------------------------------------

CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  lease_id uuid REFERENCES public.leases (id) ON DELETE SET NULL,
  invoice_number text NOT NULL,
  invoice_date timestamptz NOT NULL,
  due_date timestamptz NOT NULL,
  status app_invoice_status NOT NULL DEFAULT 'DRAFT',
  subtotal double precision NOT NULL,
  total double precision NOT NULL,
  notes text,
  pdf_path text,
  sent_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoices_invoice_number_key UNIQUE (invoice_number)
);

CREATE INDEX invoices_user_id_idx ON public.invoices (user_id);
CREATE INDEX invoices_property_id_idx ON public.invoices (property_id);

CREATE TABLE public.invoice_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  invoice_id uuid NOT NULL REFERENCES public.invoices (id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity double precision NOT NULL,
  unit_price double precision NOT NULL,
  total double precision NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX invoice_line_items_invoice_id_idx ON public.invoice_line_items (invoice_id);

-- ---------------------------------------------------------------------------
-- Recurring invoice rules
-- ---------------------------------------------------------------------------

CREATE TABLE public.recurring_invoice_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  lease_id uuid REFERENCES public.leases (id) ON DELETE SET NULL,
  enabled boolean NOT NULL DEFAULT false,
  frequency app_recurring_frequency NOT NULL DEFAULT 'MONTHLY',
  day_of_month integer NOT NULL DEFAULT 1,
  next_run_date timestamptz NOT NULL,
  invoice_description text NOT NULL DEFAULT 'Monthly Rent',
  rent_amount double precision NOT NULL,
  include_utilities boolean NOT NULL DEFAULT false,
  email_tenant boolean NOT NULL DEFAULT false,
  tenant_permission_confirmed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX recurring_invoice_rules_user_id_idx ON public.recurring_invoice_rules (user_id);
CREATE INDEX recurring_invoice_rules_property_id_idx ON public.recurring_invoice_rules (property_id);

-- ---------------------------------------------------------------------------
-- Calculator results (Prisma Calculation) + stored_reports (Prisma StoredReport)
-- ---------------------------------------------------------------------------

CREATE TABLE public.calculator_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  type text NOT NULL,
  input_json jsonb NOT NULL,
  result_json jsonb NOT NULL,
  pdf_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX calculator_results_user_id_idx ON public.calculator_results (user_id);
CREATE INDEX calculator_results_type_idx ON public.calculator_results (type);

COMMENT ON COLUMN public.calculator_results.input_json IS 'Legacy: was text JSON string in Prisma; jsonb preferred.';
COMMENT ON COLUMN public.calculator_results.result_json IS 'Legacy: was text JSON string in Prisma; jsonb preferred.';

CREATE TABLE public.stored_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  report_type text NOT NULL,
  file_name text NOT NULL,
  calculation_id uuid REFERENCES public.calculator_results (id) ON DELETE SET NULL,
  property_id uuid REFERENCES public.properties (id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES public.invoices (id) ON DELETE SET NULL,
  scenario_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX stored_reports_user_id_idx ON public.stored_reports (user_id);
CREATE INDEX stored_reports_calculation_id_idx ON public.stored_reports (calculation_id);

-- ---------------------------------------------------------------------------
-- Subscriptions (billing provider rows; Prisma Subscription + Stripe metadata)
-- ---------------------------------------------------------------------------

CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  start_date timestamptz NOT NULL,
  end_date timestamptz,
  status text NOT NULL,
  payment_provider_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX subscriptions_user_id_idx ON public.subscriptions (user_id);

COMMENT ON TABLE public.subscriptions IS
  'Provider subscription periods (e.g. Stripe). Denormalized subscription_status on profiles remains for fast UI gating until fully derived from provider.';

-- ---------------------------------------------------------------------------
-- updated_at maintenance (Postgres trigger)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at ()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at ();

CREATE TRIGGER portfolio_projection_defaults_set_updated_at
BEFORE UPDATE ON public.portfolio_projection_defaults
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at ();

CREATE TRIGGER properties_set_updated_at
BEFORE UPDATE ON public.properties
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at ();

CREATE TRIGGER tenants_set_updated_at
BEFORE UPDATE ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at ();

CREATE TRIGGER leases_set_updated_at
BEFORE UPDATE ON public.leases
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at ();

CREATE TRIGGER property_documents_set_updated_at
BEFORE UPDATE ON public.property_documents
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at ();

CREATE TRIGGER expense_entries_set_updated_at
BEFORE UPDATE ON public.expense_entries
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at ();

CREATE TRIGGER income_entries_set_updated_at
BEFORE UPDATE ON public.income_entries
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at ();

CREATE TRIGGER recurring_income_rules_set_updated_at
BEFORE UPDATE ON public.recurring_income_rules
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at ();

CREATE TRIGGER invoices_set_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at ();

CREATE TRIGGER invoice_line_items_set_updated_at
BEFORE UPDATE ON public.invoice_line_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at ();

CREATE TRIGGER recurring_invoice_rules_set_updated_at
BEFORE UPDATE ON public.recurring_invoice_rules
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at ();

CREATE TRIGGER calculator_results_set_updated_at
BEFORE UPDATE ON public.calculator_results
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at ();

CREATE TRIGGER stored_reports_set_updated_at
BEFORE UPDATE ON public.stored_reports
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at ();

CREATE TRIGGER subscriptions_set_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at ();

-- ---------------------------------------------------------------------------
-- Seed data (optional baseline; safe to run once on empty DB)
-- ---------------------------------------------------------------------------

INSERT INTO public.portfolio_projection_defaults (
  rental_income_growth_percent_annual,
  total_expenses_growth_percent_annual
)
SELECT 6, 6
WHERE NOT EXISTS (SELECT 1 FROM public.portfolio_projection_defaults);

-- Phase 3 follow-up: create `public.profiles` rows when `auth.users` is inserted
-- (Supabase dashboard SQL or a separate migration with `SECURITY DEFINER` trigger).

