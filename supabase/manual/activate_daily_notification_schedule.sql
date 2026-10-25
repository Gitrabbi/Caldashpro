-- Apply after scheduled_notifications.sql and the existing notification tables/preferences.
-- Daily at 07:00 UTC. Requires pg_cron extension enabled in Supabase.
create extension if not exists pg_cron with schema pg_catalog;
do $$
declare existing_job bigint;
begin
 select jobid into existing_job from cron.job where jobname='caldashpro-daily-notifications';
 if existing_job is not null then
  perform cron.unschedule(existing_job);
 end if;
 perform cron.schedule('caldashpro-daily-notifications','0 7 * * *',
  'select public.dispatch_calibration_deadline_notifications();');
end $$;
-- Check: select jobid,jobname,schedule,active from cron.job where jobname='caldashpro-daily-notifications';
