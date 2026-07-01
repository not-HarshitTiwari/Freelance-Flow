-- Credit notes reduce a specific invoice's outstanding balance (e.g. for a
-- return or billing error) without editing the original invoice. Issuing one
-- writes a row to the existing payments table so amount_paid/status and the
-- client ledger stay accurate without any other reads needing to know about
-- credit notes specifically.
create table public.credit_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  credit_note_number text not null,
  reason text,
  amount numeric not null check (amount > 0),
  created_at timestamptz not null default now()
);

alter table public.credit_notes enable row level security;

create policy "Workspace manage credit_notes" on public.credit_notes
  for all using (user_id = public.workspace_owner(auth.uid()))
  with check (user_id = public.workspace_owner(auth.uid()));

create index credit_notes_invoice_id_idx on public.credit_notes (invoice_id);
create index credit_notes_user_id_idx on public.credit_notes (user_id);
