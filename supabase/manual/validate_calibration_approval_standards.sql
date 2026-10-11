-- Run in Supabase SQL Editor after reviewing existing approval workflows.
-- Blocks new approvals when linked reference standards lack valid recorded dates.
create or replace function public.validate_calibration_approval_standards()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare invalid_count integer;
declare linked_count integer;
begin
 if new.approved_at is not null and old.approved_at is null then
  select count(*) into linked_count
  from public.calibration_event_standards ces where ces.calibration_event_id=new.id;
  if linked_count=0 then
   raise exception 'Approval blocked: no reference standard linked to calibration.';
  end if;
  select count(*) into invalid_count
  from public.calibration_event_standards ces
  left join public.standards s on s.id=ces.standard_id
  where ces.calibration_event_id=new.id
    and (s.id is null or s.state::text <> 'active' or s.next_due_date is null
         or s.next_due_date < new.calibration_date
         or (s.calibration_date is not null and s.calibration_date > new.calibration_date));
  if invalid_count>0 then
   raise exception 'Approval blocked: linked reference standard is inactive, overdue, missing a due date, or has inconsistent calibration dates.';
  end if;
 end if;
 return new;
end $$;
revoke all on function public.validate_calibration_approval_standards() from public, anon, authenticated;
drop trigger if exists validate_approval_standards on public.calibration_events;
create trigger validate_approval_standards
before update on public.calibration_events
for each row execute function public.validate_calibration_approval_standards();
