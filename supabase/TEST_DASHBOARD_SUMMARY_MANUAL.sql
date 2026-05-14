-- Manual checks for public.get_dashboard_summary (run in SQL editor as an authenticated user / JWT).
-- 1) Empty portfolio: expect totalProperties = 0, empty charts arrays, warnings JSON array present.
-- 2) Isolation: second user should see only own rows (RLS + explicit user_id filters).

-- Example (replace UUIDs and session):
-- select get_dashboard_summary('2026-05', array['LONG_TERM_RENTAL']::text[], null::uuid, null::int, 'UTC');
