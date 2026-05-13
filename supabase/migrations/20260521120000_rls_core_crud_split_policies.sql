-- =============================================================================
-- RLS v2: core user-owned CRUD — explicit per-command policies + grants
-- =============================================================================
-- Replaces Phase-4 "FOR ALL" policies with SELECT / INSERT / UPDATE / (optional)
-- DELETE so each rule can be documented and tuned independently.
--
-- Prerequisite: 20260513140000_core_application_schema, 20260515180000_row_level_security,
-- 20260516140000_foundation_webhooks_profiles_email, 20260520120000_auth_profile_provisioning.
--
-- Express + Prisma remain authoritative until queries migrate; this migration only
-- adjusts Postgres RLS for future Supabase client usage.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0) Optional soft-delete columns (nullable; app may adopt later)
-- ---------------------------------------------------------------------------

ALTER TABLE public.income_entries
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE public.expense_entries
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

COMMENT ON COLUMN public.income_entries.archived_at IS
  'Soft-delete / archive timestamp; prefer status + archived_at over hard DELETE for authenticated clients.';

COMMENT ON COLUMN public.expense_entries.archived_at IS
  'Soft-delete / archive timestamp; prefer status + archived_at over hard DELETE for authenticated clients.';

COMMENT ON COLUMN public.invoices.archived_at IS
  'Soft-delete / archive timestamp; use alongside status for billing records.';

-- ---------------------------------------------------------------------------
-- 1) Drop legacy single-policy names (Phase 4)
-- ---------------------------------------------------------------------------

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
-- 2) portfolio_projection_defaults — all authenticated may READ (IRR / projections);
--     only ADMIN profiles may UPDATE (matches product need for shared defaults row).
-- ---------------------------------------------------------------------------

CREATE POLICY portfolio_defaults_select_authenticated ON public.portfolio_projection_defaults
FOR SELECT
TO authenticated
USING (true);

COMMENT ON POLICY portfolio_defaults_select_authenticated ON public.portfolio_projection_defaults IS
  'Singleton projection assumptions are readable by any signed-in user for portfolio metrics; row is not user-specific.';

CREATE POLICY portfolio_defaults_update_admin ON public.portfolio_projection_defaults
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles pr
    WHERE pr.id = auth.uid ()
      AND pr.role = 'ADMIN'::public.app_user_role
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles pr
    WHERE pr.id = auth.uid ()
      AND pr.role = 'ADMIN'::public.app_user_role
  )
);

COMMENT ON POLICY portfolio_defaults_update_admin ON public.portfolio_projection_defaults IS
  'Only profiles.role = ADMIN may change global projection growth rates.';

-- ---------------------------------------------------------------------------
-- 3) subscriptions — SELECT own rows only; billing writes via service_role / Edge.
-- ---------------------------------------------------------------------------

REVOKE INSERT, UPDATE, DELETE ON TABLE public.subscriptions FROM authenticated;

GRANT SELECT ON TABLE public.subscriptions TO authenticated;

CREATE POLICY subscriptions_select_own ON public.subscriptions
FOR SELECT
TO authenticated
USING (user_id = auth.uid ());

COMMENT ON POLICY subscriptions_select_own ON public.subscriptions IS
  'Users read their own subscription rows; INSERT/UPDATE/DELETE revoked for authenticated (Stripe webhooks + service role).';

-- ---------------------------------------------------------------------------
-- 4) properties — full CRUD own rows
-- ---------------------------------------------------------------------------

CREATE POLICY properties_select_own ON public.properties
FOR SELECT
TO authenticated
USING (user_id = auth.uid ());

CREATE POLICY properties_insert_own ON public.properties
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid ());

CREATE POLICY properties_update_own ON public.properties
FOR UPDATE
TO authenticated
USING (user_id = auth.uid ())
WITH CHECK (user_id = auth.uid ());

CREATE POLICY properties_delete_own ON public.properties
FOR DELETE
TO authenticated
USING (user_id = auth.uid ());

COMMENT ON POLICY properties_select_own ON public.properties IS 'List/detail only for properties owned by auth.uid().';
COMMENT ON POLICY properties_insert_own ON public.properties IS 'Insert rows only when user_id matches auth.uid().';
COMMENT ON POLICY properties_update_own ON public.properties IS 'Update only own properties; user_id cannot change away from auth.uid().';
COMMENT ON POLICY properties_delete_own ON public.properties IS 'Hard delete own property rows (cascade removes children per FK).';

-- ---------------------------------------------------------------------------
-- 5) tenants — property_id must reference own property when set
-- ---------------------------------------------------------------------------

CREATE POLICY tenants_select_own ON public.tenants
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid ()
  AND (
    property_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.properties p
      WHERE p.id = tenants.property_id
        AND p.user_id = auth.uid ()
    )
  )
);

CREATE POLICY tenants_insert_own ON public.tenants
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid ()
  AND (
    property_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.properties p
      WHERE p.id = property_id
        AND p.user_id = auth.uid ()
    )
  )
);

CREATE POLICY tenants_update_own ON public.tenants
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid ()
  AND (
    property_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.properties p
      WHERE p.id = tenants.property_id
        AND p.user_id = auth.uid ()
    )
  )
)
WITH CHECK (
  user_id = auth.uid ()
  AND (
    property_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.properties p
      WHERE p.id = property_id
        AND p.user_id = auth.uid ()
    )
  )
);

CREATE POLICY tenants_delete_own ON public.tenants
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid ()
  AND (
    property_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.properties p
      WHERE p.id = tenants.property_id
        AND p.user_id = auth.uid ()
    )
  )
);

COMMENT ON POLICY tenants_insert_own ON public.tenants IS 'Insert tenant only for self; optional property_id must belong to auth.uid().';

-- ---------------------------------------------------------------------------
-- 6) leases — property + tenant must belong to caller
-- ---------------------------------------------------------------------------

CREATE POLICY leases_select_own ON public.leases
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid ()
  AND EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = leases.property_id
      AND p.user_id = auth.uid ()
  )
  AND EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = leases.tenant_id
      AND t.user_id = auth.uid ()
  )
);

CREATE POLICY leases_insert_own ON public.leases
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid ()
  AND EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = property_id
      AND p.user_id = auth.uid ()
  )
  AND EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = tenant_id
      AND t.user_id = auth.uid ()
  )
);

CREATE POLICY leases_update_own ON public.leases
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid ()
  AND EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = leases.property_id
      AND p.user_id = auth.uid ()
  )
  AND EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = leases.tenant_id
      AND t.user_id = auth.uid ()
  )
)
WITH CHECK (
  user_id = auth.uid ()
  AND EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = property_id
      AND p.user_id = auth.uid ()
  )
  AND EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = tenant_id
      AND t.user_id = auth.uid ()
  )
);

CREATE POLICY leases_delete_own ON public.leases
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid ()
  AND EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = leases.property_id
      AND p.user_id = auth.uid ()
  )
  AND EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = leases.tenant_id
      AND t.user_id = auth.uid ()
  )
);

COMMENT ON POLICY leases_insert_own ON public.leases IS 'Lease rows require owned property_id and tenant_id for auth.uid().';

-- ---------------------------------------------------------------------------
-- 7) property_documents — child of property
-- ---------------------------------------------------------------------------

CREATE POLICY property_documents_select_own ON public.property_documents
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid ()
  AND EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = property_documents.property_id
      AND p.user_id = auth.uid ()
  )
);

CREATE POLICY property_documents_insert_own ON public.property_documents
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid ()
  AND EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = property_id
      AND p.user_id = auth.uid ()
  )
);

CREATE POLICY property_documents_update_own ON public.property_documents
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid ()
  AND EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = property_documents.property_id
      AND p.user_id = auth.uid ()
  )
)
WITH CHECK (
  user_id = auth.uid ()
  AND EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = property_id
      AND p.user_id = auth.uid ()
  )
);

CREATE POLICY property_documents_delete_own ON public.property_documents
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid ()
  AND EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = property_documents.property_id
      AND p.user_id = auth.uid ()
  )
);

COMMENT ON POLICY property_documents_insert_own ON public.property_documents IS 'Document rows must reference a property owned by auth.uid().';

-- ---------------------------------------------------------------------------
-- 8) expense_entries — no authenticated DELETE (use status / archived_at)
-- ---------------------------------------------------------------------------

REVOKE DELETE ON TABLE public.expense_entries FROM authenticated;

CREATE POLICY expense_entries_select_own ON public.expense_entries
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid ()
  AND EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = expense_entries.property_id
      AND p.user_id = auth.uid ()
  )
);

CREATE POLICY expense_entries_insert_own ON public.expense_entries
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid ()
  AND EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = property_id
      AND p.user_id = auth.uid ()
  )
);

CREATE POLICY expense_entries_update_own ON public.expense_entries
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid ()
  AND EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = expense_entries.property_id
      AND p.user_id = auth.uid ()
  )
)
WITH CHECK (
  user_id = auth.uid ()
  AND EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = property_id
      AND p.user_id = auth.uid ()
  )
);

COMMENT ON POLICY expense_entries_update_own ON public.expense_entries IS
  'Update ledger rows for own property; hard DELETE revoked — archive via status / archived_at.';

-- ---------------------------------------------------------------------------
-- 9) income_entries — optional lease_id / tenant_id must reference caller-owned rows
-- ---------------------------------------------------------------------------

REVOKE DELETE ON TABLE public.income_entries FROM authenticated;

CREATE POLICY income_entries_select_own ON public.income_entries
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid ()
  AND EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = income_entries.property_id
      AND p.user_id = auth.uid ()
  )
  AND (
    lease_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.leases l
      WHERE l.id = income_entries.lease_id
        AND l.user_id = auth.uid ()
    )
  )
  AND (
    tenant_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.tenants t
      WHERE t.id = income_entries.tenant_id
        AND t.user_id = auth.uid ()
    )
  )
);

CREATE POLICY income_entries_insert_own ON public.income_entries
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid ()
  AND EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = property_id
      AND p.user_id = auth.uid ()
  )
  AND (
    lease_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.leases l
      WHERE l.id = lease_id
        AND l.user_id = auth.uid ()
    )
  )
  AND (
    tenant_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.tenants t
      WHERE t.id = tenant_id
        AND t.user_id = auth.uid ()
    )
  )
);

CREATE POLICY income_entries_update_own ON public.income_entries
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid ()
  AND EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = income_entries.property_id
      AND p.user_id = auth.uid ()
  )
  AND (
    lease_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.leases l
      WHERE l.id = income_entries.lease_id
        AND l.user_id = auth.uid ()
    )
  )
  AND (
    tenant_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.tenants t
      WHERE t.id = income_entries.tenant_id
        AND t.user_id = auth.uid ()
    )
  )
)
WITH CHECK (
  user_id = auth.uid ()
  AND EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = property_id
      AND p.user_id = auth.uid ()
  )
  AND (
    lease_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.leases l
      WHERE l.id = lease_id
        AND l.user_id = auth.uid ()
    )
  )
  AND (
    tenant_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.tenants t
      WHERE t.id = tenant_id
        AND t.user_id = auth.uid ()
    )
  )
);

COMMENT ON POLICY income_entries_insert_own ON public.income_entries IS
  'Income rows require owned property; optional lease_id / tenant_id must belong to auth.uid().';

-- ---------------------------------------------------------------------------
-- 10) recurring_income_rules — property, tenant, and lease must belong to caller
-- ---------------------------------------------------------------------------

CREATE POLICY recurring_income_rules_select_own ON public.recurring_income_rules
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid ()
  AND EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = recurring_income_rules.property_id
      AND p.user_id = auth.uid ()
  )
  AND EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = recurring_income_rules.tenant_id
      AND t.user_id = auth.uid ()
  )
  AND EXISTS (
    SELECT 1
    FROM public.leases l
    WHERE l.id = recurring_income_rules.lease_id
      AND l.user_id = auth.uid ()
  )
);

CREATE POLICY recurring_income_rules_insert_own ON public.recurring_income_rules
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid ()
  AND EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = property_id
      AND p.user_id = auth.uid ()
  )
  AND EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = tenant_id
      AND t.user_id = auth.uid ()
  )
  AND EXISTS (
    SELECT 1
    FROM public.leases l
    WHERE l.id = lease_id
      AND l.user_id = auth.uid ()
  )
);

CREATE POLICY recurring_income_rules_update_own ON public.recurring_income_rules
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid ()
  AND EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = recurring_income_rules.property_id
      AND p.user_id = auth.uid ()
  )
  AND EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = recurring_income_rules.tenant_id
      AND t.user_id = auth.uid ()
  )
  AND EXISTS (
    SELECT 1
    FROM public.leases l
    WHERE l.id = recurring_income_rules.lease_id
      AND l.user_id = auth.uid ()
  )
)
WITH CHECK (
  user_id = auth.uid ()
  AND EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = property_id
      AND p.user_id = auth.uid ()
  )
  AND EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = tenant_id
      AND t.user_id = auth.uid ()
  )
  AND EXISTS (
    SELECT 1
    FROM public.leases l
    WHERE l.id = lease_id
      AND l.user_id = auth.uid ()
  )
);

CREATE POLICY recurring_income_rules_delete_own ON public.recurring_income_rules
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid ()
  AND EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = recurring_income_rules.property_id
      AND p.user_id = auth.uid ()
  )
  AND EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = recurring_income_rules.tenant_id
      AND t.user_id = auth.uid ()
  )
  AND EXISTS (
    SELECT 1
    FROM public.leases l
    WHERE l.id = recurring_income_rules.lease_id
      AND l.user_id = auth.uid ()
  )
);

-- ---------------------------------------------------------------------------
-- 11) invoices — DELETE only while DRAFT; otherwise use status / archived_at
--     (DELETE privilege remains granted; RLS restricts rows to DRAFT + owner.)
-- ---------------------------------------------------------------------------

CREATE POLICY invoices_select_own ON public.invoices
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid ()
  AND EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = invoices.property_id
      AND p.user_id = auth.uid ()
  )
  AND EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = invoices.tenant_id
      AND t.user_id = auth.uid ()
  )
  AND (
    lease_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.leases l
      WHERE l.id = invoices.lease_id
        AND l.user_id = auth.uid ()
    )
  )
);

CREATE POLICY invoices_insert_own ON public.invoices
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid ()
  AND EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = property_id
      AND p.user_id = auth.uid ()
  )
  AND EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = tenant_id
      AND t.user_id = auth.uid ()
  )
  AND (
    lease_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.leases l
      WHERE l.id = lease_id
        AND l.user_id = auth.uid ()
    )
  )
);

CREATE POLICY invoices_update_own ON public.invoices
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid ()
  AND EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = invoices.property_id
      AND p.user_id = auth.uid ()
  )
  AND EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = invoices.tenant_id
      AND t.user_id = auth.uid ()
  )
  AND (
    lease_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.leases l
      WHERE l.id = invoices.lease_id
        AND l.user_id = auth.uid ()
    )
  )
)
WITH CHECK (
  user_id = auth.uid ()
  AND EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = property_id
      AND p.user_id = auth.uid ()
  )
  AND EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = tenant_id
      AND t.user_id = auth.uid ()
  )
  AND (
    lease_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.leases l
      WHERE l.id = lease_id
        AND l.user_id = auth.uid ()
    )
  )
);

CREATE POLICY invoices_delete_draft_own ON public.invoices
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid ()
  AND status = 'DRAFT'::public.app_invoice_status
);

COMMENT ON POLICY invoices_insert_own ON public.invoices IS
  'Invoice must reference owned property, tenant, and optional lease for auth.uid().';

COMMENT ON POLICY invoices_delete_draft_own ON public.invoices IS
  'Hard delete allowed only for DRAFT invoices; cancel paid/sent via status + archived_at.';

-- ---------------------------------------------------------------------------
-- 12) invoice_line_items — all operations only when parent invoice is owned
-- ---------------------------------------------------------------------------

CREATE POLICY invoice_line_items_select_own ON public.invoice_line_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.invoices i
    WHERE i.id = invoice_line_items.invoice_id
      AND i.user_id = auth.uid ()
  )
);

CREATE POLICY invoice_line_items_insert_own ON public.invoice_line_items
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.invoices i
    WHERE i.id = invoice_id
      AND i.user_id = auth.uid ()
  )
);

CREATE POLICY invoice_line_items_update_own ON public.invoice_line_items
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.invoices i
    WHERE i.id = invoice_line_items.invoice_id
      AND i.user_id = auth.uid ()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.invoices i
    WHERE i.id = invoice_id
      AND i.user_id = auth.uid ()
  )
);

CREATE POLICY invoice_line_items_delete_own ON public.invoice_line_items
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.invoices i
    WHERE i.id = invoice_line_items.invoice_id
      AND i.user_id = auth.uid ()
  )
);

COMMENT ON POLICY invoice_line_items_insert_own ON public.invoice_line_items IS
  'Line items inherit access from parent invoice.user_id = auth.uid(); blocks cross-tenant invoice_id.';

-- ---------------------------------------------------------------------------
-- 13) recurring_invoice_rules — optional lease must belong to caller
-- ---------------------------------------------------------------------------

CREATE POLICY recurring_invoice_rules_select_own ON public.recurring_invoice_rules
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid ()
  AND EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = recurring_invoice_rules.property_id
      AND p.user_id = auth.uid ()
  )
  AND EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = recurring_invoice_rules.tenant_id
      AND t.user_id = auth.uid ()
  )
  AND (
    lease_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.leases l
      WHERE l.id = recurring_invoice_rules.lease_id
        AND l.user_id = auth.uid ()
    )
  )
);

CREATE POLICY recurring_invoice_rules_insert_own ON public.recurring_invoice_rules
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid ()
  AND EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = property_id
      AND p.user_id = auth.uid ()
  )
  AND EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = tenant_id
      AND t.user_id = auth.uid ()
  )
  AND (
    lease_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.leases l
      WHERE l.id = lease_id
        AND l.user_id = auth.uid ()
    )
  )
);

CREATE POLICY recurring_invoice_rules_update_own ON public.recurring_invoice_rules
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid ()
  AND EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = recurring_invoice_rules.property_id
      AND p.user_id = auth.uid ()
  )
  AND EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = recurring_invoice_rules.tenant_id
      AND t.user_id = auth.uid ()
  )
  AND (
    lease_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.leases l
      WHERE l.id = recurring_invoice_rules.lease_id
        AND l.user_id = auth.uid ()
    )
  )
)
WITH CHECK (
  user_id = auth.uid ()
  AND EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = property_id
      AND p.user_id = auth.uid ()
  )
  AND EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = tenant_id
      AND t.user_id = auth.uid ()
  )
  AND (
    lease_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.leases l
      WHERE l.id = lease_id
        AND l.user_id = auth.uid ()
    )
  )
);

CREATE POLICY recurring_invoice_rules_delete_own ON public.recurring_invoice_rules
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid ()
  AND EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = recurring_invoice_rules.property_id
      AND p.user_id = auth.uid ()
  )
  AND EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = recurring_invoice_rules.tenant_id
      AND t.user_id = auth.uid ()
  )
  AND (
    lease_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.leases l
      WHERE l.id = recurring_invoice_rules.lease_id
        AND l.user_id = auth.uid ()
    )
  )
);

-- ---------------------------------------------------------------------------
-- 14) calculator_results (physical table; public.calculation_results VIEW inherits)
-- ---------------------------------------------------------------------------

CREATE POLICY calculator_results_select_own ON public.calculator_results
FOR SELECT
TO authenticated
USING (user_id = auth.uid ());

CREATE POLICY calculator_results_insert_own ON public.calculator_results
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid ());

CREATE POLICY calculator_results_update_own ON public.calculator_results
FOR UPDATE
TO authenticated
USING (user_id = auth.uid ())
WITH CHECK (user_id = auth.uid ());

CREATE POLICY calculator_results_delete_own ON public.calculator_results
FOR DELETE
TO authenticated
USING (user_id = auth.uid ());

COMMENT ON POLICY calculator_results_select_own ON public.calculator_results IS
  'Saved calculator runs per user; public.calculation_results is a security_invoker VIEW over this table.';

-- ---------------------------------------------------------------------------
-- 15) stored_reports — FK targets must be owned when present
-- ---------------------------------------------------------------------------

CREATE POLICY stored_reports_select_own ON public.stored_reports
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid ()
  AND (
    property_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.properties p
      WHERE p.id = stored_reports.property_id
        AND p.user_id = auth.uid ()
    )
  )
  AND (
    calculation_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.calculator_results c
      WHERE c.id = stored_reports.calculation_id
        AND c.user_id = auth.uid ()
    )
  )
  AND (
    invoice_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.invoices i
      WHERE i.id = stored_reports.invoice_id
        AND i.user_id = auth.uid ()
    )
  )
);

CREATE POLICY stored_reports_insert_own ON public.stored_reports
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid ()
  AND (
    property_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.properties p
      WHERE p.id = property_id
        AND p.user_id = auth.uid ()
    )
  )
  AND (
    calculation_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.calculator_results c
      WHERE c.id = calculation_id
        AND c.user_id = auth.uid ()
    )
  )
  AND (
    invoice_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.invoices i
      WHERE i.id = invoice_id
        AND i.user_id = auth.uid ()
    )
  )
);

CREATE POLICY stored_reports_update_own ON public.stored_reports
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid ()
  AND (
    property_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.properties p
      WHERE p.id = stored_reports.property_id
        AND p.user_id = auth.uid ()
    )
  )
  AND (
    calculation_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.calculator_results c
      WHERE c.id = stored_reports.calculation_id
        AND c.user_id = auth.uid ()
    )
  )
  AND (
    invoice_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.invoices i
      WHERE i.id = stored_reports.invoice_id
        AND i.user_id = auth.uid ()
    )
  )
)
WITH CHECK (
  user_id = auth.uid ()
  AND (
    property_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.properties p
      WHERE p.id = property_id
        AND p.user_id = auth.uid ()
    )
  )
  AND (
    calculation_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.calculator_results c
      WHERE c.id = calculation_id
        AND c.user_id = auth.uid ()
    )
  )
  AND (
    invoice_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.invoices i
      WHERE i.id = invoice_id
        AND i.user_id = auth.uid ()
    )
  )
);

CREATE POLICY stored_reports_delete_own ON public.stored_reports
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid ()
  AND (
    property_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.properties p
      WHERE p.id = stored_reports.property_id
        AND p.user_id = auth.uid ()
    )
  )
  AND (
    calculation_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.calculator_results c
      WHERE c.id = stored_reports.calculation_id
        AND c.user_id = auth.uid ()
    )
  )
  AND (
    invoice_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.invoices i
      WHERE i.id = stored_reports.invoice_id
        AND i.user_id = auth.uid ()
    )
  )
);

COMMENT ON POLICY stored_reports_insert_own ON public.stored_reports IS
  'Stored report metadata must reference owned property / calculation / invoice when FKs are set.';

-- ---------------------------------------------------------------------------
-- 16) COMMENT ON POLICY — policies not documented inline above
-- ---------------------------------------------------------------------------

COMMENT ON POLICY tenants_select_own ON public.tenants IS
  'SELECT tenants for auth.uid(); optional property_id must reference an owned property.';

COMMENT ON POLICY tenants_update_own ON public.tenants IS
  'UPDATE own tenants; property_id must remain null or reference an owned property.';

COMMENT ON POLICY tenants_delete_own ON public.tenants IS
  'DELETE own tenant rows; optional property link must still be owned when set.';

COMMENT ON POLICY leases_select_own ON public.leases IS
  'SELECT leases only when linked property and tenant are owned by auth.uid().';

COMMENT ON POLICY leases_update_own ON public.leases IS
  'UPDATE leases when property_id and tenant_id remain owned by auth.uid().';

COMMENT ON POLICY leases_delete_own ON public.leases IS
  'DELETE own lease rows with owned property and tenant.';

COMMENT ON POLICY property_documents_select_own ON public.property_documents IS
  'SELECT documents whose property_id references a property owned by auth.uid().';

COMMENT ON POLICY property_documents_update_own ON public.property_documents IS
  'UPDATE documents for an owned property; property_id must remain owned.';

COMMENT ON POLICY property_documents_delete_own ON public.property_documents IS
  'DELETE documents attached to an owned property.';

COMMENT ON POLICY expense_entries_select_own ON public.expense_entries IS
  'SELECT expense ledger rows for properties owned by auth.uid().';

COMMENT ON POLICY expense_entries_insert_own ON public.expense_entries IS
  'INSERT expense rows only for an owned property_id.';

COMMENT ON POLICY income_entries_select_own ON public.income_entries IS
  'SELECT income rows for owned property; optional lease/tenant FKs must be owned when set.';

COMMENT ON POLICY income_entries_update_own ON public.income_entries IS
  'UPDATE income rows for owned property; hard DELETE revoked for authenticated — use status/archived_at.';

COMMENT ON POLICY recurring_income_rules_select_own ON public.recurring_income_rules IS
  'SELECT recurring income rules when property, tenant, and lease belong to auth.uid().';

COMMENT ON POLICY recurring_income_rules_insert_own ON public.recurring_income_rules IS
  'INSERT recurring income rule with owned property_id, tenant_id, and lease_id.';

COMMENT ON POLICY recurring_income_rules_update_own ON public.recurring_income_rules IS
  'UPDATE rule when all FK targets remain owned by auth.uid().';

COMMENT ON POLICY recurring_income_rules_delete_own ON public.recurring_income_rules IS
  'DELETE own recurring income rules with owned property, tenant, and lease.';

COMMENT ON POLICY invoices_select_own ON public.invoices IS
  'SELECT invoices for auth.uid() with owned property, tenant, and optional lease.';

COMMENT ON POLICY invoices_update_own ON public.invoices IS
  'UPDATE own invoices; lifecycle changes should prefer status + archived_at over hard delete.';

COMMENT ON POLICY invoice_line_items_select_own ON public.invoice_line_items IS
  'SELECT line items only when parent invoice.user_id = auth.uid().';

COMMENT ON POLICY invoice_line_items_update_own ON public.invoice_line_items IS
  'UPDATE line items only for invoices owned by auth.uid(); WITH CHECK blocks invoice_id pivot.';

COMMENT ON POLICY invoice_line_items_delete_own ON public.invoice_line_items IS
  'DELETE line items only under invoices owned by auth.uid().';

COMMENT ON POLICY recurring_invoice_rules_select_own ON public.recurring_invoice_rules IS
  'SELECT recurring invoice rules with owned property and tenant; optional lease must be owned.';

COMMENT ON POLICY recurring_invoice_rules_insert_own ON public.recurring_invoice_rules IS
  'INSERT recurring invoice rule with owned property, tenant, and optional lease.';

COMMENT ON POLICY recurring_invoice_rules_update_own ON public.recurring_invoice_rules IS
  'UPDATE when property, tenant, and optional lease remain owned by auth.uid().';

COMMENT ON POLICY recurring_invoice_rules_delete_own ON public.recurring_invoice_rules IS
  'DELETE own recurring invoice rules with valid owned FKs.';

COMMENT ON POLICY calculator_results_insert_own ON public.calculator_results IS
  'Insert calculator result rows with user_id = auth.uid().';

COMMENT ON POLICY calculator_results_update_own ON public.calculator_results IS
  'Update own calculator result rows.';

COMMENT ON POLICY calculator_results_delete_own ON public.calculator_results IS
  'Delete own calculator result rows.';

COMMENT ON POLICY stored_reports_select_own ON public.stored_reports IS
  'SELECT stored reports for auth.uid() when optional property/calculation/invoice FKs are owned.';

COMMENT ON POLICY stored_reports_update_own ON public.stored_reports IS
  'UPDATE stored reports; FK targets must remain owned or null.';

COMMENT ON POLICY stored_reports_delete_own ON public.stored_reports IS
  'DELETE own stored report metadata rows.';
