
-- Audit log
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "superadmin_select_audit" ON public.audit_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "superadmin_insert_audit" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'superadmin'));
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_actor ON public.audit_logs(actor_id);

-- Evidence files
CREATE TABLE public.evidence_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fir_id uuid NOT NULL REFERENCES public.fir_records(id) ON DELETE CASCADE,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL,
  mime_type text,
  file_size bigint,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evidence_files TO authenticated;
GRANT ALL ON public.evidence_files TO service_role;
ALTER TABLE public.evidence_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "superadmin_all_evidence" ON public.evidence_files FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'superadmin')) WITH CHECK (public.has_role(auth.uid(), 'superadmin'));
CREATE INDEX idx_evidence_fir ON public.evidence_files(fir_id);

-- Storage policies for evidence bucket (bucket created separately)
CREATE POLICY "superadmin_evidence_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'evidence' AND public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "superadmin_evidence_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'evidence' AND public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "superadmin_evidence_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'evidence' AND public.has_role(auth.uid(), 'superadmin'));
