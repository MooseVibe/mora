create table if not exists public.prototype_testers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  session_token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

alter table public.prototype_testers enable row level security;

revoke all on table public.prototype_testers from anon, authenticated;
