-- Apply after public_instrument_qr_overview.sql.
-- Replaces the public QR RPC to add last calibration and certificate metadata.
-- Certificate PDFs remain private; no anonymous storage permissions are granted.
begin;
drop function if exists public.get_public_instrument_qr(uuid);
create function public.get_public_instrument_qr(p_instrument_id uuid)
returns table(
 tag_no text, instrument_name text, manufacturer text, model text,
 engineering_unit text, range_min numeric, range_max numeric,
 accuracy text, area_name text, location_name text, group_name text,
 calibration_status text, next_due_date date, last_calibration_date date,
 certificate_no text, certificate_issue_date date, certificate_expiry_date date
)
language sql stable security definer set search_path=''
as $$
 select i.tag_no::text,i.name::text,i.manufacturer::text,i.model::text,
 i.engineering_unit::text,i.range_min::numeric,i.range_max::numeric,
 i.accuracy::text,a.name::text,l.name::text,g.name::text,
 (case when i.next_due_date is null then 'Not scheduled'
 when i.next_due_date<current_date then 'Overdue'
 when i.next_due_date<=current_date+30 then 'Due soon'
 else 'Valid' end)::text,
 i.next_due_date::date,i.last_calibration_date::date,
 cert.certificate_no::text,cert.issue_date::date,cert.expiry_date::date
 from public.instruments i
 join public.instrument_qr_labels q on q.instrument_id=i.id
 left join public.areas a on a.id=i.area_id
 left join public.locations l on l.id=i.location_id
 left join public.instrument_groups g on g.id=i.instrument_group_id
 left join lateral (
 select c.certificate_no,c.issue_date,c.expiry_date
 from public.certificates c where c.instrument_id=i.id
 order by c.issue_date desc nulls last,c.id desc limit 1
 ) cert on true
 where i.id=p_instrument_id and i.state='active'
 limit 1
$$;
revoke all on function public.get_public_instrument_qr(uuid) from public;
grant execute on function public.get_public_instrument_qr(uuid) to anon,authenticated;
commit;
