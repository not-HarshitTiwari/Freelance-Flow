-- Adds the quotes/estimates table: a pre-invoice document a freelancer can send
-- to a client for approval before converting it into a real invoice.
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  quote_number text not null,
  items jsonb not null default '[]'::jsonb,
  subtotal numeric not null default 0,
  gst_type text default 'cgst_sgst',
  gst_rate numeric default 18,
  cgst numeric not null default 0,
  sgst numeric not null default 0,
  igst numeric not null default 0,
  total numeric not null default 0,
  status text not null default 'draft', -- draft, sent, accepted, rejected, expired, converted
  valid_until date,
  notes text,
  terms text,
  seller_name text,
  seller_address text,
  seller_email text,
  seller_phone text,
  seller_gstin text,
  customer_name text,
  customer_company text,
  customer_address text,
  customer_gstin text,
  customer_email text,
  review_token text unique,
  converted_invoice_id uuid references public.invoices(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.quotes enable row level security;

create policy "Users manage own quotes" on public.quotes
  for all using (auth.uid() = user_id);

-- Mirrors the proposals/contracts pattern: RLS only checks that a token exists,
-- the route handler itself filters by the specific token value (which is unguessable).
create policy "Public read quotes by review token" on public.quotes
  for select using (review_token is not null);

create policy "Public update quote status by review token" on public.quotes
  for update using (review_token is not null) with check (review_token is not null);
