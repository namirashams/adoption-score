ALTER TABLE public.customer_features ADD COLUMN IF NOT EXISTS is_core_for_customer boolean NOT NULL DEFAULT false;

UPDATE public.customer_features cf
SET is_core_for_customer = f.is_core
FROM public.features f
WHERE f.id = cf.feature_id;