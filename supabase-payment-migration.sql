-- Add payment and email fields to invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS payment_methods text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS upi_id text,
  ADD COLUMN IF NOT EXISTS bank_account_name text,
  ADD COLUMN IF NOT EXISTS bank_account_number text,
  ADD COLUMN IF NOT EXISTS bank_ifsc text,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS customer_email text;
