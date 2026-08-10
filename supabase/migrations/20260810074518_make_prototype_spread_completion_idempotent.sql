alter table public.prototype_testers
  add column if not exists last_completed_spread_reservation_id uuid;

create or replace function public.complete_prototype_spread(
  p_token_hash text,
  p_reservation_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  tester public.prototype_testers%rowtype;
  completed_at timestamptz := clock_timestamp();
begin
  select *
  into tester
  from public.prototype_testers
  where session_token_hash = p_token_hash
  for update;

  if not found then
    return jsonb_build_object('completed', false, 'reason', 'session_required');
  end if;

  if tester.last_completed_spread_reservation_id = p_reservation_id then
    return jsonb_build_object(
      'completed', true,
      'nextSpreadAt', tester.last_spread_at + interval '24 hours'
    );
  end if;

  if tester.spread_reservation_id is distinct from p_reservation_id then
    return jsonb_build_object('completed', false, 'reason', 'reservation_mismatch');
  end if;

  if tester.spread_reserved_at is null
    or tester.spread_reserved_at <= completed_at - interval '3 minutes'
  then
    update public.prototype_testers
    set spread_reservation_id = null,
        spread_reserved_at = null,
        last_seen_at = completed_at
    where id = tester.id;

    return jsonb_build_object('completed', false, 'reason', 'reservation_expired');
  end if;

  update public.prototype_testers
  set last_spread_at = completed_at,
      last_seen_at = completed_at,
      last_completed_spread_reservation_id = p_reservation_id,
      spread_reservation_id = null,
      spread_reserved_at = null
  where id = tester.id;

  return jsonb_build_object(
    'completed', true,
    'nextSpreadAt', completed_at + interval '24 hours'
  );
end;
$$;

revoke execute on function public.complete_prototype_spread(text, uuid) from public, anon, authenticated;
grant execute on function public.complete_prototype_spread(text, uuid) to service_role;
