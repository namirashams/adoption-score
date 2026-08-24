
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO anon, authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public access companies" ON public.companies FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_core BOOLEAN NOT NULL DEFAULT false,
  module TEXT NOT NULL DEFAULT 'General',
  expected_monthly_usage NUMERIC NOT NULL DEFAULT 4,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.features TO anon, authenticated;
GRANT ALL ON public.features TO service_role;
ALTER TABLE public.features ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public access features" ON public.features FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  industry TEXT NOT NULL DEFAULT '',
  customer_type TEXT NOT NULL DEFAULT '',
  size TEXT NOT NULL DEFAULT '',
  plan TEXT NOT NULL DEFAULT '',
  business_objectives TEXT NOT NULL DEFAULT '',
  pain_points TEXT NOT NULL DEFAULT '',
  use_cases TEXT NOT NULL DEFAULT '',
  renewal_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO anon, authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public access customers" ON public.customers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.customer_features (
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  feature_id UUID NOT NULL REFERENCES public.features(id) ON DELETE CASCADE,
  PRIMARY KEY (customer_id, feature_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_features TO anon, authenticated;
GRANT ALL ON public.customer_features TO service_role;
ALTER TABLE public.customer_features ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public access customer_features" ON public.customer_features FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.usage (
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  feature_id UUID NOT NULL REFERENCES public.features(id) ON DELETE CASCADE,
  current_month NUMERIC NOT NULL DEFAULT 0,
  prev_month NUMERIC NOT NULL DEFAULT 0,
  three_month NUMERIC NOT NULL DEFAULT 0,
  six_month NUMERIC NOT NULL DEFAULT 0,
  PRIMARY KEY (customer_id, feature_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.usage TO anon, authenticated;
GRANT ALL ON public.usage TO service_role;
ALTER TABLE public.usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public access usage" ON public.usage FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.customer_login_stats (
  customer_id UUID PRIMARY KEY REFERENCES public.customers(id) ON DELETE CASCADE,
  login_days_current NUMERIC NOT NULL DEFAULT 0,
  login_days_prev NUMERIC NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_login_stats TO anon, authenticated;
GRANT ALL ON public.customer_login_stats TO service_role;
ALTER TABLE public.customer_login_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public access customer_login_stats" ON public.customer_login_stats FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.ai_recommendations (
  customer_id UUID PRIMARY KEY REFERENCES public.customers(id) ON DELETE CASCADE,
  opportunities JSONB NOT NULL DEFAULT '[]'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_recommendations TO anon, authenticated;
GRANT ALL ON public.ai_recommendations TO service_role;
ALTER TABLE public.ai_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public access ai_recommendations" ON public.ai_recommendations FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
