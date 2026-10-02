ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS framework_type text NOT NULL DEFAULT 'product_adoption';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS config jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE TABLE IF NOT EXISTS public.customer_metric_values (
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  metric_key text NOT NULL,
  current_value numeric,
  prev_value numeric,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (customer_id, metric_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_metric_values TO anon, authenticated;
GRANT ALL ON public.customer_metric_values TO service_role;
ALTER TABLE public.customer_metric_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public access customer_metric_values" ON public.customer_metric_values FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);