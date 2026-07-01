-- ============================================================
-- Team / multi-seat accounts migration
-- ============================================================

-- 0. Ensure pgcrypto is available for gen_random_bytes
create extension if not exists pgcrypto;

-- 1. team_members table (create first — referenced by workspace_owner function)
create table if not exists public.team_members (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  member_email  text not null,
  member_id     uuid references public.profiles(id) on delete cascade,
  status        text not null default 'pending'
                  check (status in ('pending', 'accepted', 'removed')),
  invite_token  text unique not null default encode(gen_random_bytes(32), 'hex'),
  invited_at    timestamptz not null default now(),
  accepted_at   timestamptz,
  unique(owner_id, member_email)
);

alter table public.team_members enable row level security;

drop policy if exists "Team owner manages members" on public.team_members;
create policy "Team owner manages members" on public.team_members
  for all using (owner_id = auth.uid());

drop policy if exists "Team member reads own row" on public.team_members;
create policy "Team member reads own row" on public.team_members
  for select using (member_id = auth.uid());

-- 2. workspace_owner(): returns the workspace owner uid for a given uid.
--    For regular users (not team members) it returns uid unchanged.
--    For accepted team members it returns the owner's uid.
create or replace function public.workspace_owner(uid uuid)
returns uuid
language sql stable security definer
set search_path = public
as $$
  select coalesce(
    (select owner_id from public.team_members
     where member_id = uid and status = 'accepted' limit 1),
    uid
  );
$$;

-- 3. Allow team members to read their workspace owner's profile
--    (additive — existing "Users can view own profile" remains)
drop policy if exists "Team member reads workspace owner profile" on public.profiles;
create policy "Team member reads workspace owner profile" on public.profiles
  for select using (id = public.workspace_owner(auth.uid()));

-- 4. Rewrite workspace-data RLS policies to use workspace_owner()
--    This makes sharing transparent: owners + accepted members share the same workspace.

-- clients
drop policy if exists "Users manage own clients" on public.clients;
create policy "Workspace manage clients" on public.clients
  for all using (user_id = public.workspace_owner(auth.uid()))
  with check (user_id = public.workspace_owner(auth.uid()));

-- proposals
drop policy if exists "Users manage own proposals" on public.proposals;
create policy "Workspace manage proposals" on public.proposals
  for all using (user_id = public.workspace_owner(auth.uid()))
  with check (user_id = public.workspace_owner(auth.uid()));

-- invoices
drop policy if exists "Users manage own invoices" on public.invoices;
create policy "Workspace manage invoices" on public.invoices
  for all using (user_id = public.workspace_owner(auth.uid()))
  with check (user_id = public.workspace_owner(auth.uid()));

-- expenses
drop policy if exists "Users manage own expenses" on public.expenses;
create policy "Workspace manage expenses" on public.expenses
  for all using (user_id = public.workspace_owner(auth.uid()))
  with check (user_id = public.workspace_owner(auth.uid()));

-- products_services
drop policy if exists "Users manage own products_services" on public.products_services;
create policy "Workspace manage products_services" on public.products_services
  for all using (user_id = public.workspace_owner(auth.uid()))
  with check (user_id = public.workspace_owner(auth.uid()));

-- quotes (public-token policies "Public read/update quotes by review token" are unchanged)
drop policy if exists "Users manage own quotes" on public.quotes;
create policy "Workspace manage quotes" on public.quotes
  for all using (user_id = public.workspace_owner(auth.uid()))
  with check (user_id = public.workspace_owner(auth.uid()));

-- time_entries
drop policy if exists "Users manage own time_entries" on public.time_entries;
create policy "Workspace manage time_entries" on public.time_entries
  for all using (user_id = public.workspace_owner(auth.uid()))
  with check (user_id = public.workspace_owner(auth.uid()));

-- contracts
drop policy if exists "Users manage own contracts" on public.contracts;
create policy "Workspace manage contracts" on public.contracts
  for all using (user_id = public.workspace_owner(auth.uid()))
  with check (user_id = public.workspace_owner(auth.uid()));

-- client_portals ("Public read portal by token" stays as-is)
drop policy if exists "Users manage own portals" on public.client_portals;
create policy "Workspace manage portals" on public.client_portals
  for all using (user_id = public.workspace_owner(auth.uid()))
  with check (user_id = public.workspace_owner(auth.uid()));
