ALTER TABLE public.features ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'Core';
ALTER TABLE public.features ADD COLUMN IF NOT EXISTS is_expansion boolean NOT NULL DEFAULT false;
ALTER TABLE public.features ADD CONSTRAINT features_category_check CHECK (category IN ('Core','Advanced','Add-on'));