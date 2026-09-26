// Числа, деньги и даты — по языку сайта. Деньги в игре всегда доллары США,
// а записаны так, как привычно читателю: $12,340 по-английски и по-испански
// (как в США), US$ 12.340 по-португальски (Бразилия), 12 340 $ по-русски.
// Минус — настоящий знак минуса, а не дефис.

const LOCALES = { en: 'en-US', es: 'es-US', pt: 'pt-BR', ru: 'ru-RU' };
let locale = 'en-US';
let F = formats(locale);

function formats(l) {
  const money = (digits, extra = {}) => new Intl.NumberFormat(l, {
    style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits, ...extra
  });
  return {
    n0: new Intl.NumberFormat(l, { maximumFractionDigits: 0 }),
    n1: new Intl.NumberFormat(l, { maximumFractionDigits: 1 }),
    n2: new Intl.NumberFormat(l, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    usd0: money(0), usd2: money(2), signed: money(0, { signDisplay: 'exceptZero' }),
    pct: {},
    // Десятичный знак языка: «,» по-португальски и по-русски.
    decimal: new Intl.NumberFormat(l).formatToParts(1.5).find((x) => x.type === 'decimal')?.value || '.'
  };
}

/** Язык форматов: en, es, pt, ru. Зовёт i18n.setLanguage. */
export function setLocale(lang) {
  locale = LOCALES[lang] || 'en-US';
  F = formats(locale);
}
export const currentLocale = () => locale;

const missing = (v) => v === null || v === undefined || v === '' || Number.isNaN(Number(v));
const minus = (s) => s.replace(/-/g, '−');
const noNegZero = (n) => (Object.is(n, -0) ? 0 : n);

/** $12,340 — целые доллары. */
export function usd(v) {
  if (missing(v)) return '—';
  return minus(F.usd0.format(noNegZero(Math.round(Number(v)))));
}

/** $1,234.56 — с центами, для точных сумм. */
export function usdc(v) {
  if (missing(v)) return '—';
  return minus(F.usd2.format(noNegZero(Number(v))));
}

/** +$1,200 / −$300 — для движений денег. */
export function usdSigned(v) {
  return minus(F.signed.format(noNegZero(Math.round(Number(v) || 0))));
}

export const int = (v) => (missing(v) ? '—' : minus(F.n0.format(noNegZero(Math.round(Number(v))))));
export const dec1 = (v) => (missing(v) ? '—' : minus(F.n1.format(Number(v))));
export const dec2 = (v) => (missing(v) ? '—' : minus(F.n2.format(Number(v))));

/** До двух знаков после запятой, без лишних нулей: 0.7, 0.65, 1. */
export function decimal(v, max = 2) {
  if (missing(v)) return '—';
  F.dec ||= {};
  F.dec[max] ||= new Intl.NumberFormat(locale, { maximumFractionDigits: max });
  return minus(F.dec[max].format(Number(v)));
}

/** Доля → 12.5% (по-русски 12,5 %). */
export function pct(v, digits = 1) {
  if (missing(v)) return '—';
  F.pct[digits] ||= new Intl.NumberFormat(locale, { style: 'percent', minimumFractionDigits: 0, maximumFractionDigits: digits });
  return minus(F.pct[digits].format(Number(v)));
}

/** Проценты, которые уже в процентах: 12.5 → 12.5%. */
export const pctRaw = (v) => (missing(v) ? '—' : pct(Number(v) / 100, 1));

/** Oct 3, 2026, 6:30 PM CDT — в поясе игры или зрителя, на языке сайта. */
export function dateTime(iso, timeZone) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(locale, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZone: timeZone || undefined, timeZoneName: 'short'
  });
}

export function dateOnly(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—'
    : d.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** 04:59 */
export function clock(sec) {
  const s = Math.max(0, Math.round(sec));
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

/**
 * Число из поля ввода. Пробелы, знаки валюты и разделители тысяч
 * пропускаем; десятичный знак — по языку, но «29.50» поймём и по-русски, а
 * «1,500» — как тысячу пятьсот по-английски и полторы по-русски.
 */
export function parseMoney(text) {
  let s = String(text ?? '').replace(/[\s  $]|US|R\$/g, '').replace(/[−–]/g, '-');
  if (s === '' || s === '-') return s === '' ? 0 : NaN;
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) {
    // Есть оба знака: десятичный — тот, что правее.
    const dec = lastDot > lastComma ? '.' : ',';
    s = s.split(dec === '.' ? ',' : '.').join('').replace(dec, '.');
  } else if (lastComma >= 0 || lastDot >= 0) {
    const sep = lastComma >= 0 ? ',' : '.';
    const parts = s.split(sep);
    const groups = parts.length > 2 || (parts[1]?.length === 3 && sep !== F.decimal);
    // «1.000» по-португальски и «1,000» по-английски — тысячи; «29,5» и
    // «29.5» — дробь, если только знак не разделитель тысяч этого языка.
    s = groups ? parts.join('') : parts.join('.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/** Коротко для делений оси: 12k, 1.5M (по-русски 12 тыс., 1,5 млн). */
export function short(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  const a = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (locale === 'pt-BR' || locale === 'ru-RU') {
    const digits = a >= 1e4 && a < 1e6 ? 0 : 1;
    return sign + new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: a < 10 ? 1 : digits }).format(a);
  }
  const trim = (x) => F.n1.format(Math.round(x * 10) / 10);
  if (a >= 1e6) return sign + trim(a / 1e6) + 'M';
  if (a >= 1e4) return sign + Math.round(a / 1e3) + 'k';
  if (a >= 1e3) return sign + trim(a / 1e3) + 'k';
  return sign + (a < 10 && a % 1 ? trim(a) : Math.round(a));
}

/** Деньги коротко: $12k, US$ 12 mil, 12 тыс. $. */
export function usdShort(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  const body = short(Math.abs(n));
  const sign = n < 0 ? '−' : '';
  if (locale === 'pt-BR') return sign + 'US$ ' + body;
  if (locale === 'ru-RU') return sign + body + ' $';
  return sign + '$' + body;
}

// ----------------------------------------------------------------- часовые пояса
// Ведущий вводит дату и время игры в её поясе, а сервер хранит момент в UTC.

function tzOffsetMinutes(ms, timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute, +parts.second);
  return Math.round((asUtc - ms) / 60000);
}

/** '2026-10-03T18:30' в поясе America/Chicago → ISO-строка UTC. */
export function zonedToIso(local, timeZone) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(local || ''));
  if (!m) return null;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let utc = guess - tzOffsetMinutes(guess, timeZone) * 60000;
  const again = guess - tzOffsetMinutes(utc, timeZone) * 60000;
  if (again !== utc) utc = again;
  return new Date(utc).toISOString();
}

/** ISO-момент → '2026-10-03T18:30' в поясе игры, для поля datetime-local. */
export function isoToZoned(iso, timeZone) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const local = new Date(d.getTime() + tzOffsetMinutes(d.getTime(), timeZone) * 60000);
  return local.toISOString().slice(0, 16);
}
