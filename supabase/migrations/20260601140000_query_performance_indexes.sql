-- Targeted btree indexes for hot read paths (statement RPC, financials directory,
-- invoices directory, property ledger lists). No RLS/policy changes.
-- Skips indexes already present (e.g. invoices_rent_lease_period_uniq, invoices_property_status_due_idx).

-- ---------------------------------------------------------------------------
-- Statement + dashboard: month-scoped income/expense aggregates per property
-- get_property_monthly_statement / get_dashboard_summary filter:
--   property_id + user_id (+ income_date / expense_date range)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS income_entries_property_user_income_date_idx
  ON public.income_entries (property_id, user_id, income_date);

CREATE INDEX IF NOT EXISTS expense_entries_property_user_expense_date_idx
  ON public.expense_entries (property_id, user_id, expense_date);

-- Property workspace ledger tabs (listIncome / listExpenses):
--   WHERE property_id = ? ORDER BY income_date / expense_date DESC
CREATE INDEX IF NOT EXISTS income_entries_property_income_date_idx
  ON public.income_entries (property_id, income_date DESC);

CREATE INDEX IF NOT EXISTS expense_entries_property_expense_date_idx
  ON public.expense_entries (property_id, expense_date DESC);

-- My Properties list enrichment — recurring expense templates per property:
--   user_id + property_id IN (...) AND is_recurring AND parent IS NULL AND status <> ARCHIVED
CREATE INDEX IF NOT EXISTS expense_entries_recurring_templates_idx
  ON public.expense_entries (user_id, property_id)
  WHERE is_recurring = true
    AND recurring_schedule_parent_id IS NULL
    AND status <> 'ARCHIVED'::public.app_property_expense_status;

-- ---------------------------------------------------------------------------
-- Invoices
-- ---------------------------------------------------------------------------

-- Invoices directory (InvoicesListPage): user_id + optional filters, ORDER BY due_date DESC, created_at DESC
CREATE INDEX IF NOT EXISTS invoices_user_due_created_idx
  ON public.invoices (user_id, due_date DESC NULLS LAST, created_at DESC);

-- Property invoice lists + statement "current invoice" (ORDER BY created_at DESC LIMIT 1):
--   WHERE property_id = ? [AND user_id = ?]
CREATE INDEX IF NOT EXISTS invoices_property_created_idx
  ON public.invoices (property_id, created_at DESC);

-- Statement summary — paid invoices in calendar month:
--   property_id + user_id + invoice_date range
CREATE INDEX IF NOT EXISTS invoices_property_user_invoice_date_idx
  ON public.invoices (property_id, user_id, invoice_date);
