CREATE TABLE public.customer_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  insight TEXT NOT NULL DEFAULT '',
  reasoning TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_insights TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_insights TO authenticated;
GRANT ALL ON public.customer_insights TO service_role;

ALTER TABLE public.customer_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Single-user tool: full access to customer_insights"
ON public.customer_insights FOR ALL
USING (true) WITH CHECK (true);

CREATE INDEX idx_customer_insights_customer_created
ON public.customer_insights (customer_id, created_at DESC);