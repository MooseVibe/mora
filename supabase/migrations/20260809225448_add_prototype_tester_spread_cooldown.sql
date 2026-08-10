alter table public.prototype_testers
  add column if not exists last_spread_at timestamptz;
