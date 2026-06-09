
CREATE TABLE public.pipeline_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.fir_jobs(id) ON DELETE CASCADE,
  officer_id UUID NOT NULL,
  stage TEXT NOT NULL,
  model TEXT NOT NULL,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  ok BOOLEAN NOT NULL,
  status_code INTEGER,
  error_message TEXT,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_pipeline_attempts_job_id ON public.pipeline_attempts(job_id);
CREATE INDEX idx_pipeline_attempts_officer ON public.pipeline_attempts(officer_id, created_at DESC);

GRANT SELECT, INSERT ON public.pipeline_attempts TO authenticated;
GRANT ALL ON public.pipeline_attempts TO service_role;

ALTER TABLE public.pipeline_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Officers can view own attempts"
  ON public.pipeline_attempts FOR SELECT
  TO authenticated
  USING (officer_id = auth.uid());

CREATE POLICY "Officers can insert own attempts"
  ON public.pipeline_attempts FOR INSERT
  TO authenticated
  WITH CHECK (officer_id = auth.uid());
