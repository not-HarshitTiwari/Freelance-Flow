-- Bugfix: /api/profile PATCH used to write to auth.uid()'s own profiles row
-- even for team members, so a member "editing settings" silently saved to a
-- phantom personal row instead of the shared workspace profile everyone
-- actually sees. The app code now resolves the workspace owner's row and
-- gates writes to admin (or the owner) — this policy is what lets an admin
-- team member's write actually land on the owner's row under RLS.
-- SELECT access for all accepted members already exists via
-- "Team member reads workspace owner profile" (team-accounts migration).
drop policy if exists "Admin members update workspace owner profile" on public.profiles;

create policy "Admin members update workspace owner profile" on public.profiles
  for update using (
    id = public.workspace_owner(auth.uid())
    and public.workspace_role(auth.uid()) = 'admin'
  )
  with check (
    id = public.workspace_owner(auth.uid())
    and public.workspace_role(auth.uid()) = 'admin'
  );
