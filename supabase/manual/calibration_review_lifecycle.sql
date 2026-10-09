-- CalDashPro: calibration review lifecycle. Run in Supabase SQL Editor.
-- Existing calibration events are treated as submitted unless previously approved.
ALTER TABLE public.calibration_events
  ADD COLUMN IF NOT EXISTS review_status text,
  ADD COLUMN IF NOT EXISTS review_notes text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id);
UPDATE public.calibration_events SET review_status=CASE WHEN approved_at IS NOT NULL THEN 'approved' ELSE 'submitted' END WHERE review_status IS NULL;
ALTER TABLE public.calibration_events ALTER COLUMN review_status SET DEFAULT 'submitted';
ALTER TABLE public.calibration_events ALTER COLUMN review_status SET NOT NULL;
ALTER TABLE public.calibration_events DROP CONSTRAINT IF EXISTS calibration_events_review_status_check;
ALTER TABLE public.calibration_events ADD CONSTRAINT calibration_events_review_status_check CHECK(review_status IN ('submitted','approved','rejected'));
CREATE INDEX IF NOT EXISTS calibration_events_review_status_idx ON public.calibration_events(review_status);
-- Application-level role checks must be backed by database policies/triggers
-- before this workflow is used for official compliance.