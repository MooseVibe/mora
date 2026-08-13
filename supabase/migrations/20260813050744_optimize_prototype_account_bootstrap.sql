create or replace function public.bootstrap_prototype_account(
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
  daily jsonb;
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
    daily := jsonb_build_object(
      'status', 'drawn',
      'cardId', account.daily_card_id,
      'variantIndex', account.daily_variant_index,
      'drawnAt', account.daily_drawn_at,
      'nextDailyAt', account.daily_drawn_at + interval '12 hours'
    );
  else
    if account.daily_pending_card_id is null then
      update public.prototype_account_states
      set daily_pending_card_id = p_card_id,
          daily_pending_variant_index = p_variant_index,
          updated_at = prepared_at
      where user_id = p_user_id
      returning * into account;
    end if;

    daily := jsonb_build_object(
      'status', 'pending',
      'cardId', account.daily_pending_card_id,
      'variantIndex', account.daily_pending_variant_index
    );
  end if;

  return jsonb_build_object(
    'daily', daily,
    'spread', account.spread_snapshot,
    'nextSpreadAt', case
      when account.last_spread_at is null then null
      else to_jsonb(account.last_spread_at + interval '12 hours')
    end
  );
end;
$$;

revoke execute on function public.bootstrap_prototype_account(uuid, text, smallint)
  from public, anon, authenticated;
grant execute on function public.bootstrap_prototype_account(uuid, text, smallint)
  to service_role;
