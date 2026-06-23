-- Users profile (auto-created on signup)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  email text,
  business_name text,
  plan text default 'free', -- 'free' | 'pro'
  razorpay_subscription_id text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Clients
create table public.clients (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  email text not null,
  phone text,
  company text,
  created_at timestamptz default now()
);

alter table public.clients enable row level security;
create policy "Users manage own clients" on public.clients for all using (auth.uid() = user_id);

-- Proposals
create table public.proposals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  client_id uuid references public.clients on delete set null,
  title text not null,
  content text not null,
  status text default 'draft', -- 'draft' | 'sent' | 'accepted' | 'rejected'
  amount numeric(10,2),
  created_at timestamptz default now()
);

alter table public.proposals enable row level security;
create policy "Users manage own proposals" on public.proposals for all using (auth.uid() = user_id);

-- Invoices
create table public.invoices (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  client_id uuid references public.clients on delete set null,
  invoice_number text not null,
  items jsonb not null default '[]',
  subtotal numeric(10,2) not null,
  tax numeric(10,2) default 0,
  total numeric(10,2) not null,
  status text default 'unpaid', -- 'unpaid' | 'paid' | 'overdue'
  due_date date,
  created_at timestamptz default now()
);

alter table public.invoices enable row level security;
create policy "Users manage own invoices" on public.invoices for all using (auth.uid() = user_id);
