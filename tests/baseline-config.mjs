// Обкатанный баланс v4.9 в батах — тот же пресет, что «v3.3 baseline»
// в sql/01_schema.sql. Точка отсчёта для проверок пересчёта в доллары.

export const BASELINE_THB = {
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
  AD_DECAY: 0.55, BRAND_DECAY: 0.25, BRAND_GAIN: 0.25,
  QUALITY_DECAY: 0.05, QUALITY_UPKEEP: 15000, QUALITY_INVEST_DIVISOR: 400000,
  LOAN_TIER1_LIMIT: 300000, LOAN_TIER2_LIMIT: 800000, LOAN_TIER3_LIMIT: 2000000,
  LOAN_RATE_ANNUAL: 0.15, LOAN_TERM_MONTHS: 6,
  ROUND_DURATION_MIN: 5
};

// Параметры, которые измеряются в деньгах. Всё остальное — доли,
// коэффициенты, число гостей и месяцев — от валюты не зависит.
export const MONEY_KEYS = [
  'P_REF', 'P_FLOOR', 'CAPACITY_STEP_COST', 'RENT', 'PAYROLL_BASE', 'START_CAPITAL',
  'CIVIL_SERVICE_SALARY', 'REOPEN_THRESHOLD', 'SEO_REF', 'PROMO_REF', 'MAPS_REF',
  'SOCIAL_REF', 'OUTDOOR_REF', 'OUTDOOR_MIN_SPEND', 'AFFILIATE_MIN_SPEND',
  'QUALITY_UPKEEP', 'QUALITY_INVEST_DIVISOR',
  'LOAN_TIER1_LIMIT', 'LOAN_TIER2_LIMIT', 'LOAN_TIER3_LIMIT'
];

// Денежные поля решения игрока.
export const DECISION_MONEY_KEYS = [
  'price', 'seo_spend', 'promo_spend', 'maps_spend', 'social_spend',
  'outdoor_spend', 'affiliate_spend', 'quality_invest'
];

/** Тот же баланс в другой валюте: все денежные параметры × k. */
export function scaleConfig(cfg, k) {
  const out = { ...cfg };
  for (const key of MONEY_KEYS) out[key] = cfg[key] * k;
  return out;
}

/** Игрок на старте партии — в том виде, который ждёт движок. */
export function freshPlayer(i, cfg, cash = cfg.START_CAPITAL) {
  return {
    id: 'p' + i, username: 'p' + i, cash,
    brand: 0, reputation: 1, quality: 0, capacity_shifts: 0,
    seo_level: 0, seo_streak: 0, seo_unlocked: false, maps_level: 0,
    social_adstock: 0, outdoor_level: 0, outdoor_active_until: 0,
    affiliate_active: false, loan_tier: 0, loan_balance: 0, loan_term_left: 0,
    loan_monthly_principal: 0, cf_positive_streak: 0, ever_missed_payment: false,
    status: 'active'
  };
}
