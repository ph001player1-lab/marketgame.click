-- ============================================================================
--  ⚠️ ЭТОТ ФАЙЛ ВЫТЕСНЕН ФАЙЛОМ 04_treasury.sql
--
--  04 пересоздаёт apply_round_results целиком, добавляя расчёт казны.
--  Всё, что есть здесь, входит туда же. При установке с нуля 03 можно
--  пропустить — он оставлен только чтобы номера шагов не разъезжались с
--  историей проекта.
-- ============================================================================

-- ============================================================================
--  Применение рассчитанного месяца ОДНОЙ транзакцией. Шаг 5, часть 2.
--  Запускать в SQL Editor после 01_schema.sql и 02_functions.sql.
--
--  Смысл именно в атомарности. В версии на Google Sheets расчёт делал
--  снимок в начале и писал строки по одной в конце, и между этими двумя
--  моментами состояние успевало разъехаться: то выбор деятельности
--  затирался снимком, то зарплата за месяц терялась. Здесь либо весь
--  месяц ложится целиком, либо не ложится вовсе.
-- ============================================================================

create or replace function apply_round_results(
  p_game_id      uuid,
  p_round_number int,
  p_results      jsonb,   -- массив строк результатов из движка
  p_players      jsonb,   -- массив нового состояния активных игроков
  p_salary       numeric  -- зарплата госслужбы
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round     record;
  v_r         jsonb;
  v_p         jsonb;
  v_pid       uuid;
  v_player    record;
  v_since     int;
  v_paid      int;
  v_from      int;
  v_months    int;
  v_savings   numeric;
  v_prev      numeric;
  v_results   int := 0;
  v_wallets   int := 0;
begin
  -- Блокируем месяц: два одновременных расчёта невозможны по построению,
  -- второй просто увидит, что месяц уже закрыт, и не сделает ничего.
  select * into v_round
  from rounds
  where game_id = p_game_id and round_number = p_round_number
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'round_not_found');
  end if;
  if v_round.status = 'closed' then
    return jsonb_build_object('ok', false, 'error', 'already_closed');
  end if;

  -- ---- 1. Строки П&У активных игроков
  for v_r in select * from jsonb_array_elements(p_results) loop
    insert into results (
      game_id, round_number, player_id, price, demand, served, lost,
      revenue, cogs_total, gross_profit, rent, payroll, shift_cost,
      quality_upkeep, quality_invest, marketing_total, marketing_effect,
      ebit, interest, profit, principal_paid, cash_flow, cash_after,
      brand_after, reputation_after, quality, capacity, market_share, market_total,
      seo_spend, promo_spend, maps_spend, social_spend, outdoor_spend, affiliate_spend
    ) values (
      p_game_id, p_round_number, (v_r->>'player_id')::uuid,
      (v_r->>'price')::numeric, (v_r->>'demand')::numeric, (v_r->>'served')::numeric,
      (v_r->>'lost')::numeric, (v_r->>'revenue')::numeric, (v_r->>'cogs_total')::numeric,
      (v_r->>'gross_profit')::numeric, (v_r->>'rent')::numeric, (v_r->>'payroll')::numeric,
      (v_r->>'shift_cost')::numeric, (v_r->>'quality_upkeep')::numeric,
      (v_r->>'quality_invest')::numeric, (v_r->>'marketing_total')::numeric,
      (v_r->>'marketing_effect')::numeric, (v_r->>'ebit')::numeric,
      (v_r->>'interest')::numeric, (v_r->>'profit')::numeric,
      (v_r->>'principal_paid')::numeric, (v_r->>'cash_flow')::numeric,
      (v_r->>'cash_after')::numeric, (v_r->>'brand_after')::numeric,
      (v_r->>'reputation_after')::numeric, (v_r->>'quality')::numeric,
      (v_r->>'capacity')::numeric, (v_r->>'market_share')::numeric,
      (v_r->>'market_total')::numeric,
      (v_r->>'seo_spend')::numeric, (v_r->>'promo_spend')::numeric,
      (v_r->>'maps_spend')::numeric, (v_r->>'social_spend')::numeric,
      (v_r->>'outdoor_spend')::numeric, (v_r->>'affiliate_spend')::numeric
    )
    on conflict (game_id, round_number, player_id) do nothing;

    -- Движение денег за месяц — в журнал. Касса игрока остаётся быстрым
    -- полем для чтения, но источник правды здесь.
    insert into ledger (game_id, player_id, round_number, kind, amount, target, reason, actor)
    values (p_game_id, (v_r->>'player_id')::uuid, p_round_number, 'revenue',
            (v_r->>'cash_flow')::numeric, 'cash', 'Денежный поток за месяц', 'system');

    v_results := v_results + 1;
  end loop;

  -- ---- 2. Новое состояние активных игроков
  for v_p in select * from jsonb_array_elements(p_players) loop
    update players set
      cash = (v_p->>'cash')::numeric,
      brand = (v_p->>'brand')::numeric,
      reputation = (v_p->>'reputation')::numeric,
      quality = (v_p->>'quality')::numeric,
      capacity_shifts = (v_p->>'capacity_shifts')::int,
      seo_level = (v_p->>'seo_level')::numeric,
      seo_streak = (v_p->>'seo_streak')::int,
      seo_unlocked = (v_p->>'seo_unlocked')::boolean,
      maps_level = (v_p->>'maps_level')::numeric,
      social_adstock = (v_p->>'social_adstock')::numeric,
      outdoor_level = (v_p->>'outdoor_level')::numeric,
      outdoor_active_until = (v_p->>'outdoor_active_until')::int,
      affiliate_active = (v_p->>'affiliate_active')::boolean,
      loan_balance = (v_p->>'loan_balance')::numeric,
      loan_term_left = (v_p->>'loan_term_left')::int,
      loan_monthly_principal = (v_p->>'loan_monthly_principal')::numeric,
      loan_tier = (v_p->>'loan_tier')::int,
      cf_positive_streak = (v_p->>'cf_positive_streak')::int,
      ever_missed_payment = (v_p->>'ever_missed_payment')::boolean,
      status = v_p->>'status'
    where id = (v_p->>'id')::uuid and game_id = p_game_id;
  end loop;

  -- ---- 3. Те, кто вне бизнеса: зарплата госслужбы и журнал кошелька
  --
  -- Зарплата начисляется НЕ «по одному месяцу за закрытие», а по разнице
  -- между отслуженными и уже оплаченными месяцами. Если месяц по любой
  -- причине пропущен, следующее закрытие доплатит за оба — потерять
  -- зарплату стало невозможно.
  for v_player in
    select * from players
    where game_id = p_game_id
      and status not in ('active','left')
      and id not in (
        select (r->>'player_id')::uuid from jsonb_array_elements(p_results) r
      )
    for update
  loop
    v_savings := coalesce(v_player.employment_savings, 0);
    v_prev := coalesce(v_player.savings_last_round, 0);

    if v_player.status = 'civil_service' then
      v_since := coalesce(nullif(v_player.service_since_round, 0), p_round_number);
      v_paid  := coalesce(nullif(v_player.last_salary_round, 0), v_since - 1);
      v_from  := greatest(v_since, v_paid + 1);
      v_months := p_round_number - v_from + 1;

      if v_months > 0 then
        v_savings := v_savings + v_months * p_salary;
        update players
           set employment_savings = v_savings,
               last_salary_round = p_round_number,
               service_since_round = v_since
         where id = v_player.id;

        insert into ledger (game_id, player_id, round_number, kind, amount, target, reason, actor)
        values (p_game_id, v_player.id, p_round_number, 'civil_salary',
                v_months * p_salary, 'savings',
                'Зарплата госслужбы за ' || v_months || ' мес.', 'system');
      end if;
    end if;

    update players set savings_last_round = v_savings where id = v_player.id;

    insert into wallet_entries (game_id, round_number, player_id, status, savings, income)
    values (p_game_id, p_round_number, v_player.id, v_player.status,
            v_savings, v_savings - v_prev)
    on conflict (game_id, round_number, player_id) do nothing;

    v_wallets := v_wallets + 1;
  end loop;

  -- ---- 4. Закрываем месяц
  update rounds
     set status = 'closed', closed_at = now()
   where game_id = p_game_id and round_number = p_round_number;

  return jsonb_build_object(
    'ok', true, 'results', v_results, 'wallets', v_wallets, 'round', p_round_number
  );
end;
$$;
