-- Run in the CalDashPro production SQL Editor.
-- STEP 1: Preview records that explicitly contain DEMO in tag/name/notes.
-- Do not assume all imported instruments are demos.
select i.id,i.tag_no,i.name,i.notes,
 case when exists(select 1 from public.calibration_requests r where r.instrument_id=i.id)
 or exists(select 1 from public.calibration_events e where e.instrument_id=i.id)
 then 'HAS CALIBRATION HISTORY — REVIEW' else 'NO CALIBRATION HISTORY' end as history_check
from public.instruments i
where i.tag_no ilike '%demo%' or i.name ilike '%demo%' or coalesce(i.notes,'') ilike '%demo%'
order by i.tag_no;
-- STEP 2: After checking the result, explicitly list the approved IDs below.
-- The following transaction COPIES records; it does not remove live records.
-- Replace the sample UUIDs only with IDs verified to be demonstration records.
-- begin;
-- create temporary table approved_demo_ids(id uuid primary key) on commit drop;
-- insert into approved_demo_ids(id) values ('00000000-0000-0000-0000-000000000000');
-- insert into public.demo_areas(name)
-- select distinct a.name from public.areas a join public.instruments i on i.area_id=a.id join approved_demo_ids d on d.id=i.id
-- on conflict(name) do nothing;
-- insert into public.demo_instrument_groups(name)
-- select distinct g.name from public.instrument_groups g join public.instruments i on i.instrument_group_id=g.id join approved_demo_ids d on d.id=i.id
-- on conflict(name) do nothing;
-- insert into public.demo_locations(name,area_id)
-- select distinct l.name,da.id from public.locations l join public.areas a on a.id=l.area_id
-- join public.demo_areas da on da.name=a.name join public.instruments i on i.location_id=l.id join approved_demo_ids d on d.id=i.id
-- on conflict(area_id,name) do nothing;
-- insert into public.demo_instruments(tag_no,name,serial_no,area_id,location_id,instrument_group_id,next_due_date,last_calibration_date,notes,created_by)
-- select i.tag_no,i.name,i.serial_no,da.id,dl.id,dg.id,i.next_due_date,i.last_calibration_date,i.notes,i.created_by
-- from public.instruments i join approved_demo_ids d on d.id=i.id
-- left join public.areas a on a.id=i.area_id left join public.demo_areas da on da.name=a.name
-- left join public.instrument_groups g on g.id=i.instrument_group_id left join public.demo_instrument_groups dg on dg.name=g.name
-- left join public.locations l on l.id=i.location_id left join public.demo_locations dl on dl.area_id=da.id and dl.name=l.name
-- on conflict(tag_no) do nothing;
-- select count(*) as approved from approved_demo_ids;
-- select count(*) as copied from public.demo_instruments di join public.instruments i on i.tag_no=di.tag_no join approved_demo_ids d on d.id=i.id;
-- commit;
-- STEP 3: Archive/remove live demo rows ONLY after verifying all copied data and dependencies.
-- No automatic deletion is provided to protect calibration history and audit integrity.
