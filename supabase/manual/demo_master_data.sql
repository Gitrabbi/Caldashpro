-- Phase 1: separate demonstration master-data tables.
-- Apply in the CalDashPro production project's SQL editor; does not copy or delete live data.
create table if not exists public.demo_areas (id uuid primary key default gen_random_uuid(),name text not null unique,active boolean not null default true);
create table if not exists public.demo_instrument_groups (id uuid primary key default gen_random_uuid(),name text not null unique,active boolean not null default true);
create table if not exists public.demo_locations (id uuid primary key default gen_random_uuid(),name text not null,area_id uuid not null references public.demo_areas(id),active boolean not null default true,unique(area_id,name));
create table if not exists public.demo_instruments (
 id uuid primary key default gen_random_uuid(),
 tag_no text not null unique,
 name text not null,
 serial_no text,
 area_id uuid references public.demo_areas(id),
 location_id uuid references public.demo_locations(id),
 instrument_group_id uuid references public.demo_instrument_groups(id),
 next_due_date date,
 last_calibration_date date,
 notes text,
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now()
);
-- Separate demonstration records are not accessible to anonymous users.
alter table public.demo_areas enable row level security;
alter table public.demo_locations enable row level security;
alter table public.demo_instrument_groups enable row level security;
alter table public.demo_instruments enable row level security;
-- Authenticated members can inspect demo master data. Writes are restricted to admins/managers.
create policy demo_areas_read on public.demo_areas for select to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active));
create policy demo_locations_read on public.demo_locations for select to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active));
create policy demo_groups_read on public.demo_instrument_groups for select to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active));
create policy demo_instruments_read on public.demo_instruments for select to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active));
create policy demo_areas_write on public.demo_areas for all to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('admin','manager'))) with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('admin','manager')));
create policy demo_locations_write on public.demo_locations for all to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('admin','manager'))) with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('admin','manager')));
create policy demo_groups_write on public.demo_instrument_groups for all to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('admin','manager'))) with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('admin','manager')));
create policy demo_instruments_write on public.demo_instruments for all to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('admin','manager'))) with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('admin','manager')));
grant select,insert,update,delete on public.demo_areas,public.demo_locations,public.demo_instrument_groups,public.demo_instruments to authenticated;
