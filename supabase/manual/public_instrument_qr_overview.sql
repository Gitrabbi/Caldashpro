-- Public QR instrument overview. Only non-sensitive fields are returned.
-- Apply after instrument_qr_labels.sql. No public SELECT policies on instruments.
create or replace function public.get_public_instrument_qr(p_instrument_id uuid)
returns table(
 tag_no text, instrument_name text, manufacturer text, model text,
 engineering_unit text, range_min numeric, range_max numeric,
 accuracy text, area_name text, location_name text, group_name text,
 calibration_status text, next_due_date date
)
language sql stable security definer
set search_path = ''
as $$
 select i.tag_no::text, i.name::text, i.manufacturer::text, i.model::text,
 i.engineering_unit::text, i.range_min::numeric, i.range_max::numeric,
 i.accuracy::text, a.name::text, l.name::text, g.name::text,
 case when i.next_due_date is null then 'Not scheduled'
      when i.next_due_date < current_date then 'Overdue'
      when i.next_due_date <= current_date + 30 then 'Due soon'
      else 'Valid' end::text,
 i.next_due_date::date
 from public.instruments i
 join public.instrument_qr_labels q on q.instrument_id=i.id
 left join public.areas a on a.id=i.area_id
 left join public.locations l on l.id=i.location_id
 left join public.instrument_groups g on g.id=i.instrument_group_id
 where i.id=p_instrument_id and i.state='active'
 limit 1
$$;
revoke all on function public.get_public_instrument_qr(uuid) from public;
grant execute on function public.get_public_instrument_qr(uuid) to anon,authenticated;
-- Security boundary: no anonymous access to calibration events, certificates,
-- serial numbers, notes, personnel records, or instrument editing.
