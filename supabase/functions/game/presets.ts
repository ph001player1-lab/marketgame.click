// ============================================================================
//  Настройки новой игры по умолчанию — v5.0, доллары.
//
//  Это баланс v4.9, все денежные параметры которого поделены на 10: чек
//  300 ฿ стал $30. tests/scale_check.mjs доказывает, что игра при этом
//  считается ровно так же. Сверху — изменения v5.0:
//
//    аренда 150 000 ฿ → аренда $7,500 + страховка $1,200 + коммунальные и
//      прочее $6,300. Сумма та же ($15,000), баланс не меняется, а отчёт
//      о прибылях и убытках выглядит как у настоящего ресторана в США;
//    кредит 15% → 12% годовых, ближе к кредитам SBA;
//    налог на прибыль 21% (федеральная ставка США);
//    рынок растёт на 15% за каждую единицу среднего качества.
//
//  tests/v5_check.mjs проверяет, что разбивка аренды баланс не трогает.
// ============================================================================

import type { Config } from './economy.ts';

export type League = 'start' | 'growth' | 'elite';

/** Лиги — это форматы marketgame.biz. Длина лиги задаёт длину игры. */
export const LEAGUES: Record<League, { months: number; name: string }> = {
  start: { months: 12, name: 'Start' },
  growth: { months: 24, name: 'Growth' },
  elite: { months: 36, name: 'Elite' }
};

/** Языки сайта. Язык игры выбирает ведущий; каждый может сменить свой. */
export const LANGUAGES = ['en', 'es', 'pt', 'ru'] as const;
export type Language = typeof LANGUAGES[number];
export function isLanguage(v: unknown): v is Language {
  return (LANGUAGES as readonly unknown[]).includes(v);
}

export function isLeague(v: unknown): v is League {
  return v === 'start' || v === 'growth' || v === 'elite';
}

export const US_V5: Config = {
  P_REF: 30, P_FLOOR: 10, PRICE_ELASTICITY: 2.2, P_MAX_MULT: 1.8, KAPPA: 4,
  COGS_PCT: 0.40, QUALITY_COGS_ADD: 0.15,
  MARKET_SIZE_PER_PLAYER: 10000, MARKET_SCALES_WITH_PLAYERS: false,
  CAT_ELASTICITY: 0.4, CAT_MIN: 0.8, CAT_MAX: 1.3,
  CAPACITY_BASE: 3000, CAPACITY_STEP: 1000, CAPACITY_MIN: 100,
  CAPACITY_STEP_COST: 6000, CAPACITY_SHIFTS_MIN: -3, CAPACITY_SHIFTS_MAX: 5,
  RENT: 7500, INSURANCE: 1200, UTILITIES: 6300,
  PAYROLL_BASE: 22000, START_CAPITAL: 10000,
  CIVIL_SERVICE_SALARY: 3500, REOPEN_THRESHOLD: 10000, TOTAL_ROUNDS: 12,
  K_BRAND: 0.5, K_QUALITY: 0.5,
  K_SEO: 0.5, SEO_ALPHA: 0.9, SEO_REF: 6000, SEO_RAMP_MONTHS: 3, SEO_DECAY: 0.08,
  K_PROMO: 0.5, PROMO_ALPHA: 0.9, PROMO_REF: 5000,
  K_MAPS: 0.45, MAPS_ALPHA: 0.7, MAPS_REF: 4000, MAPS_DECAY: 0.15,
  K_SOCIAL: 0.6, SOCIAL_ALPHA: 0.8, SOCIAL_REF: 10000, SOCIAL_DECAY: 0.55,
  K_OUTDOOR: 0.4, OUTDOOR_ALPHA: 0.6, OUTDOOR_REF: 8000,
  OUTDOOR_MIN_SPEND: 4000, OUTDOOR_DURATION_MONTHS: 4,
  AFFILIATE_MIN_SPEND: 2000, AFFILIATE_BONUS_PCT: 0.125,
  BRAND_DECAY: 0.25, BRAND_GAIN: 0.25,
  QUALITY_DECAY: 0.05, QUALITY_UPKEEP: 1500, QUALITY_INVEST_DIVISOR: 40000,
  LOAN_TIER1_LIMIT: 30000, LOAN_TIER2_LIMIT: 80000, LOAN_TIER3_LIMIT: 200000,
  LOAN_RATE_ANNUAL: 0.12, LOAN_TERM_MONTHS: 6,
  ROUND_DURATION_MIN: 5,
  PROFIT_TAX_RATE: 0.21,
  MARKET_QUALITY_GAIN: 0.15
};

/** Настройки новой игры: пресет, длина — по лиге. */
export function configForLeague(league: League): Config {
  return { ...US_V5, TOTAL_ROUNDS: LEAGUES[league].months };
}

/** Доля города в каждом из четырёх участников экономики при создании игры, %. */
export const DEFAULT_CITY_SHARE_PCT = 50;

/**
 * Что ведущий может менять на ходу. Белый список с диапазонами: опечатка
 * в коэффициенте посреди партии обрушила бы экономику так, что игроки
 * этого даже не поняли бы. Длину игры задаёт лига, здесь её нет.
 */
export const EDITABLE_CONFIG: Record<string, { min: number; max: number; int?: boolean }> = {
  ROUND_DURATION_MIN: { min: 1, max: 120, int: true },
  RENT: { min: 0, max: 1_000_000 },
  INSURANCE: { min: 0, max: 1_000_000 },
  UTILITIES: { min: 0, max: 1_000_000 },
  PAYROLL_BASE: { min: 0, max: 1_000_000 },
  START_CAPITAL: { min: 0, max: 10_000_000 },
  CIVIL_SERVICE_SALARY: { min: 0, max: 100_000 },
  REOPEN_THRESHOLD: { min: 0, max: 10_000_000 },
  P_REF: { min: 1, max: 10_000 },
  MARKET_SIZE_PER_PLAYER: { min: 100, max: 1_000_000, int: true },
  MARKET_QUALITY_GAIN: { min: 0, max: 1 },
  // Ставки задаются долей, а не процентами: 0.12 = 12%.
  LOAN_RATE_ANNUAL: { min: 0, max: 1 },
  LOAN_TERM_MONTHS: { min: 1, max: 36, int: true },
  PROFIT_TAX_RATE: { min: 0, max: 0.9 }
};
