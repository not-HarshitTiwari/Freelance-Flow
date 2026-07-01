-- Adds per-member roles to the team feature: admin (full access), accountant
-- (everyday workspace work), viewer (read-only). Defaults existing/new
-- members to 'admin' so current behavior (full access) doesn't change until
-- the owner explicitly downgrades someone.
alter table public.team_members add column if not exists role text not null default 'admin';
alter table public.team_members drop constraint if exists team_members_role_check;
alter table public.team_members add constraint team_members_role_check check (role in ('admin', 'accountant', 'viewer'));

-- workspace_role(): the caller's role within their workspace. The owner
-- (anyone not present as an accepted team member) is always 'owner'.
-- Used by clients RLS below since clients CRUD goes straight through
-- supabase-js from the browser rather than an API route we can gate in TS.
create or replace function public.workspace_role(uid uuid)
returns text
language sql stable security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.team_members where member_id = uid and status = 'accepted' limit 1),
    'owner'
  );
$$;

drop policy if exists "Workspace manage clients" on public.clients;

create policy "Workspace read clients" on public.clients
  for select using (user_id = public.workspace_owner(auth.uid()));

create policy "Workspace insert clients" on public.clients
  for insert with check (user_id = public.workspace_owner(auth.uid()) and public.workspace_role(auth.uid()) <> 'viewer');

create policy "Workspace update clients" on public.clients
  for update using (user_id = public.workspace_owner(auth.uid()) and public.workspace_role(auth.uid()) <> 'viewer')
  with check (user_id = public.workspace_owner(auth.uid()) and public.workspace_role(auth.uid()) <> 'viewer');

create policy "Workspace delete clients" on public.clients
  for delete using (user_id = public.workspace_owner(auth.uid()) and public.workspace_role(auth.uid()) <> 'viewer');
