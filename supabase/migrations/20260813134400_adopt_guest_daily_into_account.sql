create or replace function public.adopt_prototype_guest_daily(
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
  adopted_at timestamptz := clock_timestamp();
begin
  if p_card_id = '' or p_variant_index < 0 or p_variant_index > 100 then
    raise data_exception using message = 'Invalid guest daily card';
  end if;

  insert into public.prototype_account_states (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select * into account
  from public.prototype_account_states
  where user_id = p_user_id
  for update;

  if account.daily_drawn_at is not null
    and account.daily_drawn_at > adopted_at - interval '12 hours'
  then
    return jsonb_build_object(
      'adopted', false,
      'status', 'drawn',
      'cardId', account.daily_card_id,
      'variantIndex', account.daily_variant_index,
      'drawnAt', account.daily_drawn_at,
      'nextDailyAt', account.daily_drawn_at + interval '12 hours'
    );
  end if;

  update public.prototype_account_states
  set daily_card_id = p_card_id,
      daily_variant_index = p_variant_index,
      daily_drawn_at = adopted_at,
      daily_pending_card_id = null,
      daily_pending_variant_index = null,
      updated_at = adopted_at
  where user_id = p_user_id
  returning * into account;

  return jsonb_build_object(
    'adopted', true,
    'status', 'drawn',
    'cardId', account.daily_card_id,
    'variantIndex', account.daily_variant_index,
    'drawnAt', account.daily_drawn_at,
    'nextDailyAt', account.daily_drawn_at + interval '12 hours'
  );
end;
$$;

revoke execute on function public.adopt_prototype_guest_daily(uuid, text, smallint)
  from public, anon, authenticated;
grant execute on function public.adopt_prototype_guest_daily(uuid, text, smallint)
  to service_role;
