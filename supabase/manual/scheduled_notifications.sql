-- Apply in Supabase SQL Editor to enable scheduled, database-backed reminders.
-- Run as the project administrator. No service-role key is required by this SQL.
CREATE TABLE IF NOT EXISTS public.notification_dispatch_log (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 recipient_id uuid NOT NULL REFERENCES auth.users(id),
 entity_type text NOT NULL,
 entity_id uuid NOT NULL,
 deadline date NOT NULL,
 reminder_type text NOT NULL CHECK(reminder_type IN ('due_soon','critical','overdue')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(recipient_id,entity_type,entity_id,deadline,reminder_type)
);
ALTER TABLE public.notification_dispatch_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_dispatch_log FROM anon,authenticated;
CREATE OR REPLACE FUNCTION public.dispatch_calibration_deadline_notifications()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE item record; person record; n integer:=0; level text; window_days integer;
BEGIN
 IF session_user NOT IN ('postgres','supabase_admin') THEN
   RAISE EXCEPTION 'Restricted to database scheduler';
 END IF;
 FOR person IN SELECT p.id,COALESCE(np.due_soon_days,30) AS warning_days,
  COALESCE(np.critical_days,7) AS critical_days
  FROM public.profiles p LEFT JOIN public.notification_preferences np ON np.user_id=p.id
  WHERE p.active=true AND p.role IN ('admin','manager','technician') AND COALESCE(np.in_app_enabled,true)
 LOOP
  window_days:=GREATEST(0,LEAST(person.warning_days,365));
  FOR item IN
    SELECT 'instrument'::text AS kind,i.id AS entity_id,i.tag_no AS label,i.next_due_date AS deadline
    FROM public.instruments i WHERE i.state='active' AND i.next_due_date IS NOT NULL
    UNION ALL
    SELECT 'certificate'::text,c.id,c.certificate_no,c.expiry_date
    FROM public.certificates c WHERE c.expiry_date IS NOT NULL
  LOOP
   IF item.deadline > CURRENT_DATE+window_days THEN CONTINUE; END IF;
   level:=CASE WHEN item.deadline<CURRENT_DATE THEN 'overdue'
      WHEN item.deadline<=CURRENT_DATE+person.critical_days THEN 'critical'
      ELSE 'due_soon' END;
   INSERT INTO public.notification_dispatch_log(recipient_id,entity_type,entity_id,deadline,reminder_type)
   VALUES(person.id,item.kind,item.entity_id,item.deadline,level)
   ON CONFLICT DO NOTHING;
   IF FOUND THEN
     INSERT INTO public.notifications(recipient_id,type,title,message,entity_type,entity_id)
     VALUES(person.id,level,CASE WHEN item.kind='instrument' THEN 'Calibration deadline' ELSE 'Certificate expiry' END,
      COALESCE(item.label,'Unnumbered certificate')||' — '||item.deadline::text||' ('||level||')',item.kind,item.entity_id);
     n:=n+1;
   END IF;
  END LOOP;
 END LOOP;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.dispatch_calibration_deadline_notifications() FROM PUBLIC,anon,authenticated;
-- Schedule this function daily through Supabase Cron (pg_cron) after review.
-- SELECT public.dispatch_calibration_deadline_notifications();
