-- Products & Services catalog (reusable line items for invoices)
CREATE TABLE IF NOT EXISTS public.products_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  type text NOT NULL DEFAULT 'service', -- 'product' | 'service'
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  unit text DEFAULT 'unit',
  hsn_code text,
  track_inventory boolean NOT NULL DEFAULT false,
  quantity numeric(12,2),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.products_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own products_services" ON public.products_services USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS products_services_user_id_name_idx ON public.products_services (user_id, name);

-- Atomically reduce stock when a tracked product is used on an invoice.
-- Runs under the caller's RLS, so it only ever touches the caller's own rows.
CREATE OR REPLACE FUNCTION public.decrement_product_stock(p_id uuid, qty numeric)
RETURNS void AS $$
  UPDATE public.products_services
  SET quantity = quantity - qty, updated_at = now()
  WHERE id = p_id AND track_inventory = true;
$$ LANGUAGE sql;
