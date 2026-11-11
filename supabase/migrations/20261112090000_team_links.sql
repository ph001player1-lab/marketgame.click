-- ============================================================================
--  Ссылка для входа команды.
--
--  Если код на почту не приходит, ведущий выдаёт команде ссылку: браузер,
--  открывший её, играет за эту команду без кода — только в этой игре и пока
--  она идёт; потом — вход по коду, как обычно. У команды одна ссылка: новая
--  отменяет прежнюю. Сам ключ есть только в ссылке, в базе — его хеш.
-- ============================================================================

create table team_links (
  player_id   uuid primary key references players(id) on delete cascade,
  game_id     uuid not null references games(id) on delete cascade,
  token_hash  text not null unique,
  created_by  text not null,
  created_at  timestamptz not null default now()
);
create index team_links_game on team_links (game_id);

alter table team_links           enable row level security;
