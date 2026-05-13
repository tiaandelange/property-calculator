-- Run in Supabase SQL Editor after applying 20260513140000_core_application_schema.sql
-- Read-only checks: tables, FK count, index count.

-- 1) Expected public tables (15)
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles',
    'portfolio_projection_defaults',
    'properties',
    'tenants',
    'leases',
    'property_documents',
    'expense_entries',
    'income_entries',
    'recurring_income_rules',
    'invoices',
    'invoice_line_items',
    'recurring_invoice_rules',
    'calculator_results',
    'stored_reports',
    'subscriptions'
  )
ORDER BY tablename;

-- 2) Foreign keys touching public app tables (expect many)
SELECT
  tc.table_schema,
  tc.table_name,
  kcu.column_name,
  ccu.table_schema AS foreign_table_schema,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN (
    'profiles', 'properties', 'tenants', 'leases', 'property_documents',
    'expense_entries', 'income_entries', 'recurring_income_rules',
    'invoices', 'invoice_line_items', 'recurring_invoice_rules',
    'calculator_results', 'stored_reports', 'subscriptions'
  )
ORDER BY tc.table_name, kcu.column_name;

-- 3) Indexes on public app tables (excluding PK indexes — optional detail)
SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles', 'portfolio_projection_defaults', 'properties', 'tenants', 'leases',
    'property_documents', 'expense_entries', 'income_entries', 'recurring_income_rules',
    'invoices', 'invoice_line_items', 'recurring_invoice_rules',
    'calculator_results', 'stored_reports', 'subscriptions'
  )
ORDER BY tablename, indexname;

-- 4) Seed row present
SELECT id, rental_income_growth_percent_annual, total_expenses_growth_percent_annual
FROM public.portfolio_projection_defaults;
