-- ============================================================================
--  РЕЙТИНГ ИГРОКОВ ПО ЛИГАМ — v4.8
--  Заменяет предыдущую версию функции. Запускать целиком в SQL Editor.
--
--  ЛИГИ
--  Партии бывают на 12, 24 и 36 месяцев, и это разные соревнования.
--  Рейтинг ведётся отдельно по каждой: сравнивать годовую партию с
--  трёхлетней бессмысленно, там разная глубина стратегии.
--
--  УЧЕБНАЯ ПАРТИЯ
--  Первая доигранная партия на 12 месяцев в зачёт не идёт — она уходит на
--  то, чтобы разобраться в правилах. Игрок после неё числится в лиге 12
--  как прошедший обучение, но без цифр: со следующей партии считается
--  всерьёз. Учебной засчитывается только та партия, где человек хотя бы
--  месяц вёл своё дело — отсидеться все двенадцать на госслужбе и
--  считаться обученным нельзя.
--  В лигах 24 и 36 учебных партий нет: туда приходят уже понимая игру.
--
--  ДОЛЯ РЫНКА
--  Все обслуженные клиенты игрока за лигу, делённые на весь рынок лиги.
--  Раньше усреднялась только по месяцам в бизнесе, из-за чего у игрока с
--  двумя месяцами торговли выходило 17% вместо трёх, а сумма долей всех
--  игроков переваливала за 100%.
-- ============================================================================

-- ---------------------------------------------------------------------------
--  Ручной зачёт обучения.
--
--  Часть игроков проходила партии до того, как завели базу, и их учебная
--  игра нигде не записана. Подделывать им партию с выдуманными
--  результатами нельзя: цифры попали бы в общий рынок и в места
--  соперников, и рейтинг перестал бы быть честным. Поэтому обучение
--  отмечается отдельной записью — видно, кто её поставил и на каком
--  основании.
--
--  Что даёт запись: у игрока не отнимается первая партия под учебную,
--  первая же сыгранная идёт в зачёт.
--
--  Таблица заводится здесь, а не отдельным файлом, потому что функция
--  ниже без неё не создастся. Наполняется файлом 08.
-- ---------------------------------------------------------------------------
create table if not exists training_credits (
  username    text primary key,
  note        text,
  granted_by  text,
  granted_at  timestamptz not null default now()
);

alter table training_credits enable row level security;


create or replace function player_ratings(
  p_min_games   int default 1,   -- минимум ЗАЧЁТНЫХ партий (сверх учебной)
  p_min_months  int default 9,   -- минимум сыгранных месяцев в партии
  p_idle_hours  int default 1    -- простой, после которого партия считается доигранной
) returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with
game_league as (
  select
    g.id as game_id, g.code, g.created_at, g.status,
    coalesce((g.config->>'START_CAPITAL')::numeric, 100000) as start_capital,
    least(floor(max(r.round_number) / 12.0)::int * 12, 36)  as league
  from games g
  join rounds r on r.game_id = g.id and r.status = 'closed'
  group by g.id, g.code, g.created_at, g.status, g.config
  having least(floor(max(r.round_number) / 12.0)::int * 12, 36) >= 12
     and (
       g.status in ('finished','archived')
       or max(r.closed_at) < now() - make_interval(hours => p_idle_hours)
     )
),

-- Общий рынок лиги. market_total одинаков для всех игроков в месяце,
-- поэтому берём его по одному разу на месяц и складываем.
league_market as (
  select gl.game_id, sum(m.market_total) as total_market
  from game_league gl
  join (
    select r.game_id, r.round_number, max(r.market_total) as market_total
    from results r
    group by r.game_id, r.round_number
  ) m on m.game_id = gl.game_id and m.round_number <= gl.league
  group by gl.game_id
),

participation as (
  select gl.game_id, x.player_id, count(distinct x.round_number) as months
  from game_league gl
  join (
    select game_id, player_id, round_number from results
    union
    select game_id, player_id, round_number from wallet_entries
  ) x on x.game_id = gl.game_id and x.round_number <= gl.league
  group by gl.game_id, x.player_id
),

finish as (
  select distinct on (gl.game_id, x.player_id)
    gl.game_id, x.player_id, x.capital
  from game_league gl
  join (
    select game_id, player_id, round_number, cash_after as capital from results
    union all
    select game_id, player_id, round_number, savings    as capital from wallet_entries
  ) x on x.game_id = gl.game_id and x.round_number <= gl.league
  order by gl.game_id, x.player_id, x.round_number desc
),

debt as (
  select
    gl.game_id, pl.id as player_id,
    greatest(0,
      coalesce((select sum(l.amount) from ledger l
                where l.player_id = pl.id and l.kind = 'loan_out'
                  and l.round_number <= gl.league), 0)
      - coalesce((select sum(abs(l.amount)) from ledger l
                  where l.player_id = pl.id and l.kind = 'loan_repay'
                    and l.round_number <= gl.league), 0)
      - coalesce((select sum(r.principal_paid) from results r
                  where r.player_id = pl.id and r.round_number <= gl.league), 0)
    ) as loan_left
  from game_league gl
  join players pl on pl.game_id = gl.game_id
),

biz as (
  select
    gl.game_id, r.player_id,
    count(*)      as months_in_business,
    sum(r.served) as served_total
  from game_league gl
  join results r on r.game_id = gl.game_id and r.round_number <= gl.league
  group by gl.game_id, r.player_id
),

per_game as (
  select
    gl.game_id, gl.code as game_code, gl.created_at as game_date,
    gl.league, gl.start_capital,
    pl.id as player_id, lower(pl.username) as username, pl.restaurant_name,
    pa.months,
    coalesce(b.months_in_business, 0) as months_in_business,
    coalesce(f.capital, 0)            as capital,
    coalesce(d.loan_left, 0)          as loan_left,
    coalesce(f.capital, 0) / nullif(gl.start_capital, 0)      as multiplier,
    coalesce(b.served_total, 0) / nullif(lm.total_market, 0)  as share
  from game_league gl
  join players pl       on pl.game_id = gl.game_id
  join participation pa on pa.game_id = gl.game_id and pa.player_id = pl.id
  left join league_market lm on lm.game_id = gl.game_id
  left join finish f    on f.game_id = gl.game_id and f.player_id = pl.id
  left join debt d      on d.game_id = gl.game_id and d.player_id = pl.id
  left join biz b       on b.game_id = gl.game_id and b.player_id = pl.id
  where pa.months >= p_min_months
    -- Кто ни месяца не вёл своего дела, не оценивается ни как ресторатор,
    -- ни как ученик: игры для него, по сути, не было.
    and coalesce(b.months_in_business, 0) >= 1
),

-- Учебная партия — первая доигранная двенадцатимесячная у игрока.
training as (
  select username, game_id
  from (
    select username, game_id,
           -- Дополнительный ключ сортировки обязателен: две партии,
           -- созданные в одну секунду, иначе упорядочиваются произвольно,
           -- и учебной у разных игроков оказывалась разная партия.
           row_number() over (
             partition by username
             order by game_date, game_code, game_id
           ) as rn
    from per_game
    where league = 12
      -- Кому обучение зачтено вручную, учебная партия не назначается:
      -- они уже играли раньше, и первая же партия здесь идёт в зачёт.
      and username not in (select username from training_credits)
  ) t
  where rn = 1
),

scored_games as (
  select pg.*
  from per_game pg
  left join training t on t.username = pg.username and t.game_id = pg.game_id
  where t.game_id is null
),

scored as (
  select
    *,
    rank() over (partition by game_id order by capital desc) as place,
    count(*) over (partition by game_id)                     as rivals,
    case
      when count(*) over (partition by game_id) > 1
        then (count(*) over (partition by game_id)
              - rank() over (partition by game_id order by capital desc))::numeric
             / (count(*) over (partition by game_id) - 1)
      else 0.5
    end as place_score
  from scored_games
),

ranked as (
  select
    league,
    username,
    (array_agg(coalesce(restaurant_name, '@' || username) order by game_date desc))[1] as restaurant,
    count(*)                          as games,
    sum(months)                       as months,
    sum(months_in_business)           as months_in_business,
    round(avg(multiplier), 2)         as avg_multiplier,
    round(max(multiplier), 2)         as best_multiplier,
    round(avg(place_score), 2)        as avg_place_score,
    count(*) filter (where place = 1) as wins,
    round(avg(capital))               as avg_capital,
    round(max(capital))               as best_capital,
    round(avg(loan_left))             as avg_debt,
    round(avg(share) * 100, 1)        as avg_share_pct,
    round(avg(multiplier) * 0.7 + avg(place_score) * 3 * 0.3, 3) as score,
    jsonb_agg(jsonb_build_object(
      'game', game_code, 'place', place, 'rivals', rivals,
      'capital', round(capital), 'multiplier', round(multiplier, 2),
      'debt', round(loan_left), 'share', round(share * 100, 1)
    ) order by game_date desc) as history
  from scored
  group by league, username
  having count(*) >= p_min_games
),

-- Прошли обучение, но зачётных партий ещё нет. Показываются в лиге 12
-- без цифр: человек уже в системе, следующая партия пойдёт в зачёт.
trainees as (
  -- Прошли учебную партию здесь, в системе.
  select
    pg.username,
    (array_agg(coalesce(pg.restaurant_name, '@' || pg.username) order by pg.game_date desc))[1] as restaurant,
    max(pg.game_code) as training_game
  from per_game pg
  join training t on t.username = pg.username and t.game_id = pg.game_id
  where not exists (
    select 1 from ranked rk where rk.username = pg.username and rk.league = 12
  )
  group by pg.username

  union all

  -- Обучение зачтено вручную: играли до того, как завели базу.
  select
    tc.username,
    coalesce(
      (select p.restaurant_name from players p
        where lower(p.username) = tc.username and p.restaurant_name is not null
        order by p.created_at desc limit 1),
      '@' || tc.username
    ) as restaurant,
    coalesce(tc.note, 'зачтено ведущим') as training_game
  from training_credits tc
  where not exists (
    select 1 from ranked rk where rk.username = tc.username and rk.league = 12
  )
)

select jsonb_build_object(
  'leagues', (
    select coalesce(jsonb_agg(x order by x.league), '[]'::jsonb)
    from (
      select
        l.league,
        (select coalesce(jsonb_agg(to_jsonb(r) order by r.score desc), '[]'::jsonb)
         from ranked r where r.league = l.league) as players
      from (select distinct league from game_league) l
    ) x
  ),
  'trainees', (select coalesce(jsonb_agg(to_jsonb(t) order by t.restaurant), '[]'::jsonb) from trainees t)
);
$$;
