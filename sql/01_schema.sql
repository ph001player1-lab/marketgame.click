-- ============================================================================
--  "Захвати рынок или закрой бизнес" — схема БД v4.0 (Supabase / Postgres)
--  Шаг 2 маршрутной карты. Запускать целиком в SQL Editor.
--
--  Безопасно к повторному запуску: всё создаётся через IF NOT EXISTS,
--  повторный прогон ничего не ломает и не стирает.
--
--  ВАЖНО ПРО ДОСТУП. RLS включён на всех таблицах, но политик НЕТ ни одной.
--  Это сделано намеренно: публичный ключ anon, который уезжает в браузер,
--  не может прочитать или записать вообще ничего. Вся работа с данными идёт
--  через Edge Function с сервисным ключом, а он RLS обходит.
--  Так снимается главная мина новичка в Supabase — забытая политика доступа.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- ИГРЫ
-- Каждая сессия — отдельная игра. Больше не нужно "сбрасывать" партию,
-- разрушая данные: старая просто остаётся в архиве со статусом finished,
-- и к ней можно вернуться, чтобы посмотреть, чем всё кончилось.
create table if not exists games (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,              -- короткий код сессии, напр. 'PHUKET-01'
  title          text,
  status         text not null default 'setup'
                 check (status in ('setup','running','finished','archived')),
  current_round  int  not null default 0,
  total_rounds   int  not null default 12,
  admin_username text not null,                     -- ник ведущего, без @
  config         jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------- ИГРОКИ
create table if not exists players (
  id               uuid primary key default gen_random_uuid(),
  game_id          uuid not null references games(id) on delete cascade,
  username         text not null,                   -- telegram username, без @
  display_name     text,
  restaurant_name  text,

  -- Деньги и базовые показатели заведения
  cash             numeric(14,2) not null default 0,
  brand            numeric(10,4) not null default 0,
  reputation       numeric(10,4) not null default 1,
  quality          numeric(10,4) not null default 0,
  capacity_shifts  int           not null default 0,

  -- Маркетинговые каналы: состояние, переносимое между месяцами
  seo_level            numeric(10,4) not null default 0,
  seo_streak           int           not null default 0,
  seo_unlocked         boolean       not null default false,
  maps_level           numeric(10,4) not null default 0,
  social_adstock       numeric(10,4) not null default 0,
  outdoor_level        numeric(10,4) not null default 0,
  outdoor_active_until int           not null default 0,
  affiliate_active     boolean       not null default false,

  -- Банк
  loan_tier               int           not null default 0,
  loan_balance            numeric(14,2) not null default 0,
  loan_term_left          int           not null default 0,
  loan_monthly_principal  numeric(14,2) not null default 0,
  cf_positive_streak      int           not null default 0,
  ever_missed_payment     boolean       not null default false,

  -- Жизнь вне бизнеса
  employment_savings      numeric(14,2) not null default 0,
  custom_profession_name  text,
  employer_username       text,
  proposed_salary         numeric(14,2) not null default 0,
  employment_approved     boolean       not null default false,
  salary_paid_this_round  boolean       not null default false,
  service_since_round     int not null default 0,
  last_salary_round       int not null default 0,
  savings_last_round      numeric(14,2) not null default 0,

  status      text not null default 'active'
              check (status in ('active','bankrupt','civil_service','freelance','custom_employed','left')),
  joined_at   timestamptz,
  created_at  timestamptz not null default now()
);

-- Ник уникален в пределах одной игры и нечувствителен к регистру:
-- @Ivan и @ivan — один человек, как и в текущей версии.
create unique index if not exists players_game_username_uidx
  on players (game_id, lower(username));

-- ---------------------------------------------------------------- МЕСЯЦЫ
create table if not exists rounds (
  id           uuid primary key default gen_random_uuid(),
  game_id      uuid not null references games(id) on delete cascade,
  round_number int  not null,
  status       text not null default 'open' check (status in ('open','closed')),
  opened_at    timestamptz,
  closed_at    timestamptz,
  deadline     timestamptz,                          -- дедлайн приёма решений
  unique (game_id, round_number)
);

-- Индекс под самый частый запрос: "какой сейчас месяц в этой игре".
create index if not exists rounds_game_number_idx
  on rounds (game_id, round_number desc);

-- ---------------------------------------------------------------- РЕШЕНИЯ
create table if not exists decisions (
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

  autoplay      boolean not null default false,      -- решение подставлено автоходом
  submitted_at  timestamptz not null default now()
);

-- Одно решение на игрока за месяц. Повторная отправка ПЕРЕЗАПИСЫВАЕТ,
-- а не плодит дубли — в листах это приходилось разгребать вручную.
create unique index if not exists decisions_unique_idx
  on decisions (game_id, round_number, player_id);

-- ---------------------------------------------------------------- РЕЗУЛЬТАТЫ
create table if not exists results (
  id            uuid primary key default gen_random_uuid(),
  game_id       uuid not null references games(id) on delete cascade,
  round_number  int  not null,
  player_id     uuid not null references players(id) on delete cascade,

  price            numeric(10,2),
  demand           numeric(14,2),
  served           numeric(14,2),
  lost             numeric(14,2),
  revenue          numeric(14,2),
  cogs_total       numeric(14,2),
  gross_profit     numeric(14,2),
  rent             numeric(14,2),
  payroll          numeric(14,2),
  shift_cost       numeric(14,2),
  quality_upkeep   numeric(14,2),
  quality_invest   numeric(14,2),
  marketing_total  numeric(14,2),
  marketing_effect numeric(14,4),
  ebit             numeric(14,2),
  interest         numeric(14,2),
  profit           numeric(14,2),
  principal_paid   numeric(14,2),
  cash_flow        numeric(14,2),
  cash_after       numeric(14,2),
  brand_after      numeric(10,4),
  reputation_after numeric(10,4),
  quality          numeric(10,4),
  capacity         numeric(14,2),
  market_share     numeric(10,6),
  market_total     numeric(14,2),

  seo_spend        numeric(14,2),
  promo_spend      numeric(14,2),
  maps_spend       numeric(14,2),
  social_spend     numeric(14,2),
  outdoor_spend    numeric(14,2),
  affiliate_spend  numeric(14,2),

  created_at   timestamptz not null default now()
);

create unique index if not exists results_unique_idx
  on results (game_id, round_number, player_id);

-- ------------------------------------------------------- КОШЕЛЬКИ ВНЕ БИЗНЕСА
-- То же, что лист Wallets в v3.3: помесячная история денег у тех, кто
-- заведения не ведёт. Нужна табло, чтобы капитал и доход были видны у всех,
-- а доля рынка и клиенты — только у тех, кто торгует.
create table if not exists wallet_entries (
  id            uuid primary key default gen_random_uuid(),
  game_id       uuid not null references games(id) on delete cascade,
  round_number  int  not null,
  player_id     uuid not null references players(id) on delete cascade,
  status        text not null,
  savings       numeric(14,2) not null,
  income        numeric(14,2) not null,
  created_at    timestamptz not null default now()
);

create unique index if not exists wallet_entries_unique_idx
  on wallet_entries (game_id, round_number, player_id);

-- ---------------------------------------------------------------- ЖУРНАЛ ДЕНЕГ
-- Каждое движение денег отдельной строкой. players.cash остаётся быстрой
-- суммой для чтения, но источник правды здесь. Любой вопрос "откуда у него
-- эти деньги" закрывается одним запросом, а штраф от государства становится
-- обычной записью, а не правкой ячейки задним числом.
create table if not exists ledger (
  id            bigserial primary key,
  game_id       uuid not null references games(id) on delete cascade,
  player_id     uuid not null references players(id) on delete cascade,
  round_number  int  not null default 0,
  kind          text not null check (kind in (
                  'start_capital','revenue','cogs','rent','payroll','shift_cost',
                  'quality_upkeep','quality_invest','marketing','interest','principal',
                  'loan_out','loan_repay','transfer_in','transfer_out',
                  'civil_salary','employer_salary','settlement','reopen',
                  'admin_fine','admin_subsidy','admin_adjust')),
  amount        numeric(14,2) not null,              -- со знаком: минус = списание
  target        text not null default 'cash'
                check (target in ('cash','savings')),
  reason        text,
  actor         text,                                -- кто инициировал: ник или 'system'
  created_at    timestamptz not null default now()
);

create index if not exists ledger_player_idx on ledger (game_id, player_id, id desc);

-- ---------------------------------------------------------------- ПЕРЕВОДЫ
create table if not exists transfers (
  id            uuid primary key default gen_random_uuid(),
  game_id       uuid not null references games(id) on delete cascade,
  from_player   uuid not null references players(id) on delete cascade,
  to_player     uuid not null references players(id) on delete cascade,
  amount        numeric(14,2) not null check (amount > 0),
  round_number  int not null default 0,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------- БАНК: ЛОГ
create table if not exists bank_log (
  id            uuid primary key default gen_random_uuid(),
  game_id       uuid not null references games(id) on delete cascade,
  player_id     uuid not null references players(id) on delete cascade,
  round_number  int not null,
  tier_before   int,
  tier_after    int,
  message       text not null,
  read          boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists bank_log_unread_idx
  on bank_log (game_id, player_id) where read = false;

-- ------------------------------------------------- ДЕЙСТВИЯ ВЕДУЩЕГО (ГОСУДАРСТВО)
-- Штрафы, субсидии, ручные правки, вход в кабинет игрока. Полный аудит:
-- через три сессии вы сами не вспомните, почему у игрока минус 50 000.
create table if not exists admin_actions (
  id            bigserial primary key,
  game_id       uuid not null references games(id) on delete cascade,
  admin_username text not null,
  player_id     uuid references players(id) on delete cascade,
  action        text not null,                       -- 'fine' | 'subsidy' | 'patch' | 'impersonate' | ...
  payload       jsonb,
  reason        text,
  created_at    timestamptz not null default now()
);

-- ------------------------------------------------- ЗАЩИТА ОТ ДВОЙНЫХ ДЕЙСТВИЙ
-- Клиент присылает уникальный id на каждое действие. Повтор при обрыве связи
-- вернёт сохранённый ответ вместо второго списания. Именно этого не хватало
-- в версии на таблицах: ретрай на плохой сети мог списать деньги дважды.
create table if not exists mutations (
  id           uuid primary key,
  game_id      uuid references games(id) on delete cascade,
  username     text,
  action       text not null,
  result       jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists mutations_created_idx on mutations (created_at);

-- ------------------------------------------------- ПРЕСЕТЫ ЭКОНОМИКИ
-- Сохранённые балансы: "мягкий старт", "жёсткая аренда", "короткая партия".
-- Вы часто крутите аренду и длительность месяца — чтобы не вспоминать
-- каждый раз, какие цифры хорошо игрались в прошлый раз.
create table if not exists config_presets (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  config      jsonb not null,
  note        text,
  created_at  timestamptz not null default now()
);

-- ============================================================================
--  RLS: включаем везде, политик не создаём. Публичный ключ не может ничего.
-- ============================================================================
alter table games          enable row level security;
alter table players        enable row level security;
alter table rounds         enable row level security;
alter table decisions      enable row level security;
alter table results        enable row level security;
alter table wallet_entries enable row level security;
alter table ledger         enable row level security;
alter table transfers      enable row level security;
alter table bank_log       enable row level security;
alter table admin_actions  enable row level security;
alter table mutations      enable row level security;
alter table config_presets enable row level security;

-- ============================================================================
--  СТАРТОВЫЙ КОНФИГ — ровно те значения, на которых игра уже обкатана в v3.3.
--  Меняется потом из панели ведущего, без единой строчки SQL.
-- ============================================================================
insert into config_presets (name, config, note)
values (
  'v3.3 baseline',
  '{
    "BASE_CURRENCY": "THB",
    "FX_RATE_THB_PER_USD": 35,
    "P_REF": 300, "P_FLOOR": 100, "PRICE_ELASTICITY": 2.2, "P_MAX_MULT": 1.8, "KAPPA": 4,
    "COGS_PCT": 0.40, "QUALITY_COGS_ADD": 0.15,
    "MARKET_SIZE_PER_PLAYER": 10000, "MARKET_SCALES_WITH_PLAYERS": false,
    "CAT_ELASTICITY": 0.4, "CAT_MIN": 0.8, "CAT_MAX": 1.3,
    "CAPACITY_BASE": 3000, "CAPACITY_STEP": 1000, "CAPACITY_MIN": 100,
    "CAPACITY_STEP_COST": 60000, "CAPACITY_SHIFTS_MIN": -3, "CAPACITY_SHIFTS_MAX": 5,
    "RENT": 150000, "PAYROLL_BASE": 220000, "START_CAPITAL": 100000,
    "CIVIL_SERVICE_SALARY": 35000, "REOPEN_THRESHOLD": 100000, "TOTAL_ROUNDS": 12,
    "K_BRAND": 0.5, "K_QUALITY": 0.5,
    "K_SEO": 0.5, "SEO_ALPHA": 0.9, "SEO_REF": 60000, "SEO_RAMP_MONTHS": 3, "SEO_DECAY": 0.08,
    "K_PROMO": 0.5, "PROMO_ALPHA": 0.9, "PROMO_REF": 50000,
    "K_MAPS": 0.45, "MAPS_ALPHA": 0.7, "MAPS_REF": 40000, "MAPS_DECAY": 0.15,
    "K_SOCIAL": 0.6, "SOCIAL_ALPHA": 0.8, "SOCIAL_REF": 100000, "SOCIAL_DECAY": 0.55,
    "K_OUTDOOR": 0.4, "OUTDOOR_ALPHA": 0.6, "OUTDOOR_REF": 80000,
    "OUTDOOR_MIN_SPEND": 40000, "OUTDOOR_DURATION_MONTHS": 4,
    "AFFILIATE_MIN_SPEND": 20000, "AFFILIATE_BONUS_PCT": 0.125,
    "AD_DECAY": 0.55, "BRAND_DECAY": 0.25, "BRAND_GAIN": 0.25,
    "QUALITY_DECAY": 0.05, "QUALITY_UPKEEP": 15000, "QUALITY_INVEST_DIVISOR": 400000,
    "LOAN_TIER1_LIMIT": 300000, "LOAN_TIER2_LIMIT": 800000, "LOAN_TIER3_LIMIT": 2000000,
    "LOAN_RATE_ANNUAL": 0.15, "LOAN_TERM_MONTHS": 6,
    "ROUND_DURATION_MIN": 5
  }'::jsonb,
  'Баланс, на котором игра обкатана в версии на Google Sheets. Точка отсчёта для калибровки.'
)
on conflict (name) do nothing;

-- ============================================================================
--  ПРОВЕРКА. Должно вернуть 12 таблиц, у всех rls = true.
-- ============================================================================
select tablename, rowsecurity as rls
from pg_tables
where schemaname = 'public'
order by tablename;
