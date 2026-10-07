-- ============================================================================
--  Валюта игры: доллары или рубли.
--
--  Ведущий выбирает валюту при создании игры: для игры в России и для
--  онлайн-игры на русском по умолчанию — рубли. Игра в рублях — тот же
--  баланс, все денежные настройки × 50 (чек $30 → 1 500 ₽), налог на прибыль
--  25%. Пресеты — в supabase/functions/game/presets.ts. После создания
--  валюта не меняется: в ней уже записаны касса и все суммы игры.
--
--  Старые игры — в долларах. В истории рейтинга у каждой игры теперь есть
--  её валюта: капитал из рублёвой игры показывается в рублях. Сам рейтинг
--  от валюты не зависит: множитель и место — отношения.
-- ============================================================================

alter table games add column currency text not null default 'USD'
  check (currency in ('USD', 'RUB'));

create or replace function player_ratings(p_league text default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with
eligible_games as (
  select g.id, g.league, g.total_rounds, g.title, g.organizer, g.currency,
         coalesce(g.finished_at, g.created_at) as finished_at
  from games g
  where (p_league is null or g.league = p_league)
    and game_is_rated(g.id)
),
eligible as (
  select s.*, eg.league, eg.finished_at, eg.title, eg.organizer, eg.currency
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
      'capital', round(capital), 'currency', currency, 'multiplier', round(multiplier, 2),
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
