-- Lets a single payment be recorded as multiple splits (e.g. part UPI, part
-- cash) by tagging each payments row with the method used for that portion.
alter table public.payments add column if not exists method text;
