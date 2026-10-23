-- CalDashPro calibration measurement-point history.
-- Execute in Supabase SQL Editor before using drift charts.
create table if not exists public.calibration_measurement_points (
 id uuid primary key default gen_random_uuid(),
 calibration_event_id uuid not null references public.calibration_events(id) on delete restrict,
 point_key text not null,
 nominal_value numeric not null,
 as_found_value numeric not null,
 as_left_value numeric,
 tolerance_minus numeric,
 tolerance_plus numeric,
 engineering_unit text not null,
 created_at timestamptz not null default now(),
 constraint calibration_point_key_not_empty check(length(trim(point_key))>0),
 constraint calibration_point_unit_not_empty check(length(trim(engineering_unit))>0),
 constraint calibration_point_tolerance_nonnegative check((tolerance_minus is null or tolerance_minus>=0) and (tolerance_plus is null or tolerance_plus>=0)),
 constraint calibration_point_unique unique(calibration_event_id,point_key)
);
create index if not exists calibration_measurement_points_event_idx on public.calibration_measurement_points(calibration_event_id);
alter table public.calibration_measurement_points enable row level security;
grant select,insert,update on public.calibration_measurement_points to authenticated;
drop policy if exists calibration_points_read on public.calibration_measurement_points;
create policy calibration_points_read on public.calibration_measurement_points for select to authenticated
using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active=true));
drop policy if exists calibration_points_insert on public.calibration_measurement_points;
create policy calibration_points_insert on public.calibration_measurement_points for insert to authenticated
with check(exists(select 1 from public.calibration_events e where e.id=calibration_event_id and e.technician_id=(select auth.uid()) and e.approved_at is null and e.review_status in ('submitted','rejected')) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active=true));
drop policy if exists calibration_points_update on public.calibration_measurement_points;
create policy calibration_points_update on public.calibration_measurement_points for update to authenticated
using(exists(select 1 from public.calibration_events e where e.id=calibration_event_id and e.technician_id=(select auth.uid()) and e.approved_at is null and e.review_status='rejected'))
with check(exists(select 1 from public.calibration_events e where e.id=calibration_event_id and e.technician_id=(select auth.uid()) and e.approved_at is null and e.review_status='rejected'));
