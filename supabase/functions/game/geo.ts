// ============================================================================
//  Где идёт игра: части света, страны, штаты США, регионы России.
//
//  Место задаёт ведущий. Для игры в одном месте — часть света, страна и,
//  если хочет, штат США, регион России или город: команды тогда вводят
//  только имя и название ресторана. Для онлайн-игры (команды из разных стран
//  и регионов) страну и штат, регион или город указывает каждая команда.
//
//  Здесь — только коды: сервер их проверяет. Названия на всех языках и
//  часовые пояса — в web/assets/js/geo.js; tests/geo_check.mjs следит, чтобы
//  списки совпадали.
// ============================================================================

import { fail, type Row } from './lib.ts';

export const ONLINE = 'online';

/** Части света и их страны — коды ISO 3166-1. */
export const REGIONS: Record<string, string[]> = {
  north_america: ['US', 'CA'],
  latin_america: [
    'MX', 'GT', 'BZ', 'SV', 'HN', 'NI', 'CR', 'PA', 'CU', 'DO', 'HT', 'JM', 'TT', 'BS', 'BB', 'AG', 'DM',
    'GD', 'KN', 'LC', 'VC', 'PR', 'CO', 'VE', 'EC', 'PE', 'BO', 'CL', 'AR', 'UY', 'PY', 'BR', 'GY', 'SR'
  ],
  europe: [
    'AL', 'AD', 'AT', 'BE', 'BA', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IS',
    'IE', 'IT', 'LV', 'LI', 'LT', 'LU', 'MT', 'MD', 'MC', 'ME', 'NL', 'MK', 'NO', 'PL', 'PT', 'RO', 'SM',
    'RS', 'SK', 'SI', 'ES', 'SE', 'CH', 'UA', 'GB', 'VA', 'GE', 'TR'
  ],
  cis: ['RU', 'BY', 'KZ', 'KG', 'UZ', 'TJ', 'TM', 'AM', 'AZ'],
  middle_east_africa: [
    'AE', 'SA', 'QA', 'KW', 'BH', 'OM', 'YE', 'IL', 'PS', 'JO', 'LB', 'SY', 'IQ', 'IR',
    'EG', 'LY', 'TN', 'DZ', 'MA', 'MR', 'ML', 'NE', 'TD', 'SD', 'SS', 'ER', 'DJ', 'ET', 'SO', 'KE', 'UG',
    'RW', 'BI', 'TZ', 'MZ', 'MW', 'ZM', 'ZW', 'BW', 'NA', 'ZA', 'LS', 'SZ', 'AO', 'CD', 'CG', 'GA', 'GQ',
    'CM', 'CF', 'NG', 'BJ', 'TG', 'GH', 'CI', 'LR', 'SL', 'GN', 'GW', 'SN', 'GM', 'CV', 'BF', 'ST', 'MG',
    'MU', 'SC', 'KM'
  ],
  asia: [
    'AF', 'PK', 'IN', 'BD', 'LK', 'NP', 'BT', 'MV', 'CN', 'HK', 'MO', 'TW', 'MN', 'KP', 'KR', 'JP', 'MM',
    'TH', 'LA', 'KH', 'VN', 'MY', 'SG', 'BN', 'ID', 'PH', 'TL'
  ],
  oceania: ['AU', 'NZ', 'PG', 'FJ', 'SB', 'VU', 'WS', 'TO', 'KI', 'FM', 'MH', 'PW', 'NR', 'TV']
};

const ALL_COUNTRIES = new Set(Object.values(REGIONS).flat());

// 50 штатов и округ Колумбия.
export const US_STATES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA',
  'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM',
  'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA',
  'WV', 'WI', 'WY'
]);

// Регионы России — как на marketgame.quest (коды ISO 3166-2:RU без «RU-»).
export const RU_REGIONS = new Set([
  'ALT', 'AMU', 'ARK', 'AST', 'BEL', 'BRY', 'VLA', 'VGG', 'VLG', 'VOR', 'YEV', 'ZAB', 'IVA', 'IRK',
  'KB', 'KGD', 'KLU', 'KAM', 'KC', 'KEM', 'KIR', 'KOS', 'KDA', 'KYA', 'KGN', 'KRS', 'LEN', 'LIP',
  'MAG', 'MOW', 'MOS', 'MUR', 'NEN', 'NIZ', 'NGR', 'NVS', 'OMS', 'ORE', 'ORL', 'PNZ', 'PER', 'PRI',
  'PSK', 'AD', 'AL', 'BA', 'BU', 'DA', 'IN', 'KL', 'KR', 'KO', 'ME', 'MO', 'SA', 'SE', 'TA', 'TY',
  'KK', 'ROS', 'RYA', 'SAM', 'SPE', 'SAR', 'SAK', 'SVE', 'SMO', 'STA', 'TAM', 'TVE', 'TOM', 'TUL',
  'TYU', 'UD', 'ULY', 'KHA', 'KHM', 'CHE', 'CE', 'CU', 'CHU', 'YAN', 'YAR'
]);

/** Страны, где штат или регион выбирают из списка, а не пишут текстом. */
const AREA_LISTS: Record<string, Set<string>> = { US: US_STATES, RU: RU_REGIONS };

export function isRegion(v: unknown): boolean {
  return v === ONLINE || (typeof v === 'string' && Object.hasOwn(REGIONS, v));
}

/**
 * Штат, регион или город. В США и России — код из списка (пусто — можно,
 * если required = false), в других странах — текст до 60 знаков.
 */
function areaFor(country: string, raw: unknown, required: boolean): string | null {
  const list = AREA_LISTS[country];
  if (list) {
    const code = String(raw ?? '').trim().toUpperCase();
    if (!code && !required) return null;
    if (!list.has(code)) fail(country === 'US' ? 'bad_state' : 'bad_ru_region');
    return code;
  }
  const text = String(raw ?? '').trim().slice(0, 60);
  return text || null;
}

/**
 * Место игры из формы ведущего: { region, country, area }. Онлайн — без
 * страны: её укажет каждая команда. Иначе страна обязательна и должна быть
 * в выбранной части света; штат, регион или город — по желанию.
 */
export function gameLocation(b: Row): { region: string; country: string | null; area: string | null } {
  const region = b.region === undefined || b.region === null || b.region === '' ? ONLINE : String(b.region);
  if (!isRegion(region)) fail('bad_region');
  if (region === ONLINE) return { region, country: null, area: null };
  const country = String(b.country ?? '').trim().toUpperCase();
  if (!REGIONS[region].includes(country)) fail('bad_country');
  return { region, country, area: areaFor(country, b.area, false) };
}

/**
 * Место команды в онлайн-игре: страна обязательна, в США — штат, в России —
 * регион, в других странах город или регион — по желанию.
 */
export function playerLocation(b: Row): { country: string; area: string | null } {
  const country = String(b.country ?? '').trim().toUpperCase();
  if (!ALL_COUNTRIES.has(country)) fail('bad_country');
  return { country, area: areaFor(country, b.area, true) };
}

/**
 * Где команда ведёт бизнес — для табло и пульта. В игре в одном месте
 * все команды там же, где игра, поэтому отдельно место команды не
 * показываем (null). В онлайн-игре — то, что команда указала сама.
 */
export function teamLocation(game: Row, p: Row): { country: string | null; area: string | null } | null {
  if (game.region !== ONLINE) return null;
  if (!p.location_country && !p.location_area) return null;
  return { country: p.location_country ?? null, area: p.location_area ?? null };
}
