// ============================================================================
//  Экономическое ядро игры. Порт calculateRound_ из Code.gs (v3.3) на TypeScript.
//
//  Модуль СПЕЦИАЛЬНО сделан чистым: никакого обращения к базе, к сети и к
//  времени. На вход — состояние игроков и их решения, на выход — новое
//  состояние и строки результатов. Ровно это позволяет прогонять его
//  золотыми тестами и сверять копейка в копейку со старой версией на
//  Google Sheets, а не выяснять расхождения балансa посреди живой сессии.
//
//  Запись в базу происходит снаружи, одной транзакцией.
//
//  v5.0 добавляет четыре параметра: страховку, коммунальные платежи, налог
//  на прибыль и рост рынка от качества. Все четыре по умолчанию равны нулю,
//  и тогда движок считает бит в бит как v4.9 — это проверяет tests/golden.mjs.
// ============================================================================

export interface Config {
  P_REF: number; P_FLOOR: number; PRICE_ELASTICITY: number; P_MAX_MULT: number; KAPPA: number;
  COGS_PCT: number; QUALITY_COGS_ADD: number;
  MARKET_SIZE_PER_PLAYER: number; MARKET_SCALES_WITH_PLAYERS: boolean;
  CAT_ELASTICITY: number; CAT_MIN: number; CAT_MAX: number;
  CAPACITY_BASE: number; CAPACITY_STEP: number; CAPACITY_MIN: number;
  CAPACITY_STEP_COST: number; CAPACITY_SHIFTS_MIN: number; CAPACITY_SHIFTS_MAX: number;
  RENT: number; PAYROLL_BASE: number; START_CAPITAL: number;
  CIVIL_SERVICE_SALARY: number; REOPEN_THRESHOLD: number; TOTAL_ROUNDS: number;
  K_BRAND: number; K_QUALITY: number;
  K_SEO: number; SEO_ALPHA: number; SEO_REF: number; SEO_RAMP_MONTHS: number; SEO_DECAY: number;
  K_PROMO: number; PROMO_ALPHA: number; PROMO_REF: number;
  K_MAPS: number; MAPS_ALPHA: number; MAPS_REF: number; MAPS_DECAY: number;
  K_SOCIAL: number; SOCIAL_ALPHA: number; SOCIAL_REF: number; SOCIAL_DECAY: number;
  K_OUTDOOR: number; OUTDOOR_ALPHA: number; OUTDOOR_REF: number;
  OUTDOOR_MIN_SPEND: number; OUTDOOR_DURATION_MONTHS: number;
  AFFILIATE_MIN_SPEND: number; AFFILIATE_BONUS_PCT: number;
  BRAND_DECAY: number; BRAND_GAIN: number;
  QUALITY_DECAY: number; QUALITY_UPKEEP: number; QUALITY_INVEST_DIVISOR: number;
  LOAN_TIER1_LIMIT: number; LOAN_TIER2_LIMIT: number; LOAN_TIER3_LIMIT: number;
  LOAN_RATE_ANNUAL: number; LOAN_TERM_MONTHS: number;
  ROUND_DURATION_MIN: number;

  // v5.0. Постоянные платежи ресторана страховой и коммунальщикам — рядом
  // с арендой, которая уходит арендодателю.
  INSURANCE?: number;
  UTILITIES?: number;
  // Налог на прибыль, доля: 0.21 = 21%. Платится с прибыли после покрытия
  // прошлых убытков.
  PROFIT_TAX_RATE?: number;
  // Прирост рынка на каждую единицу СРЕДНЕГО качества всех ресторанов:
  // 0.15 = +15% гостей. Вкладывается один — выигрывают все.
  MARKET_QUALITY_GAIN?: number;
}

export interface PlayerState {
  id: string;
  username: string;
  cash: number;
  brand: number;
  reputation: number;
  quality: number;
  capacity_shifts: number;
  seo_level: number; seo_streak: number; seo_unlocked: boolean;
  maps_level: number;
  social_adstock: number;
  outdoor_level: number; outdoor_active_until: number;
  affiliate_active: boolean;
  loan_tier: number; loan_balance: number; loan_term_left: number; loan_monthly_principal: number;
  cf_positive_streak: number; ever_missed_payment: boolean;
  status: string;
  // v5.0. Непокрытые убытки прошлых месяцев: пока они есть, налог на
  // прибыль не берётся.
  tax_loss_cf?: number;
}

export interface Decision {
  price: number;
  seo_spend: number; promo_spend: number; maps_spend: number;
  social_spend: number; outdoor_spend: number; affiliate_spend: number;
  shifts_delta: number; quality_invest: number;
}

export interface RoundResult {
  player_id: string; round_number: number;
  price: number; demand: number; served: number; lost: number;
  revenue: number; cogs_total: number; gross_profit: number;
  rent: number; payroll: number; shift_cost: number;
  quality_upkeep: number; quality_invest: number;
  marketing_total: number; marketing_effect: number;
  ebit: number; interest: number; profit: number; principal_paid: number;
  cash_flow: number; cash_after: number;
  brand_after: number; reputation_after: number; quality: number; capacity: number;
  market_share: number; market_total: number;
  seo_spend: number; promo_spend: number; maps_spend: number;
  social_spend: number; outdoor_spend: number; affiliate_spend: number;
  // v5.0
  insurance: number; utilities: number;
  profit_before_tax: number; tax: number;
}

// ------------------------------------------------------------------ утилиты

export const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, v));

export const round2 = (v: number): number => Math.round(v * 100) / 100;

export function computeCapacity(cfg: Config, shifts: number): number {
  return Math.max(
    cfg.CAPACITY_MIN,
    cfg.CAPACITY_BASE + (Number(shifts) || 0) * cfg.CAPACITY_STEP
  );
}

export function defaultDecision(cfg: Config): Decision {
  return {
    price: cfg.P_REF, seo_spend: 0, promo_spend: 0, maps_spend: 0,
    social_spend: 0, outdoor_spend: 0, affiliate_spend: 0,
    shifts_delta: 0, quality_invest: 0
  };
}

const SPEND_KEYS: (keyof Decision)[] = [
  'seo_spend', 'promo_spend', 'maps_spend', 'social_spend',
  'outdoor_spend', 'affiliate_spend', 'quality_invest'
];

/**
 * Ужимает решение под реально доступную кассу. Только для автохода:
 * решение, поданное игроком вручную, проверяется при отправке.
 *
 * Нужна из-за реального бага, найденного в v3.2: после открытия нового
 * дела игрок стартует с небольшой суммой, а автоход тянул ему решение
 * ДО банкротства, со старыми рекламными бюджетами. Новое дело улетало
 * в минус в первый же месяц, при том что игрок вообще ничего не нажимал.
 */
export function clampDecisionToCash(d: Partial<Decision>, cash: number, cfg: Config): Decision {
  const out = {
    price: Number(d.price) || cfg.P_REF,
    shifts_delta: Number(d.shifts_delta) || 0
  } as Decision;

  let total = 0;
  for (const k of SPEND_KEYS) {
    const v = Math.max(0, Number(d[k]) || 0);
    (out as unknown as Record<string, number>)[k] = v;
    total += v;
  }

  const available = Math.max(0, Number(cash) || 0);
  if (total > available) {
    const factor = total > 0 ? available / total : 0;
    for (const k of SPEND_KEYS) {
      (out as unknown as Record<string, number>)[k] = Math.floor((out as unknown as Record<string, number>)[k] * factor);
    }
  }
  return out;
}

// --------------------------------------------------------------- расчёт месяца

export interface CalcInput {
  roundNumber: number;
  cfg: Config;
  players: PlayerState[];              // ТОЛЬКО активные
  decisions: Record<string, Decision>; // ключ — player.id
}

export interface CalcOutput {
  marketTotal: number;
  playerCount: number;
  players: PlayerState[];              // новое состояние
  results: RoundResult[];
}

export function calculateRound(input: CalcInput): CalcOutput {
  const { roundNumber, cfg } = input;

  // Работаем с копиями: входное состояние не мутируем, чтобы вызывающий код
  // мог спокойно сравнить "до" и "после" и записать разницу в журнал.
  const players: PlayerState[] = input.players.map((p) => ({ ...p }));
  const decisions: Record<string, Decision> = {};

  // ---- Фаза 1: автоход и обновление состояния каналов, качества, формата.
  //
  // effMaps считается ДО обновления maps_level: эффект Google Карт в этом
  // месяце опирается на уровень, накопленный к НАЧАЛУ месяца. Это и есть
  // тот самый лаг в один месяц, из-за которого Карты "включаются" не сразу.
  const mapsEffThisRound: Record<string, number> = {};

  for (const p of players) {
    const given = input.decisions[p.id];
    const d: Decision = given
      ? { ...defaultDecision(cfg), ...given }
      : clampDecisionToCash(defaultDecision(cfg), p.cash, cfg);
    decisions[p.id] = d;

    mapsEffThisRound[p.id] = p.maps_level > 0
      ? cfg.MAPS_ALPHA * Math.pow(p.maps_level / cfg.MAPS_REF, 0.5)
      : 0;
    p.maps_level = p.maps_level * (1 - cfg.MAPS_DECAY) + (Number(d.maps_spend) || 0);

    // SEO: нужно несколько месяцев ПОДРЯД, зато потом эффект держится
    // почти без подпитки — в отличие от промоутеров.
    if (!p.seo_unlocked) {
      if ((Number(d.seo_spend) || 0) > 0) p.seo_streak = (Number(p.seo_streak) || 0) + 1;
      else p.seo_streak = 0;
      if (p.seo_streak >= cfg.SEO_RAMP_MONTHS) p.seo_unlocked = true;
    }
    p.seo_level = p.seo_level * (1 - cfg.SEO_DECAY) + (Number(d.seo_spend) || 0);

    p.social_adstock = p.social_adstock * (1 - cfg.SOCIAL_DECAY) + (Number(d.social_spend) || 0);

    // Наружная реклама — фиксированный срок, потом резкое обнуление,
    // без плавного затухания.
    if ((Number(d.outdoor_spend) || 0) >= cfg.OUTDOOR_MIN_SPEND) {
      p.outdoor_level = cfg.OUTDOOR_ALPHA * Math.pow(Number(d.outdoor_spend) / cfg.OUTDOOR_REF, 0.5);
      p.outdoor_active_until = roundNumber + cfg.OUTDOOR_DURATION_MONTHS - 1;
    }

    p.affiliate_active = (Number(d.affiliate_spend) || 0) >= cfg.AFFILIATE_MIN_SPEND;

    p.quality = clamp(
      p.quality * (1 - cfg.QUALITY_DECAY) + (Number(d.quality_invest) || 0) / cfg.QUALITY_INVEST_DIVISOR,
      0, 3
    );
    p.capacity_shifts = clamp(
      (p.capacity_shifts || 0) + (Number(d.shifts_delta) || 0),
      cfg.CAPACITY_SHIFTS_MIN, cfg.CAPACITY_SHIFTS_MAX
    );
  }

  // ---- Фаза 2: распределение спроса (единый сегмент рынка).
  const n = players.length;
  const prices = players.map((p) => Number(decisions[p.id].price) || cfg.P_REF);
  const avgPrice = prices.reduce((a, b) => a + b, 0) / Math.max(n, 1);
  const catFactor = clamp(Math.pow(avgPrice / cfg.P_REF, -cfg.CAT_ELASTICITY), cfg.CAT_MIN, cfg.CAT_MAX);

  // v5.0. Рынок растёт от среднего качества: гости идут туда, где в целом
  // хорошо кормят. Качество уже учитывает вложения этого месяца (фаза 1),
  // как и в привлекательности ниже.
  const avgQuality = players.reduce((a, p) => a + (Number(p.quality) || 0), 0) / Math.max(n, 1);
  const qualityFactor = 1 + (cfg.MARKET_QUALITY_GAIN ?? 0) * avgQuality;

  const M = (cfg.MARKET_SCALES_WITH_PLAYERS === false
    ? cfg.MARKET_SIZE_PER_PLAYER * catFactor
    : cfg.MARKET_SIZE_PER_PLAYER * n * catFactor) * qualityFactor;

  const attr: Record<string, number> = {};
  const marketingEffect: Record<string, number> = {};
  let total = 0;

  for (const p of players) {
    const d = decisions[p.id];
    const price = Number(d.price) || cfg.P_REF;

    const seoEff = p.seo_unlocked ? cfg.SEO_ALPHA * Math.pow(p.seo_level / cfg.SEO_REF, 0.5) : 0;
    const promoEff = (Number(d.promo_spend) || 0) > 0
      ? cfg.PROMO_ALPHA * Math.pow(Number(d.promo_spend) / cfg.PROMO_REF, 0.5) : 0;
    const socialEff = p.social_adstock > 0
      ? cfg.SOCIAL_ALPHA * Math.pow(p.social_adstock / cfg.SOCIAL_REF, 0.5) : 0;
    const outdoorEff = roundNumber <= p.outdoor_active_until ? p.outdoor_level : 0;

    // Вклад именно рекламы держим отдельно от бренда и качества — чтобы на
    // табло можно было честно показать "рекламный эффект", не смешивая его
    // с тем, что игрок заработал репутацией.
    const mktEffect = cfg.K_SEO * seoEff + cfg.K_PROMO * promoEff + cfg.K_MAPS * mapsEffThisRound[p.id]
      + cfg.K_SOCIAL * socialEff + cfg.K_OUTDOOR * outdoorEff;
    marketingEffect[p.id] = mktEffect;

    const v = 1 + cfg.K_BRAND * p.brand + cfg.K_QUALITY * p.quality + mktEffect;

    const pmax = cfg.P_REF * cfg.P_MAX_MULT;
    let pm = Math.pow(Math.max(price, cfg.P_FLOOR) / cfg.P_REF, -cfg.PRICE_ELASTICITY);
    if (price > pmax) pm *= Math.exp(-cfg.KAPPA * (price - pmax) / cfg.P_REF);

    const a = v * pm * p.reputation;
    attr[p.id] = a;
    total += a;
  }

  // ---- Фаза 3: П&У, денежный поток, кредит, бренд и репутация.
  const results: RoundResult[] = [];
  const fairShare = M / Math.max(n, 1);

  for (const p of players) {
    const d = decisions[p.id];
    const price = Number(d.price) || cfg.P_REF;

    const demand = total > 0 ? (M * attr[p.id]) / total : 0;
    const capacity = computeCapacity(cfg, p.capacity_shifts);
    const served = Math.min(demand, capacity);
    const lost = Math.max(0, demand - capacity);

    const unitCost = cfg.P_REF * cfg.COGS_PCT * (1 + cfg.QUALITY_COGS_ADD * p.quality);
    const cogsTotal = unitCost * served;
    const affiliateBonus = p.affiliate_active ? cfg.AFFILIATE_BONUS_PCT : 0;
    const revenue = price * served * (1 + affiliateBonus);
    const grossProfit = revenue - cogsTotal;

    const shiftCost = Math.max(0, p.capacity_shifts) * cfg.CAPACITY_STEP_COST;
    const qualityUpkeep = cfg.QUALITY_UPKEEP * p.quality;
    const qualityInvestSpend = Number(d.quality_invest) || 0;
    const marketingTotal = (Number(d.seo_spend) || 0) + (Number(d.promo_spend) || 0)
      + (Number(d.maps_spend) || 0) + (Number(d.social_spend) || 0)
      + (Number(d.outdoor_spend) || 0) + (Number(d.affiliate_spend) || 0);

    const insurance = cfg.INSURANCE ?? 0;
    const utilities = cfg.UTILITIES ?? 0;

    const ebit = grossProfit - cfg.RENT - insurance - utilities - cfg.PAYROLL_BASE - shiftCost
      - qualityUpkeep - qualityInvestSpend - marketingTotal;

    const interest = p.loan_balance * (cfg.LOAN_RATE_ANNUAL / 12);
    const profitBeforeTax = ebit - interest;

    // v5.0. Налог на прибыль с переносом убытков, как в жизни: сначала
    // прибыль гасит непокрытые убытки прошлых месяцев, налог — только с
    // остатка. Убытки копятся всегда, даже при нулевой ставке: ведущий может
    // ввести налог посреди игры, и тогда прошлые потери уже учтены.
    let tax = 0;
    let lossCf = Number(p.tax_loss_cf) || 0;
    if (profitBeforeTax > 0) {
      const offset = Math.min(lossCf, profitBeforeTax);
      lossCf -= offset;
      tax = (profitBeforeTax - offset) * (cfg.PROFIT_TAX_RATE ?? 0);
    } else {
      lossCf += -profitBeforeTax;
    }
    p.tax_loss_cf = lossCf;

    const profit = profitBeforeTax - tax;
    const principalPaid = Math.min(p.loan_balance, p.loan_monthly_principal || 0);
    const cashFlow = profit - principalPaid;
    const cashAfter = p.cash + cashFlow;

    const missedThisRound = cashAfter < 0 && p.loan_balance > 0;
    p.ever_missed_payment = p.ever_missed_payment || missedThisRound;
    p.cf_positive_streak = cashFlow > 0 ? (Number(p.cf_positive_streak) || 0) + 1 : 0;

    p.loan_balance = Math.max(0, p.loan_balance - principalPaid);
    p.loan_term_left = Math.max(0, (p.loan_term_left || 0) - 1);
    if (p.loan_balance <= 0) { p.loan_term_left = 0; p.loan_monthly_principal = 0; }

    const sat = (1 + 0.5 * p.quality + 0.15 * p.brand) / Math.max(price / cfg.P_REF, 0.2);
    const brandGain = cfg.BRAND_GAIN * (served / Math.max(fairShare, 1)) * Math.min(1, sat);
    p.brand = clamp(p.brand * (1 - cfg.BRAND_DECAY) + brandGain, 0, 3);

    const refusal = demand > 0 ? lost / demand : 0;
    p.reputation = clamp(p.reputation - 0.3 * refusal + 0.05, 0.6, 1.0);

    p.cash = cashAfter;
    if (p.cash < 0) p.status = 'bankrupt';

    results.push({
      player_id: p.id, round_number: roundNumber, price,
      demand, served, lost,
      revenue, cogs_total: cogsTotal, gross_profit: grossProfit,
      rent: cfg.RENT, payroll: cfg.PAYROLL_BASE, shift_cost: shiftCost,
      quality_upkeep: qualityUpkeep, quality_invest: qualityInvestSpend,
      marketing_total: marketingTotal, marketing_effect: round2(marketingEffect[p.id] || 0),
      ebit, interest, profit, principal_paid: principalPaid,
      cash_flow: cashFlow, cash_after: p.cash,
      brand_after: p.brand, reputation_after: p.reputation,
      quality: p.quality, capacity,
      market_share: M > 0 ? served / M : 0, market_total: Math.round(M),
      seo_spend: Number(d.seo_spend) || 0, promo_spend: Number(d.promo_spend) || 0,
      maps_spend: Number(d.maps_spend) || 0, social_spend: Number(d.social_spend) || 0,
      outdoor_spend: Number(d.outdoor_spend) || 0, affiliate_spend: Number(d.affiliate_spend) || 0,
      insurance, utilities, profit_before_tax: profitBeforeTax, tax
    });
  }

  return { marketTotal: M, playerCount: n, players, results };
}

// --------------------------------------------------------------- банк

/**
 * Уровень кредитного лимита. Открывается автоматически, игроку не нужно
 * ничего считать — он просто видит новый доступный лимит.
 */
export function computeLoanTier(p: PlayerState, cfg: Config, roundNumber: number): number {
  if (roundNumber < 1) return 0;
  if (p.cf_positive_streak >= 2 && !p.ever_missed_payment) return 3;
  if (p.cf_positive_streak >= 2) return 2;
  return 1;
}

export function loanLimitFor(tier: number, cfg: Config): number {
  if (tier >= 3) return cfg.LOAN_TIER3_LIMIT;
  if (tier === 2) return cfg.LOAN_TIER2_LIMIT;
  if (tier === 1) return cfg.LOAN_TIER1_LIMIT;
  return 0;
}
