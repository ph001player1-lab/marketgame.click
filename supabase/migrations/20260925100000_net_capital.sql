-- ============================================================================
--  Капитал — деньги минус долг банку.
--
--  В v4.9 кредит из капитала не вычитался, и команда могла занять весь
--  лимит в последнем месяце: деньги в кассе росли, а долг никто не
--  считал — множитель вырастал в разы на пустом месте. Теперь капитал —
--  как у настоящего бизнеса: касса минус остаток кредита. Кредит всё так
--  же помогает расти, но результат дают только заработанные деньги.
--
--  Вне бизнеса кредита нет (он погашен или списан при закрытии), капитал —
--  накопления. У банкрота, который ещё не выбрал, чем заниматься, — касса
--  минус долг: это дыра, которую он оставил.
--
--  Меняется только выражение капитала; столбцы вида те же, рейтинг
--  (player_ratings) и история читают его как раньше.
-- ============================================================================

create or replace view v_standings as
with months as (
  select game_id, player_id, round_number, cash_after as capital,
         true as in_business, served
  from results
  union all
  select game_id, player_id, round_number, savings as capital,
         false as in_business, 0::numeric as served
  from wallet_entries
),
bounded as (
  select m.*
  from months m
  join games g on g.id = m.game_id
  where m.round_number <= g.total_rounds
),
last_month as (
  select game_id, player_id, max(round_number) as last_round
  from bounded
  group by game_id, player_id
),
agg as (
  select game_id, player_id,
         count(distinct round_number)             as months_played,
         count(*) filter (where in_business)      as months_in_business,
         coalesce(sum(served), 0)                 as served_total
  from bounded
  group by game_id, player_id
),
-- Весь рынок игры — сумма рынков месяцев. Тогда доли всех команд
-- складываются корректно, а остаток до 100% — гости, которых никто не принял.
market as (
  select game_id, sum(mt) as market_total
  from (
    select r.game_id, r.round_number, max(r.market_total) as mt
    from results r
    join games g on g.id = r.game_id and r.round_number <= g.total_rounds
    group by r.game_id, r.round_number
  ) x
  group by game_id
),
start_cap as (
  select player_id, sum(amount) as start_capital
  from ledger
  where kind = 'start_capital'
  group by player_id
),
base as (
  select p.game_id, p.id as player_id, p.email, p.display_name, p.restaurant_name,
         p.location_kind, p.location_state, p.location_country, p.status,
         a.months_played, a.months_in_business, lm.last_round,
         case when p.status in ('active', 'bankrupt') then p.cash - p.loan_balance
              when p.status = 'left' then 0
              else p.employment_savings end as capital,
         coalesce(sc.start_capital, (g.config->>'START_CAPITAL')::numeric) as start_capital,
         a.served_total / nullif(mk.market_total, 0) as share
  from players p
  join games g        on g.id = p.game_id
  join agg a          on a.game_id = p.game_id and a.player_id = p.id
  join last_month lm  on lm.game_id = p.game_id and lm.player_id = p.id
  left join market mk on mk.game_id = p.game_id
  left join start_cap sc on sc.player_id = p.id
)
select b.*,
       b.capital / nullif(b.start_capital, 0)                     as multiplier,
       rank()   over (partition by b.game_id order by b.capital desc) as place,
       count(*) over (partition by b.game_id)                     as rivals
from base b;
