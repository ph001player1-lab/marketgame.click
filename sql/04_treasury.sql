-- ============================================================================
--  КАЗНА ГОСУДАРСТВА — v4.4
--  Запускать в SQL Editor целиком, после 01/02/03. Безопасно к повторному
--  запуску: таблица создаётся по IF NOT EXISTS, функция заменяется.
--
--  Идея: ведущий играет государство, и у государства теперь есть бюджет,
--  а не бездонный карман. Земля государственная, поэтому аренда идёт в
--  казну. Банк государственный, поэтому проценты по кредитам тоже.
--  Штрафы пополняют казну, субсидии выплачиваются из неё.
--
--  Это меняет саму драматургию сессии: раздавая субсидии направо и налево,
--  ведущий видит, как казна тает, и вынужден выбирать — ровно та же
--  задача, что стоит перед игроками.
-- ============================================================================

create table if not exists treasury (
  id            bigserial primary key,
  game_id       uuid not null references games(id) on delete cascade,
  round_number  int  not null,

  rent          numeric(14,2) not null default 0,  -- аренда со всех активных
  interest      numeric(14,2) not null default 0,  -- проценты по кредитам
  fines         numeric(14,2) not null default 0,  -- собранные штрафы
  subsidies     numeric(14,2) not null default 0,  -- выплаченные субсидии
  income        numeric(14,2) not null default 0,  -- итог месяца (может быть минусом)
  balance       numeric(14,2) not null default 0,  -- накопленная казна

  created_at    timestamptz not null default now(),
  unique (game_id, round_number)
);

alter table treasury enable row level security;

-- ---------------------------------------------------------------------------
--  Пересоздаём применение месяца — теперь оно ещё и считает казну.
-- ---------------------------------------------------------------------------
create or replace function apply_round_results(
  p_game_id      uuid,
  p_round_number int,
  p_results      jsonb,
  p_players      jsonb,
  p_salary       numeric
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round     record;
  v_r         jsonb;
  v_p         jsonb;
  v_player    record;
  v_since     int;
  v_paid      int;
  v_from      int;
  v_months    int;
  v_savings   numeric;
  v_prev      numeric;
  v_results   int := 0;
  v_wallets   int := 0;
  v_rent      numeric := 0;
  v_interest  numeric := 0;
  v_fines     numeric := 0;
  v_subsidies numeric := 0;
  v_subsidies_extra numeric := 0;
  v_income    numeric := 0;
  v_prev_bal  numeric := 0;
begin
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

    insert into ledger (game_id, player_id, round_number, kind, amount, target, reason, actor)
    values (p_game_id, (v_r->>'player_id')::uuid, p_round_number, 'revenue',
            (v_r->>'cash_flow')::numeric, 'cash', 'Денежный поток за месяц', 'system');

    -- Земля государственная, банк государственный: аренда и проценты,
    -- которые игрок заплатил, — это доход казны.
    v_rent     := v_rent + (v_r->>'rent')::numeric;
    v_interest := v_interest + (v_r->>'interest')::numeric;

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

  -- ---- 3. Вне бизнеса: зарплата госслужбы с добором и журнал кошелька
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

        -- Зарплата госслужащего платится из казны: он на неё и работает.
        v_subsidies := v_subsidies + v_months * p_salary;
      end if;
    end if;

    update players set savings_last_round = v_savings where id = v_player.id;

    insert into wallet_entries (game_id, round_number, player_id, status, savings, income)
    values (p_game_id, p_round_number, v_player.id, v_player.status,
            v_savings, v_savings - v_prev)
    on conflict (game_id, round_number, player_id) do nothing;

    v_wallets := v_wallets + 1;
  end loop;

  -- ---- 3.5. Сброс отметки "зарплата за месяц выплачена"
  update players
     set salary_paid_this_round = false
   where game_id = p_game_id and salary_paid_this_round = true;

  -- ---- 3.6. Казна за месяц
  --
  -- Штрафы и субсидии ведущий раздаёт в любой момент месяца, поэтому
  -- берём их из журнала по номеру месяца, а не считаем по ходу.
  select
    coalesce(sum(case when kind = 'admin_fine'    then abs(amount) else 0 end), 0),
    coalesce(sum(case when kind = 'admin_subsidy' then amount      else 0 end), 0)
  into v_fines, v_subsidies_extra
  from ledger
  where game_id = p_game_id and round_number = p_round_number
    and kind in ('admin_fine','admin_subsidy');

  v_subsidies := v_subsidies + v_subsidies_extra;
  v_income := v_rent + v_interest + v_fines - v_subsidies;

  select coalesce(balance, 0) into v_prev_bal
  from treasury
  where game_id = p_game_id and round_number < p_round_number
  order by round_number desc limit 1;

  insert into treasury (game_id, round_number, rent, interest, fines, subsidies, income, balance)
  values (p_game_id, p_round_number, v_rent, v_interest, v_fines, v_subsidies,
          v_income, coalesce(v_prev_bal, 0) + v_income)
  on conflict (game_id, round_number) do update
    set rent = excluded.rent, interest = excluded.interest,
        fines = excluded.fines, subsidies = excluded.subsidies,
        income = excluded.income, balance = excluded.balance;

  -- ---- 4. Закрываем месяц
  update rounds
     set status = 'closed', closed_at = now()
   where game_id = p_game_id and round_number = p_round_number;

  return jsonb_build_object(
    'ok', true, 'results', v_results, 'wallets', v_wallets,
    'round', p_round_number, 'treasuryIncome', v_income,
    'treasuryBalance', coalesce(v_prev_bal, 0) + v_income
  );
end;
$$;
