-- CalDashPro audit trail. Run once in Supabase SQL Editor.
create table if not exists public.calibration_audit_log (
 id bigint generated always as identity primary key,
 table_name text not null,
 record_id uuid not null,
 operation text not null check (operation in ('INSERT','UPDATE','DELETE')),
 actor_id uuid,
 occurred_at timestamptz not null default now(),
 before_data jsonb,
 after_data jsonb
);
create index if not exists calibration_audit_log_record_idx on public.calibration_audit_log(table_name,record_id,occurred_at desc);
create index if not exists calibration_audit_log_occurred_idx on public.calibration_audit_log(occurred_at desc);
alter table public.calibration_audit_log enable row level security;
revoke all on public.calibration_audit_log from anon,authenticated;
grant select on public.calibration_audit_log to authenticated;
drop policy if exists calibration_audit_log_read on public.calibration_audit_log;
create policy calibration_audit_log_read on public.calibration_audit_log for select to authenticated
using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.active=true));
create or replace function public.record_calibration_audit() returns trigger language plpgsql security definer set search_path = '' as $$
declare actor uuid;
begin
 actor := auth.uid();
 if tg_op='INSERT' then
  insert into public.calibration_audit_log(table_name,record_id,operation,actor_id,after_data)
  values(tg_table_name,new.id,tg_op,actor,to_jsonb(new));
  return new;
 elsif tg_op='UPDATE' then
  if to_jsonb(old) is distinct from to_jsonb(new) then
   insert into public.calibration_audit_log(table_name,record_id,operation,actor_id,before_data,after_data)
   values(tg_table_name,new.id,tg_op,actor,to_jsonb(old),to_jsonb(new));
  end if;
  return new;
 else
  insert into public.calibration_audit_log(table_name,record_id,operation,actor_id,before_data)
  values(tg_table_name,old.id,tg_op,actor,to_jsonb(old));
  return old;
 end if;
end $$;
revoke all on function public.record_calibration_audit() from public,anon,authenticated;
do $$
declare tbl text;
begin
 foreach tbl in array array['instruments','calibration_events','calibration_requests','certificates'] loop
  if to_regclass('public.'||tbl) is not null then
   execute format('drop trigger if exists audit_changes on public.%I',tbl);
   execute format('create trigger audit_changes after insert or update or delete on public.%I for each row execute function public.record_calibration_audit()',tbl);
  end if;
 end loop;
end $$;
-- Audit entries are append-only for application users; service-role/database administrators retain privileged access.
