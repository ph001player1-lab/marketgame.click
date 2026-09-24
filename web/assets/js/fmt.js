// Американские форматы: $12,340, 7:00 PM CT, Sep 24, 2026.

const n0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const n1 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const n2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** $12,340 — целые доллары; минус — настоящий знак минуса. */
export function usd(v) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '—';
  const n = Math.round(Number(v));
  return (n < 0 ? '−$' : '$') + n0.format(Math.abs(n));
}

/** $1,234.56 — с центами, для точных сумм. */
export function usdc(v) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '—';
  const n = Number(v);
  return (n < 0 ? '−$' : '$') + n2.format(Math.abs(n));
}

/** +$1,200 / −$300 — для движений денег. */
export function usdSigned(v) {
  const n = Math.round(Number(v) || 0);
  if (n === 0) return '$0';
  return (n > 0 ? '+$' : '−$') + n0.format(Math.abs(n));
}

export const int = (v) => (v === null || v === undefined ? '—' : n0.format(Math.round(Number(v))));
export const dec1 = (v) => (v === null || v === undefined ? '—' : n1.format(Number(v)));
export const dec2 = (v) => (v === null || v === undefined ? '—' : n2.format(Number(v)));

/** Доля → 12.5%. */
export const pct = (v, digits = 1) =>
  (v === null || v === undefined ? '—' : (Number(v) * 100).toFixed(digits).replace(/\.0$/, '') + '%');

/** Проценты, которые уже в процентах: 12.5 → 12.5%. */
export const pctRaw = (v) => (v === null || v === undefined ? '—' : dec1(v) + '%');

/** Sep 24, 2026, 7:00 PM CDT — в поясе игры или зрителя. */
export function dateTime(iso, timeZone) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZone: timeZone || undefined, timeZoneName: 'short'
  });
}

export function dateOnly(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—'
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** 04:59 */
export function clock(sec) {
  const s = Math.max(0, Math.round(sec));
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

/** Число из поля ввода: запятые и знаки доллара игнорируем. */
export function parseMoney(text) {
  const s = String(text ?? '').replace(/[$,\s]/g, '');
  if (s === '') return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/** Коротко для делений оси: $12k, −$1.5M, 950. */
export function short(v, prefix = '') {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  const a = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  const trim = (x) => String(Math.round(x * 10) / 10);
  if (a >= 1e6) return sign + prefix + trim(a / 1e6) + 'M';
  if (a >= 1e4) return sign + prefix + Math.round(a / 1e3) + 'k';
  if (a >= 1e3) return sign + prefix + trim(a / 1e3) + 'k';
  return sign + prefix + (a < 10 && a % 1 ? trim(a) : Math.round(a));
}
export const usdShort = (v) => short(v, '$');
