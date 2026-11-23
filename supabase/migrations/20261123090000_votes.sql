-- ============================================================================
--  Голосования.
--
--  Ведущий выносит на голосование закон (налог на прибыль, аренду, ставку
--  по кредитам, зарплату на госслужбе), разовый сбор или грант — или свой
--  вопрос. Голосует каждая команда игры (кроме вышедших): «за», «против»,
--  «воздержался»; до конца голосования голос можно изменить. Пока идёт
--  голосование, видно только, сколько команд проголосовало; итог — после
--  конца. Принятое решение ведущий подписывает или отклоняет (вето):
--  подписанный закон вступает в силу со следующего месяца, сбор или грант
--  исполняются сразу. Месяц продлевается на время голосования.
-- ============================================================================

create table votes (
  id          uuid primary key default gen_random_uuid(),
  game_id     uuid not null references games(id) on delete cascade,
  round_number int not null,
  template    text not null,
  question    text,
  value       numeric,
  rule        text not null default 'all' check (rule in ('all', 'voted')),
  seconds     int not null,
  opened_at   timestamptz not null default now(),
  closes_at   timestamptz not null,
  status      text not null default 'open' check (status in ('open', 'closed', 'cancelled')),
  result      jsonb,
  -- Принятое голосованием ждёт ведущего: подписать или наложить вето.
  decision    text check (decision in ('pending', 'signed', 'vetoed')),
  decided_at  timestamptz,
  decided_by  text,
  applied     jsonb,
  created_by  text not null,
  closed_at   timestamptz
);
-- В игре идёт не больше одного голосования.
create unique index votes_one_open on votes (game_id) where status = 'open';
create index votes_game on votes (game_id, opened_at);

create table vote_ballots (
  vote_id     uuid not null references votes(id) on delete cascade,
  game_id     uuid not null references games(id) on delete cascade,
  player_id   uuid not null references players(id) on delete cascade,
  choice      text not null check (choice in ('yes', 'no', 'abstain')),
  cast_at     timestamptz not null default now(),
  primary key (vote_id, player_id)
);

alter table votes                enable row level security;
alter table vote_ballots         enable row level security;
