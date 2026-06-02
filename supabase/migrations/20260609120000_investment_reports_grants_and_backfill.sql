-- Calculator investment reports were falling back to stored_reports when investment_reports
-- lacked table grants. Backfill legacy rows and keep a single source of truth.

grant select, insert, delete on table public.investment_reports to authenticated;

insert into public.investment_reports (
  id,
  user_id,
  property_type,
  label,
  file_name,
  storage_bucket,
  storage_key,
  payload,
  created_at
)
select
  sr.id,
  sr.user_id,
  coalesce(
    nullif(trim(regexp_replace(sr.file_name, '^investment-report-', '')), ''),
    'investment'
  ),
  sr.scenario_name,
  sr.file_name,
  coalesce(sr.storage_bucket, 'reports'),
  sr.storage_key,
  null::jsonb,
  sr.created_at
from public.stored_reports sr
where sr.report_type = 'INVESTMENT_REPORT'
  and sr.storage_key is not null
  and not exists (
    select 1
    from public.investment_reports ir
    where ir.id = sr.id
  );

update public.investment_reports
set property_type = regexp_replace(property_type, '\.pdf$', '')
where property_type like '%.pdf';

delete from public.stored_reports
where report_type = 'INVESTMENT_REPORT';
