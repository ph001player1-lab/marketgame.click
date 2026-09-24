# marketgame.click — Market Game: Capture the Market 5.0

Веб-версия деловой игры для американского рынка. Все решения по продукту —
в [CONCEPT.md](CONCEPT.md); сначала правится он, потом код.

Отправная точка — v4.9, русская версия для Telegram: её материалы лежат в
[docs/v4.9-ru/](docs/v4.9-ru/), исходный код — в истории репозитория.

```
supabase/migrations/     схема базы 5.0 — применяется по порядку
supabase/functions/game/ Edge Function: API игры
  economy.ts               экономический движок, чистая функция
  presets.ts               настройки новой игры в долларах, лиги
  handler.ts               маршруты, вход, защита от повторов
  round.ts                 открытие и расчёт месяца
  player.ts                кабинет команды
  host.ts                  пульт ведущего и администратора
  board.ts                 табло, бюджет города, рейтинг, история
  index.ts                 подключение к Supabase
supabase/templates/      письмо с кодом входа
supabase/config.toml     настройки для локального запуска
web/                     сайт: без сборки, обычные модули JavaScript
  index.html               вход, мои игры, игра, пульт, отчёт, рейтинг
  board/                   табло для проектора: board/?code=КОД
  report/                  отчёт команды по ссылке: report/?t=…
  rating/                  рейтинг лиг, открыт без входа
  assets/js/config.js      адрес проекта Supabase и публичный ключ
  assets/js/i18n.js        все тексты сайта (английский)
  assets/js/charts.js      графики на SVG
  assets/js/vendor/        клиент входа Supabase (npm run vendor)
  assets/js/views/         разделы: Business, Scoreboard, Guide, Console…
tests/                   проверки
  ui/                      сайт в браузере и локальный стенд
docs/v4.9-ru/            материалы русской версии — исходник для перевода
```

## Как устроен сервер

- **Клиент к базе не ходит.** RLS включён на всех таблицах без единой
  политики, публичный ключ не может ничего. Вся работа идёт через функцию
  `game`, как и в v4.9.
- **Действие с деньгами — одна транзакция** с блокировкой строк: перевод,
  кредит, расчёт месяца проходят целиком или не проходят вовсе.
- **Вход:**
  1. клиент спрашивает функцию `preflightLogin`, внесена ли почта;
  2. Supabase Auth высылает на неё код;
  3. с токеном входа клиент зовёт остальные действия.

  Самостоятельной регистрации нет: почты вносят ведущий (состав игры) и
  администратор (ведущие).
- **Защита от повторов:** клиент присылает `requestId` с каждым нажатием, и
  повтор при обрыве связи не спишет деньги второй раз.
- **Деньги сходятся с журналами.** Касса и накопления команды — это сумма
  её журнала `ledger`. У бюджета города свой журнал `city_ledger`, итоги
  участников экономики лежат в `institution_months`.

## Проверки

Нужен Node.js 20+. Для проверок сервера — PostgreSQL (переменные `PGHOST`,
`PGPORT`, `PGUSER`, `PGPASSWORD`, как у psql).

```
npm install
npm test               # экономика: эталон v4.9, доллары, 5.0; схема базы
npm run test:api       # функция game на чистой базе: целая игра и редкие ветки
npm run report:teams   # сколько команд переживает первый месяц
npm run report:balance # как 5.0 меняет выживаемость и капитал
npm run test:ui        # сайт в Chromium: телефон, планшет, ноутбук, проектор
npm run site           # локальный сайт с тестовой партией: http://localhost:8080
```

`npm run site` поднимает сайт и функцию на локальной базе. Вход тестовый:
письма не уходят, подходит любой код из шести цифр. Администратор —
ph001player1@gmail.com, команды тестовой партии — team1@example.com …
team6@example.com.

GitHub Actions запускает всё это при каждом изменении, плюс проверку типов
функции в Deno. Скриншоты проверки сайта лежат в артефакте `screens`.

## Развёртывание в Supabase

Разворачивает workflow **Deploy Supabase**:
- миграции базы;
- функция `game`;
- настройки входа: регистрация выключена, код из 6 цифр, наш шаблон письма;
- пробный запрос в конце.

### Один раз

1. **Токен Supabase:** supabase.com → аватар → **Account preferences** →
   **Access Tokens** → **Generate new token**.
2. **Секреты в GitHub:** репозиторий → **Settings** → **Secrets and
   variables** → **Actions** → **New repository secret**:
   - `SUPABASE_ACCESS_TOKEN` — токен из шага 1;
   - `SUPABASE_DB_PASSWORD` — пароль базы, без квадратных скобок. Если
     пароль где-то пересылали, сначала смените его: Project Settings →
     Database → **Reset database password**.
3. **Запуск:** **Actions** → **Deploy Supabase** → **Run workflow** →
   выбрать ветку. Зелёный шаг *Smoke test* значит, что игра отвечает.

### Администратор

По умолчанию администратор — ph001player1@gmail.com. Другой список —
секрет `ADMIN_EMAILS` (почты через запятую), потом снова запустить
развёртывание.

### Почта для кодов входа

Без своего почтового сервиса Supabase шлёт письма только участникам своей
команды (владелец проекта их получит) и всего несколько в час. Для игр с
людьми нужен свой сервис — Resend (бесплатно: 3 000 писем в месяц, 100 в
день).

1. **Аккаунт:** resend.com → Sign up.
2. **Домен:** **Domains** → **Add Domain** → `marketgame.click`, регион
   North Virginia (us-east-1). Resend покажет 3–4 DNS-записи.
3. **Записи в Dynadot:** **My Domains** → marketgame.click → **DNS
   Settings** (режим *Dynadot DNS*) → раздел **Subdomain Records** — по
   строке на каждую запись Resend, значения копировать из Resend как есть.
   Сейчас (2026) Resend просит такие:

   | Subdomain           | Тип   | Значение                               |
   |---------------------|-------|----------------------------------------|
   | `resend._domainkey` | TXT   | длинный ключ `p=…` из Resend            |
   | `send`              | CNAME | `send.forge.rmta.net`                  |
   | `rsend`             | CNAME | `rsend.forge.rmta.net`                 |
   | `_dmarc`            | TXT   | `v=DMARC1; p=none;` (по желанию)       |

   CNAME не уживается с другими записями того же имени: если у `send`
   остались старые MX и TXT (прежний формат Resend через amazonses.com),
   их нужно удалить. Записи сайта (A, AAAA и CNAME `www`) не трогать.
4. **Проверка:** в Resend у домена **Verify DNS Records**; статус
   **Verified** — обычно через несколько минут, иногда до суток.
5. **Ключ:** **API Keys** → **Create API Key** → имя `supabase`,
   Permission **Sending access**, Domain `marketgame.click` → скопировать
   ключ `re_…` (Resend показывает его один раз).
6. **Секрет в GitHub:** **Settings** → **Secrets and variables** →
   **Actions** → **New repository secret** → Name `SMTP_PASS`, Secret —
   ключ → **Add secret**.
7. **Развёртывание:** **Actions** → **Deploy Supabase** → **Run workflow**
   (именно вручную: при обычных пушах почту не трогаем). Сначала уходит
   пробное письмо администратору через Resend; если Resend отказал (домен
   не подтверждён, ключ не тот), шаг падает, а вход работает по-старому.
   Если письмо ушло, шаг *Email sending (custom SMTP)* подключает почту:
   smtp.resend.com, порт 465, пользователь `resend`, отправитель
   noreply@marketgame.click.

Проверка: войти на сайт со своей почтой — код придёт от
noreply@marketgame.click. Другой отправитель — переменная репозитория
`SMTP_SENDER` (Settings → Secrets and variables → Actions → Variables).

## Сайт: GitHub Pages и домен

Сайт — папка `web/`, её публикует workflow **Deploy site** при каждом
изменении в `web/` на основной ветке репозитория.

### Один раз

1. **Pages:** репозиторий → **Settings** → **Pages** → **Build and
   deployment** → **Source: GitHub Actions**.
2. **Кому можно публиковать:** **Settings** → **Environments** →
   **github-pages** → **Deployment branches and tags** → добавить основную
   ветку репозитория (сейчас это `claude/blissful-mayer-3hluhu`) или
   выбрать **No restriction**. Иначе публикация падает с ошибкой
   *Branch … is not allowed to deploy to github-pages*.
3. **Первая публикация:** **Actions** → **Deploy site** → **Run workflow**.
   Сайт появится на https://ph001player1-lab.github.io/marketgame.click/.
4. **Домен в Dynadot:** **My Domains** → marketgame.click → **DNS
   Settings** → удалить старые записи A/AAAA/CNAME для корня и www (и
   переадресацию, если включена), добавить:

   | Тип   | Хост | Значение                  |
   |-------|------|---------------------------|
   | A     | @    | 185.199.108.153           |
   | A     | @    | 185.199.109.153           |
   | A     | @    | 185.199.110.153           |
   | A     | @    | 185.199.111.153           |
   | AAAA  | @    | 2606:50c0:8000::153       |
   | AAAA  | @    | 2606:50c0:8001::153       |
   | AAAA  | @    | 2606:50c0:8002::153       |
   | AAAA  | @    | 2606:50c0:8003::153       |
   | CNAME | www  | ph001player1-lab.github.io |

5. **Домен в GitHub:** **Settings** → **Pages** → **Custom domain:**
   `marketgame.click` → **Save**. Когда проверка DNS пройдёт (от нескольких
   минут до суток), включить **Enforce HTTPS**.

Файл `web/CNAME` уже содержит домен. Функция игры принимает запросы с
marketgame.click, www.marketgame.click и ph001player1-lab.github.io;
другой список — секрет функции `ALLOWED_ORIGINS`.

## Локальный запуск

`supabase/config.toml` настроен на локальный Supabase (`supabase start`):
регистрация выключена, письма с кодом видны в Mailpit на
http://127.0.0.1:54324.
