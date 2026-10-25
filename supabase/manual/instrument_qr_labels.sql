-- CalDashPro Live QR label registry. Run once in the production Supabase SQL editor.
-- QR destination is derived from immutable instrument UUID; no QR image files need storing.
create table if not exists public.instrument_qr_labels (
 instrument_id uuid primary key references public.instruments(id) on delete cascade,
 generated_at timestamptz not null default now(),
 printed_at timestamptz,
 printed_by uuid references auth.users(id),
 print_count integer not null default 0 check(print_count>=0)
);
alter table public.instrument_qr_labels enable row level security;
drop policy if exists instrument_qr_labels_read on public.instrument_qr_labels;
create policy instrument_qr_labels_read on public.instrument_qr_labels
for select to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active));
drop policy if exists instrument_qr_labels_write on public.instrument_qr_labels;
create policy instrument_qr_labels_write on public.instrument_qr_labels
for update to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('admin','manager'))) with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('admin','manager')));
grant select,update on public.instrument_qr_labels to authenticated;
-- Existing instruments receive QR registry entries without changing instrument records.
insert into public.instrument_qr_labels(instrument_id)
select id from public.instruments on conflict(instrument_id) do nothing;
-- New instruments (including imports) automatically receive QR registry entries.
create or replace function public.register_instrument_qr_label()
returns trigger language plpgsql security definer set search_path=public
as $$begin
 insert into public.instrument_qr_labels(instrument_id) values(new.id) on conflict(instrument_id) do nothing;
 return new;
end$$;
drop trigger if exists instrument_qr_label_after_insert on public.instruments;
create trigger instrument_qr_label_after_insert after insert on public.instruments
for each row execute function public.register_instrument_qr_label();
-- Only authorized roles can mark a label printed; recorded after download/print initiation.
create or replace function public.mark_instrument_qr_printed(p_instrument_ids uuid[])
returns integer language plpgsql security invoker set search_path=public
as $$
declare n integer;
begin
 if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.active and p.role in ('admin','manager')) then
   raise exception 'Not authorized to mark QR labels printed';
 end if;
 update public.instrument_qr_labels
 set printed_at=now(),printed_by=auth.uid(),print_count=print_count+1
 where instrument_id=any(p_instrument_ids);
 get diagnostics n=row_count;
 return n;
end$$;
grant execute on function public.mark_instrument_qr_printed(uuid[]) to authenticated;
