// Проверки экономики v5.0.
//
//   1. Разбивка аренды на аренду, страховку и коммунальные не меняет игру:
//      пресет US_V5 с выключенными налогом и ростом рынка и со ставкой 15%
//      считает ровно как баланс v4.9, поделённый на 10.
//   2. Налог на прибыль берётся только с прибыли сверх накопленных убытков.
//   3. Рынок растёт на MARKET_QUALITY_GAIN за единицу среднего качества.
//
// В конце — отчёт для сведения: как v5.0 меняет выживаемость и итоговый
// капитал на случайных партиях по сравнению с v4.9.

import { calculateRound } from '../build/economy.mjs';
import { US_V5 } from '../build/presets.mjs';
import { BASELINE_THB, MONEY_KEYS, DECISION_MONEY_KEYS, scaleConfig, freshPlayer } from './baseline-config.mjs';

let failures = 0;
const check = (ok, msg) => { if (!ok) { failures++; console.log('  ОШИБКА: ' + msg); } };

let seed = 11;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;

// Решения в масштабе батов; для долларов делятся на 10.
function randomDecisionThb() {
  return {
    price: 150 + Math.round(rnd() * 450),
    seo_spend: rnd() < 0.5 ? Math.round(rnd() * 80000) : 0,
    promo_spend: rnd() < 0.5 ? Math.round(rnd() * 60000) : 0,
    maps_spend: rnd() < 0.5 ? Math.round(rnd() * 50000) : 0,
    social_spend: rnd() < 0.5 ? Math.round(rnd() * 120000) : 0,
    outdoor_spend: rnd() < 0.2 ? 40000 + Math.round(rnd() * 60000) : 0,
    affiliate_spend: rnd() < 0.3 ? 20000 : 0,
    shifts_delta: Math.floor(rnd() * 3) - 1,
    quality_invest: rnd() < 0.15 ? 400000 : 0
  };
}
const toUsd = (d) => { const o = { ...d }; for (const k of DECISION_MONEY_KEYS) o[k] = d[k] / 10; return o; };

// Партия из нескольких месяцев в двух настройках сразу; колбэк сравнивает
// строки результатов одного месяца.
function playSideBySide(cfgA, cfgB, months, onRound, decide = randomDecisionThb, toB = toUsd, scaleCash = 0.1) {
  const n = 3 + Math.floor(rnd() * 6);
  let a = [], b = [];
  for (let i = 0; i < n; i++) {
    const p = freshPlayer(i, cfgA, cfgA.START_CAPITAL * (1 + 3 * rnd()));
    a.push(p);
    b.push({ ...p, cash: p.cash * scaleCash });
  }
  for (let r = 1; r <= months; r++) {
    const dA = {}, dB = {};
    for (const p of a) { const d = decide(p); dA[p.id] = d; dB[p.id] = toB(d); }
    const oA = calculateRound({ roundNumber: r, cfg: cfgA, players: a.filter((p) => p.status === 'active'), decisions: dA });
    const oB = calculateRound({ roundNumber: r, cfg: cfgB, players: b.filter((p) => p.status === 'active'), decisions: dB });
    onRound(oA, oB, r);
    const nA = new Map(oA.players.map((p) => [p.id, p]));
    const nB = new Map(oB.players.map((p) => [p.id, p]));
    a = a.map((p) => nA.get(p.id) ?? p);
    b = b.map((p) => nB.get(p.id) ?? p);
  }
}

// ---------------------------------------------------------------- 1
console.log('1. Разбивка аренды не меняет баланс');
{
  const scaled = scaleConfig(BASELINE_THB, 0.1);
  for (const key of MONEY_KEYS) {
    if (key === 'RENT') continue;
    check(Math.abs(US_V5[key] - scaled[key]) < 1e-9, `${key}: пресет ${US_V5[key]}, ожидалось ${scaled[key]}`);
  }
  check(US_V5.RENT + US_V5.INSURANCE + US_V5.UTILITIES === scaled.RENT,
    'аренда + страховка + коммунальные должны давать прежние постоянные расходы');

  const neutral = { ...US_V5, PROFIT_TAX_RATE: 0, MARKET_QUALITY_GAIN: 0, LOAN_RATE_ANNUAL: BASELINE_THB.LOAN_RATE_ANNUAL };
  let rows = 0, worst = 0;
  for (let g = 0; g < 150; g++) {
    playSideBySide(BASELINE_THB, neutral, 12, (oA, oB) => {
      const byId = new Map(oB.results.map((x) => [x.player_id, x]));
      for (const x of oA.results) {
        const y = byId.get(x.player_id); rows++;
        const rel = Math.abs(x.cash_after / 10 - y.cash_after) / Math.max(100, Math.abs(x.cash_after / 10));
        worst = Math.max(worst, rel, Math.abs(x.market_share - y.market_share));
      }
      check(oA.players.every((p) => oB.players.find((q) => q.id === p.id).status === p.status), 'разошлись статусы');
    });
  }
  check(worst < 1e-9, 'расхождение ' + worst);
  console.log(`   строк ${rows}, макс. расхождение ${worst.toExponential(1)}`);
}

// ---------------------------------------------------------------- 2
console.log('2. Налог только с прибыли сверх накопленных убытков');
{
  const cfg = { ...US_V5 };
  let checked = 0, taxed = 0;
  for (let g = 0; g < 150; g++) {
    const cf = new Map();
    playSideBySide(cfg, cfg, 12, (o) => {
      for (const r of o.results) {
        const before = cf.get(r.player_id) ?? 0;
        let expectTax = 0, after = before;
        if (r.profit_before_tax > 0) {
          const off = Math.min(before, r.profit_before_tax);
          after = before - off;
          expectTax = (r.profit_before_tax - off) * cfg.PROFIT_TAX_RATE;
        } else {
          after = before - r.profit_before_tax;
        }
        cf.set(r.player_id, after);
        check(Math.abs(r.tax - expectTax) < 1e-6, `налог ${r.tax}, ожидался ${expectTax}`);
        check(Math.abs(r.profit - (r.profit_before_tax - r.tax)) < 1e-6, 'прибыль после налога');
        check(r.tax >= 0, 'отрицательный налог');
        checked++;
        if (r.tax > 0) taxed++;
      }
    }, (p) => toUsd(randomDecisionThb()), (d) => d, 1);
  }
  console.log(`   строк ${checked}, из них с налогом ${taxed}`);
}

// ---------------------------------------------------------------- 3
console.log('3. Рынок растёт от среднего качества');
{
  for (let t = 0; t < 50; t++) {
    const n = 2 + Math.floor(rnd() * 7);
    const players = Array.from({ length: n }, (_, i) => ({ ...freshPlayer(i, US_V5), quality: Math.round(rnd() * 300) / 100 }));
    const decisions = Object.fromEntries(players.map((p) => [p.id, { price: 30, seo_spend: 0, promo_spend: 0,
      maps_spend: 0, social_spend: 0, outdoor_spend: 0, affiliate_spend: 0, shifts_delta: 0, quality_invest: 0 }]));
    const off = calculateRound({ roundNumber: 1, cfg: { ...US_V5, MARKET_QUALITY_GAIN: 0 }, players, decisions });
    const on = calculateRound({ roundNumber: 1, cfg: US_V5, players, decisions });
    // Качество тает на 5% уже в первой фазе месяца — среднее берём после неё.
    const avgQ = off.players.reduce((s, p) => s + p.quality, 0) / n;
    const expect = off.marketTotal * (1 + US_V5.MARKET_QUALITY_GAIN * avgQ);
    check(Math.abs(on.marketTotal - expect) < 1e-6, `рынок ${on.marketTotal}, ожидался ${expect}`);
  }
  console.log('   50 сценариев');
}

if (failures) { console.log(`\nОШИБОК: ${failures}`); process.exit(1); }
console.log('\nВСЁ СХОДИТСЯ — экономика v5.0 ведёт себя, как задумано.');

// ---------------------------------------------------------------- отчёт
if (process.argv.includes('--report')) {
  console.log('\nОтчёт: 5 команд, 12 месяцев, случайные решения, по 400 партий');
  const summarize = (label, cfg) => {
    let alive = 0, total = 0;
    const mult = [];
    for (let g = 0; g < 400; g++) {
      const players = Array.from({ length: 5 }, (_, i) => freshPlayer(i, cfg));
      let state = players;
      for (let r = 1; r <= 12; r++) {
        const act = state.filter((p) => p.status === 'active');
        if (!act.length) break;
        const decisions = Object.fromEntries(act.map((p) => {
          const d = toUsd(randomDecisionThb());
          d.price = 24 + Math.round(rnd() * 16);            // $24–40
          for (const k of ['seo_spend', 'promo_spend', 'maps_spend', 'social_spend', 'outdoor_spend', 'affiliate_spend', 'quality_invest']) {
            d[k] = Math.min(d[k], Math.max(0, p.cash) * 0.15); // не больше 15% кассы на статью
          }
          return [p.id, d];
        }));
        const out = calculateRound({ roundNumber: r, cfg, players: act, decisions });
        const next = new Map(out.players.map((p) => [p.id, p]));
        state = state.map((p) => next.get(p.id) ?? p);
      }
      for (const p of state) {
        total++;
        if (p.status === 'active') { alive++; mult.push(p.cash / cfg.START_CAPITAL); }
      }
    }
    mult.sort((x, y) => x - y);
    const med = mult.length ? mult[Math.floor(mult.length / 2)] : 0;
    console.log(`   ${label.padEnd(36)} дожили до конца ${(100 * alive / total).toFixed(0)}%, медиана капитала ×${med.toFixed(1)}`);
  };
  summarize('v4.9 в долларах', scaleConfig(BASELINE_THB, 0.1));
  summarize('v5.0 без налога и роста рынка', { ...US_V5, PROFIT_TAX_RATE: 0, MARKET_QUALITY_GAIN: 0 });
  summarize('v5.0 полностью', US_V5);
}
