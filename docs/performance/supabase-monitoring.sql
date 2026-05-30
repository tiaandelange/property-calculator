-- =============================================================================
-- Proplytic / Supabase — read-only performance monitoring
-- =============================================================================
--
-- WHERE TO RUN
--   Supabase Dashboard → SQL Editor (project owner / service role).
--   Do NOT run from the Supabase CLI against the pooler if auth fails; the
--   Dashboard SQL Editor uses a direct Postgres session and works reliably.
--
-- WHAT THIS FILE IS
--   Safe SELECT-only queries for index usage, table I/O, and (optionally)
--   pg_stat_statements. Monitoring and documentation only — no DDL here.
--
-- SAFETY RULES (read before acting on results)
--   • Do not add or drop indexes based on one day of low traffic.
--   • Monitor for at least a week under normal portfolio usage.
--   • Compare EXPLAIN (ANALYZE, BUFFERS) before and after any index change.
--   • Indexes speed reads but add write overhead and migration cost.
--   • Never drop an index from this checklist without an approved migration.
--   • RLS and auth must not be weakened to “fix” slow queries.
--
-- CUMULATIVE STATS
--   pg_stat_user_* views are cumulative since last stats reset (or cluster start).
--   pg_stat_statements (when enabled) tracks planning + execution stats per query
--   fingerprint. Reset distorts comparisons — note last reset time when reviewing.
--
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 0) Optional: when were stats last reset?
-- -----------------------------------------------------------------------------
SELECT
  stats_reset AS pg_stat_database_reset,
  datname
FROM pg_stat_database
WHERE datname = current_database();


-- -----------------------------------------------------------------------------
-- 1) Index usage — pg_stat_user_indexes
--    Low idx_scan on a large index may mean unused; high idx_scan = hot path.
-- -----------------------------------------------------------------------------
SELECT
  schemaname,
  relname AS table_name,
  indexrelname AS index_name,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan ASC, pg_relation_size(indexrelid) DESC;


-- Hot indexes (most scans) — confirm expected paths are indexed
SELECT
  relname AS table_name,
  indexrelname AS index_name,
  idx_scan,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC
LIMIT 40;


-- Indexes on public tables that have never been scanned (investigate before dropping)
SELECT
  relname AS table_name,
  indexrelname AS index_name,
  idx_scan,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND idx_scan = 0
  AND indexrelname NOT LIKE '%_pkey'
ORDER BY pg_relation_size(indexrelid) DESC;


-- -----------------------------------------------------------------------------
-- 2) Table scan / read stats — pg_stat_user_tables
--    High seq_scan vs idx_scan can mean missing or unused indexes (not always).
-- -----------------------------------------------------------------------------
SELECT
  relname AS table_name,
  seq_scan,
  seq_tup_read,
  idx_scan,
  idx_tup_fetch,
  n_live_tup,
  n_dead_tup,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY seq_scan DESC, n_live_tup DESC;


-- Tables where sequential scans dominate (candidates for EXPLAIN review)
SELECT
  relname AS table_name,
  seq_scan,
  idx_scan,
  CASE
    WHEN (seq_scan + idx_scan) = 0 THEN NULL
    ELSE round(100.0 * seq_scan / (seq_scan + idx_scan), 1)
  END AS seq_scan_pct,
  n_live_tup
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND (seq_scan + idx_scan) > 0
ORDER BY seq_scan DESC
LIMIT 30;


-- -----------------------------------------------------------------------------
-- 3) Slow / expensive queries — pg_stat_statements (extension must be enabled)
--    Supabase: Database → Extensions → pg_stat_statements (often on by default).
-- -----------------------------------------------------------------------------

-- Check extension is available
SELECT extname, extversion
FROM pg_extension
WHERE extname = 'pg_stat_statements';


-- Top queries by total time (adjust LIMIT)
SELECT
  left(query, 200) AS query_preview,
  calls,
  round(total_exec_time::numeric, 2) AS total_exec_time_ms,
  round(mean_exec_time::numeric, 2) AS mean_exec_time_ms,
  rows,
  shared_blks_hit,
  shared_blks_read
FROM pg_stat_statements
WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
  AND query NOT LIKE '%pg_stat_statements%'
ORDER BY total_exec_time DESC
LIMIT 25;


-- Top queries by mean time (good for occasional heavy RPCs)
SELECT
  left(query, 200) AS query_preview,
  calls,
  round(mean_exec_time::numeric, 2) AS mean_exec_time_ms,
  round(total_exec_time::numeric, 2) AS total_exec_time_ms,
  rows
FROM pg_stat_statements
WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
  AND calls >= 5
  AND query NOT LIKE '%pg_stat_statements%'
ORDER BY mean_exec_time DESC
LIMIT 25;


-- Proplytic hot paths — filter by RPC / table name (edit patterns as needed)
SELECT
  left(query, 240) AS query_preview,
  calls,
  round(mean_exec_time::numeric, 2) AS mean_exec_time_ms,
  round(total_exec_time::numeric, 2) AS total_exec_time_ms,
  rows
FROM pg_stat_statements
WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
  AND (
    query ILIKE '%get_property_monthly_statement%'
    OR query ILIKE '%get_property_statement_range%'
    OR query ILIKE '%get_workspace_financials_directory%'
    OR query ILIKE '%get_properties_directory%'
    OR query ILIKE '%get_tenants_directory%'
    OR query ILIKE '%get_leases_directory%'
    OR query ILIKE '%get_invoices_directory%'
    OR query ILIKE '%get_invoice_directory_metrics%'
    OR query ILIKE '%get_dashboard_summary%'
    OR query ILIKE '% FROM public.invoices %'
    OR query ILIKE '% FROM public.expense_entries %'
    OR query ILIKE '% FROM public.leases %'
  )
ORDER BY total_exec_time DESC
LIMIT 30;


-- -----------------------------------------------------------------------------
-- 4) Candidate indexes to WATCH (do not create from this file)
--    Compare idx_scan / seq_scan above for these access patterns over ≥1 week.
--    Map generic names below to Proplytic schema where they differ.
-- -----------------------------------------------------------------------------

/*
  Generic watch list                          Proplytic notes (2026-05 schema)
  ------------------------------------------  ---------------------------------
  statement_lines(property_id, statement_date)  statement_lines is a VIEW on
                                                invoices; line_date = due/issue
                                                date. Index underlying invoices
                                                (property_id, due_date) or RPC-
                                                specific filters — not the view.

  statement_lines(tenant_id, statement_date)  View column: primary_tenant_id;
                                                same note — index base tables.

  invoices(workspace_id, status, due_date)      Use user_id (RLS owner), not
                                                workspace_id. Existing:
                                                invoices_user_due_created_idx,
                                                directory filters on user_id +
                                                status + due_date.

  invoices(lease_id, invoice_period, invoice_type)
                                                Rent uniqueness / recurring paths;
                                                check invoices_rent_lease_period_uniq
                                                and lease-scoped listing queries.

  leases(property_id, status)                   Property lease tabs + directory;
                                                leases_property_id_idx exists —
                                                monitor composite (property_id, status)
                                                only if EXPLAIN shows filter on both.

  expenses(property_id, due_date)               Table: expense_entries; column:
                                                expense_date. Existing:
                                                expense_entries_property_expense_date_idx,
                                                expense_entries_property_user_expense_date_idx.
*/

-- Show whether watch-list-style indexes already exist (names may differ)
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('invoices', 'leases', 'expense_entries', 'income_entries')
ORDER BY tablename, indexname;


-- Compare scan counts on tables tied to the watch list
SELECT
  relname AS table_name,
  seq_scan,
  idx_scan,
  n_live_tup
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND relname IN ('invoices', 'leases', 'expense_entries', 'income_entries', 'properties', 'tenants')
ORDER BY relname;


-- -----------------------------------------------------------------------------
-- 5) Quick EXPLAIN template (run manually for a single slow query id)
--    Replace $1… with literal UUIDs in Dashboard; never paste secrets.
-- -----------------------------------------------------------------------------
-- EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
-- SELECT … your filtered query …;


-- -----------------------------------------------------------------------------
-- 6) Optional: reset stats (DO NOT run in production without a reason)
-- -----------------------------------------------------------------------------
-- SELECT pg_stat_reset();
-- SELECT pg_stat_statements_reset();
