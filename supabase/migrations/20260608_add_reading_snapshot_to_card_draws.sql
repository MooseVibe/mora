alter table public.card_draws
  add column if not exists reading_snapshot jsonb;

create index if not exists card_draws_user_drawn_at_desc_idx
  on public.card_draws (user_id, drawn_at desc);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'card_draws_variant_idx_nonnegative'
      and conrelid = 'public.card_draws'::regclass
  ) then
    alter table public.card_draws
      add constraint card_draws_variant_idx_nonnegative
      check (variant_idx is null or variant_idx >= 0);
  end if;
end $$;
