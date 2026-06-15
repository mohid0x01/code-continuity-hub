
-- Add search_path to generate_case_number
CREATE OR REPLACE FUNCTION public.generate_case_number()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  next_val bigint;
BEGIN
  next_val := nextval('public.fir_case_seq');
  RETURN 'FIR-' || to_char(now(), 'YYYY') || '-' || lpad(next_val::text, 6, '0');
END;
$$;

-- Revoke public/anon/authenticated execute on internal helpers
REVOKE EXECUTE ON FUNCTION public.generate_case_number() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bootstrap_superadmin() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- has_role: only authenticated needs it (RLS calls it)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
