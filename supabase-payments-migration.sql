-- Records structured, queryable payment history against invoices.
-- Previously a payment was only ever logged as a free-text line appended to
-- invoices.payment_note — fine for display on one invoice, but impossible to
-- list/aggregate across all invoices. This table is additive: the existing
-- payment_note/amount_paid/status fields on invoices are untouched.
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  amount numeric not null check (amount > 0),
  note text,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.payments enable row level security;

create policy "Workspace manage payments" on public.payments
  for all using (user_id = public.workspace_owner(auth.uid()))
  with check (user_id = public.workspace_owner(auth.uid()));

create index payments_invoice_id_idx on public.payments (invoice_id);
create index payments_user_id_paid_at_idx on public.payments (user_id, paid_at desc);
