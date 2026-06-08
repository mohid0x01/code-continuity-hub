
CREATE TYPE public.incident_type AS ENUM ('theft', 'assault', 'vehicular', 'property', 'kidnapping', 'robbery', 'other');
CREATE TYPE public.job_status AS ENUM ('pending', 'preprocessing', 'entity_extraction', 'spatial_resolution', 'timeline_sequencing', 'scene_generation', 'completed', 'failed');
CREATE TYPE public.entity_role AS ENUM ('suspect', 'victim', 'witness', 'bystander');
CREATE TYPE public.entity_type AS ENUM ('actor', 'vehicle', 'location', 'object');

CREATE TABLE public.officer_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  badge_number TEXT NOT NULL UNIQUE,
  rank TEXT DEFAULT 'ASI',
  district TEXT NOT NULL,
  station TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.officer_profiles TO authenticated;
GRANT ALL ON public.officer_profiles TO service_role;
ALTER TABLE public.officer_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Officers can read own profile" ON public.officer_profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Officers can update own profile" ON public.officer_profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.officer_profiles (id, full_name, badge_number, district)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'Officer'),
    COALESCE(NEW.raw_user_meta_data ->> 'badge_number', 'BADGE-' || LEFT(NEW.id::text, 8)),
    COALESCE(NEW.raw_user_meta_data ->> 'district', 'Khairpur')
  );
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.fir_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  officer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  case_number TEXT NOT NULL,
  district TEXT NOT NULL,
  incident_date DATE,
  incident_type public.incident_type NOT NULL DEFAULT 'other',
  raw_narrative TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fir_records TO authenticated;
GRANT ALL ON public.fir_records TO service_role;
ALTER TABLE public.fir_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Officers can read own FIRs" ON public.fir_records FOR SELECT TO authenticated USING (auth.uid() = officer_id);
CREATE POLICY "Officers can insert FIRs" ON public.fir_records FOR INSERT TO authenticated WITH CHECK (auth.uid() = officer_id);

CREATE TABLE public.fir_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fir_id UUID NOT NULL REFERENCES public.fir_records(id) ON DELETE CASCADE,
  officer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.job_status NOT NULL DEFAULT 'pending',
  pipeline_progress JSONB DEFAULT '{}',
  scene_manifest JSONB,
  llm_model TEXT DEFAULT 'google/gemini-2.5-flash',
  processing_time_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fir_jobs TO authenticated;
GRANT ALL ON public.fir_jobs TO service_role;
ALTER TABLE public.fir_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Officers can read own jobs" ON public.fir_jobs FOR SELECT TO authenticated USING (auth.uid() = officer_id);
CREATE POLICY "Officers can insert jobs" ON public.fir_jobs FOR INSERT TO authenticated WITH CHECK (auth.uid() = officer_id);
CREATE POLICY "Officers can update own jobs" ON public.fir_jobs FOR UPDATE TO authenticated USING (auth.uid() = officer_id);
ALTER PUBLICATION supabase_realtime ADD TABLE public.fir_jobs;

CREATE TABLE public.scene_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.fir_jobs(id) ON DELETE CASCADE,
  entity_type public.entity_type NOT NULL,
  entity_role public.entity_role,
  label TEXT NOT NULL,
  description TEXT,
  color TEXT,
  confidence REAL DEFAULT 0.0,
  position_x REAL DEFAULT 0.0,
  position_y REAL DEFAULT 0.0,
  position_z REAL DEFAULT 0.0,
  metadata JSONB DEFAULT '{}',
  source_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scene_entities TO authenticated;
GRANT ALL ON public.scene_entities TO service_role;
ALTER TABLE public.scene_entities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Officers can read entities via job" ON public.scene_entities FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.fir_jobs WHERE fir_jobs.id = scene_entities.job_id AND fir_jobs.officer_id = auth.uid()));
CREATE POLICY "Officers can insert entities via job" ON public.scene_entities FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.fir_jobs WHERE fir_jobs.id = scene_entities.job_id AND fir_jobs.officer_id = auth.uid()));
CREATE POLICY "Officers can delete entities via job" ON public.scene_entities FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.fir_jobs WHERE fir_jobs.id = scene_entities.job_id AND fir_jobs.officer_id = auth.uid()));

CREATE TABLE public.scene_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.fir_jobs(id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL,
  entity_id UUID REFERENCES public.scene_entities(id) ON DELETE SET NULL,
  action_label TEXT NOT NULL,
  description TEXT NOT NULL,
  origin_x REAL DEFAULT 0.0,
  origin_y REAL DEFAULT 0.0,
  origin_z REAL DEFAULT 0.0,
  dest_x REAL DEFAULT 0.0,
  dest_y REAL DEFAULT 0.0,
  dest_z REAL DEFAULT 0.0,
  duration_seconds REAL DEFAULT 2.0,
  source_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scene_events TO authenticated;
GRANT ALL ON public.scene_events TO service_role;
ALTER TABLE public.scene_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Officers can read events via job" ON public.scene_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.fir_jobs WHERE fir_jobs.id = scene_events.job_id AND fir_jobs.officer_id = auth.uid()));
CREATE POLICY "Officers can insert events via job" ON public.scene_events FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.fir_jobs WHERE fir_jobs.id = scene_events.job_id AND fir_jobs.officer_id = auth.uid()));
CREATE POLICY "Officers can delete events via job" ON public.scene_events FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.fir_jobs WHERE fir_jobs.id = scene_events.job_id AND fir_jobs.officer_id = auth.uid()));

CREATE INDEX idx_fir_records_officer ON public.fir_records(officer_id);
CREATE INDEX idx_fir_jobs_fir ON public.fir_jobs(fir_id);
CREATE INDEX idx_fir_jobs_officer ON public.fir_jobs(officer_id);
CREATE INDEX idx_fir_jobs_status ON public.fir_jobs(status);
CREATE INDEX idx_scene_entities_job ON public.scene_entities(job_id);
CREATE INDEX idx_scene_events_job ON public.scene_events(job_id);
CREATE INDEX idx_scene_events_sequence ON public.scene_events(job_id, sequence_number);
