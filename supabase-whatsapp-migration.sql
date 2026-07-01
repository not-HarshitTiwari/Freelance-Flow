-- Adds WhatsApp sending support for invoices and quotes.
-- customer_phone lets us auto-send via the Meta Cloud API when configured;
-- without it (or without WHATSAPP_* env vars) sending falls back to a
-- client-side wa.me link, so this column is optional everywhere it's read.
alter table public.invoices add column if not exists customer_phone text;
alter table public.invoices add column if not exists whatsapp_sent_at timestamptz;

alter table public.quotes add column if not exists customer_phone text;
