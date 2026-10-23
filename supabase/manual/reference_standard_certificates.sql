-- Original certificates issued for reference standards.
create table if not exists public.reference_standard_certificates (
 id uuid primary key default gen_random_uuid(),
 standard_id uuid not null references public.standards(id) on delete restrict,
 certificate_no text not null,
 issuer text,
 issue_date date,
 calibration_date date,
 next_due_date date,
 file_path text,
 notes text,
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 constraint reference_cert_dates_check check (next_due_date is null or calibration_date is null or next_due_date>=calibration_date)
);
create index if not exists reference_standard_certificates_standard_idx on public.reference_standard_certificates(standard_id,created_at desc);
alter table public.reference_standard_certificates enable row level security;
grant select,insert,update on public.reference_standard_certificates to authenticated;
drop policy if exists reference_cert_read on public.reference_standard_certificates;
create policy reference_cert_read on public.reference_standard_certificates for select to authenticated
using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active=true));
drop policy if exists reference_cert_insert on public.reference_standard_certificates;
create policy reference_cert_insert on public.reference_standard_certificates for insert to authenticated
with check (created_by=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active=true and p.role in ('admin','manager')));
drop policy if exists reference_cert_update on public.reference_standard_certificates;
create policy reference_cert_update on public.reference_standard_certificates for update to authenticated
using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active=true and p.role in ('admin','manager')))
with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active=true and p.role in ('admin','manager')));
-- Files are stored in existing private calibration-certificates bucket, using unique paths.
