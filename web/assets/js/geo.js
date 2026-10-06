// Где идёт игра: части света, страны, штаты США и регионы России.
//
// Коды — те же, что проверяет сервер (supabase/functions/game/geo.ts);
// tests/geo_check.mjs следит, чтобы списки совпадали. Названия стран — из
// браузера (Intl.DisplayNames) на языке сайта; штаты США — по-английски;
// регионы России — как на marketgame.quest, по-русски и по-английски.
// Часовой пояс штата или региона подставляется в форму игры.

import { t } from './i18n.js';
import { currentLocale } from './fmt.js';

export const ONLINE = 'online';

/** Части света в порядке списка и их страны — коды ISO 3166-1. */
export const REGIONS = {
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

export const REGION_KEYS = Object.keys(REGIONS);

// 50 штатов и округ Колумбия: код, название, часовой пояс (основной для штата).
export const US_STATES = [
  ['AL', 'Alabama', 'America/Chicago'],
  ['AK', 'Alaska', 'America/Anchorage'],
  ['AZ', 'Arizona', 'America/Phoenix'],
  ['AR', 'Arkansas', 'America/Chicago'],
  ['CA', 'California', 'America/Los_Angeles'],
  ['CO', 'Colorado', 'America/Denver'],
  ['CT', 'Connecticut', 'America/New_York'],
  ['DE', 'Delaware', 'America/New_York'],
  ['DC', 'District of Columbia', 'America/New_York'],
  ['FL', 'Florida', 'America/New_York'],
  ['GA', 'Georgia', 'America/New_York'],
  ['HI', 'Hawaii', 'Pacific/Honolulu'],
  ['ID', 'Idaho', 'America/Denver'],
  ['IL', 'Illinois', 'America/Chicago'],
  ['IN', 'Indiana', 'America/New_York'],
  ['IA', 'Iowa', 'America/Chicago'],
  ['KS', 'Kansas', 'America/Chicago'],
  ['KY', 'Kentucky', 'America/New_York'],
  ['LA', 'Louisiana', 'America/Chicago'],
  ['ME', 'Maine', 'America/New_York'],
  ['MD', 'Maryland', 'America/New_York'],
  ['MA', 'Massachusetts', 'America/New_York'],
  ['MI', 'Michigan', 'America/New_York'],
  ['MN', 'Minnesota', 'America/Chicago'],
  ['MS', 'Mississippi', 'America/Chicago'],
  ['MO', 'Missouri', 'America/Chicago'],
  ['MT', 'Montana', 'America/Denver'],
  ['NE', 'Nebraska', 'America/Chicago'],
  ['NV', 'Nevada', 'America/Los_Angeles'],
  ['NH', 'New Hampshire', 'America/New_York'],
  ['NJ', 'New Jersey', 'America/New_York'],
  ['NM', 'New Mexico', 'America/Denver'],
  ['NY', 'New York', 'America/New_York'],
  ['NC', 'North Carolina', 'America/New_York'],
  ['ND', 'North Dakota', 'America/Chicago'],
  ['OH', 'Ohio', 'America/New_York'],
  ['OK', 'Oklahoma', 'America/Chicago'],
  ['OR', 'Oregon', 'America/Los_Angeles'],
  ['PA', 'Pennsylvania', 'America/New_York'],
  ['RI', 'Rhode Island', 'America/New_York'],
  ['SC', 'South Carolina', 'America/New_York'],
  ['SD', 'South Dakota', 'America/Chicago'],
  ['TN', 'Tennessee', 'America/Chicago'],
  ['TX', 'Texas', 'America/Chicago'],
  ['UT', 'Utah', 'America/Denver'],
  ['VT', 'Vermont', 'America/New_York'],
  ['VA', 'Virginia', 'America/New_York'],
  ['WA', 'Washington', 'America/Los_Angeles'],
  ['WV', 'West Virginia', 'America/New_York'],
  ['WI', 'Wisconsin', 'America/Chicago'],
  ['WY', 'Wyoming', 'America/Denver']
];

// Регионы России — как на marketgame.quest: код, название по-русски,
// по-английски, часовой пояс.
export const RU_REGIONS = [
  ['ALT', 'Алтайский край', 'Altai Krai', 'Asia/Barnaul'],
  ['AMU', 'Амурская область', 'Amur Oblast', 'Asia/Yakutsk'],
  ['ARK', 'Архангельская область', 'Arkhangelsk Oblast', 'Europe/Moscow'],
  ['AST', 'Астраханская область', 'Astrakhan Oblast', 'Europe/Astrakhan'],
  ['BEL', 'Белгородская область', 'Belgorod Oblast', 'Europe/Moscow'],
  ['BRY', 'Брянская область', 'Bryansk Oblast', 'Europe/Moscow'],
  ['VLA', 'Владимирская область', 'Vladimir Oblast', 'Europe/Moscow'],
  ['VGG', 'Волгоградская область', 'Volgograd Oblast', 'Europe/Volgograd'],
  ['VLG', 'Вологодская область', 'Vologda Oblast', 'Europe/Moscow'],
  ['VOR', 'Воронежская область', 'Voronezh Oblast', 'Europe/Moscow'],
  ['YEV', 'Еврейская автономная область', 'Jewish Autonomous Oblast', 'Asia/Vladivostok'],
  ['ZAB', 'Забайкальский край', 'Zabaykalsky Krai', 'Asia/Chita'],
  ['IVA', 'Ивановская область', 'Ivanovo Oblast', 'Europe/Moscow'],
  ['IRK', 'Иркутская область', 'Irkutsk Oblast', 'Asia/Irkutsk'],
  ['KB', 'Кабардино-Балкарская Республика', 'Kabardino-Balkaria', 'Europe/Moscow'],
  ['KGD', 'Калининградская область', 'Kaliningrad Oblast', 'Europe/Kaliningrad'],
  ['KLU', 'Калужская область', 'Kaluga Oblast', 'Europe/Moscow'],
  ['KAM', 'Камчатский край', 'Kamchatka Krai', 'Asia/Kamchatka'],
  ['KC', 'Карачаево-Черкесская Республика', 'Karachay-Cherkessia', 'Europe/Moscow'],
  ['KEM', 'Кемеровская область — Кузбасс', 'Kemerovo Oblast — Kuzbass', 'Asia/Novokuznetsk'],
  ['KIR', 'Кировская область', 'Kirov Oblast', 'Europe/Kirov'],
  ['KOS', 'Костромская область', 'Kostroma Oblast', 'Europe/Moscow'],
  ['KDA', 'Краснодарский край', 'Krasnodar Krai', 'Europe/Moscow'],
  ['KYA', 'Красноярский край', 'Krasnoyarsk Krai', 'Asia/Krasnoyarsk'],
  ['KGN', 'Курганская область', 'Kurgan Oblast', 'Asia/Yekaterinburg'],
  ['KRS', 'Курская область', 'Kursk Oblast', 'Europe/Moscow'],
  ['LEN', 'Ленинградская область', 'Leningrad Oblast', 'Europe/Moscow'],
  ['LIP', 'Липецкая область', 'Lipetsk Oblast', 'Europe/Moscow'],
  ['MAG', 'Магаданская область', 'Magadan Oblast', 'Asia/Magadan'],
  ['MOW', 'Москва', 'Moscow', 'Europe/Moscow'],
  ['MOS', 'Московская область', 'Moscow Oblast', 'Europe/Moscow'],
  ['MUR', 'Мурманская область', 'Murmansk Oblast', 'Europe/Moscow'],
  ['NEN', 'Ненецкий автономный округ', 'Nenets Autonomous Okrug', 'Europe/Moscow'],
  ['NIZ', 'Нижегородская область', 'Nizhny Novgorod Oblast', 'Europe/Moscow'],
  ['NGR', 'Новгородская область', 'Novgorod Oblast', 'Europe/Moscow'],
  ['NVS', 'Новосибирская область', 'Novosibirsk Oblast', 'Asia/Novosibirsk'],
  ['OMS', 'Омская область', 'Omsk Oblast', 'Asia/Omsk'],
  ['ORE', 'Оренбургская область', 'Orenburg Oblast', 'Asia/Yekaterinburg'],
  ['ORL', 'Орловская область', 'Oryol Oblast', 'Europe/Moscow'],
  ['PNZ', 'Пензенская область', 'Penza Oblast', 'Europe/Moscow'],
  ['PER', 'Пермский край', 'Perm Krai', 'Asia/Yekaterinburg'],
  ['PRI', 'Приморский край', 'Primorsky Krai', 'Asia/Vladivostok'],
  ['PSK', 'Псковская область', 'Pskov Oblast', 'Europe/Moscow'],
  ['AD', 'Республика Адыгея', 'Adygea', 'Europe/Moscow'],
  ['AL', 'Республика Алтай', 'Altai Republic', 'Asia/Barnaul'],
  ['BA', 'Республика Башкортостан', 'Bashkortostan', 'Asia/Yekaterinburg'],
  ['BU', 'Республика Бурятия', 'Buryatia', 'Asia/Irkutsk'],
  ['DA', 'Республика Дагестан', 'Dagestan', 'Europe/Moscow'],
  ['IN', 'Республика Ингушетия', 'Ingushetia', 'Europe/Moscow'],
  ['KL', 'Республика Калмыкия', 'Kalmykia', 'Europe/Moscow'],
  ['KR', 'Республика Карелия', 'Karelia', 'Europe/Moscow'],
  ['KO', 'Республика Коми', 'Komi Republic', 'Europe/Moscow'],
  ['ME', 'Республика Марий Эл', 'Mari El', 'Europe/Moscow'],
  ['MO', 'Республика Мордовия', 'Mordovia', 'Europe/Moscow'],
  ['SA', 'Республика Саха (Якутия)', 'Sakha (Yakutia)', 'Asia/Yakutsk'],
  ['SE', 'Республика Северная Осетия — Алания', 'North Ossetia — Alania', 'Europe/Moscow'],
  ['TA', 'Республика Татарстан', 'Tatarstan', 'Europe/Moscow'],
  ['TY', 'Республика Тыва', 'Tuva', 'Asia/Krasnoyarsk'],
  ['KK', 'Республика Хакасия', 'Khakassia', 'Asia/Krasnoyarsk'],
  ['ROS', 'Ростовская область', 'Rostov Oblast', 'Europe/Moscow'],
  ['RYA', 'Рязанская область', 'Ryazan Oblast', 'Europe/Moscow'],
  ['SAM', 'Самарская область', 'Samara Oblast', 'Europe/Samara'],
  ['SPE', 'Санкт-Петербург', 'Saint Petersburg', 'Europe/Moscow'],
  ['SAR', 'Саратовская область', 'Saratov Oblast', 'Europe/Saratov'],
  ['SAK', 'Сахалинская область', 'Sakhalin Oblast', 'Asia/Sakhalin'],
  ['SVE', 'Свердловская область', 'Sverdlovsk Oblast', 'Asia/Yekaterinburg'],
  ['SMO', 'Смоленская область', 'Smolensk Oblast', 'Europe/Moscow'],
  ['STA', 'Ставропольский край', 'Stavropol Krai', 'Europe/Moscow'],
  ['TAM', 'Тамбовская область', 'Tambov Oblast', 'Europe/Moscow'],
  ['TVE', 'Тверская область', 'Tver Oblast', 'Europe/Moscow'],
  ['TOM', 'Томская область', 'Tomsk Oblast', 'Asia/Tomsk'],
  ['TUL', 'Тульская область', 'Tula Oblast', 'Europe/Moscow'],
  ['TYU', 'Тюменская область', 'Tyumen Oblast', 'Asia/Yekaterinburg'],
  ['UD', 'Удмуртская Республика', 'Udmurtia', 'Europe/Samara'],
  ['ULY', 'Ульяновская область', 'Ulyanovsk Oblast', 'Europe/Ulyanovsk'],
  ['KHA', 'Хабаровский край', 'Khabarovsk Krai', 'Asia/Vladivostok'],
  ['KHM', 'Ханты-Мансийский автономный округ — Югра', 'Khanty-Mansi Autonomous Okrug — Yugra', 'Asia/Yekaterinburg'],
  ['CHE', 'Челябинская область', 'Chelyabinsk Oblast', 'Asia/Yekaterinburg'],
  ['CE', 'Чеченская Республика', 'Chechnya', 'Europe/Moscow'],
  ['CU', 'Чувашская Республика', 'Chuvashia', 'Europe/Moscow'],
  ['CHU', 'Чукотский автономный округ', 'Chukotka Autonomous Okrug', 'Asia/Anadyr'],
  ['YAN', 'Ямало-Ненецкий автономный округ', 'Yamalo-Nenets Autonomous Okrug', 'Asia/Yekaterinburg'],
  ['YAR', 'Ярославская область', 'Yaroslavl Oblast', 'Europe/Moscow']
];

const AREAS = {
  US: Object.fromEntries(US_STATES.map(([code, name, zone]) => [code, { name: () => name, zone }])),
  RU: Object.fromEntries(RU_REGIONS.map(([code, ru, en, zone]) => [code, { name: () => (currentLocale().startsWith('ru') ? ru : en), zone }]))
};

/** Место новой игры по языку сайта ведущего. Ведущий меняет его в форме. */
export const DEFAULT_PLACE = {
  en: { region: 'north_america', country: 'US' },
  es: { region: 'latin_america', country: 'MX' },
  pt: { region: 'latin_america', country: 'BR' },
  ru: { region: 'cis', country: 'RU' }
};

const namers = new Map();

function namer(style) {
  const key = currentLocale() + ':' + style;
  if (!namers.has(key)) {
    let n = null;
    try { n = new Intl.DisplayNames([currentLocale()], { type: 'region', style }); } catch { n = null; }
    namers.set(key, n);
  }
  return namers.get(key);
}

/**
 * Название страны на языке сайта: «Германия», «Germany». short — для
 * подписей к командам: «США» вместо «Соединенные Штаты».
 */
export function countryName(code, short = false) {
  if (!code) return '';
  try { return namer(short && code === 'US' ? 'short' : 'long')?.of(code) || code; } catch { return code; }
}

const byName = (a, b) => a[1].localeCompare(b[1], currentLocale());

/** Страны части света (или все — для онлайн-игры): [[код, название]] по алфавиту. */
export function countryOptions(region) {
  const codes = region && REGIONS[region] ? REGIONS[region] : Object.values(REGIONS).flat();
  return codes.map((c) => [c, countryName(c)]).sort(byName);
}

/** Есть ли у страны список штатов или регионов (США, Россия). */
export const hasAreaList = (country) => Object.hasOwn(AREAS, country || '');

/** Штаты или регионы страны: [[код, название]] по алфавиту. */
export function areaOptions(country) {
  const list = AREAS[country];
  return list ? Object.entries(list).map(([code, a]) => [code, a.name()]).sort(byName) : [];
}

/** Штат или регион по коду; в других странах area — это сам текст. */
export function areaName(country, area) {
  if (!area) return '';
  return AREAS[country]?.[area]?.name() ?? area;
}

/** Часовой пояс штата США или региона России — для формы игры. */
export const areaZone = (country, area) => AREAS[country]?.[area]?.zone ?? null;

/** Часть света, к которой относится страна. */
export const regionOf = (country) => REGION_KEYS.find((r) => REGIONS[r].includes(country)) ?? null;

export const regionName = (region) => t('regions.' + (region || ONLINE));

/**
 * Где команда ведёт бизнес. Коротко — для значка у названия: «TX»,
 * «Москва», «Berlin», «Германия». Полностью — «Texas, США».
 */
export function placeText(loc, long = false) {
  if (!loc || (!loc.country && !loc.area)) return '';
  const country = loc.country ? countryName(loc.country, true) : '';
  if (!loc.area) return country;
  const area = areaName(loc.country, loc.area);
  if (!long) return loc.country === 'US' ? loc.area : area;
  return country ? area + ', ' + country : area;
}
