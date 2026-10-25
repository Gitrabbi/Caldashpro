-- Public QR PDF eligibility check; only returns approved published certificate ID.
create or replace function public.get_public_qr_certificate(p_instrument_id uuid)
returns table(certificate_id uuid,certificate_no text)
language sql stable security definer set search_path=''
as $$
 select c.id,c.certificate_no::text
 from public.certificates c
 join public.instruments i on i.id=c.instrument_id
 join public.instrument_qr_labels q on q.instrument_id=i.id
 left join public.calibration_events e on e.id=c.calibration_event_id
 where i.id=p_instrument_id and i.state='active'
 and c.public_qr_enabled=true
 and c.file_path is not null
 and (c.calibration_event_id is null or e.approved_at is not null)
 order by c.issue_date desc nulls last,c.id desc limit 1
$$;
revoke all on function public.get_public_qr_certificate(uuid) from public;
grant execute on function public.get_public_qr_certificate(uuid) to anon,authenticated;
