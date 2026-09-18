CREATE TABLE public.customer_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL DEFAULT 'Other',
  date_noticed DATE NOT NULL DEFAULT CURRENT_DATE,
  raw_text TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  interpretation TEXT NOT NULL DEFAULT '',
  interpreted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_signals TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_signals TO authenticated;
GRANT ALL ON public.customer_signals TO service_role;

ALTER TABLE public.customer_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public access customer_signals" ON public.customer_signals
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_customer_signals_customer ON public.customer_signals (customer_id, date_noticed DESC);