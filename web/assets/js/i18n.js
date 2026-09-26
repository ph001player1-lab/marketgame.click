// Языки сайта: английский, испанский, португальский, русский.
//
// Все тексты — в словарях i18n/<язык>.js. Английский встроен сразу и служит
// запасным; остальные грузятся, только когда нужны.
//
// Какой язык показать:
//   1. выбранный человеком в меню (хранится в этом браузере);
//   2. иначе в игре — язык игры, который выбрал ведущий;
//   3. иначе — язык браузера, если он из наших четырёх, или английский.
//
// t('decision.title', { n: 3 }) → строка с подстановкой {n};
// tn('board.teamsCount', 5) → форма по числу (one / few / many / other).

import EN from './i18n/en.js';
import { setLocale } from './fmt.js';

/** Языки — названиями на самих языках: так их находят в списке. */
export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'pt', name: 'Português' },
  { code: 'ru', name: 'Русский' }
];
const CODES = LANGUAGES.map((l) => l.code);
const PLURAL_LOCALE = { en: 'en-US', es: 'es-US', pt: 'pt-BR', ru: 'ru-RU' };
const PREF_KEY = 'mg-lang';

const DICTS = { en: EN };
let lang = 'en';
let current = EN;
let plural = new Intl.PluralRules('en-US');

export const isLanguage = (code) => CODES.includes(code);
export const language = () => lang;
export const languageName = (code) => LANGUAGES.find((l) => l.code === code)?.name ?? code;

function storage() {
  try { return window.localStorage; } catch { return null; }
}

/** Язык, выбранный в меню, или null — «автоматически». */
export function preferredLanguage() {
  let v = null;
  try { v = storage()?.getItem(PREF_KEY) ?? null; } catch { /* закрытое хранилище */ }
  return isLanguage(v) ? v : null;
}

export function setPreferredLanguage(code) {
  try {
    if (isLanguage(code)) storage()?.setItem(PREF_KEY, code);
    else storage()?.removeItem(PREF_KEY);
  } catch { /* закрытое хранилище: выбор живёт до перезагрузки */ }
}

/** Первый язык браузера из наших четырёх. */
export function browserLanguage() {
  const list = typeof navigator === 'undefined' ? [] : (navigator.languages?.length ? navigator.languages : [navigator.language]);
  for (const l of list) {
    const code = String(l || '').slice(0, 2).toLowerCase();
    if (isLanguage(code)) return code;
  }
  return 'en';
}

/** Какой язык показывать: выбор человека → язык игры → язык браузера. */
export function pickLanguage(gameLanguage) {
  return preferredLanguage() || (isLanguage(gameLanguage) ? gameLanguage : null) || browserLanguage();
}

/** Загружает словарь и делает язык текущим. Возвращает true, если язык сменился. */
export async function setLanguage(code) {
  const next = isLanguage(code) ? code : 'en';
  if (!DICTS[next]) {
    try {
      DICTS[next] = (await import(`./i18n/${next}.js`)).default;
    } catch {
      return false;   // нет сети — остаёмся на текущем языке
    }
  }
  const changed = next !== lang;
  lang = next;
  current = DICTS[next];
  plural = new Intl.PluralRules(PLURAL_LOCALE[next]);
  setLocale(next);
  if (typeof document !== 'undefined') document.documentElement.lang = next;
  return changed;
}

/** Подстановка {x} в строку. */
export function fill(text, vars) {
  if (typeof text !== 'string' || !vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : m));
}

function lookup(dict, path) {
  return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), dict);
}

/** t('a.b.c', { x: 1 }) → строка из словаря с подстановкой {x}. Нет перевода — английский. */
export function t(path, vars) {
  let v = lookup(current, path);
  if (v === undefined && current !== EN) v = lookup(EN, path);
  if (v === undefined) v = path;
  if (typeof v !== 'string') return v;
  return fill(v, vars);
}

/**
 * Число с существительным: tn('rating.gamesList', 3). Форма — по правилам
 * языка: ключ _one, _few, _many, иначе основной ключ.
 */
export function tn(path, n, vars = {}) {
  const form = plural.select(Number(n));
  const own = lookup(current, path + '_' + form);
  if (typeof own === 'string') return fill(own, { n, ...vars });
  return t(path, { n, ...vars });
}

/** Текст ошибки сервера по её коду и подробностям. */
export function errorText(res, fmt) {
  const code = typeof res === 'string' ? res : res?.error;
  const vars = {};
  if (res && typeof res === 'object') {
    for (const [k, v] of Object.entries(res)) {
      vars[k] = typeof v === 'number' && fmt && /available|min|max|needed|totalSpend/.test(k) ? fmt(v) : v;
    }
  }
  const text = t('errors.' + code, vars);
  return text === 'errors.' + code ? t('errors.server_error') : text;
}
