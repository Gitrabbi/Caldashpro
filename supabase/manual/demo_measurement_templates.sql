-- CalDashPro demo measurement templates. Run after demo_calibration_workflow.sql.
-- Safe to rerun without duplicate-policy errors.
create table if not exists public.demo_measurement_templates (
 id uuid primary key default gen_random_uuid(),
 instrument_id uuid not null references public.demo_instruments(id) on delete cascade,
 point_key text not null,
 nominal_value numeric not null,
 tolerance_minus numeric not null check (tolerance_minus >= 0),
 tolerance_plus numeric not null check (tolerance_plus >= 0),
 engineering_unit text not null default '',
 created_at timestamptz not null default now(),
 unique(instrument_id,point_key)
);
alter table public.demo_measurement_templates enable row level security;
drop policy if exists demo_templates_read on public.demo_measurement_templates;
create policy demo_templates_read on public.demo_measurement_templates for select to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active));
drop policy if exists demo_templates_write on public.demo_measurement_templates;
create policy demo_templates_write on public.demo_measurement_templates for all to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('admin','manager'))) with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('admin','manager')));
grant select,insert,update,delete on public.demo_measurement_templates to authenticated;
