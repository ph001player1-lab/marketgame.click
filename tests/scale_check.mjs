// Проверка перехода на доллары: если все денежные параметры и все денежные
// решения игроков умножить на один коэффициент k, игра должна вести себя
// так же — те же доли рынка, те же банкротства, касса ровно в k раз.
//
// Смысл: долларовая версия — это другой пресет настроек, а не новый баланс.
// Если тест упал, значит в движке появилась денежная константа, которая не
// берётся из настроек, и пересчёт в доллары её не заденет.

import { calculateRound } from '../build/economy.mjs';
import { BASELINE_THB, DECISION_MONEY_KEYS, scaleConfig, freshPlayer } from './baseline-config.mjs';

const FACTORS = [1 / 10, 1 / 20];
const GAMES = 200;
const MONTHS = 12;
const TOLERANCE = 1e-9;

let seed = 7;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;

function randomDecision() {
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

let failed = false;

for (const k of FACTORS) {
  const cfgScaled = scaleConfig(BASELINE_THB, k);
  let rows = 0, worstShare = 0, worstCash = 0, statusMismatch = 0;

  for (let g = 0; g < GAMES; g++) {
    const n = 3 + Math.floor(rnd() * 6);
    let base = [], scaled = [];
    for (let i = 0; i < n; i++) {
      const p = freshPlayer(i, BASELINE_THB, BASELINE_THB.START_CAPITAL * (1 + 3 * rnd()));
      base.push(p);
      scaled.push({ ...p, cash: p.cash * k });
    }

    for (let r = 1; r <= MONTHS; r++) {
      const dBase = {}, dScaled = {};
      for (const p of base) {
        const d = randomDecision();
        dBase[p.id] = d;
        const ds = { ...d };
        for (const key of DECISION_MONEY_KEYS) ds[key] = d[key] * k;
        dScaled[p.id] = ds;
      }

      const oBase = calculateRound({ roundNumber: r, cfg: BASELINE_THB,
        players: base.filter((p) => p.status === 'active'), decisions: dBase });
      const oScaled = calculateRound({ roundNumber: r, cfg: cfgScaled,
        players: scaled.filter((p) => p.status === 'active'), decisions: dScaled });

      const byId = new Map(oScaled.results.map((x) => [x.player_id, x]));
      for (const a of oBase.results) {
        const b = byId.get(a.player_id);
        rows++;
        worstShare = Math.max(worstShare, Math.abs(a.market_share - b.market_share));
        const denom = Math.max(1000, Math.abs(a.cash_after)) * k;
        worstCash = Math.max(worstCash, Math.abs(a.cash_after * k - b.cash_after) / denom);
      }

      const nextBase = new Map(oBase.players.map((p) => [p.id, p]));
      const nextScaled = new Map(oScaled.players.map((p) => [p.id, p]));
      base = base.map((p) => nextBase.get(p.id) ?? p);
      scaled = scaled.map((p) => nextScaled.get(p.id) ?? p);
      for (let i = 0; i < base.length; i++) {
        if (base[i].status !== scaled[i].status) statusMismatch++;
      }
    }
  }

  const ok = worstShare < TOLERANCE && worstCash < TOLERANCE && statusMismatch === 0;
  if (!ok) failed = true;
  console.log(`k = 1/${Math.round(1 / k)}: строк ${rows}, ` +
    `макс. расхождение доли рынка ${worstShare.toExponential(1)}, ` +
    `кассы ${worstCash.toExponential(1)}, расхождений статуса ${statusMismatch} — ` +
    (ok ? 'игра идентична' : 'РАСХОЖДЕНИЕ'));
}

if (failed) process.exit(1);
