-- Run AFTER supabase/manual/demo_master_data.sql.
-- Isolated demo workflow: all foreign keys remain inside demo tables.
create table if not exists public.demo_calibration_requests (
 id uuid primary key default gen_random_uuid(),
 instrument_id uuid not null references public.demo_instruments(id) on delete restrict,
 due_date date, status text not null default 'open' check(status in ('open','assigned','submitted','completed','cancelled')),
 notes text, created_by uuid references auth.users(id),
 created_at timestamptz not null default now()
);
create table if not exists public.demo_calibration_events (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references public.demo_calibration_requests(id) on delete restrict,
 instrument_id uuid not null references public.demo_instruments(id) on delete restrict,
 calibration_date date not null,
 result text not null check(result in ('pass','fail','adjusted')),
 as_found_summary text, as_left_summary text,
 review_status text not null default 'submitted' check(review_status in ('submitted','approved','rejected')),
 reviewed_by uuid references auth.users(id), reviewed_at timestamptz,
 created_by uuid references auth.users(id), created_at timestamptz not null default now(),
 unique(request_id)
);
create table if not exists public.demo_calibration_measurement_points (
 id uuid primary key default gen_random_uuid(),
 calibration_event_id uuid not null references public.demo_calibration_events(id) on delete cascade,
 point_key text not null,
 nominal_value numeric not null,
 as_found_value numeric not null,
 as_left_value numeric,
 tolerance_minus numeric,
 tolerance_plus numeric,
 engineering_unit text,
 unique(calibration_event_id,point_key)
);
do $$
declare t text;
begin
 foreach t in array array['demo_calibration_requests','demo_calibration_events','demo_calibration_measurement_points'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy %I on public.%I for select to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active))',t||'_read',t);
  execute format('create policy %I on public.%I for insert to authenticated with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in (''admin'',''manager'',''technician'')))',t||'_insert',t);
  execute format('create policy %I on public.%I for update to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in (''admin'',''manager''))) with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in (''admin'',''manager'')))',t||'_update',t);
  execute format('grant select,insert,update on public.%I to authenticated',t);
 end loop;
end $$;
