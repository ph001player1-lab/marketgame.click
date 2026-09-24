-- ============================================================================
--  ДИАГНОСТИКА ПАРТИИ — набор запросов для разбора расхождений
--
--  Запускать по одному в SQL Editor. Ничего не меняют, только читают.
--  Везде подставьте свой код игры вместо 'TEST-01'.
--
--  Порядок неслучаен: запросы идут от «что вообще произошло» к «где
--  именно разошлось». Обычно ответ находится на втором-третьем.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. ГЛАВНАЯ ПРОВЕРКА: сходится ли касса с журналом
--
-- Журнал ledger фиксирует КАЖДОЕ движение денег. Если сумма всех движений
-- не равна текущей кассе — значит где-то деньги появились или исчезли
-- мимо журнала, и это настоящая ошибка в коде.
--
-- Если расхождений нет, экономика считает честно, и разбираться надо не
-- в ней, а в том, какие именно операции были у игроков.
-- ---------------------------------------------------------------------------
select
  p.username,
  p.status,
  p.cash                                        as касса_сейчас,
  p.employment_savings                          as накопления,
  coalesce(sum(l.amount) filter (where l.target = 'cash'), 0)    as журнал_касса,
  coalesce(sum(l.amount) filter (where l.target = 'savings'), 0) as журнал_накопления,
  round(p.cash - coalesce(sum(l.amount) filter (where l.target = 'cash'), 0), 2) as расхождение
from players p
left join ledger l on l.player_id = p.id
join games g on g.id = p.game_id
where g.code = 'TEST-01'
group by p.id, p.username, p.status, p.cash, p.employment_savings
order by abs(p.cash - coalesce(sum(l.amount) filter (where l.target = 'cash'), 0)) desc;


-- ---------------------------------------------------------------------------
-- 2. ВСЕ ДВИЖЕНИЯ ДЕНЕГ ДВУХ ИГРОКОВ РЯДОМ
--
-- Здесь сразу видно операции, которых нет в П&У: кредит, перевод, штраф,
-- субсидия. Именно они дают расхождение капитала при одинаковой прибыли.
-- Подставьте ники своих двух компаний.
-- ---------------------------------------------------------------------------
select
  l.round_number as мес,
  p.username,
  l.kind         as тип,
  l.amount       as сумма,
  l.target       as куда,
  l.reason       as причина,
  l.actor        as кто_инициировал
from ledger l
join players p on p.id = l.player_id
join games g on g.id = l.game_id
where g.code = 'TEST-01'
  and p.username in ('igrok2', 'igrok3')       -- ← ваши два ника
order by l.round_number, p.username, l.id;


-- ---------------------------------------------------------------------------
-- 3. РЕШЕНИЯ ДВУХ ИГРОКОВ РЯДОМ — правда ли стратегии были одинаковые
--
-- Автоход подставляет прошлое решение тому, кто не успел. Если один игрок
-- отправил решение, а второй промолчал, стратегии разойдутся, хотя
-- игроки договаривались об одном и том же. Колонка «автоход» это покажет.
-- ---------------------------------------------------------------------------
select
  d.round_number as мес,
  p.username,
  d.price as цена, d.seo_spend as seo, d.promo_spend as промо,
  d.maps_spend as карты, d.social_spend as соцсети,
  d.outdoor_spend as наружка, d.affiliate_spend as партнёрка,
  d.shifts_delta as смены, d.quality_invest as качество,
  d.autoplay as автоход
from decisions d
join players p on p.id = d.player_id
join games g on g.id = d.game_id
where g.code = 'TEST-01'
  and p.username in ('igrok2', 'igrok3')       -- ← ваши два ника
order by d.round_number, p.username;


-- ---------------------------------------------------------------------------
-- 4. П&У ДВУХ ИГРОКОВ ПОСТРОЧНО ЗА ОДИН МЕСЯЦ
--
-- Разворачивает расчёт по шагам. Смотреть сверху вниз: первая строка, где
-- цифры разошлись, и есть причина всего остального.
-- ---------------------------------------------------------------------------
select
  p.username,
  round(r.demand)        as спрос,
  round(r.capacity)      as ёмкость,
  round(r.served)        as обслужено,
  round(r.lost)          as потеряно,
  r.price                as цена,
  round(r.revenue)       as выручка,
  round(r.cogs_total)    as себестоимость,
  round(r.gross_profit)  as валовая,
  round(r.marketing_total) as реклама,
  round(r.shift_cost)    as смены,
  round(r.quality_upkeep) as содержание_качества,
  round(r.ebit)          as ebit,
  round(r.interest)      as проценты,
  round(r.profit)        as прибыль,
  round(r.principal_paid) as тело_кредита,
  round(r.cash_flow)     as поток,
  round(r.cash_after)    as касса_после,
  round(r.brand_after, 3) as бренд,
  round(r.reputation_after, 3) as репутация,
  round(r.quality, 3)    as качество
from results r
join players p on p.id = r.player_id
join games g on g.id = r.game_id
where g.code = 'TEST-01'
  and r.round_number = 2                        -- ← нужный месяц
order by p.username;


-- ---------------------------------------------------------------------------
-- 5. ПРОВЕРКА АРИФМЕТИКИ САМОГО РАСЧЁТА
--
-- Пересчитывает П&У по формулам заново и сравнивает с тем, что записано.
-- Любая строка в выдаче — настоящая ошибка движка. Пустая выдача означает,
-- что расчёт внутренне непротиворечив.
-- ---------------------------------------------------------------------------
select
  r.round_number as мес, p.username,
  round(r.gross_profit - (r.revenue - r.cogs_total), 2)                     as ошибка_валовой,
  round(r.profit - (r.ebit - r.interest), 2)                                as ошибка_прибыли,
  round(r.cash_flow - (r.profit - r.principal_paid), 2)                     as ошибка_потока,
  round(r.ebit - (r.gross_profit - r.rent - r.payroll - r.shift_cost
                  - r.quality_upkeep - r.quality_invest - r.marketing_total), 2) as ошибка_ebit
from results r
join players p on p.id = r.player_id
join games g on g.id = r.game_id
where g.code = 'TEST-01'
  and (abs(r.gross_profit - (r.revenue - r.cogs_total)) > 0.01
    or abs(r.profit - (r.ebit - r.interest)) > 0.01
    or abs(r.cash_flow - (r.profit - r.principal_paid)) > 0.01
    or abs(r.ebit - (r.gross_profit - r.rent - r.payroll - r.shift_cost
                     - r.quality_upkeep - r.quality_invest - r.marketing_total)) > 0.01)
order by r.round_number, p.username;


-- ---------------------------------------------------------------------------
-- 6. НЕПРЕРЫВНОСТЬ КАССЫ ПО МЕСЯЦАМ
--
-- Касса после месяца должна равняться кассе после прошлого месяца плюс
-- поток. Если не равна — между месяцами были операции вне П&У: кредит,
-- перевод, штраф. Колонка «разрыв» покажет, на сколько именно, и тогда
-- запрос №2 объяснит, откуда эти деньги.
-- ---------------------------------------------------------------------------
select
  p.username,
  r.round_number as мес,
  round(lag(r.cash_after) over w)  as касса_до,
  round(r.cash_flow)               as поток,
  round(r.cash_after)              as касса_после,
  round(r.cash_after - lag(r.cash_after) over w - r.cash_flow) as разрыв
from results r
join players p on p.id = r.player_id
join games g on g.id = r.game_id
where g.code = 'TEST-01'
window w as (partition by p.id order by r.round_number)
order by p.username, r.round_number;


-- ---------------------------------------------------------------------------
-- 7. ВСЕ ДЕЙСТВИЯ ВЕДУЩЕГО ЗА ПАРТИЮ
--
-- Штрафы, субсидии, правки настроек, входы в чужой кабинет. Через три
-- сессии вы сами не вспомните, кого и за что штрафовали.
-- ---------------------------------------------------------------------------
select
  a.created_at    as когда,
  a.action        as действие,
  p.username      as кому,
  a.payload       as детали,
  a.reason        as причина
from admin_actions a
left join players p on p.id = a.player_id
join games g on g.id = a.game_id
where g.code = 'TEST-01'
order by a.id;
