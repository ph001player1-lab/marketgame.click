-- ============================================================================
--  Итоги игр и рейтинг v5.0
--
--  v_standings — положение каждой команды в каждой игре: капитал,
--  приумножение, место, доля рынка. На нём стоят и история игр, и рейтинг.
--  Капитал — живые деньги команды: касса работающего бизнеса или
--  накопления вне его. Поэтому поправка ведущего после финала сразу видна
--  в рейтинге. Кредит из капитала не вычитается — как и в v4.9: получить
--  кредит надо суметь, и рывок на заёмных деньгах — законный приём.
--
--  player_ratings — рейтинг по лигам. Отличия от v4.9:
--    • личность — почта команды; наружу почта не отдаётся;
--    • лига — та, что задана при создании игры;
--    • учебной партии больше нет — вместо неё ведущий помечает игру Practice;
--    • игра попадает в рейтинг, как только ведущий её закрыл или рассчитан
--      последний месяц, — без часа ожидания;
--    • команда должна отыграть три четверти месяцев лиги (9, 18 или 27).
-- ============================================================================

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
base as (
  select p.game_id, p.id as player_id, p.email, p.display_name, p.restaurant_name,
         p.location_kind, p.location_state, p.location_country, p.status,
         a.months_played, a.months_in_business, lm.last_round,
         case when p.status in ('active', 'bankrupt') then p.cash
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

-- Игра идёт в рейтинг: закрыта, не учебная и доиграна до конца лиги.
create or replace function game_is_rated(p_game_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from games g
    join rounds r on r.game_id = g.id
                 and r.round_number = g.total_rounds
                 and r.status = 'closed'
    where g.id = p_game_id and g.status = 'finished' and not g.practice
  );
$$;

create or replace function player_ratings(p_league text default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with
eligible_games as (
  select g.id, g.league, g.total_rounds, g.title, g.organizer,
         coalesce(g.finished_at, g.created_at) as finished_at
  from games g
  where (p_league is null or g.league = p_league)
    and game_is_rated(g.id)
),
eligible as (
  select s.*, eg.league, eg.finished_at, eg.title, eg.organizer
  from v_standings s
  join eligible_games eg on eg.id = s.game_id
  where s.months_played >= ceil(eg.total_rounds * 0.75)
    and s.months_in_business >= 1
),
-- Место считаем заново среди засчитанных команд: кто ушёл в первом
-- месяце, не должен делать чужое место почётнее.
per_game as (
  select e.*,
         rank()   over (partition by e.game_id order by e.capital desc) as rank_place,
         count(*) over (partition by e.game_id)                        as rank_rivals
  from eligible e
),
scored as (
  select p.*,
         case when p.rank_rivals > 1
              then (p.rank_rivals - p.rank_place)::numeric / (p.rank_rivals - 1)
              else 0.5 end as place_score
  from per_game p
),
ranked as (
  select
    league,
    email,
    (array_agg(player_id        order by finished_at desc))[1] as player_key,
    (array_agg(display_name     order by finished_at desc))[1] as display_name,
    (array_agg(restaurant_name  order by finished_at desc))[1] as restaurant,
    (array_agg(location_kind    order by finished_at desc))[1] as location_kind,
    (array_agg(location_state   order by finished_at desc))[1] as location_state,
    (array_agg(location_country order by finished_at desc))[1] as location_country,
    count(*)                                   as games,
    count(*) filter (where rank_place = 1)     as wins,
    round(avg(multiplier), 2)                  as avg_multiplier,
    round(max(multiplier), 2)                  as best_multiplier,
    round(avg(place_score), 2)                 as avg_place_score,
    round(avg(capital))                        as avg_capital,
    round(avg(share) * 100, 1)                 as avg_share_pct,
    round(avg(multiplier) * 0.7 + avg(place_score) * 0.9, 3) as score,
    jsonb_agg(jsonb_build_object(
      'title', title, 'organizer', organizer, 'finishedAt', finished_at,
      'place', rank_place, 'rivals', rank_rivals,
      'capital', round(capital), 'multiplier', round(multiplier, 2),
      'sharePct', round(share * 100, 1)
    ) order by finished_at desc) as history
  from scored
  group by league, email
)
select jsonb_build_object(
  'leagues', coalesce((
    select jsonb_agg(
             jsonb_build_object(
               'league', l.league,
               'players', (
                 select coalesce(jsonb_agg(to_jsonb(r) - 'email' order by r.score desc), '[]'::jsonb)
                 from ranked r where r.league = l.league
               )
             )
             order by array_position(array['start','growth','elite'], l.league)
           )
    from (select distinct league from ranked) l
  ), '[]'::jsonb)
);
$$;
