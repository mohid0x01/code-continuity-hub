
-- 1. Role system
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('superadmin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own role" ON public.user_roles;
CREATE POLICY "Users can read their own role"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- has_role security definer
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 2. Case number sequence + generator
CREATE SEQUENCE IF NOT EXISTS public.fir_case_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_case_number()
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  next_val bigint;
BEGIN
  next_val := nextval('public.fir_case_seq');
  RETURN 'FIR-' || to_char(now(), 'YYYY') || '-' || lpad(next_val::text, 6, '0');
END;
$$;

-- Apply default to fir_records.case_number and make unique
ALTER TABLE public.fir_records
  ALTER COLUMN case_number SET DEFAULT public.generate_case_number();

DO $$ BEGIN
  ALTER TABLE public.fir_records ADD CONSTRAINT fir_records_case_number_unique UNIQUE (case_number);
EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; END $$;

-- 3. Location columns
ALTER TABLE public.fir_records
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS area text,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS formatted_address text;

-- 4. Video output columns
ALTER TABLE public.fir_jobs
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS video_status text;

-- 5. Drop officer auto-profile trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- Keep function but make it a no-op (officer model deprecated)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN NEW;
END;
$$;

-- 6. Bootstrap superadmin trigger
CREATE OR REPLACE FUNCTION public.bootstrap_superadmin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email = 'admin@sceneiq.gov.pk' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'superadmin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_bootstrap_admin ON auth.users;
CREATE TRIGGER on_auth_user_bootstrap_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.bootstrap_superadmin();

-- 7. Rebuild RLS policies on existing tables to be superadmin-only
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('fir_records','fir_jobs','scene_entities','scene_events','pipeline_attempts','officer_profiles')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- fir_records
CREATE POLICY "Superadmins manage fir_records" ON public.fir_records
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

-- fir_jobs
CREATE POLICY "Superadmins manage fir_jobs" ON public.fir_jobs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

-- scene_entities
CREATE POLICY "Superadmins manage scene_entities" ON public.scene_entities
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

-- scene_events
CREATE POLICY "Superadmins manage scene_events" ON public.scene_events
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

-- pipeline_attempts
CREATE POLICY "Superadmins manage pipeline_attempts" ON public.pipeline_attempts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

-- officer_profiles (deprecated but keep RLS clean)
CREATE POLICY "Superadmins read officer_profiles" ON public.officer_profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'));
