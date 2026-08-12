create table if not exists public.prototype_account_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  daily_pending_card_id text,
  daily_pending_variant_index smallint,
  daily_card_id text,
  daily_variant_index smallint,
  daily_drawn_at timestamptz,
  spread_snapshot jsonb,
  last_spread_at timestamptz,
  spread_reservation_id uuid,
  spread_reserved_at timestamptz,
  last_completed_spread_reservation_id uuid,
  updated_at timestamptz not null default now(),
  constraint prototype_account_daily_pending_complete check (
    (daily_pending_card_id is null and daily_pending_variant_index is null)
    or
    (daily_pending_card_id is not null and daily_pending_variant_index is not null)
  ),
  constraint prototype_account_daily_complete check (
    (daily_card_id is null and daily_variant_index is null and daily_drawn_at is null)
    or
    (daily_card_id is not null and daily_variant_index is not null and daily_drawn_at is not null)
  ),
  constraint prototype_account_daily_variants_nonnegative check (
    coalesce(daily_pending_variant_index, 0) >= 0
    and coalesce(daily_variant_index, 0) >= 0
  ),
  constraint prototype_account_spread_snapshot_object check (
    spread_snapshot is null or jsonb_typeof(spread_snapshot) = 'object'
  ),
  constraint prototype_account_spread_reservation_complete check (
    (spread_reservation_id is null and spread_reserved_at is null)
    or
    (spread_reservation_id is not null and spread_reserved_at is not null)
  )
);

alter table public.prototype_account_states enable row level security;
revoke all on table public.prototype_account_states from public, anon, authenticated;

create or replace function public.prepare_prototype_daily(
  p_user_id uuid,
  p_card_id text,
  p_variant_index smallint
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  account public.prototype_account_states%rowtype;
  prepared_at timestamptz := clock_timestamp();
begin
  insert into public.prototype_account_states (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select * into account
  from public.prototype_account_states
  where user_id = p_user_id
  for update;

  if account.daily_drawn_at is not null
    and account.daily_drawn_at > prepared_at - interval '12 hours'
  then
    return jsonb_build_object(
      'status', 'drawn',
      'cardId', account.daily_card_id,
      'variantIndex', account.daily_variant_index,
      'drawnAt', account.daily_drawn_at,
      'nextDailyAt', account.daily_drawn_at + interval '12 hours'
    );
  end if;

  if account.daily_pending_card_id is null then
    update public.prototype_account_states
    set daily_pending_card_id = p_card_id,
        daily_pending_variant_index = p_variant_index,
        updated_at = prepared_at
    where user_id = p_user_id
    returning * into account;
  end if;

  return jsonb_build_object(
    'status', 'pending',
    'cardId', account.daily_pending_card_id,
    'variantIndex', account.daily_pending_variant_index
  );
end;
$$;

create or replace function public.complete_prototype_daily(p_user_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  account public.prototype_account_states%rowtype;
  completed_at timestamptz := clock_timestamp();
begin
  select * into account
  from public.prototype_account_states
  where user_id = p_user_id
  for update;

  if found
    and account.daily_drawn_at is not null
    and account.daily_drawn_at > completed_at - interval '12 hours'
  then
    return jsonb_build_object(
      'completed', true,
      'cardId', account.daily_card_id,
      'variantIndex', account.daily_variant_index,
      'drawnAt', account.daily_drawn_at,
      'nextDailyAt', account.daily_drawn_at + interval '12 hours'
    );
  end if;

  if not found or account.daily_pending_card_id is null then
    return jsonb_build_object('completed', false, 'reason', 'pending_required');
  end if;

  update public.prototype_account_states
  set daily_card_id = daily_pending_card_id,
      daily_variant_index = daily_pending_variant_index,
      daily_drawn_at = completed_at,
      daily_pending_card_id = null,
      daily_pending_variant_index = null,
      updated_at = completed_at
  where user_id = p_user_id
  returning * into account;

  return jsonb_build_object(
    'completed', true,
    'cardId', account.daily_card_id,
    'variantIndex', account.daily_variant_index,
    'drawnAt', account.daily_drawn_at,
    'nextDailyAt', account.daily_drawn_at + interval '12 hours'
  );
end;
$$;

create or replace function public.reserve_prototype_account_spread(p_user_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  account public.prototype_account_states%rowtype;
  reserved_at timestamptz := clock_timestamp();
  reservation_id uuid := gen_random_uuid();
begin
  insert into public.prototype_account_states (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select * into account
  from public.prototype_account_states
  where user_id = p_user_id
  for update;

  if account.last_spread_at is not null
    and account.last_spread_at > reserved_at - interval '12 hours'
  then
    return jsonb_build_object(
      'reserved', false,
      'reason', 'cooldown',
      'nextSpreadAt', account.last_spread_at + interval '12 hours'
    );
  end if;

  if account.spread_reserved_at is not null
    and account.spread_reserved_at > reserved_at - interval '3 minutes'
  then
    return jsonb_build_object(
      'reserved', false,
      'reason', 'in_progress',
      'reservationExpiresAt', account.spread_reserved_at + interval '3 minutes'
    );
  end if;

  update public.prototype_account_states
  set spread_reservation_id = reservation_id,
      spread_reserved_at = reserved_at,
      updated_at = reserved_at
  where user_id = p_user_id;

  return jsonb_build_object(
    'reserved', true,
    'reservationId', reservation_id,
    'reservationExpiresAt', reserved_at + interval '3 minutes'
  );
end;
$$;

create or replace function public.complete_prototype_account_spread(
  p_user_id uuid,
  p_reservation_id uuid,
  p_snapshot jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  account public.prototype_account_states%rowtype;
  completed_at timestamptz := clock_timestamp();
begin
  select * into account
  from public.prototype_account_states
  where user_id = p_user_id
  for update;

  if not found then
    return jsonb_build_object('completed', false, 'reason', 'account_required');
  end if;

  if account.last_completed_spread_reservation_id = p_reservation_id then
    return jsonb_build_object(
      'completed', true,
      'snapshot', account.spread_snapshot,
      'nextSpreadAt', account.last_spread_at + interval '12 hours'
    );
  end if;

  if account.spread_reservation_id is distinct from p_reservation_id then
    return jsonb_build_object('completed', false, 'reason', 'reservation_mismatch');
  end if;

  if account.spread_reserved_at is null
    or account.spread_reserved_at <= completed_at - interval '3 minutes'
  then
    update public.prototype_account_states
    set spread_reservation_id = null,
        spread_reserved_at = null,
        updated_at = completed_at
    where user_id = p_user_id;
    return jsonb_build_object('completed', false, 'reason', 'reservation_expired');
  end if;

  update public.prototype_account_states
  set spread_snapshot = p_snapshot,
      last_spread_at = completed_at,
      last_completed_spread_reservation_id = p_reservation_id,
      spread_reservation_id = null,
      spread_reserved_at = null,
      updated_at = completed_at
  where user_id = p_user_id;

  return jsonb_build_object(
    'completed', true,
    'snapshot', p_snapshot,
    'nextSpreadAt', completed_at + interval '12 hours'
  );
end;
$$;

create or replace function public.release_prototype_account_spread(
  p_user_id uuid,
  p_reservation_id uuid
)
returns jsonb
language sql
security invoker
set search_path = public, pg_temp
as $$
  with released as (
    update public.prototype_account_states
    set spread_reservation_id = null,
        spread_reserved_at = null,
        updated_at = clock_timestamp()
    where user_id = p_user_id
      and spread_reservation_id = p_reservation_id
    returning 1
  )
  select jsonb_build_object('released', exists(select 1 from released));
$$;

revoke execute on function public.prepare_prototype_daily(uuid, text, smallint) from public, anon, authenticated;
revoke execute on function public.complete_prototype_daily(uuid) from public, anon, authenticated;
revoke execute on function public.reserve_prototype_account_spread(uuid) from public, anon, authenticated;
revoke execute on function public.complete_prototype_account_spread(uuid, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.release_prototype_account_spread(uuid, uuid) from public, anon, authenticated;

grant execute on function public.prepare_prototype_daily(uuid, text, smallint) to service_role;
grant execute on function public.complete_prototype_daily(uuid) to service_role;
grant execute on function public.reserve_prototype_account_spread(uuid) to service_role;
grant execute on function public.complete_prototype_account_spread(uuid, uuid, jsonb) to service_role;
grant execute on function public.release_prototype_account_spread(uuid, uuid) to service_role;
