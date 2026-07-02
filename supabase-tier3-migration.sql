-- Tier 3: Discounts, TDS, Proforma invoices, VAT, P&L

-- invoices: new columns
alter table public.invoices
  add column if not exists invoice_type text not null default 'invoice',
  add column if not exists tds_pct numeric not null default 0,
  add column if not exists tds_amount numeric not null default 0,
  add column if not exists vat_rate numeric not null default 0,
  add column if not exists vat_amount numeric not null default 0;

-- quotes: VAT support
alter table public.quotes
  add column if not exists vat_rate numeric not null default 0,
  add column if not exists vat_amount numeric not null default 0;

-- item-level discount_pct lives inside the items JSONB — no column needed.
