-- Add extra fields to invoices table
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS invoice_date date DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS gst_type text DEFAULT 'cgst_sgst', -- 'cgst_sgst' | 'igst'
  ADD COLUMN IF NOT EXISTS gst_rate numeric(5,2) DEFAULT 18,
  ADD COLUMN IF NOT EXISTS cgst numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sgst numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS igst numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS transaction_id text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS terms text,
  -- Seller details
  ADD COLUMN IF NOT EXISTS seller_name text,
  ADD COLUMN IF NOT EXISTS seller_address text,
  ADD COLUMN IF NOT EXISTS seller_email text,
  ADD COLUMN IF NOT EXISTS seller_phone text,
  ADD COLUMN IF NOT EXISTS seller_gstin text,
  -- Customer details
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS customer_company text,
  ADD COLUMN IF NOT EXISTS customer_address text,
  ADD COLUMN IF NOT EXISTS customer_gstin text;

-- Add business info to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS business_address text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS gstin text;
