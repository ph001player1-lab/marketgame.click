// Проверка сайта в настоящем браузере: телефон, планшет, ноутбук, широкий
// экран и проектор. Скриншоты — в папку из SCREENS_DIR (по умолчанию
// build/screens). Любая ошибка JavaScript на странице роняет проверку.
//
//   npm run build && node tests/ui/screens.mjs

import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { startServer, ADMIN } from './server.mjs';
import { seedGame, TEAMS, AUSTIN } from './seed.mjs';
import { TEST_LOGO_PNG_B64 } from '../fixtures/logo.mjs';

async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* нет в проекте — берём глобальный */ }
  const require = createRequire(import.meta.url);
  for (const p of ['/opt/node22/lib/node_modules/playwright', '/usr/local/lib/node_modules/playwright', '/usr/lib/node_modules/playwright']) {
    try { return require(p); } catch { /* дальше */ }
  }
  throw new Error('Playwright not found: npm i -D playwright');
}

const OUT = process.env.SCREENS_DIR || 'build/screens';
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  tablet: { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 1, hasTouch: true },
  laptop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  wide: { viewport: { width: 1680, height: 1000 }, deviceScaleFactor: 1 },
  projector: { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 }
};

const { chromium } = await loadPlaywright();
const server = await startServer({ port: Number(process.env.PORT || 8091), pollMs: 2500 });
const errors = [];
let passed = 0;
let browser = null;

async function step(name, fn) {
  try {
    await fn();
    passed++;
    console.log('  ok  ' + name);
  } catch (e) {
    console.log('  FAIL ' + name);
    throw e;
  }
}

async function page(browser, kind, email) {
  const ctx = await browser.newContext({ ...VIEWPORTS[kind], locale: 'en-US', timezoneId: 'America/Chicago' });
  if (email) await ctx.addInitScript((e) => localStorage.setItem('mg-test-email', e), email);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(kind + ': ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(kind + ' console: ' + m.text()); });
  return p;
}

const shot = (p, name, full = false) => p.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });

try {
  console.log('Seeding games…');
  // Сыгранная до конца онлайн-игра — для рейтинга и отчёта: команды из
  // разных штатов и стран, место каждая указала сама.
  const done = await seedGame(server.sql, { months: 12, finish: true, title: 'Small Business Week Online', sponsor: false,
    place: { region: 'online' } });
  // Идущая игра: 4 месяца рассчитаны, пятый открыт.
  const live = await seedGame(server.sql, { months: 4 });
  await live.call(ADMIN, 'openRound', { gameId: live.gameId });
  const base = server.url;
  browser = await chromium.launch();

  console.log('Browser checks:');

  await step('sign-in on a phone: email, code, My games', async () => {
    const p = await page(browser, 'phone');
    await p.goto(base);
    await p.getByText('To register for the game, please enter your email').waitFor();
    assert.equal(await p.locator('.login__tagline').count(), 0, 'no slogan on the sign-in screen');
    await p.getByLabel('Email').fill('nobody@example.com');
    await p.getByRole('button', { name: 'Send me a code' }).click();
    await p.getByText('isn\'t on any game roster').waitFor();
    await shot(p, 'phone-01-login-refused');
    await p.getByLabel('Email').fill(TEAMS[0].email);
    await p.getByRole('button', { name: 'Send me a code' }).click();
    await p.getByLabel('Code from the email').fill('123456');
    await p.getByRole('heading', { name: 'My games' }).waitFor();
    await shot(p, 'phone-02-my-games');
    await p.close();
  });

  await step('sign-in through the Supabase Auth client (auth server mocked)', async () => {
    const ctx = await browser.newContext({ ...VIEWPORTS.laptop, locale: 'en-US' });
    await ctx.addCookies([{ name: 'realauth', value: '1', url: base }]);
    const calls = [];
    await ctx.route('https://auth.test/**', async (route) => {
      const req = route.request();
      const path = new URL(req.url()).pathname;
      calls.push({ what: req.method() + ' ' + path, apikey: req.headers().apikey });
      const json = (status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
      if (path === '/auth/v1/otp') return json(200, {});
      if (path === '/auth/v1/verify') {
        const { email, token } = JSON.parse(req.postData() || '{}');
        if (token !== '654321') return json(403, { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' });
        const now = Math.floor(Date.now() / 1000);
        return json(200, {
          access_token: 'test:' + email, token_type: 'bearer', expires_in: 3600, expires_at: now + 3600,
          refresh_token: 'refresh-token',
          user: { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email,
            app_metadata: { provider: 'email' }, user_metadata: {}, created_at: new Date().toISOString() }
        });
      }
      if (path === '/auth/v1/logout') return route.fulfill({ status: 204, body: '' });
      return json(404, { msg: 'not mocked: ' + path });
    });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push('auth: ' + e.message));
    await p.goto(base);
    await p.getByLabel('Email').fill(TEAMS[0].email);
    await p.getByRole('button', { name: 'Send me a code' }).click();
    await p.getByLabel('Code from the email').fill('111111');
    await p.getByText('That code didn\'t work').waitFor();
    await p.getByLabel('Code from the email').fill('654321');
    await p.getByRole('heading', { name: 'My games' }).waitFor();
    assert.ok(calls.some((c) => c.what === 'POST /auth/v1/otp' && c.apikey === 'test'), 'code requested with the key');
    assert.ok(calls.some((c) => c.what === 'POST /auth/v1/verify'), 'code verified');
    await p.reload();
    await p.getByRole('heading', { name: 'My games' }).waitFor();
    await p.getByRole('button', { name: 'Menu' }).click();
    await p.getByRole('button', { name: 'Sign out' }).click();
    await p.getByRole('heading', { name: 'Sign in' }).waitFor();
    await ctx.close();
  });

  await step('phone: Business, Scoreboard and Guide tabs, one pane at a time', async () => {
    const p = await page(browser, 'phone', TEAMS[0].email);
    await p.goto(base + '#/g/' + live.gameId);
    await p.getByRole('button', { name: 'Send decision' }).or(p.getByRole('button', { name: 'Update decision' })).waitFor();
    await shot(p, 'phone-03-business');
    await shot(p, 'phone-03-business-full', true);
    await p.locator('.tab--board').click();
    // Табло открывается «Куском Пирога»: два пирога и цифры списком.
    await p.locator('.cake__svg').first().waitFor();
    assert.equal(await p.locator('.pane--main').isVisible(), false, 'business pane hidden on the scoreboard tab');
    await p.locator('.cake__list').first().getByText('Taco Town (you)').waitFor();
    await p.waitForTimeout(300);
    await shot(p, 'phone-04-cake', true);
    // На телефоне месяц выбирают списком со стрелками; лента мини-пар не нужна.
    assert.equal(await p.locator('.cake__strip').isVisible(), false);
    await p.getByLabel('Month', { exact: true }).selectOption('1');
    await p.locator('.cake__title', { hasText: 'Month 1 of 12' }).waitFor();
    await p.getByRole('button', { name: 'Next month' }).click();
    await p.locator('.cake__title', { hasText: 'Month 2 of 12' }).waitFor();
    await p.getByRole('button', { name: 'Teams', exact: true }).click();
    await p.locator('.table--standings').waitFor();
    await shot(p, 'phone-04-scoreboard');
    await p.getByRole('button', { name: 'Economy' }).click();
    await p.getByText('Market size, guests a month').waitFor();
    await shot(p, 'phone-05-economy', true);
    await p.getByRole('button', { name: 'Where the money went' }).click();
    await p.locator('.sankey').waitFor();
    await shot(p, 'phone-06-money', true);
    await p.getByRole('button', { name: 'Teams', exact: true }).click();
    await p.locator('.tab--guide').click();
    await p.getByRole('heading', { name: 'How to win' }).waitFor();
    await shot(p, 'phone-07-guide');
    await p.locator('.guide__toc').getByText('Red ocean or blue ocean').click();
    await p.getByRole('heading', { name: 'Red ocean or blue ocean', exact: true }).waitFor();
    await p.waitForTimeout(600);
    await shot(p, 'phone-07b-guide-ocean');
    // Кнопка «i» у цены открывает нужный раздел памятки.
    await p.locator('.tab--main').click();
    await p.locator('button.info').first().click();
    await p.locator('#guide-price').waitFor();
    await p.waitForTimeout(600);
    await shot(p, 'phone-08-guide-price');
    await p.close();
  });

  await step('phone: send a decision', async () => {
    const open = live.monitor.players.filter((x) => x.status === 'active' && x.email !== TEAMS[0].email);
    assert.ok(open.length, 'an open restaurant to play');
    const p = await page(browser, 'phone', open[0].email);
    await p.goto(base + '#/g/' + live.gameId);
    const send = p.getByRole('button', { name: 'Send decision' });
    await send.waitFor();
    await send.click();
    await p.getByText('Decision sent').first().waitFor();
    await p.close();
  });

  await step('new team joins: only name and restaurant; an online game also asks where', async () => {
    const NEW = 'newbie@example.com';
    const here = await live.call(ADMIN, 'createGame', { title: 'Austin Lunch', league: 'start', ...AUSTIN });
    await live.call(ADMIN, 'setRoster', { gameId: here.gameId, emails: [NEW] });
    const p = await page(browser, 'phone', NEW);
    await p.goto(base + '#/g/' + here.gameId);
    await p.getByRole('heading', { name: 'Welcome to the game' }).waitFor();
    assert.equal(await p.getByLabel('Country').count(), 0, 'the host set the place: no questions about it');
    await p.getByLabel('Your name').fill('Nina');
    await p.getByLabel('Restaurant name').fill('Nina’s Kitchen');
    await shot(p, 'phone-12-join');
    await p.getByRole('button', { name: 'Start playing' }).click();
    await p.getByText('The game hasn\'t started yet').waitFor();

    // Онлайн-игра: команда указывает страну, а в России — регион.
    const web = await live.call(ADMIN, 'createGame', { title: 'Webinar Cup', league: 'start', region: 'online' });
    await live.call(ADMIN, 'setRoster', { gameId: web.gameId, emails: [NEW] });
    await p.goto(base + '#/g/' + web.gameId);
    await p.getByRole('heading', { name: 'Welcome to the game' }).waitFor();
    await p.getByLabel('Country').selectOption('RU');
    await p.getByLabel('Region').selectOption('MOW');
    await shot(p, 'phone-13-join-online');
    await p.getByRole('button', { name: 'Start playing' }).click();
    await p.getByText('The game hasn\'t started yet').waitFor();
    const mon = await live.call(ADMIN, 'monitor', { gameId: web.gameId });
    assert.deepEqual(mon.players[0].location, { country: 'RU', area: 'MOW' });
    await p.close();
  });

  for (const kind of ['tablet', 'laptop', 'wide']) {
    await step(kind + ': business with scoreboard / guide side by side', async () => {
      const p = await page(browser, kind, TEAMS[1].email);
      await p.goto(base + '#/g/' + live.gameId);
      await p.locator('.pane--board .cake__svg').first().waitFor();
      await p.waitForTimeout(300);
      await shot(p, kind + '-00-cake');
      await p.locator('.pane--board').getByRole('button', { name: 'Teams', exact: true }).click();
      await p.locator('.table--standings').waitFor();
      await p.locator('.chart__svg').first().waitFor();
      assert.equal(await p.locator('.pane--main').isVisible(), true);
      assert.equal(await p.locator('.pane--board').isVisible(), true);
      await p.waitForTimeout(400);
      await shot(p, kind + '-01-game');
      if (kind !== 'wide') {
        await p.locator('.tab--guide').click();
        await p.getByRole('heading', { name: 'How to win' }).waitFor();
        await shot(p, kind + '-02-guide');
      } else {
        assert.equal(await p.locator('.pane--guide').isVisible(), true, 'three panes on a wide screen');
      }
      await p.close();
    });
  }

  await step('laptop: chart tooltip and table view', async () => {
    const p = await page(browser, 'laptop', TEAMS[1].email);
    await p.goto(base + '#/g/' + live.gameId);
    await p.locator('.pane--board').getByRole('button', { name: 'Teams', exact: true }).click();
    const plot = p.locator('.pane--board .chart__plot').first();
    await plot.waitFor();
    await plot.scrollIntoViewIfNeeded();
    const box = await plot.boundingBox();
    await p.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5);
    await p.locator('.chart__tip:not([hidden])').waitFor();
    await shot(p, 'laptop-03-tooltip');
    await p.locator('.pane--board').getByRole('button', { name: 'Table' }).first().click();
    await p.locator('.pane--board .table--sticky').waitFor();
    await shot(p, 'laptop-04-table');
    await p.close();
  });

  await step('host console: Run, Teams, City, Settings', async () => {
    const p = await page(browser, 'laptop', ADMIN);
    await p.goto(base + '#/g/' + live.gameId);
    await p.getByRole('button', { name: /Calculate month 5/ }).waitFor();
    await shot(p, 'host-01-run');
    await p.getByRole('button', { name: 'Teams', exact: true }).first().click();
    await p.getByText('Team emails').waitFor();
    await shot(p, 'host-02-teams', true);
    await p.getByRole('button', { name: 'City', exact: true }).click();
    await p.getByText('City ownership').waitFor();
    await shot(p, 'host-03-city', true);
    await p.getByRole('button', { name: 'Settings', exact: true }).click();
    await p.getByText('Game details').waitFor();
    await shot(p, 'host-04-settings', true);
    // Расчёт месяца с пульта.
    await p.getByRole('button', { name: 'Run', exact: true }).click();
    await p.getByRole('button', { name: /Calculate month 5/ }).click();
    await p.locator('dialog').getByRole('button', { name: /Calculate month 5/ }).click();
    await p.getByText('Month 5 is calculated').first().waitFor();
    await p.getByRole('button', { name: 'Open month 6' }).waitFor();
    // Разбор месяца для ведущего: цвет воды и вопросы командам.
    await p.getByText('Debrief after month 5').waitFor();
    await p.getByText('Questions for the teams').waitFor();
    await shot(p, 'host-08-debrief', true);
    await p.close();
  });

  await step('host plays as a team', async () => {
    const mon = await live.call(ADMIN, 'monitor', { gameId: live.gameId });
    const p = await page(browser, 'laptop', ADMIN);
    await p.goto(base + '#/g/' + live.gameId + '/as/' + mon.players[2].id);
    await p.getByText('Host view: you are playing as').waitFor();
    await shot(p, 'host-05-play-as');
    await p.close();
  });

  await step('admin: hosts page', async () => {
    const p = await page(browser, 'laptop', ADMIN);
    await p.goto(base + '#/hosts');
    await p.getByLabel('Host email').fill('host2@example.com');
    await p.getByRole('button', { name: 'Add a host' }).click();
    await p.getByText('host2@example.com').first().waitFor();
    await shot(p, 'admin-01-hosts');
    await p.close();
  });

  await step('create a game with an uploaded sponsor logo', async () => {
    const p = await page(browser, 'laptop', ADMIN);
    await p.goto(base + '#/new');
    await p.getByLabel('Game title').fill('Albany Chamber · Winter');
    // Место по языку сайта ведущего: Северная Америка, США. Штат подставляет пояс.
    assert.equal(await p.getByLabel('World region').inputValue(), 'north_america');
    assert.equal(await p.getByLabel('Country').inputValue(), 'US');
    assert.equal(await p.getByLabel('Game currency').inputValue(), 'USD');
    await p.getByLabel('State').selectOption('NY');
    assert.equal(await p.getByLabel('Time zone').inputValue(), 'America/New_York', 'time zone from the state');
    await p.getByText('Growth · 24 months').click();
    await p.getByText('Sponsor (optional)').click();
    await p.getByLabel('Sponsor name').fill('Lone Star Coffee Roasters');
    await p.getByLabel('Upload logo file').setInputFiles({
      name: 'logo.png', mimeType: 'image/png', buffer: Buffer.from(TEST_LOGO_PNG_B64, 'base64')
    });
    await p.getByText('Logo ready').waitFor();
    const size = await p.locator('.logo-preview img').evaluate((img) => [img.naturalWidth, img.naturalHeight]);
    assert.deepEqual(size, [101, 51], 'empty transparent edges are trimmed');
    await shot(p, 'host-06-create');
    await p.getByRole('button', { name: 'Create game' }).click();
    await p.getByText('Ready to start').waitFor();
    const code = (await p.locator('.code').first().textContent()).trim();
    // Логотип на табло проектора — картинкой от функции игры.
    const b = await page(browser, 'projector', ADMIN);
    await b.goto(base + 'board/?code=' + code);
    await b.waitForFunction(() => {
      const img = document.querySelector('.sponsor img');
      return img && img.complete && img.naturalWidth === 101;
    });
    await b.close();
    await p.close();
    const [g] = await server.sql`select region, country, area, timezone from games where title = 'Albany Chamber · Winter'`;
    assert.deepEqual({ ...g }, { region: 'north_america', country: 'US', area: 'NY', timezone: 'America/New_York' });
  });

  await step('host in Russian: a game in a Russian region, time zone from the region', async () => {
    const p = await page(browser, 'laptop', ADMIN);
    await p.addInitScript(() => localStorage.setItem('mg-lang', 'ru'));
    await p.goto(base + '#/new');
    await p.getByRole('heading', { name: 'Создать игру' }).waitFor();
    assert.equal(await p.getByLabel('Регион мира').inputValue(), 'cis', 'Russian host: Russia & CIS');
    assert.equal(await p.getByLabel('Страна').inputValue(), 'RU');
    await p.getByLabel('Название игры').fill('Екатеринбург · весна');
    await p.getByLabel('Регион', { exact: true }).selectOption('SVE');
    assert.equal(await p.getByLabel('Часовой пояс').inputValue(), 'Asia/Yekaterinburg', 'time zone from the region');
    // Игра в России — в рублях.
    assert.equal(await p.getByLabel('Валюта игры').inputValue(), 'RUB', 'rubles for a game in Russia');
    await shot(p, 'lang-ru-03-create', true);
    await p.getByRole('button', { name: 'Создать игру' }).click();
    await p.getByText('Всё готово к старту').waitFor();
    const [g] = await server.sql`select region, country, area, timezone, language, currency, config->>'P_REF' as pref,
                                        config->>'PROFIT_TAX_RATE' as tax from games where title = 'Екатеринбург · весна'`;
    assert.deepEqual({ ...g }, { region: 'cis', country: 'RU', area: 'SVE', timezone: 'Asia/Yekaterinburg', language: 'ru',
      currency: 'RUB', pref: '1500', tax: '0.25' });
    // Суммы игры — в рублях: и в настройках ведущего, и в подписях полей.
    await p.getByRole('button', { name: 'Настройки', exact: true }).click();
    await p.getByLabel('Аренда, ₽').waitFor();
    assert.equal(await p.getByLabel('Аренда, ₽').inputValue(), '375000');
    await p.getByText('Валюта игры: Российский рубль (₽).').waitFor();
    await shot(p, 'lang-ru-04-rubles', true);
    await p.close();
  });

  await step('team: borrow, repay and send money', async () => {
    const team = TEAMS.find((x) => x.restaurant === 'Green Bowl');
    const p = await page(browser, 'laptop', team.email);
    await p.goto(base + '#/g/' + live.gameId);
    await p.getByLabel('Borrow', { exact: true }).fill('5,000');
    await p.getByRole('button', { name: 'Borrow', exact: true }).click();
    await p.getByText('Loan received: $5,000.').waitFor();
    await p.getByLabel('Repay early', { exact: true }).fill('1000');
    await p.getByRole('button', { name: 'Repay early', exact: true }).click();
    await p.getByText('Repaid $1,000.').waitFor();
    await p.getByLabel('Recipient').selectOption({ label: 'Taco Town' });
    await p.getByRole('textbox', { name: 'Amount, $' }).fill('250');
    await p.getByRole('button', { name: 'Send', exact: true }).click();
    await p.getByText('Sent $250 to Taco Town.').waitFor();
    await shot(p, 'laptop-05-bank');
    await p.close();
  });

  await step('bankrupt team chooses a government job', async () => {
    const mon = await live.call(ADMIN, 'monitor', { gameId: live.gameId });
    const broke = mon.players.find((x) => x.status === 'bankrupt');
    assert.ok(broke, 'a bankrupt team');
    const p = await page(browser, 'phone', broke.email);
    await p.goto(base + '#/g/' + live.gameId);
    await p.getByRole('button', { name: 'Government job' }).click();
    await p.getByText('You have a government job').waitFor();
    await shot(p, 'phone-11-government-job');
    await p.close();
  });

  await step('host: sell a stake and change rent for next month', async () => {
    const p = await page(browser, 'laptop', ADMIN);
    await p.goto(base + '#/g/' + live.gameId);
    await p.getByRole('button', { name: 'City', exact: true }).click();
    await p.getByLabel('Company', { exact: true }).selectOption({ label: 'Landlord' });
    await p.getByLabel('Buyer', { exact: true }).selectOption({ label: 'Green Bowl' });
    await p.getByLabel('Share, %', { exact: true }).fill('5');
    await p.getByLabel('Price, $', { exact: true }).fill('1500');
    await p.getByRole('button', { name: 'Record' }).click();
    await p.locator('dialog').getByRole('button', { name: 'Yes' }).click();
    await p.getByText('Stake recorded.').waitFor();
    await p.getByText('Green Bowl 5%').first().waitFor();
    await p.getByRole('button', { name: 'Settings', exact: true }).click();
    await p.getByLabel('Rent, $').fill('8000');
    await p.getByRole('button', { name: 'Save for next month' }).click();
    await p.getByText('Saved. Applies from the next month.').waitFor();
    await p.getByText('Rent: $7,500 → $8,000').waitFor();
    await shot(p, 'host-07-next-month-rent');
    await p.close();
  });

  await step('host: game report with every team', async () => {
    const p = await page(browser, 'laptop', ADMIN);
    await p.goto(base + '#/g/' + done.gameId + '/report');
    await p.getByRole('button', { name: 'Download CSV (all teams)' }).waitFor();
    await p.getByText('Every team\'s decisions').waitFor();
    await p.close();
  });

  await step('projector scoreboard: sign in first, then only this game\'s people see it', async () => {
    const p = await page(browser, 'projector');
    await p.goto(base + 'board/?code=' + live.code);
    await p.getByText('The scoreboard is only for this game').waitFor();
    await shot(p, 'projector-00-sign-in');
    // Чужая почта: вход есть, а табло — нет.
    await p.evaluate(() => localStorage.setItem('mg-test-email', 'host2@example.com'));
    await p.reload();
    await p.getByText('You are not on this game\'s roster').waitFor();
    await p.getByRole('button', { name: 'Use another email' }).click();
    await p.getByLabel('Email').fill(ADMIN);
    await p.getByRole('button', { name: 'Send me a code' }).click();
    await p.getByLabel('Code from the email').fill('123456');
    // Главный экран проектора — «Кусок Пирога»: два пирога и лента месяцев.
    await p.locator('.cake__svg').first().waitFor();
    const cells = p.locator('button.cake__cell');
    const [{ played }] = await server.sql`select count(distinct round_number)::int as played from results where game_id = ${live.gameId}`;
    assert.equal(await cells.count(), played, 'a mini pair for every played month');
    assert.equal(await p.locator('.cake__cell.is-future').count(), 12 - played, 'future months are placeholders');
    await p.waitForTimeout(400);
    await shot(p, 'projector-00-cake');
    await cells.nth(1).click();
    await p.locator('.cake__title', { hasText: 'Month 2 of 12' }).waitFor();
    await p.keyboard.press('ArrowLeft');
    await p.locator('.cake__title', { hasText: 'Month 1 of 12' }).waitFor();
    await shot(p, 'projector-00-cake-month1');
    await p.getByRole('button', { name: 'Teams and charts' }).click();
    await p.locator('.table--standings').waitFor();
    await p.locator('.chart__svg').first().waitFor();
    await p.waitForTimeout(400);
    await shot(p, 'projector-01-teams');
    await p.getByRole('button', { name: 'Economy' }).click();
    await p.getByText('City budget').first().waitFor();
    await p.getByRole('heading', { name: 'Red ocean or blue ocean?' }).waitFor();
    await p.locator('.ocean-now .water').first().waitFor();
    await p.waitForTimeout(300);
    await shot(p, 'projector-02-economy');
    await p.getByRole('button', { name: 'Where the money went' }).click();
    await p.locator('.sankey').waitFor();
    await shot(p, 'projector-03-money');
    await p.getByRole('button', { name: 'Rating' }).click();
    await p.locator('.table--rating').waitFor();
    await shot(p, 'projector-04-rating');
    // Обратно на главный экран.
    await p.getByRole('button', { name: 'Piece of Cake' }).click();
    await p.locator('.cake__svg').first().waitFor();
    await p.close();
  });

  await step('finished game: team report, open book, CSV', async () => {
    const p = await page(browser, 'laptop', TEAMS[0].email);
    await p.goto(base + '#/g/' + done.gameId + '/report');
    await p.getByRole('heading', { name: 'Your result' }).waitFor();
    await p.getByText('Every team\'s decisions').waitFor();
    const [download] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: 'Download CSV' }).click()]);
    assert.match(download.suggestedFilename(), /\.csv$/);
    await shot(p, 'report-01-team', true);
    await p.close();
  });

  await step('public team report link and rating page', async () => {
    const dash = await done.call(TEAMS[0].email, 'dashboard', { gameId: done.gameId });
    const p = await page(browser, 'phone');
    await p.goto(base + 'report/?t=' + dash.reportToken);
    await p.getByRole('heading', { name: 'Taco Town' }).waitFor();
    await shot(p, 'phone-09-public-report');
    await p.goto(base + 'rating/');
    await p.locator('.table--rating').waitFor();
    await shot(p, 'phone-10-rating', true);
    // Фильтр по месту: регион мира, страна, штат.
    await p.getByLabel('Where').selectOption('a:US:TX');
    const places = await p.locator('.table--rating tbody td:nth-child(3)').allTextContents();
    assert.ok(places.length && places.every((x) => x === 'Texas, US'), 'only Texas teams: ' + places.join(' | '));
    await p.getByLabel('Where').selectOption('r:north_america');
    assert.ok((await p.locator('.table--rating tbody tr').count()) > places.length, 'the whole region');
    await p.close();
  });

  await step('languages: a Spanish game opens in Spanish, the menu switches to Russian', async () => {
    // Игра на испанском: игрок видит её по-испански без всяких настроек.
    const es = await seedGame(server.sql, { months: 2, title: 'Juego de Miami', language: 'es', sponsor: false });
    await es.call(ADMIN, 'openRound', { gameId: es.gameId });
    const p = await page(browser, 'laptop', TEAMS[0].email);
    await p.goto(base + '#/g/' + es.gameId);
    await p.getByRole('button', { name: 'Enviar decisión' }).or(p.getByRole('button', { name: 'Actualizar decisión' })).waitFor();
    assert.equal(await p.evaluate(() => document.documentElement.lang), 'es');
    await p.locator('.cake__svg').first().waitFor();
    await p.getByText('Cuota de mercado').first().waitFor();
    await p.waitForTimeout(400);
    await shot(p, 'lang-es-01-game');
    // Меню → Настройки → Язык: русский — и сайт, и игра по-русски.
    await p.getByRole('button', { name: 'Menú' }).click();
    await p.getByLabel('Idioma').selectOption('ru');
    await p.getByRole('button', { name: 'Отправить решение' }).or(p.getByRole('button', { name: 'Обновить решение' })).waitFor();
    const money = await p.locator('.topbar__money b').textContent();
    assert.match(money, /\$$/, 'Russian money: 12 340 $');
    await p.locator('.tab--board').click();
    await p.getByRole('button', { name: 'Экономика' }).click();
    await p.getByRole('heading', { name: 'Красный или голубой океан?' }).waitFor();
    await p.getByText('Как считаем').first().waitFor();
    await p.waitForTimeout(400);
    await shot(p, 'lang-ru-01-economy');
    await p.locator('.tab--guide').click();
    await p.getByRole('heading', { name: 'Как победить' }).waitFor();
    await shot(p, 'lang-ru-02-guide');
    await p.goto(base + '#/');
    await p.getByRole('heading', { name: 'Мои игры' }).waitFor();
    // «Автоматически»: игра — снова на своём языке, остальной сайт — на языке браузера.
    await p.getByRole('button', { name: 'Меню' }).click();
    await p.getByLabel('Язык').selectOption('auto');
    await p.getByRole('heading', { name: 'My games' }).waitFor();
    await p.goto(base + '#/g/' + es.gameId);
    await p.getByText('Tus decisiones para el mes').waitFor();
    await p.close();
  });

  await step('languages: Portuguese host console and a new game in the host\'s language', async () => {
    const p = await page(browser, 'laptop', ADMIN);
    await p.addInitScript(() => localStorage.setItem('mg-lang', 'pt'));
    await p.goto(base + '#/g/' + live.gameId);
    await p.getByText('Pronto para começar').or(p.getByText(/O mês \d+ (de \d+ )?(está aberto|foi calculado)/)).first().waitFor();
    await p.waitForTimeout(300);
    await shot(p, 'lang-pt-01-console');
    await p.goto(base + '#/new');
    await p.getByRole('heading', { name: 'Criar um jogo' }).waitFor();
    assert.equal(await p.getByLabel('Idioma do jogo').inputValue(), 'pt', 'the game language defaults to the host\'s language');
    await p.close();
  });

  await step('quality stars: next to team names and for the town, everywhere', async () => {
    // Качество подставляем в итоги: честно накопить три пункта за тест долго.
    // Последний месяц: у всех 1,2 (у города первая звезда), у Taco Town — 2,1.
    const [{ r }] = await server.sql`select max(round_number) as r from results where game_id = ${live.gameId}`;
    await server.sql`update results set quality = 0.3 where game_id = ${live.gameId} and round_number = ${r - 1}`;
    await server.sql`update results set quality = 1.2 where game_id = ${live.gameId} and round_number = ${r}`;
    await server.sql`update players p set quality = 1.2 from results x
                     where x.player_id = p.id and x.game_id = ${live.gameId} and x.round_number = ${r} and p.status = 'active'`;
    const [taco] = await server.sql`select id from players where game_id = ${live.gameId} and email = ${TEAMS[0].email}`;
    await server.sql`update results set quality = 2.1 where player_id = ${taco.id} and round_number = ${r}`;
    await server.sql`update players set quality = 2.1 where id = ${taco.id}`;

    const p = await page(browser, 'laptop', TEAMS[0].email);
    await p.goto(base + '#/g/' + live.gameId);
    await p.locator('.pane--board').getByRole('button', { name: 'Teams', exact: true }).click();
    const row = p.locator('.table--standings tr', { hasText: 'Taco Town' });
    await row.locator('.stars').waitFor();
    assert.equal(await row.locator('.stars').getAttribute('aria-label'), '2 quality stars out of 3');
    assert.match(await p.locator('.board-line .stars--city').getAttribute('aria-label'), /City: 1 quality star out of 3/);
    await p.locator('.stars-news', { hasText: 'Taco Town' }).waitFor();
    await p.locator('.topbar__name .stars').waitFor();
    await p.waitForTimeout(300);
    await shot(p, 'stars-01-game');
    await p.close();

    const b = await page(browser, 'projector', ADMIN);
    await b.goto(base + 'board/?code=' + live.code);
    await b.getByRole('button', { name: 'Teams and charts' }).click();
    await b.locator('.table--standings .stars').first().waitFor();
    await b.waitForTimeout(400);
    await shot(b, 'stars-02-projector');
    await b.close();

    const h = await page(browser, 'laptop', ADMIN);
    await h.goto(base + '#/g/' + live.gameId);
    await h.locator('.stars-news', { hasText: 'Taco Town' }).first().waitFor();
    await h.getByRole('button', { name: 'Teams', exact: true }).first().click();
    await h.locator('.team-cell .stars').first().waitFor();
    await shot(h, 'stars-03-console');
    await h.close();
  });

  if (errors.length) {
    console.log('\nJavaScript errors on pages:\n  ' + errors.join('\n  '));
    process.exitCode = 1;
  } else {
    console.log(`\nALL UI CHECKS PASSED (${passed}). Screenshots: ${OUT}/`);
  }
} catch (e) {
  console.error(e);
  if (errors.length) console.log('\nJavaScript errors on pages:\n  ' + errors.join('\n  '));
  process.exitCode = 1;
} finally {
  await browser?.close();
  await server.close();
}
