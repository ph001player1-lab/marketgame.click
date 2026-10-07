// Проверка игры в рублях.
//
//   npm run build && node tests/currency_check.mjs
//
// Игра в рублях — тот же баланс, что и в долларах: все денежные настройки
// × 50 (чек $30 → 1 500 ₽), налог на прибыль 25%, как в России. Тест
// проверяет пресет и то, что движок считает рублёвую игру так же: при
// равном налоге — те же доли рынка и банкротства, деньги ровно × 50.

import assert from 'node:assert/strict';
import { calculateRound } from '../build/economy.mjs';
import { configFor, editableFor, EDITABLE_CONFIG, MONEY_KEYS, CURRENCIES } from '../build/presets.mjs';
import { freshPlayer } from './baseline-config.mjs';

const K = CURRENCIES.RUB.scale;
const usd = configFor('start', 'USD');
const rub = configFor('start', 'RUB');

// 1. Пресет.
assert.equal(K, 50);
assert.equal(rub.P_REF, 1500, 'чек 1 500 ₽');
assert.equal(rub.START_CAPITAL, 500000, 'стартовый капитал 500 000 ₽');
assert.equal(rub.PROFIT_TAX_RATE, 0.25, 'налог на прибыль в России 25%');
assert.equal(usd.PROFIT_TAX_RATE, 0.21, 'в долларовой игре — как раньше');
for (const key of Object.keys(usd)) {
  if (MONEY_KEYS.includes(key)) assert.equal(rub[key], usd[key] * K, key + ' × 50');
  else if (key !== 'PROFIT_TAX_RATE') assert.equal(rub[key], usd[key], key + ' не зависит от валюты');
}
// Деньги — все числовые настройки, которые измеряются в долларах: ни одна не забыта.
const notMoney = /ELASTICITY|MULT|KAPPA|PCT|ADD|SIZE_PER_PLAYER|SCALES|CAT_|CAPACITY_(BASE|STEP|MIN|SHIFTS)$|CAPACITY_SHIFTS|ROUNDS|^K_|ALPHA|DECAY|GAIN|MONTHS|RATE|_MIN$|BONUS/;
for (const key of Object.keys(usd)) {
  if (typeof usd[key] !== 'number' || notMoney.test(key)) continue;
  assert.ok(MONEY_KEYS.includes(key), key + ' похоже на деньги, но не в MONEY_KEYS');
}
// Диапазоны настроек ведущего — тоже в рублях.
assert.equal(editableFor('USD'), EDITABLE_CONFIG);
assert.equal(editableFor('RUB').RENT.max, EDITABLE_CONFIG.RENT.max * K);
assert.equal(editableFor('RUB').P_REF.min, EDITABLE_CONFIG.P_REF.min * K);
assert.deepEqual(editableFor('RUB').PROFIT_TAX_RATE, EDITABLE_CONFIG.PROFIT_TAX_RATE, 'ставки — доли, не деньги');

// 2. Движок: при равном налоге рублёвая игра идентична долларовой.
const rubSameTax = { ...rub, PROFIT_TAX_RATE: usd.PROFIT_TAX_RATE };
const DECISION_MONEY = ['price', 'seo_spend', 'promo_spend', 'maps_spend', 'social_spend', 'outdoor_spend',
  'affiliate_spend', 'quality_invest'];
let seed = 11;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const decision = () => ({
  price: 15 + Math.round(rnd() * 45),
  seo_spend: rnd() < 0.5 ? Math.round(rnd() * 8000) : 0,
  promo_spend: rnd() < 0.5 ? Math.round(rnd() * 6000) : 0,
  maps_spend: rnd() < 0.5 ? Math.round(rnd() * 5000) : 0,
  social_spend: rnd() < 0.5 ? Math.round(rnd() * 12000) : 0,
  outdoor_spend: rnd() < 0.2 ? 4000 + Math.round(rnd() * 6000) : 0,
  affiliate_spend: rnd() < 0.3 ? 2000 : 0,
  shifts_delta: Math.floor(rnd() * 3) - 1,
  quality_invest: rnd() < 0.15 ? 40000 : 0
});

let rows = 0, worstShare = 0, worstCash = 0, statusMismatch = 0;
for (let g = 0; g < 150; g++) {
  const n = 3 + Math.floor(rnd() * 6);
  let a = [], b = [];
  for (let i = 0; i < n; i++) {
    const p = freshPlayer(i, usd, usd.START_CAPITAL * (1 + 3 * rnd()));
    a.push(p);
    b.push({ ...p, cash: p.cash * K });
  }
  for (let r = 1; r <= 12; r++) {
    const da = {}, db = {};
    for (const p of a) {
      const d = decision();
      da[p.id] = d;
      db[p.id] = { ...d, ...Object.fromEntries(DECISION_MONEY.map((k) => [k, d[k] * K])) };
    }
    const oa = calculateRound({ roundNumber: r, cfg: usd, players: a.filter((p) => p.status === 'active'), decisions: da });
    const ob = calculateRound({ roundNumber: r, cfg: rubSameTax, players: b.filter((p) => p.status === 'active'), decisions: db });
    const byId = new Map(ob.results.map((x) => [x.player_id, x]));
    for (const x of oa.results) {
      const y = byId.get(x.player_id);
      rows++;
      worstShare = Math.max(worstShare, Math.abs(x.market_share - y.market_share));
      worstCash = Math.max(worstCash, Math.abs(x.cash_after * K - y.cash_after) / (Math.max(1000, Math.abs(x.cash_after)) * K));
    }
    const na = new Map(oa.players.map((p) => [p.id, p]));
    const nb = new Map(ob.players.map((p) => [p.id, p]));
    a = a.map((p) => na.get(p.id) ?? p);
    b = b.map((p) => nb.get(p.id) ?? p);
    for (let i = 0; i < a.length; i++) if (a[i].status !== b[i].status) statusMismatch++;
  }
}
const same = worstShare < 1e-9 && worstCash < 1e-9 && statusMismatch === 0;
console.log(`rubles: строк ${rows}, макс. расхождение доли ${worstShare.toExponential(1)}, кассы ${worstCash.toExponential(1)}, ` +
  `статусов ${statusMismatch} — ${same ? 'игра в рублях идентична долларовой' : 'РАСХОЖДЕНИЕ'}`);
if (!same) process.exit(1);
