// Проверка игры в рублях и в батах.
//
//   npm run build && node tests/currency_check.mjs
//
// Игра в рублях и в батах — тот же баланс, что и в долларах: все денежные
// настройки × 50 (чек $30 → 1 500 ₽, налог 25%, как в России) или × 35
// (чек → 1 050 ฿, налог 20%, как в Таиланде). Тест проверяет пресеты и то,
// что движок считает такую игру так же: при равном налоге — те же доли
// рынка и банкротства, деньги ровно × множитель.

import assert from 'node:assert/strict';
import { calculateRound } from '../build/economy.mjs';
import { configFor, editableFor, EDITABLE_CONFIG, MONEY_KEYS, CURRENCIES } from '../build/presets.mjs';
import { freshPlayer } from './baseline-config.mjs';

const usd = configFor('start', 'USD');
assert.equal(usd.PROFIT_TAX_RATE, 0.21, 'в долларовой игре — как раньше');
assert.equal(editableFor('USD'), EDITABLE_CONFIG);
// Деньги — все числовые настройки, которые измеряются в долларах: ни одна не забыта.
const notMoney = /ELASTICITY|MULT|KAPPA|PCT|ADD|SIZE_PER_PLAYER|DEMAND_PER_TEAM|SCALES|CAT_|CAPACITY_(BASE|STEP|MIN|SHIFTS)$|CAPACITY_SHIFTS|ROUNDS|^K_|ALPHA|DECAY|GAIN|MONTHS|RATE|_MIN$|BONUS/;
for (const key of Object.keys(usd)) {
  if (typeof usd[key] !== 'number' || notMoney.test(key)) continue;
  assert.ok(MONEY_KEYS.includes(key), key + ' похоже на деньги, но не в MONEY_KEYS');
}

const DECISION_MONEY = ['price', 'seo_spend', 'promo_spend', 'maps_spend', 'social_spend', 'outdoor_spend',
  'affiliate_spend', 'quality_invest'];

let failed = false;
for (const [code, scale, tax, check, capital, word] of [
  ['RUB', 50, 0.25, 1500, 500000, 'рублях'],
  ['THB', 35, 0.20, 1050, 350000, 'батах']
]) {
  const K = CURRENCIES[code].scale;
  const cur = configFor('start', code);

  // 1. Пресет.
  assert.equal(K, scale);
  assert.equal(cur.P_REF, check, code + ': чек');
  assert.equal(cur.START_CAPITAL, capital, code + ': стартовый капитал');
  assert.equal(cur.PROFIT_TAX_RATE, tax, code + ': налог на прибыль');
  for (const key of Object.keys(usd)) {
    if (MONEY_KEYS.includes(key)) assert.equal(cur[key], usd[key] * K, `${code}: ${key} × ${K}`);
    else if (key !== 'PROFIT_TAX_RATE') assert.equal(cur[key], usd[key], `${code}: ${key} не зависит от валюты`);
  }
  // Диапазоны настроек ведущего — тоже в этой валюте.
  assert.equal(editableFor(code).RENT.max, EDITABLE_CONFIG.RENT.max * K);
  assert.equal(editableFor(code).P_REF.min, EDITABLE_CONFIG.P_REF.min * K);
  assert.deepEqual(editableFor(code).PROFIT_TAX_RATE, EDITABLE_CONFIG.PROFIT_TAX_RATE, 'ставки — доли, не деньги');

  // 2. Движок: при равном налоге игра в этой валюте идентична долларовой.
  const sameTax = { ...cur, PROFIT_TAX_RATE: usd.PROFIT_TAX_RATE };
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
      const ob = calculateRound({ roundNumber: r, cfg: sameTax, players: b.filter((p) => p.status === 'active'), decisions: db });
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
  console.log(`${code}: строк ${rows}, макс. расхождение доли ${worstShare.toExponential(1)}, кассы ${worstCash.toExponential(1)}, ` +
    `статусов ${statusMismatch} — ${same ? `игра в ${word} идентична долларовой` : 'РАСХОЖДЕНИЕ'}`);
  if (!same) failed = true;
}
if (failed) process.exit(1);
