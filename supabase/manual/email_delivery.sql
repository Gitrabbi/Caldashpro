-- CalDashPro email delivery idempotency ledger. Run in Supabase SQL Editor.
create table if not exists public.notification_email_deliveries (
 notification_id uuid primary key references public.notifications(id) on delete cascade,
 recipient_id uuid not null references auth.users(id),
 status text not null default 'pending' check (status in ('pending','sent','failed')),
 provider_id text,
 last_error text,
 attempted_at timestamptz not null default now(),
 sent_at timestamptz
);
alter table public.notification_email_deliveries enable row level security;
revoke all on public.notification_email_deliveries from anon,authenticated;
-- Only the service role can access this table through the API.
