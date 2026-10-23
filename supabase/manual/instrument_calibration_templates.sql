-- Calibration templates: configure nominal points once per instrument.
create table if not exists public.instrument_calibration_points (
 id uuid primary key default gen_random_uuid(),
 instrument_id uuid not null references public.instruments(id) on delete cascade,
 point_key text not null,
 nominal_value numeric not null,
 tolerance_minus numeric,
 tolerance_plus numeric,
 engineering_unit text not null,
 sort_order integer not null default 0,
 active boolean not null default true,
 created_at timestamptz not null default now(),
 unique(instrument_id,point_key),
 check(length(trim(point_key))>0),
 check(length(trim(engineering_unit))>0),
 check((tolerance_minus is null or tolerance_minus>=0) and (tolerance_plus is null or tolerance_plus>=0))
);
alter table public.instrument_calibration_points enable row level security;
grant select,insert,update,delete on public.instrument_calibration_points to authenticated;
drop policy if exists instrument_points_select on public.instrument_calibration_points;
create policy instrument_points_select on public.instrument_calibration_points for select to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active=true));
drop policy if exists instrument_points_insert on public.instrument_calibration_points;
create policy instrument_points_insert on public.instrument_calibration_points for insert to authenticated with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active=true and p.role in ('admin','manager')));
drop policy if exists instrument_points_update on public.instrument_calibration_points;
create policy instrument_points_update on public.instrument_calibration_points for update to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active=true and p.role in ('admin','manager'))) with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active=true and p.role in ('admin','manager')));
drop policy if exists instrument_points_delete on public.instrument_calibration_points;
create policy instrument_points_delete on public.instrument_calibration_points for delete to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active=true and p.role in ('admin','manager')));
-- Historical readings store nominal and tolerance values copied at calibration time.
