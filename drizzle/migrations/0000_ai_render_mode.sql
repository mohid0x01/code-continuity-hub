ALTER TABLE public.fir_jobs
  ADD COLUMN IF NOT EXISTS render_mode text NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS ai_video_job_id text,
  ADD COLUMN IF NOT EXISTS ai_video_path text,
  ADD COLUMN IF NOT EXISTS ai_video_error text;