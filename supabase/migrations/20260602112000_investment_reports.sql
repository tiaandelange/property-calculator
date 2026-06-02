-- Investment Reports (calculator-driven PDFs)

create table if not exists public.investment_reports (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  property_type text not null,
  label text null,
  file_name text not null,
  storage_bucket text not null,
  storage_key text not null,
  payload jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists investment_reports_user_id_idx on public.investment_reports (user_id);
create index if not exists investment_reports_user_created_idx on public.investment_reports (user_id, created_at desc);

alter table public.investment_reports enable row level security;

drop policy if exists "investment_reports_select_own" on public.investment_reports;
create policy "investment_reports_select_own"
on public.investment_reports
for select
using (auth.uid() = user_id);

drop policy if exists "investment_reports_insert_own" on public.investment_reports;
create policy "investment_reports_insert_own"
on public.investment_reports
for insert
with check (auth.uid() = user_id);

drop policy if exists "investment_reports_delete_own" on public.investment_reports;
create policy "investment_reports_delete_own"
on public.investment_reports
for delete
using (auth.uid() = user_id);

