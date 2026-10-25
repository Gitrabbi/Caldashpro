-- Explicit publication of individual certificate PDFs on anonymous QR pages.
-- Private storage remains private; only approved/opted-in certificates can be streamed.
alter table public.certificates add column if not exists public_qr_enabled boolean not null default false;
create index if not exists certificates_public_qr_idx on public.certificates(instrument_id,issue_date desc)
where public_qr_enabled=true and file_path is not null;
-- Existing certificates are PRIVATE until explicitly approved for public QR access.
-- Only authorized managers should change public_qr_enabled (enforce with existing certificates UPDATE RLS).
