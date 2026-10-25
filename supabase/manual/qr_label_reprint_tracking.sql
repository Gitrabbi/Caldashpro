-- Track exactly which name/tag were last printed on each physical QR label.
-- Existing labels without snapshots are treated as needing printing.
alter table public.instrument_qr_labels
 add column if not exists printed_tag_no text,
 add column if not exists printed_instrument_name text;
create or replace function public.mark_instrument_qr_printed(p_instrument_ids uuid[])
returns integer language plpgsql security invoker set search_path=public
as $$
declare n integer;
begin
 if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.active and p.role in ('admin','manager')) then
 raise exception 'Not authorized to mark QR labels printed';
 end if;
 update public.instrument_qr_labels q
 set printed_at=now(),printed_by=auth.uid(),print_count=q.print_count+1,
 printed_tag_no=i.tag_no,printed_instrument_name=i.name
 from public.instruments i
 where q.instrument_id=i.id and i.id=any(p_instrument_ids);
 get diagnostics n=row_count;
 return n;
end$$;
grant execute on function public.mark_instrument_qr_printed(uuid[]) to authenticated;
