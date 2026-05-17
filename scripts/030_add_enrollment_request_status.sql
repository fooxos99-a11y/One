ALTER TABLE public.enrollment_requests
ADD COLUMN IF NOT EXISTS enrollment_status text NOT NULL DEFAULT 'pending';

ALTER TABLE public.enrollment_requests
ADD COLUMN IF NOT EXISTS provisional_notified_at timestamp with time zone;

UPDATE public.enrollment_requests
SET enrollment_status = 'pending'
WHERE enrollment_status IS NULL OR btrim(enrollment_status) = '';