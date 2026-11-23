// «Обезьяний» тест сайта: случайные нажатия, ввод и переключения на живой
// игре — у команды на телефоне и ноутбуке, у ведущего и у команды на
// узком телефоне по-русски.
//
// Ошибка — это:
//   - ошибка JavaScript на странице (pageerror, console.error);
//   - ответ 500 от функции game;
//   - всплывающее «Something went wrong» — код ошибки, который сайт не знает;
//   - прокрутка вбок на телефоне.
//
// Случайность воспроизводимая:  MONKEY_SEED=7 MONKEY_STEPS=300 node tests/ui/monkey.mjs
// (браузер — как в screens.mjs; PW_CHROMIUM — свой Chromium).

import { createRequire } from 'node:module';
import { startServer, ADMIN } from './server.mjs';
import { seedGame, TEAMS } from './seed.mjs';

const SEED = Number(process.env.MONKEY_SEED || 1);
const STEPS = Number(process.env.MONKEY_STEPS || 120);

async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* нет в проекте — берём глобальный */ }
  const require = createRequire(import.meta.url);
  for (const p of ['/opt/node22/lib/node_modules/playwright', '/usr/local/lib/node_modules/playwright', '/usr/lib/node_modules/playwright']) {
    try { return require(p); } catch { /* дальше */ }
  }
  throw new Error('Playwright not found: npm i -D playwright');
}

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const en = (await import('../../web/assets/js/i18n/en.js')).default;
const ru = (await import('../../web/assets/js/i18n/ru.js')).default;
const SERVER_ERROR = [en.errors.server_error, ru.errors.server_error];
// Кнопки, которые обезьяне нажимать нельзя: они уводят из игры насовсем.
const FORBIDDEN = /sign out|выйти|delete|удалить|leave the game|выйти из игры|play again|сыграть ещё|finish game|закончить игру|print|печать/i;
const VALUES = ['', '0', '-5', '1e9', 'abc', '12,5', '100', '5', '31', '2500', '9999999', '<b>x</b>', '  7 ', '%', '0.01'];

const { chromium } = await loadPlaywright();
const server = await startServer({ port: Number(process.env.PORT || 8092), db: 'mg_ui_monkey', pollMs: 2000 });
const problems = [];
let browser = null;

/** Игра, где есть всё: доли, решение акционеров, заявка, аукцион, голосование, инициатива. */
async function setup() {
  const g = await seedGame(server.sql, { months: 3, title: 'Monkey town', sponsor: false });
  const call = g.call;
  const ok = async (p, what) => { const r = await p; if (!r.ok) throw new Error(what + ': ' + JSON.stringify(r)); return r; };
  await ok(call(ADMIN, 'openRound', { gameId: g.gameId }), 'openRound');
  const m = await ok(call(ADMIN, 'monitor', { gameId: g.gameId }), 'monitor');
  const id = (email) => m.players.find((p) => p.email === email).id;
  await ok(call(ADMIN, 'sellStake', { gameId: g.gameId, kind: 'landlord', playerId: id(TEAMS[0].email), pct: 55, price: 100 }), 'sell');
  await ok(call(ADMIN, 'sellStake', { gameId: g.gameId, kind: 'bank', playerId: id(TEAMS[1].email), pct: 35, price: 100 }), 'sell');
  await ok(call(TEAMS[0].email, 'proposePrice', { gameId: g.gameId, kind: 'landlord', value: 8200 }), 'propose');
  await ok(call(TEAMS[2].email, 'requestStake', { gameId: g.gameId, kind: 'insurer', seller: 'city', pct: 5, price: 500 }), 'request');
  const r = await ok(call(TEAMS[3].email, 'requestStake', { gameId: g.gameId, kind: 'utility', seller: 'city', pct: 5, price: 400 }), 'request');
  await ok(call(ADMIN, 'cityAnswerOffer', { gameId: g.gameId, offerId: r.offerId, answer: 'auction' }), 'auction');
  await ok(call(TEAMS[1].email, 'requestStake', { gameId: g.gameId, kind: 'landlord', seller: id(TEAMS[0].email), pct: 5, price: 300 }), 'request');
  await ok(call(TEAMS[4].email, 'proposeInitiative', { gameId: g.gameId, template: 'price_cap', target: 'bank', value: 15 }), 'initiative');
  await ok(call(ADMIN, 'startVote', { gameId: g.gameId, template: 'profit_tax', value: 25, seconds: 300 }), 'vote');
  return g;
}

/** Видимые элементы, с которыми можно что-то сделать. */
async function candidates(p) {
  return await p.evaluate((forbidden) => {
    const re = new RegExp(forbidden, 'i');
    const els = [...document.querySelectorAll('button, [role="tab"], select, input, textarea, summary, a[href^="#"], label.seller')];
    const out = [];
    let n = 0;
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || el.disabled || el.closest('[hidden]')) continue;
      const text = (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 60);
      if (re.test(text) || re.test(el.getAttribute('aria-label') || '')) continue;
      if (el.tagName === 'INPUT' && ['file', 'hidden'].includes(el.type)) continue;
      el.dataset.monkey = String(++n);
      out.push({ id: n, tag: el.tagName, type: el.type || '', text });
    }
    return out;
  }, FORBIDDEN.source);
}

async function monkey(name, kind, email, gameId, { lang = null, steps = STEPS, seed = SEED } = {}) {
  const R = rng(seed + name.length * 101);
  const pick = (list) => list[Math.floor(R() * list.length)];
  const views = {
    phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    narrow: { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true },
    laptop: { viewport: { width: 1280, height: 800 } }
  };
  const ctx = await browser.newContext({ ...views[kind], locale: 'en-US' });
  await ctx.addInitScript(([e, l]) => {
    localStorage.setItem('mg-test-email', e);
    if (l) localStorage.setItem('mg-lang', l);
  }, [email, lang]);
  const p = await ctx.newPage();
  const where = () => `${name}, шаг ${done}`;
  let done = 0;
  p.on('pageerror', (e) => problems.push(`${where()}: JavaScript: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error') problems.push(`${where()}: console: ${m.text()}`); });
  p.on('response', (r) => { if (r.url().includes('/api') && r.status() >= 500) problems.push(`${where()}: ответ ${r.status()}`); });
  p.on('dialog', (d) => d.dismiss().catch(() => {}));
  const url = server.url + '#/g/' + gameId;
  await p.goto(url);
  await p.locator('.pane--main .card').first().waitFor({ timeout: 15000 });
  const clicks = new Map();

  for (done = 1; done <= steps; done++) {
    // Ушли из игры (меню, «Мои игры») — возвращаемся.
    if (!p.url().includes('#/g/')) await p.goto(url);
    if (R() < 0.03) await p.reload();
    const list = await candidates(p);
    if (!list.length) { await p.waitForTimeout(200); continue; }
    const c = pick(list);
    const el = p.locator(`[data-monkey="${c.id}"]`);
    const label = c.tag.toLowerCase() + (c.type ? ':' + c.type : '') + ' «' + c.text.slice(0, 30) + '»';
    clicks.set(c.tag, (clicks.get(c.tag) ?? 0) + 1);
    try {
      if (c.tag === 'SELECT') {
        const options = await el.locator('option').evaluateAll((os) => os.map((o) => o.value));
        if (options.length) await el.selectOption(pick(options), { timeout: 1500 });
      } else if ((c.tag === 'INPUT' && !['radio', 'checkbox', 'button', 'submit'].includes(c.type)) || c.tag === 'TEXTAREA') {
        await el.fill(pick(VALUES), { timeout: 1500 });
        if (R() < 0.3) await el.press('Enter', { timeout: 1500 });
      } else {
        await el.click({ timeout: 1500 });
      }
    } catch { /* элемент исчез или перекрыт — обычное дело на живой странице */ }
    await p.waitForTimeout(80 + Math.floor(R() * 220));
    // Что-то пошло не так у сервера — сайт не узнал код ошибки.
    const toasts = await p.locator('.toast').allTextContents().catch(() => []);
    for (const tx of toasts) if (SERVER_ERROR.some((s) => tx.includes(s))) problems.push(`${where()}: «${tx}» после ${label}`);
    if (kind !== 'laptop') {
      const wide = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth).catch(() => 0);
      if (wide > 1) problems.push(`${where()}: страница шире экрана на ${wide}px после ${label}`);
    }
  }
  console.log(`  ok  ${name}: ${steps} действий (${[...clicks.entries()].map(([k, v]) => k.toLowerCase() + ' ' + v).join(', ')})`);
  await ctx.close();
}

try {
  console.log(`Обезьяний тест сайта: seed ${SEED}, по ${STEPS} действий`);
  const g = await setup();
  browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  await monkey('команда на телефоне', 'phone', TEAMS[0].email, g.gameId);
  await monkey('команда на ноутбуке', 'laptop', TEAMS[1].email, g.gameId);
  await monkey('ведущий', 'laptop', ADMIN, g.gameId);
  await monkey('команда на 360 px по-русски', 'narrow', TEAMS[2].email, g.gameId, { lang: 'ru' });
  // Деньги после всего этого по-прежнему сходятся.
  const { moneyInvariants } = await import('../api/harness.mjs');
  await moneyInvariants(server.sql, g.gameId);
} catch (e) {
  problems.push('прервалось: ' + (e.stack || e.message));
} finally {
  await browser?.close();
  await server.close();
}
if (problems.length) {
  console.log(`\nНАЙДЕНО ОШИБОК: ${problems.length}\n  ` + [...new Set(problems)].slice(0, 40).join('\n  '));
  process.exit(1);
}
console.log('\nОБЕЗЬЯНИЙ ТЕСТ САЙТА ПРОЙДЕН: ни ошибок JavaScript, ни сбоев сервера, ни прокрутки вбок.');
