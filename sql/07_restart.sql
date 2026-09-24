-- ============================================================================
--  АРХИВ ПАРТИЙ И ПЕРЕЗАПУСК — v4.7
--  Шаг 7 установки. Запускать после 01-06.
-- ============================================================================
alter table games add column if not exists finished_at timestamptz;
alter table games add column if not exists series      text;

-- Проставляем серию уже существующим партиям: серия — это код без
-- порядкового номера, по ней Edge Function находит текущую игру.
update games
   set series = coalesce(series, split_part(code, '#', 1))
 where series is null;

create index if not exists games_series_idx on games (series, created_at desc);


create or replace function archive_and_restart_game(
  p_game_id        uuid,
  p_admin_username text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game      record;
  v_closed    int;
  v_series    text;
  v_seq       int;
  v_new_code  text;
  v_new_id    uuid;
  v_start     numeric;
  v_player    record;
  v_count     int := 0;
begin
  select * into v_game from games where id = p_game_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'game_not_found');
  end if;

  select count(*) into v_closed
  from rounds where game_id = p_game_id and status = 'closed';

  -- Ничего не сыграно — архивировать нечего, просто чистим на месте.
  -- Иначе база копила бы пустые партии от случайных нажатий.
  if v_closed = 0 then
    perform reset_game(p_game_id, p_admin_username);
    return jsonb_build_object('ok', true, 'mode', 'reset', 'gameId', p_game_id,
                              'code', v_game.code, 'archived', false);
  end if;

  v_series := coalesce(v_game.series, split_part(v_game.code, '#', 1));
  v_start := coalesce((v_game.config->>'START_CAPITAL')::numeric, 100000);

  update games
     set status = 'finished', finished_at = now(), series = v_series
   where id = p_game_id;

  select coalesce(max(split_part(code, '#', 2)::int), 1) + 1
    into v_seq
  from games
  where series = v_series and code ~ '#[0-9]+$';

  v_new_code := v_series || '#' || coalesce(v_seq, 2);

  insert into games (code, title, status, current_round, total_rounds,
                     admin_username, config, series)
  values (v_new_code, v_game.title, 'setup', 0, v_game.total_rounds,
          v_game.admin_username, v_game.config, v_series)
  returning id into v_new_id;

  -- Состав переносим как есть: те же люди играют дальше.
  for v_player in
    select username, display_name from players where game_id = p_game_id
  loop
    insert into players (game_id, username, display_name, cash, reputation, status)
    values (v_new_id, v_player.username, v_player.display_name, v_start, 1, 'active');
    v_count := v_count + 1;
  end loop;

  insert into ledger (game_id, player_id, round_number, kind, amount, target, reason, actor)
  select v_new_id, id, 0, 'start_capital', v_start, 'cash',
         'Стартовый капитал', p_admin_username
  from players where game_id = v_new_id;

  insert into admin_actions (game_id, admin_username, action, payload, reason)
  values (v_new_id, p_admin_username, 'restart',
          jsonb_build_object('previousGame', v_game.code, 'players', v_count),
          'Партия ' || v_game.code || ' закрыта, начата ' || v_new_code);

  return jsonb_build_object(
    'ok', true, 'mode', 'restart', 'archived', true,
    'previousCode', v_game.code, 'gameId', v_new_id, 'code', v_new_code,
    'players', v_count
  );
end;
$$;
