-- Saved calculator inputs (lightweight, user-scoped).
-- Keeps `/calculators` draft inputs without interfering with calculator_results / stored_reports.

create table if not exists public.calculator_saved_inputs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  property_type text not null,
  label text null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists calculator_saved_inputs_user_id_idx on public.calculator_saved_inputs (user_id);
create index if not exists calculator_saved_inputs_user_type_idx on public.calculator_saved_inputs (user_id, property_type);

alter table public.calculator_saved_inputs enable row level security;

-- RLS: user can manage their own saved inputs.
drop policy if exists "calculator_saved_inputs_select_own" on public.calculator_saved_inputs;
create policy "calculator_saved_inputs_select_own"
on public.calculator_saved_inputs
for select
using (auth.uid() = user_id);

drop policy if exists "calculator_saved_inputs_insert_own" on public.calculator_saved_inputs;
create policy "calculator_saved_inputs_insert_own"
on public.calculator_saved_inputs
for insert
with check (auth.uid() = user_id);

drop policy if exists "calculator_saved_inputs_update_own" on public.calculator_saved_inputs;
create policy "calculator_saved_inputs_update_own"
on public.calculator_saved_inputs
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "calculator_saved_inputs_delete_own" on public.calculator_saved_inputs;
create policy "calculator_saved_inputs_delete_own"
on public.calculator_saved_inputs
for delete
using (auth.uid() = user_id);

grant select, insert, update, delete on table public.calculator_saved_inputs to authenticated;

