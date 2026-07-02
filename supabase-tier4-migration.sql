-- Tier 4–8 migration

-- API keys table
create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  prefix text not null,
  key_hash text not null unique,
  scopes text[] not null default '{"read"}',
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.api_keys enable row level security;
create policy "owner only" on public.api_keys
  using (user_id = auth.uid());

-- Audit log table
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  entity_type text not null,
  entity_id text,
  meta jsonb not null default '{}',
  actor_email text,
  created_at timestamptz not null default now()
);
alter table public.audit_log enable row level security;
create policy "owner only" on public.audit_log
  using (user_id = auth.uid());

-- Index for fast log queries
create index if not exists audit_log_user_created on public.audit_log (user_id, created_at desc);
create index if not exists audit_log_action on public.audit_log (user_id, action);
