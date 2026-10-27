-- CalDashPro Phase 2: work-order accountability and escalation.
-- Apply once in Supabase SQL Editor. Does not alter the existing deadline schedule.
create table if not exists public.work_order_escalation_log (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references public.calibration_requests(id) on delete cascade,
 recipient_id uuid not null references auth.users(id),
 stage text not null check(stage in ('assigned_due_soon','assigned_overdue','manager_7d','manager_30d')),
 due_date date not null,
 created_at timestamptz not null default now(),
 unique(request_id,recipient_id,stage,due_date)
);
alter table public.work_order_escalation_log enable row level security;
revoke all on public.work_order_escalation_log from anon,authenticated;
create or replace function public.dispatch_work_order_escalations()
returns integer language plpgsql security definer set search_path='' as $$
declare job record; recipient record; stage_name text; n integer:=0; days_late integer;
begin
 if session_user not in ('postgres','supabase_admin') then
  raise exception 'Restricted to database scheduler';
 end if;
 for job in
  select r.id,r.assigned_to,r.due_date,r.status,i.tag_no,i.name
  from public.calibration_requests r
  join public.instruments i on i.id=r.instrument_id
  where r.due_date is not null
    and r.status not in ('completed','cancelled')
    and i.state='active'
 loop
  days_late:=current_date-job.due_date;
  for recipient in
   select p.id,p.role,coalesce(np.in_app_enabled,true) as enabled
   from public.profiles p
   left join public.notification_preferences np on np.user_id=p.id
   where p.active=true and (
    (p.id=job.assigned_to and days_late>=-7)
    or (p.role in ('admin','manager') and days_late>=7)
   )
  loop
   if not recipient.enabled then continue; end if;
   if recipient.id=job.assigned_to and days_late>=0 then
    stage_name:='assigned_overdue';
   elsif recipient.id=job.assigned_to then
    stage_name:='assigned_due_soon';
   elsif days_late>=30 then
    stage_name:='manager_30d';
   elsif days_late>=7 then
    stage_name:='manager_7d';
   else
    continue;
   end if;
   insert into public.work_order_escalation_log(request_id,recipient_id,stage,due_date)
   values(job.id,recipient.id,stage_name,job.due_date)
   on conflict do nothing;
   if found then
    insert into public.notifications(recipient_id,type,title,message,entity_type,entity_id)
    values(
     recipient.id,
     (case when days_late>=0 then 'overdue' else 'due_soon' end)::public.notification_type,
     case when stage_name like 'manager_%' then 'Work order escalation' else 'Assigned calibration work order' end,
     coalesce(job.tag_no,'Instrument')||' — '||coalesce(job.name,'Calibration')||
     ' | due '||job.due_date::text||
     case when days_late>0 then ' | '||days_late::text||' days overdue'
      when days_late=0 then ' | due today'
      else ' | due in '||(-days_late)::text||' days' end,
     'calibration_request',job.id
    );
    n:=n+1;
   end if;
  end loop;
 end loop;
 return n;
end $$;
revoke all on function public.dispatch_work_order_escalations() from public,anon,authenticated;
create extension if not exists pg_cron with schema pg_catalog;
do $$
declare previous_id bigint;
begin
 select jobid into previous_id from cron.job where jobname='caldashpro-work-order-escalations';
 if previous_id is not null then perform cron.unschedule(previous_id);end if;
 perform cron.schedule('caldashpro-work-order-escalations','5 7 * * *',
  'select public.dispatch_work_order_escalations();');
end $$;
-- Verify: select jobname,schedule,active from cron.job where jobname='caldashpro-work-order-escalations';
-- Manual test: select public.dispatch_work_order_escalations();
