-- Run once in Supabase SQL Editor to enable the daily notification job.
-- Supabase pg_cron schedules use UTC unless configured otherwise.
SELECT cron.schedule(
 'caldashpro-daily-deadline-reminders',
 '30 6 * * *',
 $$SELECT public.dispatch_calibration_deadline_notifications();$$
);
-- Inspect cron.job to confirm the schedule is active.
