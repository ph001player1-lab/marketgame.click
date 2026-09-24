-- ============================================================================
--  Функции создания игры и режима ведущего. Шаг 2, часть 2.
--  Запускать ПОСЛЕ 01_schema.sql, тоже целиком в SQL Editor.
-- ============================================================================

-- ---------------------------------------------------------------- СОЗДАТЬ ИГРУ
-- Создаёт сессию и сразу заводит игроков по списку ников. Стартовый капитал
-- проводится через журнал, а не просто проставляется в поле — чтобы уже с
-- первой строчки баланс сходился с журналом.
create or replace function create_game(
  p_code           text,
  p_admin_username text,
  p_usernames      text[],
  p_config         jsonb default null,
  p_title          text  default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game_id uuid;
  v_config  jsonb;
  v_start   numeric;
  v_user    text;
  v_player  uuid;
begin
  -- Если конфиг не передан, берём обкатанный baseline.
  v_config := coalesce(
    p_config,
    (select config from config_presets where name = 'v3.3 baseline'),
    '{}'::jsonb
  );

  v_start := coalesce((v_config->>'START_CAPITAL')::numeric, 100000);

  insert into games (code, title, admin_username, config, total_rounds, status)
  values (
    p_code,
    p_title,
    lower(replace(p_admin_username, '@', '')),
    v_config,
    coalesce((v_config->>'TOTAL_ROUNDS')::int, 12),
    'setup'
  )
  returning id into v_game_id;

  foreach v_user in array p_usernames loop
    v_user := lower(trim(replace(v_user, '@', '')));
    continue when v_user = '';

    insert into players (game_id, username, cash, reputation, status)
    values (v_game_id, v_user, v_start, 1, 'active')
    returning id into v_player;

    insert into ledger (game_id, player_id, kind, amount, target, reason, actor)
    values (v_game_id, v_player, 'start_capital', v_start, 'cash',
            'Стартовый капитал', 'system');
  end loop;

  return v_game_id;
end;
$$;

-- ------------------------------------------------------- ШТРАФ / СУБСИДИЯ
-- Государство в лице ведущего меняет деньги конкретного игрока.
-- Сумма со знаком: минус — штраф, плюс — субсидия.
-- Деньги кладутся туда, где игрок их реально держит: активному в кассу,
-- вне бизнеса — в накопления. Иначе субсидия госслужащему ушла бы в кассу
-- закрытого заведения и просто исчезла бы с экрана.
create or replace function admin_adjust_balance(
  p_game_id        uuid,
  p_player_id      uuid,
  p_amount         numeric,
  p_kind           text,      -- 'admin_fine' | 'admin_subsidy' | 'admin_adjust'
  p_reason         text,
  p_admin_username text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status  text;
  v_target  text;
  v_cash    numeric;
  v_savings numeric;
  v_round   int;
begin
  select status, cash, employment_savings
    into v_status, v_cash, v_savings
  from players
  where id = p_player_id and game_id = p_game_id
  for update;                       -- блокируем строку на время правки

  if not found then
    return jsonb_build_object('ok', false, 'error', 'player_not_found');
  end if;

  select current_round into v_round from games where id = p_game_id;

  v_target := case when v_status = 'active' then 'cash' else 'savings' end;

  if v_target = 'cash' then
    update players set cash = cash + p_amount where id = p_player_id
      returning cash into v_cash;
  else
    -- Накопления в минус не уводим: отрицательные "сбережения" сломали бы
    -- порог открытия нового дела и выглядели бы бессмыслицей на табло.
    update players
       set employment_savings = greatest(0, employment_savings + p_amount)
     where id = p_player_id
      returning employment_savings into v_savings;
  end if;

  insert into ledger (game_id, player_id, round_number, kind, amount, target, reason, actor)
  values (p_game_id, p_player_id, coalesce(v_round, 0), p_kind, p_amount, v_target,
          p_reason, p_admin_username);

  insert into admin_actions (game_id, admin_username, player_id, action, payload, reason)
  values (p_game_id, p_admin_username, p_player_id,
          p_kind, jsonb_build_object('amount', p_amount, 'target', v_target), p_reason);

  -- Игрок должен узнать о штрафе, а не обнаружить дыру в кассе молча.
  insert into bank_log (game_id, player_id, round_number, message)
  values (p_game_id, p_player_id, coalesce(v_round, 0),
          case when p_amount < 0
               then 'Государство: штраф ' || to_char(abs(p_amount), 'FM999G999G999') || ' ฿. ' || coalesce(p_reason, '')
               else 'Государство: субсидия ' || to_char(p_amount, 'FM999G999G999') || ' ฿. ' || coalesce(p_reason, '')
          end);

  return jsonb_build_object(
    'ok', true, 'target', v_target,
    'cash', v_cash, 'savings', v_savings
  );
end;
$$;

-- ------------------------------------------------------- МАССОВОЕ ДЕЙСТВИЕ
-- Налог со всех активных или субсидия всем, кто вне бизнеса. Руками по
-- одному игроку это делать больно, а по сюжету государство обычно
-- действует сразу на всех.
create or replace function admin_adjust_many(
  p_game_id        uuid,
  p_scope          text,      -- 'all' | 'active' | 'off_business'
  p_amount         numeric,   -- фиксированная сумма каждому, со знаком
  p_kind           text,
  p_reason         text,
  p_admin_username text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player record;
  v_count int := 0;
begin
  for v_player in
    select id from players
    where game_id = p_game_id
      and case p_scope
            when 'active'       then status = 'active'
            when 'off_business' then status in ('civil_service','freelance','custom_employed')
            else status <> 'left'
          end
  loop
    perform admin_adjust_balance(p_game_id, v_player.id, p_amount, p_kind, p_reason, p_admin_username);
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('ok', true, 'affected', v_count);
end;
$$;

-- ------------------------------------------------------- КТО ЭТО И ЧТО ЕМУ МОЖНО
-- Единая точка определения роли. Возвращает и роль, и — если ведущий смотрит
-- чужой кабинет — на кого он сейчас смотрит.
--
-- Режим ведущего нужен по двум причинам сразу: во время живой сессии полезно
-- видеть, что происходит у игрока, который просит помощи; а при обкатке в
-- одиночку это единственный способ отыграть партию на пятерых.
create or replace function identify_user(
  p_game_code text,
  p_username  text,
  p_as        text default null    -- ведущий: чей кабинет открыть
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game    record;
  v_user    text := lower(trim(replace(coalesce(p_username,''), '@', '')));
  v_as      text := lower(trim(replace(coalesce(p_as,''), '@', '')));
  v_is_admin boolean;
  v_player  record;
begin
  select * into v_game from games where code = p_game_code;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'game_not_found');
  end if;

  if v_user = '' then
    return jsonb_build_object('ok', false, 'error', 'no_username');
  end if;

  v_is_admin := (v_user = v_game.admin_username);

  -- Ведущий открывает чужой кабинет. Обычному игроку это недоступно:
  -- параметр as у него просто игнорируется, а не даёт ошибку — так
  -- подобранная чужая ссылка ничего не открывает.
  if v_is_admin and v_as <> '' then
    select * into v_player from players
     where game_id = v_game.id and lower(username) = v_as;

    if not found then
      return jsonb_build_object('ok', false, 'error', 'player_not_found');
    end if;

    insert into admin_actions (game_id, admin_username, player_id, action, payload)
    values (v_game.id, v_user, v_player.id, 'impersonate',
            jsonb_build_object('as', v_as));

    return jsonb_build_object(
      'ok', true, 'role', 'player', 'gameId', v_game.id,
      'username', v_player.username, 'playerId', v_player.id,
      'impersonating', true, 'realUsername', v_user
    );
  end if;

  if v_is_admin then
    return jsonb_build_object(
      'ok', true, 'role', 'admin', 'gameId', v_game.id,
      'username', v_user, 'impersonating', false
    );
  end if;

  select * into v_player from players
   where game_id = v_game.id and lower(username) = v_user;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_in_game');
  end if;

  return jsonb_build_object(
    'ok', true, 'role', 'player', 'gameId', v_game.id,
    'username', v_player.username, 'playerId', v_player.id,
    'impersonating', false
  );
end;
$$;

-- ============================================================================
--  ПРОВЕРКА
--
--  Создаёт демо-партию, ЕСЛИ ЕЁ ЕЩЁ НЕТ. Блок безопасен к повторному
--  запуску: при обновлении уже установленной базы он просто ничего не
--  делает, вместо того чтобы падать на уникальности кода игры.
--
--  Перед первым запуском замените ник ведущего и список игроков.
-- ============================================================================
do $$
declare
  v_admin   text   := 'ВАШ_НИК';                                  -- ← замените
  v_players text[] := array['igrok1','igrok2','igrok3','igrok4']; -- ← и это
  v_code    text   := 'TEST-01';
begin
  if exists (select 1 from games where code = v_code) then
    raise notice 'Партия % уже существует — пропускаем создание.', v_code;
  elsif v_admin = 'ВАШ_НИК' then
    raise notice 'Ник ведущего не заменён — демо-партия не создана. Это нормально при обновлении.';
  else
    perform create_game(v_code, v_admin, v_players, null, 'Первая тестовая партия');
    raise notice 'Создана партия % с % игроками.', v_code, array_length(v_players, 1);
  end if;
end $$;

-- Что получилось: состав текущих партий.
select g.code, g.status, g.current_round, p.username, p.cash, p.status as player_status
from games g
left join players p on p.game_id = g.id
order by g.created_at desc, p.username;
