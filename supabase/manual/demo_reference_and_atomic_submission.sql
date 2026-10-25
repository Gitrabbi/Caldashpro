-- CalDashPro: demo reference standards and validated calibration records.
-- Run after demo_measurement_templates.sql. Safe to re-run.
create table if not exists public.demo_reference_standards (
 id uuid primary key default gen_random_uuid(),
 asset_no text not null unique,
 name text not null,
 certificate_no text not null,
 calibration_date date not null,
 next_due_date date not null,
 active boolean not null default true,
 created_at timestamptz not null default now(),
 constraint demo_standard_dates check(next_due_date>calibration_date)
);
alter table public.demo_reference_standards enable row level security;
drop policy if exists demo_reference_read on public.demo_reference_standards;
create policy demo_reference_read on public.demo_reference_standards for select to authenticated using(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active));
drop policy if exists demo_reference_write on public.demo_reference_standards;
create policy demo_reference_write on public.demo_reference_standards for all to authenticated using(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('admin','manager'))) with check(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('admin','manager')));
grant select,insert,update,delete on public.demo_reference_standards to authenticated;
alter table public.demo_calibration_events add column if not exists standard_id uuid references public.demo_reference_standards(id);
-- Atomic submission: reject invalid standards, missing readings, mismatched template points.
create or replace function public.submit_demo_calibration(
 p_request_id uuid,p_date date,p_standard_id uuid,p_found text,p_left text,p_readings jsonb
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_request public.demo_calibration_requests%rowtype;
 v_standard public.demo_reference_standards%rowtype;
 v_count int;v_expected int;v_fail boolean;v_changed boolean;v_event uuid;
begin
 if not exists(select 1 from public.profiles where id=(select auth.uid()) and active and role in ('admin','manager','technician')) then raise exception 'Not authorized';end if;
 select * into v_request from public.demo_calibration_requests where id=p_request_id;
 if not found or v_request.status not in ('open','assigned') then raise exception 'Request unavailable';end if;
 if exists(select 1 from public.demo_calibration_events where request_id=p_request_id) then raise exception 'Already calibrated';end if;
 select * into v_standard from public.demo_reference_standards where id=p_standard_id and active;
 if not found or p_date<v_standard.calibration_date or p_date>v_standard.next_due_date then raise exception 'Reference standard is not valid for calibration date';end if;
 if jsonb_typeof(p_readings) is distinct from 'array' then raise exception 'Readings must be an array';end if;
 select count(*) into v_expected from public.demo_measurement_templates where instrument_id=v_request.instrument_id;
 select count(*) into v_count from jsonb_array_elements(p_readings);
 if v_expected=0 or v_count<>v_expected then raise exception 'Measurement template mismatch';end if;
 if exists(
  select 1 from public.demo_measurement_templates t
  where t.instrument_id=v_request.instrument_id and
   (select count(*) from jsonb_array_elements(p_readings) x where x->>'point_key'=t.point_key)<>1
 ) then raise exception 'Missing or duplicate measurement point';end if;
 if exists(select 1 from jsonb_array_elements(p_readings) x where
  not exists(select 1 from public.demo_measurement_templates t where t.instrument_id=v_request.instrument_id and t.point_key=x->>'point_key')
  or (x->>'found') is null or (x->>'left') is null
 ) then raise exception 'Invalid measurement readings';end if;
 select coalesce(bool_or((x->>'left')::numeric<t.nominal_value-t.tolerance_minus or (x->>'left')::numeric>t.nominal_value+t.tolerance_plus),false),
 coalesce(bool_or((x->>'found')::numeric<>(x->>'left')::numeric),false)
 into v_fail,v_changed from jsonb_array_elements(p_readings) x join public.demo_measurement_templates t on t.instrument_id=v_request.instrument_id and t.point_key=x->>'point_key';
 insert into public.demo_calibration_events(request_id,instrument_id,calibration_date,result,as_found_summary,as_left_summary,standard_id,created_by)
 values(p_request_id,v_request.instrument_id,p_date,case when v_fail then 'fail' when v_changed then 'adjusted' else 'pass' end,p_found,p_left,p_standard_id,(select auth.uid())) returning id into v_event;
 insert into public.demo_calibration_measurement_points(calibration_event_id,point_key,nominal_value,as_found_value,as_left_value,tolerance_minus,tolerance_plus,engineering_unit)
 select v_event,t.point_key,t.nominal_value,(x->>'found')::numeric,(x->>'left')::numeric,t.tolerance_minus,t.tolerance_plus,t.engineering_unit
 from jsonb_array_elements(p_readings) x join public.demo_measurement_templates t on t.instrument_id=v_request.instrument_id and t.point_key=x->>'point_key';
 update public.demo_calibration_requests set status='submitted' where id=p_request_id;
 return v_event;
end $$;
revoke all on function public.submit_demo_calibration(uuid,date,uuid,text,text,jsonb) from public,anon;
grant execute on function public.submit_demo_calibration(uuid,date,uuid,text,text,jsonb) to authenticated;
