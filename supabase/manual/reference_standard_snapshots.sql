-- Historical reference-standard snapshots for calibration traceability
alter table public.calibration_event_standards
 add column if not exists asset_no_at_use text,
 add column if not exists name_at_use text,
 add column if not exists certificate_no_at_use text,
 add column if not exists calibration_date_at_use date,
 add column if not exists next_due_date_at_use date,
 add column if not exists traceability_reference_at_use text,
 add column if not exists captured_at timestamptz;

create or replace function public.capture_calibration_standard_snapshot()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare s public.standards%rowtype;
begin
 select * into s from public.standards where id=new.standard_id;
 if not found then raise exception 'Reference standard not found'; end if;
 new.asset_no_at_use := s.asset_no;
 new.name_at_use := s.name;
 new.certificate_no_at_use := s.certificate_no;
 new.calibration_date_at_use := s.calibration_date;
 new.next_due_date_at_use := s.next_due_date;
 new.traceability_reference_at_use := s.traceability_reference;
 new.captured_at := now();
 return new;
end $$;
revoke all on function public.capture_calibration_standard_snapshot() from public,anon,authenticated;
drop trigger if exists capture_standard_snapshot on public.calibration_event_standards;
create trigger capture_standard_snapshot before insert on public.calibration_event_standards
for each row execute function public.capture_calibration_standard_snapshot();

-- Existing links have no true historical snapshot; deliberately do not backfill them.
