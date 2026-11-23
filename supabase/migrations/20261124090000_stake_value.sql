-- ============================================================================
--  Доли компаний — в капитале.
--
--  Команда, купившая долю арендодателя, банка, страховой или коммунальщиков,
--  владеет активом. Его стоимость — оценка компании, как у настоящего
--  бизнеса (капитализация дохода):
--
--    стоимость компании = прибыль в месяц × 12 ÷ ставка по кредитам игры,
--
--  прибыль — средняя за последние три месяца (не меньше нуля), ставка — не
--  меньше 1%. Оценку сервер записывает каждый месяц при расчёте
--  (institution_months.value), а стоимость долей команды на конец месяца —
--  в results / wallet_entries (stake_value).
--
--  Капитал = деньги − долг + доли × оценка компании. По нему — место,
--  множитель и рейтинг. В играх, рассчитанных до этой правки, оценок нет —
--  их итоги не меняются.
-- ============================================================================

alter table institution_months add column value numeric(16,2);
alter table results            add column stake_value numeric(16,2) not null default 0;
alter table wallet_entries     add column stake_value numeric(16,2) not null default 0;

drop view v_standings;

create view v_standings as
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
-- Доли компаний — по последней оценке компании (институция за месяц).
-- В играх до этой правки оценок нет — доли не считаются, как и раньше.
last_value as (
  select distinct on (game_id, kind) game_id, kind, value
  from institution_months
  where value is not null
  order by game_id, kind, round_number desc
),
stake_values as (
  select s.game_id, s.player_id, sum(s.pct / 100 * lv.value) as stakes_value
  from stakes s
  join last_value lv on lv.game_id = s.game_id and lv.kind = s.kind
  group by s.game_id, s.player_id
),
base as (
  select p.game_id, p.id as player_id, p.email, p.display_name, p.restaurant_name,
         -- Где команда вела бизнес: в игре в одном месте — там же, где игра,
         -- в онлайн-игре — то, что команда указала сама.
         case when g.region = 'online' then p.location_country else g.country end as location_country,
         case when g.region = 'online' then p.location_area else g.area end as location_area,
         p.status,
         a.months_played, a.months_in_business, lm.last_round,
         case when p.status in ('active', 'bankrupt') then p.cash - p.loan_balance
              when p.status = 'left' then 0
              else p.employment_savings end
           + case when p.status = 'left' then 0 else coalesce(sv.stakes_value, 0) end as capital,
         case when p.status = 'left' then 0 else coalesce(sv.stakes_value, 0) end as stakes_value,
         coalesce(sc.start_capital, (g.config->>'START_CAPITAL')::numeric) as start_capital,
         a.served_total / nullif(mk.market_total, 0) as share
  from players p
  join games g        on g.id = p.game_id
  join agg a          on a.game_id = p.game_id and a.player_id = p.id
  join last_month lm  on lm.game_id = p.game_id and lm.player_id = p.id
  left join market mk on mk.game_id = p.game_id
  left join start_cap sc on sc.player_id = p.id
  left join stake_values sv on sv.game_id = p.game_id and sv.player_id = p.id
)
select b.*,
       b.capital / nullif(b.start_capital, 0)                     as multiplier,
       rank()   over (partition by b.game_id order by b.capital desc) as place,
       count(*) over (partition by b.game_id)                     as rivals
from base b;

-- Как и раньше (20261017100000_close_public_api.sql): вид — только для функции game.
alter view v_standings set (security_invoker = on);
revoke all on v_standings from public;
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on v_standings from %I', r);
    end if;
  end loop;
end $$;
