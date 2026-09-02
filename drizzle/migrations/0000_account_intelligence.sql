ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS account_owner text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS customer_since date,
  ADD COLUMN IF NOT EXISTS contract_value numeric,
  ADD COLUMN IF NOT EXISTS contract_status text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'Active';

CREATE TABLE IF NOT EXISTS public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  name text NOT NULL,
  designation text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  roles text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO anon, authenticated;
GRANT ALL ON public.contacts TO service_role;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public access contacts" ON public.contacts FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  objective_text text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  success_metric text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.objectives TO anon, authenticated;
GRANT ALL ON public.objectives TO service_role;
ALTER TABLE public.objectives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public access objectives" ON public.objectives FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.pain_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'Other',
  status text NOT NULL DEFAULT 'Open',
  date_raised date NOT NULL DEFAULT current_date,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pain_points TO anon, authenticated;
GRANT ALL ON public.pain_points TO service_role;
ALTER TABLE public.pain_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public access pain_points" ON public.pain_points FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  meeting_date date NOT NULL DEFAULT current_date,
  meeting_type text NOT NULL DEFAULT 'Call',
  participants text NOT NULL DEFAULT '',
  raw_notes text NOT NULL DEFAULT '',
  discussion_summary text NOT NULL DEFAULT '',
  customer_concerns text NOT NULL DEFAULT '',
  decisions text NOT NULL DEFAULT '',
  csm_commitments text NOT NULL DEFAULT '',
  customer_commitments text NOT NULL DEFAULT '',
  follow_up_date date,
  next_meeting_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meetings TO anon, authenticated;
GRANT ALL ON public.meetings TO service_role;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public access meetings" ON public.meetings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.timeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  event_date date NOT NULL DEFAULT current_date,
  event_type text NOT NULL DEFAULT 'Call',
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  related_meeting_id uuid REFERENCES public.meetings(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.timeline_events TO anon, authenticated;
GRANT ALL ON public.timeline_events TO service_role;
ALTER TABLE public.timeline_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public access timeline_events" ON public.timeline_events FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.action_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  action_text text NOT NULL,
  owner text NOT NULL DEFAULT '',
  due_date date,
  status text NOT NULL DEFAULT 'Open',
  source text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.action_items TO anon, authenticated;
GRANT ALL ON public.action_items TO service_role;
ALTER TABLE public.action_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public access action_items" ON public.action_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_contacts_customer ON public.contacts(customer_id);
CREATE INDEX IF NOT EXISTS idx_objectives_customer ON public.objectives(customer_id);
CREATE INDEX IF NOT EXISTS idx_pain_points_customer ON public.pain_points(customer_id);
CREATE INDEX IF NOT EXISTS idx_meetings_customer ON public.meetings(customer_id);
CREATE INDEX IF NOT EXISTS idx_timeline_customer ON public.timeline_events(customer_id);
CREATE INDEX IF NOT EXISTS idx_action_items_customer ON public.action_items(customer_id);