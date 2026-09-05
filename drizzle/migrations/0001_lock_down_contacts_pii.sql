DROP POLICY IF EXISTS "public access contacts" ON public.contacts;

REVOKE ALL ON public.contacts FROM anon;
REVOKE ALL ON public.contacts FROM authenticated;
GRANT ALL ON public.contacts TO service_role;

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;