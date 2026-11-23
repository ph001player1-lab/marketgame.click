-- ============================================================================
--  Биржа: заявки на покупку долей, торг и аукцион. Без частных владельцев.
--
--  Команда просит владельца — город или другую команду — продать ей долю
--  компании: сколько процентов и за сколько. Владелец принимает,
--  отказывает, называет свою цену (торг без ограничения кругов) или
--  объявляет аукцион. Деньги не замораживаются: проверяются в момент
--  сделки. Заявка действует до расчёта текущего месяца; у команды не больше
--  одной открытой заявки.
--
--  Аукцион — 3 минуты, участвуют все команды, кроме продавца. Начальная
--  цена — цена заявки (она же первая ставка); каждая ставка выше лучшей
--  хотя бы на 1 и не больше денег команды; ставка в последние 15 секунд
--  продлевает аукцион на 15 секунд. Победитель платит свою ставку.
--
--  Частных владельцев больше нет: доли компании — у города и у команд,
--  вместе всегда 100%. Ничейный остаток, который ведущий мог оставить
--  раньше, уменьшив долю города, возвращается городу.
-- ============================================================================

update institutions i
set city_pct = greatest(0, 100 - coalesce(
  (select sum(s.pct) from stakes s where s.game_id = i.game_id and s.kind = i.kind), 0));

create table stake_offers (
  id           uuid primary key default gen_random_uuid(),
  game_id      uuid not null references games(id) on delete cascade,
  kind         text not null check (kind in ('landlord', 'bank', 'insurer', 'utility')),
  buyer_id     uuid not null references players(id) on delete cascade,
  -- Продавец: 'city' (отвечает ведущий) или id команды.
  seller       text not null,
  pct          numeric(7,2) not null check (pct > 0 and pct <= 100),
  -- Цена за всю долю, которая сейчас на столе.
  price        numeric(16,2) not null check (price > 0),
  -- Чей ход: продавец отвечает на заявку, покупатель — на встречную цену.
  turn         text not null default 'seller' check (turn in ('seller', 'buyer')),
  status       text not null default 'open'
               check (status in ('open', 'accepted', 'rejected', 'withdrawn', 'expired', 'auction')),
  -- Торг: [{ by: 'buyer' | 'seller', price, at }].
  history      jsonb not null default '[]',
  round_number int not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  closed_at    timestamptz
);
-- У команды не больше одной открытой заявки.
create unique index stake_offers_one_open on stake_offers (buyer_id) where status = 'open';
create index stake_offers_game on stake_offers (game_id, status);

create table auctions (
  id           uuid primary key default gen_random_uuid(),
  game_id      uuid not null references games(id) on delete cascade,
  kind         text not null check (kind in ('landlord', 'bank', 'insurer', 'utility')),
  seller       text not null,
  pct          numeric(7,2) not null check (pct > 0 and pct <= 100),
  start_price  numeric(16,2) not null,
  offer_id     uuid references stake_offers(id) on delete set null,
  round_number int not null,
  opened_at    timestamptz not null default now(),
  closes_at    timestamptz not null,
  status       text not null default 'open' check (status in ('open', 'sold', 'unsold', 'cancelled')),
  winner_id    uuid references players(id) on delete set null,
  price        numeric(16,2),
  result       jsonb,
  created_by   text not null,
  closed_at    timestamptz
);
create index auctions_game on auctions (game_id, status);

create table auction_bids (
  id           bigserial primary key,
  auction_id   uuid not null references auctions(id) on delete cascade,
  game_id      uuid not null references games(id) on delete cascade,
  player_id    uuid not null references players(id) on delete cascade,
  amount       numeric(16,2) not null check (amount > 0),
  created_at   timestamptz not null default now()
);
create index auction_bids_auction on auction_bids (auction_id, amount desc);

alter table stake_offers enable row level security;
alter table auctions     enable row level security;
alter table auction_bids enable row level security;
