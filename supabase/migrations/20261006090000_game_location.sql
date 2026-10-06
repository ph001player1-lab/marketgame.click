-- ============================================================================
--  Где идёт игра — задаёт ведущий.
--
--  Раньше каждая команда сама отвечала, где ведёт бизнес: штат США, «по
--  всей Америке» или другая страна. Теперь место — настройка игры:
--
--    games.region  — часть света: north_america, latin_america, europe,
--                    cis (Россия и СНГ), middle_east_africa, asia, oceania —
--                    или online: команды из разных стран и регионов;
--    games.country — страна, код ISO 3166-1 (US, RU, DE); у онлайн-игры нет;
--    games.area    — штат США (TX), регион России (MOW — коды как на
--                    marketgame.quest) или город текстом; можно не указывать.
--
--  В игре в одном месте команды вводят только имя и название ресторана и
--  оказываются там же, где игра. В онлайн-игре каждая команда указывает
--  страну и штат, регион или город: players.location_country и
--  players.location_area. Списки кодов — в supabase/functions/game/geo.ts.
--
--  Старые игры становятся онлайн-играми: в них команды выбирали место
--  сами. Их ответы переводим: штат → US и штат, «по всей Америке» → US,
--  другая страна — её название текстом (код из текста не угадать).
--
--  v_standings и player_ratings отдают место, где команда вела бизнес в
--  этой игре: location_country и location_area вместо location_kind,
--  location_state и location_country.
-- ============================================================================

alter table games
  add column region  text not null default 'online' check (region in (
    'north_america', 'latin_america', 'europe', 'cis', 'middle_east_africa', 'asia', 'oceania', 'online')),
  add column country text check (country ~ '^[A-Z]{2}$'),
  add column area    text check (char_length(area) <= 60);

alter table games add constraint games_place_check check (
  case when region = 'online' then country is null and area is null else country is not null end);

alter table players add column location_area text check (char_length(location_area) <= 60);

update players set location_country = 'US', location_area = upper(location_state)
 where location_kind = 'state';
update players set location_country = 'US', location_area = null
 where location_kind = 'multistate';
update players set location_area = left(nullif(btrim(location_country), ''), 60), location_country = null
 where location_kind = 'international';
update players set location_country = null, location_area = null
 where location_kind is null;

alter table players add constraint players_location_country_check check (location_country ~ '^[A-Z]{2}$');

-- Вид читает старые столбцы — пересоздаём его после их удаления.
drop view v_standings;
alter table players drop column location_kind, drop column location_state;

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
         -- Где команда вела бизнес: в игре в одном месте — там же, где игра,
         -- в онлайн-игре — то, что команда указала сама.
         case when g.region = 'online' then p.location_country else g.country end as location_country,
         case when g.region = 'online' then p.location_area else g.area end as location_area,
         p.status,
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
    (array_agg(location_country order by finished_at desc))[1] as location_country,
    (array_agg(location_area    order by finished_at desc))[1] as location_area,
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
