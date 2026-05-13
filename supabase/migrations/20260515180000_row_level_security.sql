-- =============================================================================
-- Phase 4: Row Level Security (RLS) — NOT applied until you run this in SQL Editor / CLI.
-- =============================================================================
-- Prerequisites: core schema + auth profile trigger migrations already applied.
-- Role: policies target `authenticated` (Supabase JWT). No anon access to private data.
-- Service role is never used by the frontend; it bypasses RLS for server-side jobs only.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0) Privileges: allow authenticated role to attempt DML; RLS then filters rows.
--    `portfolio_projection_defaults` is not user-owned; only admins may read/update
--    (see policies below). Others are strictly per auth.uid().
-- ---------------------------------------------------------------------------

GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.properties TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tenants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.leases TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.property_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.expense_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.income_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.recurring_income_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.invoices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.invoice_line_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.recurring_invoice_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.calculator_results TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.stored_reports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.subscriptions TO authenticated;

-- Singleton table: no broad user CRUD; admin-only via policies + UPDATE for admins.
GRANT SELECT, UPDATE ON TABLE public.portfolio_projection_defaults TO authenticated;

-- profiles: INSERT allowed for self-repair rows (id must equal auth.uid()); trigger still primary path.
GRANT INSERT ON TABLE public.profiles TO authenticated;

-- ---------------------------------------------------------------------------
-- 1) Enable RLS on all relevant tables
-- ---------------------------------------------------------------------------

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_projection_defaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_income_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_invoice_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calculator_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stored_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- profiles: already enabled in Phase 3; harmless if repeated.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 2) Drop existing policies we replace (idempotent re-run after edits)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;

DROP POLICY IF EXISTS properties_all_own ON public.properties;
DROP POLICY IF EXISTS portfolio_defaults_admin_select ON public.portfolio_projection_defaults;
DROP POLICY IF EXISTS portfolio_defaults_admin_update ON public.portfolio_projection_defaults;
DROP POLICY IF EXISTS tenants_all_own ON public.tenants;
DROP POLICY IF EXISTS leases_all_own ON public.leases;
DROP POLICY IF EXISTS property_documents_all_own ON public.property_documents;
DROP POLICY IF EXISTS expense_entries_all_own ON public.expense_entries;
DROP POLICY IF EXISTS income_entries_all_own ON public.income_entries;
DROP POLICY IF EXISTS recurring_income_rules_all_own ON public.recurring_income_rules;
DROP POLICY IF EXISTS invoices_all_own ON public.invoices;
DROP POLICY IF EXISTS invoice_line_items_all_own ON public.invoice_line_items;
DROP POLICY IF EXISTS recurring_invoice_rules_all_own ON public.recurring_invoice_rules;
DROP POLICY IF EXISTS calculator_results_all_own ON public.calculator_results;
DROP POLICY IF EXISTS stored_reports_all_own ON public.stored_reports;
DROP POLICY IF EXISTS subscriptions_all_own ON public.subscriptions;

-- ---------------------------------------------------------------------------
-- 3) profiles — PK id equals auth user; no public reads.
--     SELECT/UPDATE: own row only. INSERT: only self id (recovery if trigger missed).
-- ---------------------------------------------------------------------------

CREATE POLICY profiles_select_own ON public.profiles
FOR SELECT TO authenticated
USING (id = auth.uid());

CREATE POLICY profiles_update_own ON public.profiles
FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

CREATE POLICY profiles_insert_own ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (id = auth.uid());

-- ---------------------------------------------------------------------------
-- 4) properties — user_id must equal auth.uid() for all operations.
-- ---------------------------------------------------------------------------

CREATE POLICY properties_all_own ON public.properties
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 5) portfolio_projection_defaults — not user-scoped; ADMIN profile only.
-- ---------------------------------------------------------------------------

CREATE POLICY portfolio_defaults_admin_select ON public.portfolio_projection_defaults
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles pr
    WHERE pr.id = auth.uid()
      AND pr.role = 'ADMIN'::public.app_user_role
  )
);

CREATE POLICY portfolio_defaults_admin_update ON public.portfolio_projection_defaults
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles pr
    WHERE pr.id = auth.uid()
      AND pr.role = 'ADMIN'::public.app_user_role
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles pr
    WHERE pr.id = auth.uid()
      AND pr.role = 'ADMIN'::public.app_user_role
  )
);

-- ---------------------------------------------------------------------------
-- 6) tenants — own user_id; optional property_id must reference own property.
-- ---------------------------------------------------------------------------

CREATE POLICY tenants_all_own ON public.tenants
FOR ALL TO authenticated
USING (
  user_id = auth.uid()
  AND (
    property_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.properties p
      WHERE p.id = tenants.property_id
        AND p.user_id = auth.uid()
    )
  )
)
WITH CHECK (
  user_id = auth.uid()
  AND (
    property_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.properties p
      WHERE p.id = tenants.property_id
        AND p.user_id = auth.uid()
    )
  )
);

-- ---------------------------------------------------------------------------
-- 7) leases — own user_id; property and tenant must belong to same user.
-- ---------------------------------------------------------------------------

CREATE POLICY leases_all_own ON public.leases
FOR ALL TO authenticated
USING (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = leases.property_id
      AND p.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = leases.tenant_id
      AND t.user_id = auth.uid()
  )
)
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = leases.property_id
      AND p.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = leases.tenant_id
      AND t.user_id = auth.uid()
  )
);

-- ---------------------------------------------------------------------------
-- 8) property_documents — own user_id; property must be owned.
-- ---------------------------------------------------------------------------

CREATE POLICY property_documents_all_own ON public.property_documents
FOR ALL TO authenticated
USING (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = property_documents.property_id
      AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = property_documents.property_id
      AND p.user_id = auth.uid()
  )
);

-- ---------------------------------------------------------------------------
-- 9) expense_entries / income_entries — user_id + property ownership.
-- ---------------------------------------------------------------------------

CREATE POLICY expense_entries_all_own ON public.expense_entries
FOR ALL TO authenticated
USING (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = expense_entries.property_id
      AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = expense_entries.property_id
      AND p.user_id = auth.uid()
  )
);

CREATE POLICY income_entries_all_own ON public.income_entries
FOR ALL TO authenticated
USING (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = income_entries.property_id
      AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = income_entries.property_id
      AND p.user_id = auth.uid()
  )
);

-- ---------------------------------------------------------------------------
-- 10) recurring_income_rules — user_id + lease owned by same user.
-- ---------------------------------------------------------------------------

CREATE POLICY recurring_income_rules_all_own ON public.recurring_income_rules
FOR ALL TO authenticated
USING (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.leases l
    WHERE l.id = recurring_income_rules.lease_id
      AND l.user_id = auth.uid()
  )
)
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.leases l
    WHERE l.id = recurring_income_rules.lease_id
      AND l.user_id = auth.uid()
  )
);

-- ---------------------------------------------------------------------------
-- 11) invoices — user_id; optional lease must belong to caller.
-- ---------------------------------------------------------------------------

CREATE POLICY invoices_all_own ON public.invoices
FOR ALL TO authenticated
USING (
  user_id = auth.uid()
  AND (
    lease_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.leases l
      WHERE l.id = invoices.lease_id
        AND l.user_id = auth.uid()
    )
  )
)
WITH CHECK (
  user_id = auth.uid()
  AND (
    lease_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.leases l
      WHERE l.id = invoices.lease_id
        AND l.user_id = auth.uid()
    )
  )
);

-- ---------------------------------------------------------------------------
-- 12) invoice_line_items — no user_id; inherit access via parent invoice.
-- ---------------------------------------------------------------------------

CREATE POLICY invoice_line_items_all_own ON public.invoice_line_items
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.invoices i
    WHERE i.id = invoice_line_items.invoice_id
      AND i.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.invoices i
    WHERE i.id = invoice_line_items.invoice_id
      AND i.user_id = auth.uid()
  )
);

-- ---------------------------------------------------------------------------
-- 13) recurring_invoice_rules — user_id + optional lease ownership.
-- ---------------------------------------------------------------------------

CREATE POLICY recurring_invoice_rules_all_own ON public.recurring_invoice_rules
FOR ALL TO authenticated
USING (
  user_id = auth.uid()
  AND (
    lease_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.leases l
      WHERE l.id = recurring_invoice_rules.lease_id
        AND l.user_id = auth.uid()
    )
  )
)
WITH CHECK (
  user_id = auth.uid()
  AND (
    lease_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.leases l
      WHERE l.id = recurring_invoice_rules.lease_id
        AND l.user_id = auth.uid()
    )
  )
);

-- ---------------------------------------------------------------------------
-- 14) calculator_results / subscriptions — user_id = auth.uid().
-- ---------------------------------------------------------------------------

CREATE POLICY calculator_results_all_own ON public.calculator_results
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY subscriptions_all_own ON public.subscriptions
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 15) stored_reports — user_id + optional FKs must reference rows caller owns.
-- ---------------------------------------------------------------------------

CREATE POLICY stored_reports_all_own ON public.stored_reports
FOR ALL TO authenticated
USING (
  user_id = auth.uid()
  AND (
    property_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.properties p
      WHERE p.id = stored_reports.property_id
        AND p.user_id = auth.uid()
    )
  )
  AND (
    calculation_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.calculator_results c
      WHERE c.id = stored_reports.calculation_id
        AND c.user_id = auth.uid()
    )
  )
  AND (
    invoice_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.invoices i
      WHERE i.id = stored_reports.invoice_id
        AND i.user_id = auth.uid()
    )
  )
)
WITH CHECK (
  user_id = auth.uid()
  AND (
    property_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.properties p
      WHERE p.id = stored_reports.property_id
        AND p.user_id = auth.uid()
    )
  )
  AND (
    calculation_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.calculator_results c
      WHERE c.id = stored_reports.calculation_id
        AND c.user_id = auth.uid()
    )
  )
  AND (
    invoice_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.invoices i
      WHERE i.id = stored_reports.invoice_id
        AND i.user_id = auth.uid()
    )
  )
);
