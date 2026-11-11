-- ============================================================================
--  Заявки на игру по QR-коду.
--
--  Ведущий показывает QR-код со ссылкой на игру; игрок вводит почту и
--  название ресторана и нажимает «Зарегистрироваться». Заявку видит ведущий:
--  принимает отмеченные или удаляет. Принятая заявка становится командой
--  игры, а браузер, подавший её, играет без кода на почту — по своему ключу
--  (храним только его хеш). Ключ действует в этой игре, пока она идёт;
--  потом — вход по коду, как обычно. Отклонённая заявка просто удаляется.
-- ============================================================================

create table join_requests (
  id               uuid primary key default gen_random_uuid(),
  game_id          uuid not null references games(id) on delete cascade,
  email            text not null,
  restaurant_name  text not null,
  token_hash       text not null unique,
  status           text not null default 'pending' check (status in ('pending', 'approved')),
  player_id        uuid references players(id) on delete cascade,
  created_at       timestamptz not null default now(),
  decided_at       timestamptz,
  unique (game_id, email)
);
create index join_requests_game on join_requests (game_id, status);

alter table join_requests        enable row level security;
