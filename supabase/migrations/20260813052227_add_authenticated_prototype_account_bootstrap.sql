create or replace function public.bootstrap_own_prototype_account(
  p_card_id text,
  p_variant_index smallint
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  account public.prototype_account_states%rowtype;
  account_id uuid := (select auth.uid());
  account_email text := lower(coalesce((select auth.jwt()->>'email'), ''));
  prepared_at timestamptz := clock_timestamp();
  daily jsonb;
begin
  if account_id is null then
    raise insufficient_privilege using message = 'Authenticated account required';
  end if;

  if p_card_id = '' or p_variant_index < 0 or p_variant_index > 100 then
    raise data_exception using message = 'Invalid daily candidate';
  end if;

  insert into public.prototype_account_states (user_id)
  values (account_id)
  on conflict (user_id) do nothing;

  select * into account
  from public.prototype_account_states
  where user_id = account_id
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
      where user_id = account_id
      returning * into account;
    end if;

    daily := jsonb_build_object(
      'status', 'pending',
      'cardId', account.daily_pending_card_id,
      'variantIndex', account.daily_pending_variant_index
    );
  end if;

  return jsonb_build_object(
    'accountId', account_id,
    'email', account_email,
    'isAdmin', account_email = 'iliushka00@bk.ru',
    'daily', daily,
    'spread', account.spread_snapshot,
    'nextSpreadAt', case
      when account.last_spread_at is null then null
      else to_jsonb(account.last_spread_at + interval '12 hours')
    end
  );
end;
$$;

revoke execute on function public.bootstrap_own_prototype_account(text, smallint)
  from public, anon, service_role;
grant execute on function public.bootstrap_own_prototype_account(text, smallint)
  to authenticated;
