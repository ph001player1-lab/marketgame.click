-- ============================================================================
--  Market Game — схема базы v5.0
--
--  Отличия от v4.9:
--    • личность — почта, а не ник Telegram; почты видят только ведущий и
--      администратор;
--    • много игр одновременно, у каждой свой ведущий, лига и код табло;
--    • правила месяца фиксируются при его открытии (rounds.config);
--    • арендодатель, банк, страховая и коммунальщики — четыре участника
--      экономики с долей города и долями игроков;
--    • бюджет города — журнал city_ledger, помесячный отчёт собирается из
--      него, а не хранится отдельно.
--
--  RLS включён на всех таблицах, политик нет: публичный ключ не может
--  ничего. Вся работа идёт через Edge Function, как и в v4.9.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- ВЕДУЩИЕ
-- Администраторы задаются секретом ADMIN_EMAILS и сюда не пишутся:
-- администратор ведёт игры и без записи в этой таблице.
create table hosts (
  email       text primary key check (email = lower(email)),
  added_by    text not null,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- ИГРЫ
create table games (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,             -- код табло, 6 знаков
  title             text not null,
  league            text not null check (league in ('start','growth','elite')),
  total_rounds      int  not null check (total_rounds in (12, 24, 36)),
  practice          boolean not null default false,   -- учебная: вне рейтинга
  status            text not null default 'setup'
                    check (status in ('setup','running','finished')),
  current_round     int  not null default 0,
  host_email        text not null check (host_email = lower(host_email)),
  organizer         text,                             -- палата-организатор
  sponsor_name      text,
  sponsor_logo_url  text,
  sponsor_url       text,
  timezone          text not null default 'America/New_York',
  scheduled_at      timestamptz,
  open_book         boolean not null default true,    -- решения всех видны после финала
  config            jsonb not null,                   -- правила следующего месяца
  series_id         uuid,                             -- «сыграть ещё раз» тем же составом
  created_at        timestamptz not null default now(),
  started_at        timestamptz,
  finished_at       timestamptz
);

create index games_host_idx on games (host_email, created_at desc);

-- ---------------------------------------------------------------- КОМАНДЫ
create table players (
  id               uuid primary key default gen_random_uuid(),
  game_id          uuid not null references games(id) on delete cascade,
  email            text not null check (email = lower(email)),
  display_name     text,
  restaurant_name  text,
  -- Где команда ведёт бизнес — как в селекторе marketgame.biz.
  location_kind    text check (location_kind in ('state','multistate','international')),
  location_state   text,                              -- код штата: TX, OH, DC
  location_country text,                              -- для международных

  cash             numeric(14,2) not null default 0,
  brand            numeric(10,4) not null default 0,
  reputation       numeric(10,4) not null default 1,
  quality          numeric(10,4) not null default 0,
  capacity_shifts  int           not null default 0,

  seo_level            numeric(14,4) not null default 0,
  seo_streak           int           not null default 0,
  seo_unlocked         boolean       not null default false,
  maps_level           numeric(14,4) not null default 0,
  social_adstock       numeric(14,4) not null default 0,
  outdoor_level        numeric(10,4) not null default 0,
  outdoor_active_until int           not null default 0,
  affiliate_active     boolean       not null default false,

  loan_tier               int           not null default 0,
  loan_balance            numeric(14,2) not null default 0,
  loan_term_left          int           not null default 0,
  loan_monthly_principal  numeric(14,2) not null default 0,
  cf_positive_streak      int           not null default 0,
  ever_missed_payment     boolean       not null default false,
  tax_loss_cf             numeric(14,2) not null default 0,  -- непокрытые убытки

  employment_savings      numeric(14,2) not null default 0,
  custom_profession_name  text,
  employer_id             uuid references players(id) on delete set null,
  proposed_salary         numeric(14,2) not null default 0,
  employment_approved     boolean       not null default false,
  salary_paid_this_round  boolean       not null default false,
  service_since_round     int not null default 0,
  last_salary_round       int not null default 0,
  savings_last_round      numeric(14,2) not null default 0,

  status      text not null default 'active'
              check (status in ('active','bankrupt','civil_service','freelance','custom_employed','left')),
  -- Ссылка на отчёт команды для напарников: без входа, только чтение.
  report_token uuid not null default gen_random_uuid() unique,
  joined_at   timestamptz,
  created_at  timestamptz not null default now(),
  unique (game_id, email)
);

create index players_email_idx on players (email);

-- ---------------------------------------------------------------- МЕСЯЦЫ
create table rounds (
  id           uuid primary key default gen_random_uuid(),
  game_id      uuid not null references games(id) on delete cascade,
  round_number int  not null,
  status       text not null default 'open' check (status in ('open','closed')),
  opened_at    timestamptz,
  closed_at    timestamptz,
  deadline     timestamptz,
  config       jsonb not null,          -- правила, с которыми месяц открыт
  unique (game_id, round_number)
);

-- ---------------------------------------------------------------- РЕШЕНИЯ
create table decisions (
  id             uuid primary key default gen_random_uuid(),
  game_id        uuid not null references games(id) on delete cascade,
  round_number   int  not null,
  player_id      uuid not null references players(id) on delete cascade,
  price            numeric(10,2) not null,
  seo_spend        numeric(14,2) not null default 0,
  promo_spend      numeric(14,2) not null default 0,
  maps_spend       numeric(14,2) not null default 0,
  social_spend     numeric(14,2) not null default 0,
  outdoor_spend    numeric(14,2) not null default 0,
  affiliate_spend  numeric(14,2) not null default 0,
  shifts_delta     int           not null default 0,
  quality_invest   numeric(14,2) not null default 0,
  autoplay      boolean not null default false,
  submitted_at  timestamptz not null default now(),
  unique (game_id, round_number, player_id)
);

-- ---------------------------------------------------------------- РЕЗУЛЬТАТЫ
create table results (
  id            uuid primary key default gen_random_uuid(),
  game_id       uuid not null references games(id) on delete cascade,
  round_number  int  not null,
  player_id     uuid not null references players(id) on delete cascade,
  price numeric(10,2), demand numeric(14,2), served numeric(14,2), lost numeric(14,2),
  revenue numeric(14,2), cogs_total numeric(14,2), gross_profit numeric(14,2),
  rent numeric(14,2), insurance numeric(14,2), utilities numeric(14,2),
  payroll numeric(14,2), shift_cost numeric(14,2),
  quality_upkeep numeric(14,2), quality_invest numeric(14,2),
  marketing_total numeric(14,2), marketing_effect numeric(14,4),
  ebit numeric(14,2), interest numeric(14,2), profit_before_tax numeric(14,2),
  tax numeric(14,2), profit numeric(14,2), principal_paid numeric(14,2),
  cash_flow numeric(14,2), cash_after numeric(14,2),
  brand_after numeric(10,4), reputation_after numeric(10,4),
  quality numeric(10,4), capacity numeric(14,2),
  market_share numeric(10,6), market_total numeric(14,2),
  seo_spend numeric(14,2), promo_spend numeric(14,2), maps_spend numeric(14,2),
  social_spend numeric(14,2), outdoor_spend numeric(14,2), affiliate_spend numeric(14,2),
  -- Дивиденды с долей, полученные в этом месяце. Входят в cash_after, но не
  -- в cash_flow: это доход владельца, а не ресторана.
  dividends numeric(14,2) not null default 0,
  loan_balance_after numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (game_id, round_number, player_id)
);

-- ------------------------------------------------------- МЕСЯЦЫ ВНЕ БИЗНЕСА
create table wallet_entries (
  id            uuid primary key default gen_random_uuid(),
  game_id       uuid not null references games(id) on delete cascade,
  round_number  int  not null,
  player_id     uuid not null references players(id) on delete cascade,
  status        text not null,
  savings       numeric(14,2) not null,
  income        numeric(14,2) not null,
  created_at    timestamptz not null default now(),
  unique (game_id, round_number, player_id)
);

-- ------------------------------------------------------- ЖУРНАЛ ДЕНЕГ ИГРОКОВ
-- Каждое движение денег команды — отдельной строкой. Касса и накопления в
-- players — быстрые суммы для чтения, источник правды — здесь.
create table ledger (
  id            bigserial primary key,
  game_id       uuid not null references games(id) on delete cascade,
  player_id     uuid not null references players(id) on delete cascade,
  round_number  int  not null default 0,
  kind          text not null check (kind in (
                  'start_capital','month_cash_flow','loan_out','loan_repay',
                  'transfer_in','transfer_out','civil_salary','employer_salary',
                  'settlement','bankruptcy','reopen','fine','grant','city_tax',
                  'dividend','stake_buy','stake_sell')),
  amount        numeric(14,2) not null,              -- со знаком
  target        text not null default 'cash' check (target in ('cash','savings')),
  reason        text,
  actor         text,
  created_at    timestamptz not null default now()
);

create index ledger_player_idx on ledger (player_id, id);

-- ---------------------------------------------------------------- ПЕРЕВОДЫ
create table transfers (
  id            uuid primary key default gen_random_uuid(),
  game_id       uuid not null references games(id) on delete cascade,
  from_player   uuid not null references players(id) on delete cascade,
  to_player     uuid not null references players(id) on delete cascade,
  amount        numeric(14,2) not null check (amount > 0),
  round_number  int not null default 0,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------- УВЕДОМЛЕНИЯ
-- Лимит кредита, штрафы, гранты, сделки с долями — всё, что игрок должен
-- увидеть, даже если нажимал в это время что-то другое.
create table notices (
  id            bigserial primary key,
  game_id       uuid not null references games(id) on delete cascade,
  player_id     uuid not null references players(id) on delete cascade,
  round_number  int not null default 0,
  kind          text not null,
  message       text not null,
  read          boolean not null default false,
  created_at    timestamptz not null default now()
);

create index notices_unread_idx on notices (player_id) where read = false;

-- ------------------------------------------------------- ДЕЙСТВИЯ ВЕДУЩЕГО
create table host_actions (
  id          bigserial primary key,
  game_id     uuid references games(id) on delete cascade,
  actor       text not null,
  player_id   uuid references players(id) on delete cascade,
  action      text not null,
  payload     jsonb,
  reason      text,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------- ЗАЩИТА ОТ ПОВТОРОВ
-- Клиент присылает уникальный id на каждое действие с деньгами. Повтор при
-- обрыве связи вернёт сохранённый ответ вместо второго списания.
create table mutations (
  id          uuid primary key,
  game_id     uuid references games(id) on delete cascade,
  email       text,
  action      text not null,
  result      jsonb,
  created_at  timestamptz not null default now()
);

-- ============================================================================
--  УЧАСТНИКИ ЭКОНОМИКИ: арендодатель, банк, страховая, коммунальщики
-- ============================================================================

create table institutions (
  game_id   uuid not null references games(id) on delete cascade,
  kind      text not null check (kind in ('landlord','bank','insurer','utility')),
  city_pct  numeric(7,4) not null default 50 check (city_pct between 0 and 100),
  loss_cf   numeric(14,2) not null default 0,       -- непокрытый убыток прошлых месяцев
  primary key (game_id, kind)
);

-- Доли игроков. Город продаёт их из своей доли, частная доля — остаток.
create table stakes (
  game_id    uuid not null references games(id) on delete cascade,
  kind       text not null check (kind in ('landlord','bank','insurer','utility')),
  player_id  uuid not null references players(id) on delete cascade,
  pct        numeric(7,4) not null check (pct > 0 and pct <= 100),
  primary key (game_id, kind, player_id)
);

-- Итоги месяца по каждому участнику — для графиков и истории. Хранятся,
-- а не пересчитываются: доли потом меняются, а выплаты уже сделаны.
create table institution_months (
  game_id       uuid not null references games(id) on delete cascade,
  round_number  int  not null,
  kind          text not null,
  income        numeric(14,2) not null default 0,
  write_offs    numeric(14,2) not null default 0,
  profit        numeric(14,2) not null default 0,
  payout        numeric(14,2) not null default 0,
  to_city       numeric(14,2) not null default 0,
  to_players    numeric(14,2) not null default 0,
  to_private    numeric(14,2) not null default 0,
  city_pct      numeric(7,4)  not null default 0,
  players_pct   numeric(7,4)  not null default 0,
  loss_cf_after numeric(14,2) not null default 0,
  loans_outstanding numeric(14,2),                  -- только у банка
  primary key (game_id, round_number, kind)
);

-- Кредиты, которые закрывшийся бизнес не вернул. Убыток банка того месяца,
-- в котором закрылось дело.
create table loan_write_offs (
  id            bigserial primary key,
  game_id       uuid not null references games(id) on delete cascade,
  player_id     uuid not null references players(id) on delete cascade,
  round_number  int not null,                       -- учётный месяц
  amount        numeric(14,2) not null check (amount > 0),
  created_at    timestamptz not null default now()
);

-- ============================================================================
--  БЮДЖЕТ ГОРОДА
--
--  Каждое движение денег города — строкой со знаком: плюс — доход, минус —
--  расход. Учётный месяц — открытый; если месяц закрыт, запись относится к
--  следующему. Так штраф между месяцами не теряется (в v4.9 терялся).
-- ============================================================================

create table city_ledger (
  id            bigserial primary key,
  game_id       uuid not null references games(id) on delete cascade,
  round_number  int  not null,
  kind          text not null check (kind in (
                  'profit_tax','fine','city_tax','grant','civil_salary',
                  'dividend','stake_sale','stake_buyback')),
  amount        numeric(14,2) not null,
  player_id     uuid references players(id) on delete set null,
  institution   text,
  reason        text,
  actor         text,
  created_at    timestamptz not null default now()
);

create index city_ledger_game_idx on city_ledger (game_id, round_number);

-- ============================================================================
--  RLS: включаем везде, политик не создаём.
-- ============================================================================
alter table hosts              enable row level security;
alter table games              enable row level security;
alter table players            enable row level security;
alter table rounds             enable row level security;
alter table decisions          enable row level security;
alter table results            enable row level security;
alter table wallet_entries     enable row level security;
alter table ledger             enable row level security;
alter table transfers          enable row level security;
alter table notices            enable row level security;
alter table host_actions       enable row level security;
alter table mutations          enable row level security;
alter table institutions       enable row level security;
alter table stakes             enable row level security;
alter table institution_months enable row level security;
alter table loan_write_offs    enable row level security;
alter table city_ledger        enable row level security;
