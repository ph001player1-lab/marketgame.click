-- ============================================================================
--  РЕЙТИНГ ИГРОКОВ ПО ВСЕМ ПАРТИЯМ
--
--  Запускать целиком в SQL Editor. Ничего не меняет, только читает.
--  Единственный параметр — минимум сыгранных месяцев, он в самом низу.
--
--  ЧТО СЧИТАЕТСЯ ИТОГОВЫМ КАПИТАЛОМ
--    в бизнесе — касса за вычетом непогашенного кредита;
--    вне бизнеса — накопления.
--  Долг вычитается намеренно: игрок, взявший два миллиона и не отдавший,
--  не богаче того, кто заработал столько же своими силами.
--
--  ПОЧЕМУ НЕ ПРОСТО «У КОГО БОЛЬШЕ БАТОВ»
--  Партии идут с разными настройками: аренда, размер рынка, число
--  месяцев. Абсолютный капитал сравнивать нечестно. Поэтому основа
--  рейтинга — во сколько раз игрок приумножил СВОЙ стартовый капитал,
--  а поправка — какое место он занял среди тех, кто играл с ним рядом.
-- ============================================================================

with

-- Месяцы участия: неважно, вёл человек дело или был на госслужбе.
-- Строка в results = месяц в бизнесе, строка в wallet_entries = месяц вне.
participation as (
  select game_id, player_id, round_number from results
  union
  select game_id, player_id, round_number from wallet_entries
),

months_played as (
  select game_id, player_id, count(distinct round_number) as months
  from participation
  group by game_id, player_id
),

-- Месяцы именно в бизнесе и средняя доля рынка за них.
business_stats as (
  select
    game_id, player_id,
    count(*)                as months_in_business,
    avg(market_share)       as avg_share,
    max(cash_after)         as peak_cash,
    sum(profit)             as total_profit
  from results
  group by game_id, player_id
),

game_meta as (
  select
    id as game_id,
    code,
    coalesce((config->>'START_CAPITAL')::numeric, 100000) as start_capital,
    created_at
  from games
),

-- Итог игрока в одной партии.
per_game as (
  select
    p.game_id,
    p.id            as player_id,
    lower(p.username) as username,
    p.restaurant_name,
    p.status,
    g.code          as game_code,
    g.created_at    as game_date,
    g.start_capital,
    m.months,
    coalesce(b.months_in_business, 0) as months_in_business,
    b.avg_share,
    coalesce(b.total_profit, 0)       as total_profit,

    -- Итоговое состояние. Вне бизнеса деньги лежат в накоплениях,
    -- в бизнесе — в кассе, и оттуда вычитается непогашенный долг.
    case
      when p.status in ('civil_service','freelance','custom_employed')
        then p.employment_savings
      else p.cash - p.loan_balance
    end as net_worth
  from players p
  join months_played m on m.game_id = p.game_id and m.player_id = p.id
  join game_meta g     on g.game_id = p.game_id
  left join business_stats b on b.game_id = p.game_id and b.player_id = p.id
  where p.status <> 'left'
),

-- Множитель капитала и место внутри своей партии.
scored as (
  select
    *,
    net_worth / nullif(start_capital, 0) as multiplier,
    rank() over (partition by game_id order by net_worth desc) as place,
    count(*) over (partition by game_id)                       as rivals,

    -- Место переводим в долю от 0 до 1: первый получает 1, последний 0.
    -- В партии из одного игрока соревноваться не с кем, ставим 0.5.
    case
      when count(*) over (partition by game_id) > 1
        then (count(*) over (partition by game_id)
              - rank() over (partition by game_id order by net_worth desc))::numeric
             / (count(*) over (partition by game_id) - 1)
      else 0.5
    end as place_score
  from per_game
)

-- ---------------------------------------------------------------------------
--  ИТОГОВЫЙ РЕЙТИНГ
-- ---------------------------------------------------------------------------
select
  row_number() over (
    order by round(avg(multiplier) * 0.7 + avg(place_score) * 3 * 0.3, 3) desc
  ) as "№",

  -- Заведения показываем все, что человек называл в разных партиях,
  -- начиная с последнего. Игрок один, а вывесок может быть несколько.
  (array_agg(coalesce(restaurant_name, '@' || username) order by game_date desc))[1]
    as "заведение",
  string_agg(distinct coalesce(restaurant_name, ''), ', ')
    filter (where restaurant_name is not null) as "все заведения",
  username as "ник",

  count(*)                                as "партий в зачёте",
  sum(months)                             as "месяцев всего",
  round(avg(multiplier), 2)               as "средний множитель",
  round(avg(place_score), 2)              as "средняя доля места",
  round(avg(multiplier) * 0.7 + avg(place_score) * 3 * 0.3, 3) as "БАЛЛ",

  round(max(multiplier), 2)               as "лучший множитель",
  round(avg(net_worth))                   as "средний итог, ฿",
  round(max(net_worth))                   as "лучший итог, ฿",
  round(avg(coalesce(avg_share, 0)) * 100, 1) as "средняя доля рынка, %",
  sum(months_in_business)                 as "месяцев в бизнесе",
  sum(months) - sum(months_in_business)   as "месяцев вне бизнеса",
  count(*) filter (where place = 1)       as "побед",
  string_agg(game_code || ': ×' || round(multiplier, 1), '  ·  ' order by game_date desc)
    as "по партиям"

from scored
where months >= 9                          -- ← минимум месяцев для зачёта
group by username
order by "БАЛЛ" desc;
