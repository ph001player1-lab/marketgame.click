// Сквозной сценарий: одна игра целиком через интерфейс, как на настоящем
// мероприятии. Ведущий создаёт игру и вносит команды, команды входят с
// телефонов, заполняют профиль, отправляют решения, берут кредит,
// переводят деньги, покупают долю на бирже, голосуют; ведущий отвечает
// за город, открывает и считает месяцы, подписывает закон, заканчивает
// игру; команда открывает отчёт, все — рейтинг. Ни одного вызова API в
// обход экранов — только клики и ввод.
//
//   npm run build && node tests/ui/journey.mjs   (PW_CHROMIUM — свой Chromium)

import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { startServer, ADMIN } from './server.mjs';
import { moneyInvariants } from '../api/harness.mjs';

async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* нет в проекте — берём глобальный */ }
  const require = createRequire(import.meta.url);
  for (const p of ['/opt/node22/lib/node_modules/playwright', '/usr/local/lib/node_modules/playwright', '/usr/lib/node_modules/playwright']) {
    try { return require(p); } catch { /* дальше */ }
  }
  throw new Error('Playwright not found: npm i -D playwright');
}

const TEAMS = [
  { email: 'olga@journey.test', name: 'Olga', restaurant: 'Borscht Bar' },
  { email: 'pedro@journey.test', name: 'Pedro', restaurant: 'Taqueria Sol' },
  { email: 'mei@journey.test', name: 'Mei', restaurant: 'Noodle Lab' }
];

const { chromium } = await loadPlaywright();
const server = await startServer({ port: Number(process.env.PORT || 8093), db: 'mg_ui_journey', pollMs: 1500 });
const errors = [];
let browser = null;
let passed = 0;

async function step(name, fn) {
  try { await fn(); passed++; console.log('  ok  ' + name); } catch (e) { console.log('  FAIL ' + name); throw e; }
}

async function open(kind, email) {
  const sizes = {
    phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    laptop: { viewport: { width: 1280, height: 800 } }
  };
  const ctx = await browser.newContext({ ...sizes[kind], locale: 'en-US', timezoneId: 'America/Chicago' });
  await ctx.addInitScript((e) => localStorage.setItem('mg-test-email', e), email);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(email + ': ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(email + ' console: ' + m.text()); });
  p.on('response', (r) => { if (r.url().includes('/api') && r.status() >= 500) errors.push(email + ': HTTP ' + r.status()); });
  return p;
}

try {
  browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  const base = server.url;
  let gameId = '';
  const host = await open('laptop', ADMIN);
  const teams = [];

  console.log('Сквозной сценарий: игра целиком через интерфейс');

  await step('host creates a game and adds three teams', async () => {
    await host.goto(base + '#/new');
    await host.getByLabel('Game title').fill('Journey Cup');
    await host.getByRole('button', { name: 'Create game' }).click();
    await host.getByText('Ready to start').waitFor();
    gameId = host.url().match(/#\/g\/([0-9a-f-]{36})/)[1];
    await host.getByRole('button', { name: 'Teams', exact: true }).first().click();
    await host.getByLabel('Team emails').fill(TEAMS.map((x) => x.email).join('\n'));
    await host.getByRole('button', { name: 'Save roster' }).click();
    await host.getByText(/added: 3|3 added|Added 3/i).first().waitFor();
  });

  await step('teams sign in on phones and fill in the profile', async () => {
    for (const tm of TEAMS) {
      const p = await open('phone', tm.email);
      await p.goto(base + '#/g/' + gameId);
      await p.getByRole('heading', { name: 'Welcome to the game' }).waitFor();
      await p.getByLabel('Your name').fill(tm.name);
      await p.getByLabel('Restaurant name').fill(tm.restaurant);
      await p.getByRole('button', { name: 'Start playing' }).click();
      await p.getByText('The game hasn\'t started yet').waitFor();
      teams.push(p);
    }
  });

  await step('host opens month 1; every team sends a decision', async () => {
    await host.getByRole('button', { name: 'Run', exact: true }).click();
    await host.getByRole('button', { name: 'Open month 1' }).click();
    const dlg = host.locator('dialog');
    if (await dlg.count()) await dlg.getByRole('button').last().click().catch(() => {});
    await host.getByRole('button', { name: /Calculate month 1/ }).waitFor();
    for (const p of teams) {
      await p.locator('.tab--main').click();
      const send = p.getByRole('button', { name: 'Send decision' });
      await send.waitFor({ timeout: 15000 });
      await send.click();
      await p.getByText('Decision sent').first().waitFor();
    }
  });

  await step('Bank: a loan and a transfer; Invest: a stake request the city accepts', async () => {
    const [olga, pedro, mei] = teams;
    await olga.locator('.tab--bank').click();
    await olga.getByLabel('Borrow', { exact: true }).fill('5000');
    await olga.getByRole('button', { name: 'Borrow', exact: true }).click();
    await olga.getByText('Loan received: $5,000.').waitFor();
    await pedro.locator('.tab--bank').click();
    await pedro.getByLabel('Recipient').selectOption({ label: 'Noodle Lab' });
    await pedro.getByRole('textbox', { name: 'Amount, $' }).fill('100');
    await pedro.getByRole('button', { name: 'Send', exact: true }).click();
    await pedro.getByText('Sent $100 to Noodle Lab.').waitFor();
    await mei.locator('.tab--invest').click();
    const form = mei.locator('#buy-form');
    await form.getByLabel('Company').selectOption('bank');
    await form.getByLabel('How much, %').fill('5');
    await form.getByLabel('Price for the whole stake, $').fill('1000');
    await form.getByRole('button', { name: 'Send the request' }).click();
    await mei.getByText('Request sent').first().waitFor();
    await host.getByRole('button', { name: 'City', exact: true }).click();
    const ex = host.locator('#host-exchange');
    await ex.getByText('Noodle Lab wants to buy 5% of the bank from the city').waitFor({ timeout: 15000 });
    await ex.getByRole('button', { name: 'Accept', exact: true }).click();
    await host.getByText('Deal done').first().waitFor();
    await mei.locator('.offer').getByText('The deal is done.', { exact: true }).waitFor({ timeout: 15000 });
  });

  await step('host calculates month 1; teams see results and the news', async () => {
    await host.getByRole('button', { name: 'Run', exact: true }).click();
    await host.getByRole('button', { name: /Calculate month 1/ }).click();
    await host.locator('dialog').getByRole('button', { name: /Calculate month 1/ }).click();
    await host.getByRole('button', { name: 'Open month 2' }).waitFor({ timeout: 20000 });
    for (const p of teams) {
      await p.locator('.tab--main').click();
      await p.getByText(/Profit and loss · month 1|Month 1/).first().waitFor({ timeout: 15000 });
    }
    await teams[2].locator('.tab--board').click();
    await teams[2].locator('.news-card').getByText(/Noodle Lab bought 5% of the bank from the city/).waitFor({ timeout: 15000 });
  });

  await step('month 2: the citizens vote for a tax, the host signs it; teams see it coming', async () => {
    await host.getByRole('button', { name: 'Open month 2' }).click();
    const dlg = host.locator('dialog');
    if (await dlg.count()) await dlg.getByRole('button').last().click().catch(() => {});
    const card = host.locator('.card', { hasText: 'Start the vote' });
    await card.getByLabel('What to vote on').selectOption('profit_tax');
    await card.getByLabel('Value, %').fill('25');
    await card.getByRole('button', { name: 'Start the vote' }).click();
    await host.getByText('The vote has started.').waitFor();
    for (const p of teams.slice(0, 2)) {
      await p.locator('.strip', { hasText: 'Set the profit tax at 25%' }).click({ timeout: 15000 });
      await p.locator('.vote').getByRole('button', { name: 'Yes' }).click();
      await p.locator('.vote').getByText('your vote: yes').waitFor();
    }
    await host.getByRole('button', { name: 'Finish now' }).click();
    await host.getByRole('button', { name: 'Sign', exact: true }).click();
    await host.getByText('The host signed it. Takes effect from next month.').first().waitFor();
    await teams[0].locator('.tab--main').click();
    await teams[0].getByText(/Profit tax: 21% → 25%/).waitFor({ timeout: 15000 });
  });

  await step('month 2 is played and calculated; the host finishes the game', async () => {
    for (const p of teams) {
      await p.locator('.tab--main').click();
      const send = p.getByRole('button', { name: /Send decision|Update decision/ });
      await send.waitFor({ timeout: 15000 });
      await send.click();
      await p.getByText('Decision sent').first().waitFor();
    }
    await host.getByRole('button', { name: /Calculate month 2/ }).click();
    await host.locator('dialog').getByRole('button', { name: /Calculate month 2/ }).click();
    await host.getByRole('button', { name: 'Open month 3' }).waitFor({ timeout: 20000 });
    await host.getByRole('button', { name: 'Finish game & update rating' }).click();
    await host.locator('dialog').getByRole('button', { name: 'Finish game & update rating' }).click();
    await host.getByText(/finished/i).first().waitFor();
  });

  await step('a team opens its report; the money still adds up', async () => {
    const p = teams[2];
    await p.goto(base + '#/g/' + gameId + '/report');
    await p.getByRole('heading', { name: 'Your result' }).waitFor();
    await p.getByText(/5% of the bank/).first().waitFor();
    await moneyInvariants(server.sql, gameId);
    const [{ status }] = await server.sql`select status from games where id = ${gameId}`;
    assert.equal(status, 'finished');
  });

  for (const p of [host, ...teams]) await p.context().close();
  if (errors.length) {
    console.log('\nОшибки на страницах:\n  ' + errors.join('\n  '));
    process.exitCode = 1;
  } else {
    console.log(`\nСКВОЗНОЙ СЦЕНАРИЙ ПРОЙДЕН (${passed} шагов).`);
  }
} catch (e) {
  console.error(e);
  if (errors.length) console.log('\nОшибки на страницах:\n  ' + errors.join('\n  '));
  process.exitCode = 1;
} finally {
  await browser?.close();
  await server.close();
}
