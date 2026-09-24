-- ============================================================================
--  СБРОС ПАРТИИ ОДНОЙ ТРАНЗАКЦИЕЙ — v4.5
--  Запускать в SQL Editor после 01-04. Безопасно к повторному запуску.
--
--  Зачем отдельная функция вместо семи запросов подряд из Edge Function:
--
--  1. Атомарность. Раньше сброс шёл цепочкой отдельных удалений, и обрыв
--     связи посередине оставлял партию в состоянии «месяцы стёрты, а
--     результаты нет». Теперь либо сброшено всё, либо ничего.
--
--  2. Полнота. Список таблиц жил в TypeScript, и при добавлении казны про
--     неё забыли — старая казна переезжала в новую партию. Здесь список
--     лежит рядом со схемой, и это ровно то место, куда смотришь, когда
--     заводишь новую таблицу.
-- ============================================================================

create or replace function reset_game(
  p_game_id        uuid,
  p_admin_username text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game    record;
  v_start   numeric;
  v_players int;
begin
  -- Блокируем игру: сброс не должен пересечься с расчётом месяца.
  select * into v_game from games where id = p_game_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'game_not_found');
  end if;

  v_start := coalesce((v_game.config->>'START_CAPITAL')::numeric, 100000);

  -- Всё, что относится к ходу партии. Состав игроков и настройки живут
  -- отдельно и переживают сброс — менять их нужно своими кнопками.
  delete from results        where game_id = p_game_id;
  delete from decisions      where game_id = p_game_id;
  delete from wallet_entries where game_id = p_game_id;
  delete from bank_log       where game_id = p_game_id;
  delete from transfers      where game_id = p_game_id;
  delete from ledger         where game_id = p_game_id;
  delete from treasury       where game_id = p_game_id;   -- ← забывали именно её
  delete from rounds         where game_id = p_game_id;
  delete from mutations      where game_id = p_game_id;

  -- admin_actions НЕ чистим намеренно: это журнал действий ведущего, и он
  -- ценен именно тем, что переживает сброс. Если после сессии возникнет
  -- вопрос «а что вообще происходило», ответ должен сохраниться.

  update players set
    cash = v_start,
    employment_savings = 0,
    brand = 0, reputation = 1, quality = 0, capacity_shifts = 0,
    seo_level = 0, seo_streak = 0, seo_unlocked = false,
    maps_level = 0, social_adstock = 0,
    outdoor_level = 0, outdoor_active_until = 0, affiliate_active = false,
    loan_tier = 0, loan_balance = 0, loan_term_left = 0, loan_monthly_principal = 0,
    cf_positive_streak = 0, ever_missed_payment = false,
    custom_profession_name = null, employer_username = null, proposed_salary = 0,
    employment_approved = false, salary_paid_this_round = false,
    service_since_round = 0, last_salary_round = 0, savings_last_round = 0,
    status = 'active'
  where game_id = p_game_id;

  get diagnostics v_players = row_count;

  -- Стартовый капитал проводим через журнал, чтобы баланс сходился с ним
  -- с первой же строки новой партии.
  insert into ledger (game_id, player_id, round_number, kind, amount, target, reason, actor)
  select p_game_id, id, 0, 'start_capital', v_start, 'cash',
         'Стартовый капитал (новая партия)', p_admin_username
  from players where game_id = p_game_id;

  update games set current_round = 0, status = 'setup' where id = p_game_id;

  insert into admin_actions (game_id, admin_username, action, payload, reason)
  values (p_game_id, p_admin_username, 'reset',
          jsonb_build_object('players', v_players, 'startCapital', v_start),
          'Полный сброс партии');

  return jsonb_build_object('ok', true, 'players', v_players, 'startCapital', v_start);
end;
$$;
