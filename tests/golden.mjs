// Золотой тест: прогоняет один и тот же месяц через ОРИГИНАЛЬНУЮ логику
// (скопированную дословно из Code.gs v3.3) и через новый порт на TypeScript,
// затем сверяет каждое поле каждого результата.
//
// Смысл: при переезде на другую платформу баланс не должен поехать ни на
// копейку. Расхождение здесь дешевле найти сейчас, чем посреди живой сессии.

import { calculateRound } from '../build/economy.mjs';

const CFG = {
  P_REF: 300, P_FLOOR: 100, PRICE_ELASTICITY: 2.2, P_MAX_MULT: 1.8, KAPPA: 4,
  COGS_PCT: 0.40, QUALITY_COGS_ADD: 0.15,
  MARKET_SIZE_PER_PLAYER: 10000, MARKET_SCALES_WITH_PLAYERS: false,
  CAT_ELASTICITY: 0.4, CAT_MIN: 0.8, CAT_MAX: 1.3,
  CAPACITY_BASE: 3000, CAPACITY_STEP: 1000, CAPACITY_MIN: 100,
  CAPACITY_STEP_COST: 60000, CAPACITY_SHIFTS_MIN: -3, CAPACITY_SHIFTS_MAX: 5,
  RENT: 150000, PAYROLL_BASE: 220000, START_CAPITAL: 100000,
  CIVIL_SERVICE_SALARY: 35000, REOPEN_THRESHOLD: 100000, TOTAL_ROUNDS: 12,
  K_BRAND: 0.5, K_QUALITY: 0.5,
  K_SEO: 0.5, SEO_ALPHA: 0.9, SEO_REF: 60000, SEO_RAMP_MONTHS: 3, SEO_DECAY: 0.08,
  K_PROMO: 0.5, PROMO_ALPHA: 0.9, PROMO_REF: 50000,
  K_MAPS: 0.45, MAPS_ALPHA: 0.7, MAPS_REF: 40000, MAPS_DECAY: 0.15,
  K_SOCIAL: 0.6, SOCIAL_ALPHA: 0.8, SOCIAL_REF: 100000, SOCIAL_DECAY: 0.55,
  K_OUTDOOR: 0.4, OUTDOOR_ALPHA: 0.6, OUTDOOR_REF: 80000,
  OUTDOOR_MIN_SPEND: 40000, OUTDOOR_DURATION_MONTHS: 4,
  AFFILIATE_MIN_SPEND: 20000, AFFILIATE_BONUS_PCT: 0.125,
  BRAND_DECAY: 0.25, BRAND_GAIN: 0.25,
  QUALITY_DECAY: 0.05, QUALITY_UPKEEP: 15000, QUALITY_INVEST_DIVISOR: 400000,
  LOAN_TIER1_LIMIT: 300000, LOAN_TIER2_LIMIT: 800000, LOAN_TIER3_LIMIT: 2000000,
  LOAN_RATE_ANNUAL: 0.15, LOAN_TERM_MONTHS: 6, ROUND_DURATION_MIN: 5
};

// ---------------------------------------------------------------------------
// ЭТАЛОН — дословная копия calculateRound_ из Code.gs, работающая на массивах
// объектов вместо листов таблицы. Ни одна формула не изменена.
// ---------------------------------------------------------------------------
const clamp_ = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round2_ = (v) => Math.round(v * 100) / 100;
const computeCapacity_ = (cfg, shifts) =>
  Math.max(cfg.CAPACITY_MIN, cfg.CAPACITY_BASE + (Number(shifts) || 0) * cfg.CAPACITY_STEP);

function referenceCalculate(roundNumber, cfg, playersIn, decisionsIn) {
  const active = playersIn.map((p) => ({ ...p }));
  const decisions = {};
  const DEFAULT_DECISION = {
    price: cfg.P_REF, seo_spend: 0, promo_spend: 0, maps_spend: 0,
    social_spend: 0, outdoor_spend: 0, affiliate_spend: 0,
    shifts_delta: 0, quality_invest: 0
  };

  const mapsEffThisRound = {};
  active.forEach(function (p) {
    const u = p.id;
    const d = decisionsIn[u] || DEFAULT_DECISION;
    decisions[u] = d;

    mapsEffThisRound[u] = p.maps_level > 0
      ? cfg.MAPS_ALPHA * Math.pow(p.maps_level / cfg.MAPS_REF, 0.5) : 0;
    p.maps_level = p.maps_level * (1 - cfg.MAPS_DECAY) + Number(d.maps_spend || 0);

    if (!p.seo_unlocked) {
      if (Number(d.seo_spend || 0) > 0) p.seo_streak = (Number(p.seo_streak) || 0) + 1;
      else p.seo_streak = 0;
      if (p.seo_streak >= cfg.SEO_RAMP_MONTHS) p.seo_unlocked = true;
    }
    p.seo_level = p.seo_level * (1 - cfg.SEO_DECAY) + Number(d.seo_spend || 0);
    p.social_adstock = p.social_adstock * (1 - cfg.SOCIAL_DECAY) + Number(d.social_spend || 0);

    if (Number(d.outdoor_spend || 0) >= cfg.OUTDOOR_MIN_SPEND) {
      p.outdoor_level = cfg.OUTDOOR_ALPHA * Math.pow(Number(d.outdoor_spend) / cfg.OUTDOOR_REF, 0.5);
      p.outdoor_active_until = roundNumber + cfg.OUTDOOR_DURATION_MONTHS - 1;
    }
    p.affiliate_active = Number(d.affiliate_spend || 0) >= cfg.AFFILIATE_MIN_SPEND;

    p.quality = clamp_(p.quality * (1 - cfg.QUALITY_DECAY) +
      Number(d.quality_invest || 0) / cfg.QUALITY_INVEST_DIVISOR, 0, 3);
    p.capacity_shifts = clamp_((p.capacity_shifts || 0) + Number(d.shifts_delta || 0),
      cfg.CAPACITY_SHIFTS_MIN, cfg.CAPACITY_SHIFTS_MAX);
  });

  const n = active.length;
  const prices = active.map((p) => Number(decisions[p.id].price) || cfg.P_REF);
  const avgPrice = prices.reduce((a, b) => a + b, 0) / Math.max(n, 1);
  const catFactor = clamp_(Math.pow(avgPrice / cfg.P_REF, -cfg.CAT_ELASTICITY), cfg.CAT_MIN, cfg.CAT_MAX);
  const M = cfg.MARKET_SCALES_WITH_PLAYERS === false
    ? cfg.MARKET_SIZE_PER_PLAYER * catFactor
    : cfg.MARKET_SIZE_PER_PLAYER * n * catFactor;

  const attr = {}; let total = 0; const marketingEffect = {};
  active.forEach(function (p) {
    const u = p.id, d = decisions[u];
    const price = Number(d.price) || cfg.P_REF;
    const seoEff = p.seo_unlocked ? cfg.SEO_ALPHA * Math.pow(p.seo_level / cfg.SEO_REF, 0.5) : 0;
    const promoEff = Number(d.promo_spend || 0) > 0
      ? cfg.PROMO_ALPHA * Math.pow(Number(d.promo_spend) / cfg.PROMO_REF, 0.5) : 0;
    const socialEff = p.social_adstock > 0
      ? cfg.SOCIAL_ALPHA * Math.pow(p.social_adstock / cfg.SOCIAL_REF, 0.5) : 0;
    const outdoorEff = roundNumber <= p.outdoor_active_until ? p.outdoor_level : 0;

    const mktEffect = cfg.K_SEO * seoEff + cfg.K_PROMO * promoEff + cfg.K_MAPS * mapsEffThisRound[u]
      + cfg.K_SOCIAL * socialEff + cfg.K_OUTDOOR * outdoorEff;
    marketingEffect[u] = mktEffect;

    const v = 1 + cfg.K_BRAND * p.brand + cfg.K_QUALITY * p.quality + mktEffect;
    const pmax = cfg.P_REF * cfg.P_MAX_MULT;
    let pm = Math.pow(Math.max(price, cfg.P_FLOOR) / cfg.P_REF, -cfg.PRICE_ELASTICITY);
    if (price > pmax) pm *= Math.exp(-cfg.KAPPA * (price - pmax) / cfg.P_REF);
    const a = v * pm * p.reputation;
    attr[u] = a; total += a;
  });

  const results = [];
  const fairShare = M / Math.max(n, 1);

  active.forEach(function (p) {
    const u = p.id, d = decisions[u];
    const price = Number(d.price) || cfg.P_REF;
    const demand = total > 0 ? M * attr[u] / total : 0;
    const capacity = computeCapacity_(cfg, p.capacity_shifts);
    const served = Math.min(demand, capacity);
    const lost = Math.max(0, demand - capacity);

    const unitCost = cfg.P_REF * cfg.COGS_PCT * (1 + cfg.QUALITY_COGS_ADD * p.quality);
    const cogsTotal = unitCost * served;
    const affiliateBonus = p.affiliate_active ? cfg.AFFILIATE_BONUS_PCT : 0;
    const revenue = price * served * (1 + affiliateBonus);
    const grossProfit = revenue - cogsTotal;

    const shiftCost = Math.max(0, p.capacity_shifts) * cfg.CAPACITY_STEP_COST;
    const qualityUpkeep = cfg.QUALITY_UPKEEP * p.quality;
    const qualityInvestSpend = Number(d.quality_invest || 0);
    const marketingTotal = Number(d.seo_spend || 0) + Number(d.promo_spend || 0) + Number(d.maps_spend || 0)
      + Number(d.social_spend || 0) + Number(d.outdoor_spend || 0) + Number(d.affiliate_spend || 0);

    const ebit = grossProfit - cfg.RENT - cfg.PAYROLL_BASE - shiftCost - qualityUpkeep - qualityInvestSpend - marketingTotal;
    const interest = p.loan_balance * (cfg.LOAN_RATE_ANNUAL / 12);
    const profit = ebit - interest;
    const principalPaid = Math.min(p.loan_balance, p.loan_monthly_principal || 0);
    const cashFlow = profit - principalPaid;
    const cashAfter = p.cash + cashFlow;

    const missedThisRound = (cashAfter < 0 && p.loan_balance > 0);
    p.ever_missed_payment = p.ever_missed_payment || missedThisRound;
    p.cf_positive_streak = cashFlow > 0 ? (Number(p.cf_positive_streak) || 0) + 1 : 0;
    p.loan_balance = Math.max(0, p.loan_balance - principalPaid);
    p.loan_term_left = Math.max(0, (p.loan_term_left || 0) - 1);
    if (p.loan_balance <= 0) { p.loan_term_left = 0; p.loan_monthly_principal = 0; }

    const sat = (1 + 0.5 * p.quality + 0.15 * p.brand) / Math.max(price / cfg.P_REF, 0.2);
    const brandGain = cfg.BRAND_GAIN * (served / Math.max(fairShare, 1)) * Math.min(1, sat);
    p.brand = clamp_(p.brand * (1 - cfg.BRAND_DECAY) + brandGain, 0, 3);
    const refusal = demand > 0 ? lost / demand : 0;
    p.reputation = clamp_(p.reputation - 0.3 * refusal + 0.05, 0.6, 1.0);
    p.cash = cashAfter;
    if (p.cash < 0) p.status = 'bankrupt';

    results.push({
      player_id: p.id, round_number: roundNumber, price, demand, served, lost,
      revenue, cogs_total: cogsTotal, gross_profit: grossProfit,
      rent: cfg.RENT, payroll: cfg.PAYROLL_BASE, shift_cost: shiftCost,
      quality_upkeep: qualityUpkeep, quality_invest: qualityInvestSpend,
      marketing_total: marketingTotal, marketing_effect: round2_(marketingEffect[u] || 0),
      ebit, interest, profit, principal_paid: principalPaid,
      cash_flow: cashFlow, cash_after: p.cash,
      brand_after: p.brand, reputation_after: p.reputation, quality: p.quality, capacity,
      market_share: M > 0 ? served / M : 0, market_total: Math.round(M),
      seo_spend: Number(d.seo_spend || 0), promo_spend: Number(d.promo_spend || 0),
      maps_spend: Number(d.maps_spend || 0), social_spend: Number(d.social_spend || 0),
      outdoor_spend: Number(d.outdoor_spend || 0), affiliate_spend: Number(d.affiliate_spend || 0)
    });
  });

  return { marketTotal: M, playerCount: n, players: active, results };
}

// --------------------------------------------------------------- генератор
let seed = 20260828;
function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

function makePlayer(i) {
  return {
    id: 'p' + i, username: 'igrok' + i,
    cash: Math.round(rnd() * 900000) - 50000,
    brand: rnd() * 2.5,
    reputation: 0.6 + rnd() * 0.4,
    quality: rnd() * 3,
    capacity_shifts: Math.floor(rnd() * 9) - 3,
    seo_level: rnd() * 200000, seo_streak: Math.floor(rnd() * 5), seo_unlocked: rnd() > 0.5,
    maps_level: rnd() * 150000,
    social_adstock: rnd() * 250000,
    outdoor_level: rnd() * 0.8, outdoor_active_until: Math.floor(rnd() * 12),
    affiliate_active: rnd() > 0.5,
    loan_tier: Math.floor(rnd() * 4),
    loan_balance: Math.round(rnd() * 800000),
    loan_term_left: Math.floor(rnd() * 7),
    loan_monthly_principal: Math.round(rnd() * 120000),
    cf_positive_streak: Math.floor(rnd() * 4),
    ever_missed_payment: rnd() > 0.7,
    status: 'active'
  };
}

function makeDecision() {
  return {
    price: pick([100, 180, 250, 300, 380, 540, 620, 900]),
    seo_spend: pick([0, 0, 30000, 60000, 150000]),
    promo_spend: pick([0, 25000, 50000, 120000]),
    maps_spend: pick([0, 0, 40000, 90000]),
    social_spend: pick([0, 50000, 100000, 300000]),
    outdoor_spend: pick([0, 0, 39999, 40000, 80000]),
    affiliate_spend: pick([0, 19999, 20000, 60000]),
    shifts_delta: Math.floor(rnd() * 5) - 2,
    quality_invest: pick([0, 0, 200000, 400000, 900000])
  };
}

// --------------------------------------------------------------- сверка
function compare(a, b, path, diffs) {
  if (typeof a === 'number' && typeof b === 'number') {
    if (Number.isNaN(a) && Number.isNaN(b)) return;
    // Допуск на порядок операций с плавающей точкой, не на разницу в формуле.
    const tol = Math.max(1e-9, Math.abs(a) * 1e-12);
    if (Math.abs(a - b) > tol) diffs.push(`${path}: эталон ${a} ≠ порт ${b}`);
    return;
  }
  if (a !== b) diffs.push(`${path}: эталон ${a} ≠ порт ${b}`);
}

let cases = 0, allDiffs = [];
for (let iter = 0; iter < 400; iter++) {
  const n = 1 + Math.floor(rnd() * 6);
  const players = [];
  for (let i = 0; i < n; i++) players.push(makePlayer(i));
  const decisions = {};
  for (const p of players) if (rnd() > 0.15) decisions[p.id] = makeDecision();
  const roundNumber = 1 + Math.floor(rnd() * 12);

  const ref = referenceCalculate(roundNumber, CFG, players, decisions);
  const got = calculateRound({ roundNumber, cfg: CFG, players, decisions });

  const diffs = [];
  compare(ref.marketTotal, got.marketTotal, `iter${iter}.marketTotal`, diffs);
  compare(ref.playerCount, got.playerCount, `iter${iter}.playerCount`, diffs);

  for (let i = 0; i < ref.results.length; i++) {
    const r1 = ref.results[i], r2 = got.results[i];
    for (const k of Object.keys(r1)) compare(r1[k], r2[k], `iter${iter}.results[${i}].${k}`, diffs);
    cases++;
  }
  for (let i = 0; i < ref.players.length; i++) {
    const p1 = ref.players[i], p2 = got.players[i];
    for (const k of Object.keys(p1)) compare(p1[k], p2[k], `iter${iter}.players[${i}].${k}`, diffs);
  }
  allDiffs = allDiffs.concat(diffs);
}

console.log(`Сценариев: 400, строк результатов сверено: ${cases}`);
if (allDiffs.length === 0) {
  console.log('РАСХОЖДЕНИЙ НЕТ — порт считает идентично Apps Script.');
} else {
  console.log(`РАСХОЖДЕНИЙ: ${allDiffs.length}`);
  allDiffs.slice(0, 25).forEach((d) => console.log('  ' + d));
  process.exit(1);
}
