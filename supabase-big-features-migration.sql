-- 1. Expenses table
CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  amount numeric(12,2) NOT NULL,
  category text NOT NULL DEFAULT 'Other',
  date date NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own expenses" ON public.expenses USING (auth.uid() = user_id);

-- 2. Client portals table
CREATE TABLE IF NOT EXISTS public.client_portals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL UNIQUE,
  token text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.client_portals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own portals" ON public.client_portals USING (auth.uid() = user_id);
-- Allow public read by token (for portal page)
CREATE POLICY "Public read portal by token" ON public.client_portals FOR SELECT USING (true);

-- 3. Proposal review token
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS review_token text UNIQUE;

-- 4. Recurring invoice fields
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_interval text DEFAULT 'monthly', -- weekly / monthly / quarterly
  ADD COLUMN IF NOT EXISTS next_invoice_date date,
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;
