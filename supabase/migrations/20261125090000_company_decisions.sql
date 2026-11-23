-- ============================================================================
--  Решения акционеров, «Потолок цены» и инициативы команд.
--
--  Цену услуги компании — аренду, страховку, коммунальные, ставку по
--  кредитам — решают владельцы компании, а не голосование горожан:
--
--    больше 50% — контрольный пакет: владелец сам ставит цену, а у
--      владельцев больше 30% (блокирующий пакет) есть 3 минуты на вето;
--    контрольного пакета нет — собрание акционеров на 3 минуты: голоса
--      весят по долям, принято, если «за» больше 50% всех долей; «против»
--      владельца больше 30% — вето.
--
--  Долей города голосует ведущий, частные владельцы не голосуют. Реестр
--  владельцев — на момент предложения (owners). Принятая цена вступает в
--  силу со следующего месяца.
--
--  Горожане голосуют за закон «Потолок цены» (votes.target — компания):
--  цена компании не может быть выше потолка. Команда может предложить
--  вопрос на голосование горожан — инициатива; на голосование её выносит
--  ведущий.
-- ============================================================================

create table company_decisions (
  id           uuid primary key default gen_random_uuid(),
  game_id      uuid not null references games(id) on delete cascade,
  kind         text not null check (kind in ('landlord', 'bank', 'insurer', 'utility')),
  round_number int not null,
  -- control — у предложившего контрольный пакет; meeting — собрание.
  mode         text not null check (mode in ('control', 'meeting')),
  -- Новая цена и прежняя — в единицах настройки (ставка — долей: 0.12).
  value        numeric not null,
  old_value    numeric,
  -- Кто предложил: 'city' (ведущий за город) или id команды.
  proposer     text not null,
  -- Реестр на момент предложения: [{ id, label, pct }].
  owners       jsonb not null,
  opened_at    timestamptz not null default now(),
  closes_at    timestamptz not null,
  status       text not null default 'open'
               check (status in ('open', 'passed', 'rejected', 'vetoed', 'cancelled')),
  result       jsonb,
  applied      jsonb,
  created_by   text not null,
  closed_at    timestamptz
);
-- По каждой компании идёт не больше одного решения.
create unique index company_decisions_one_open on company_decisions (game_id, kind) where status = 'open';
create index company_decisions_game on company_decisions (game_id, opened_at);

create table company_ballots (
  decision_id  uuid not null references company_decisions(id) on delete cascade,
  game_id      uuid not null references games(id) on delete cascade,
  -- 'city' или id команды.
  owner        text not null,
  choice       text not null check (choice in ('yes', 'no')),
  cast_at      timestamptz not null default now(),
  primary key (decision_id, owner)
);

create table initiatives (
  id           uuid primary key default gen_random_uuid(),
  game_id      uuid not null references games(id) on delete cascade,
  player_id    uuid not null references players(id) on delete cascade,
  template     text not null,
  target       text,
  value        numeric,
  question     text,
  status       text not null default 'pending'
               check (status in ('pending', 'voted', 'rejected', 'withdrawn')),
  created_at   timestamptz not null default now(),
  decided_at   timestamptz,
  decided_by   text
);
-- У команды не больше одной инициативы, которая ждёт ведущего.
create unique index initiatives_one_pending on initiatives (player_id) where status = 'pending';
create index initiatives_game on initiatives (game_id, created_at);

alter table votes add column target text;
alter table votes add column initiative_id uuid references initiatives(id) on delete set null;
-- Команда, чья инициатива вынесена на голосование, — как её звали тогда.
alter table votes add column proposer text;

alter table company_decisions enable row level security;
alter table company_ballots   enable row level security;
alter table initiatives       enable row level security;
