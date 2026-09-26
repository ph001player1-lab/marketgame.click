// Проверка словарей сайта.
//
//   node tests/i18n_check.mjs
//
// 1. У каждого текста, который вызывает код, есть английский перевод. Иначе
//    игрок увидел бы на экране «board.metrics.cash» вместо слов. Проверяются
//    ключи-строки в t('…') и ключи, которые код собирает сам: коды ошибок
//    сервера, новостей и записей журнала денег, настройки ведущего.
// 2. Испанский, португальский и русский словари полные: те же ключи, что в
//    английском, те же подстановки {x}, парные ** для жирного, формы числа
//    для русского. Английский текст, забытый без перевода, — тоже ошибка.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { t } from '../web/assets/js/i18n.js';
import EN from '../web/assets/js/i18n/en.js';

const root = new URL('..', import.meta.url).pathname;
const problems = [];
const missing = new Set();
const check = (key, where) => { if (t(key) === key) missing.add(key + '   ← ' + where); };

function files(dir, ext) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p, ext) : p.endsWith(ext) ? [p] : [];
  });
}

// ----------------------------------------------------------------- 1. ключи кода

for (const file of files(join(root, 'web/assets/js'), '.js').filter((f) => !f.includes('/i18n'))) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/\btn?\(\s*'([a-zA-Z0-9_.]+)'/g)) {
    if (m[1].endsWith('.')) continue;          // префикс, к нему приклеивают часть ключа
    check(m[1], file.replace(root, ''));
  }
}

// Коды ошибок, которые может вернуть сервер.
const serverSrc = files(join(root, 'supabase/functions/game'), '.ts').map((f) => readFileSync(f, 'utf8')).join('\n');
for (const m of serverSrc.matchAll(/fail\('([a-z_]+)'/g)) check('errors.' + m[1], 'server fail()');

// Коды новостей и примечаний журнала денег: сервер пишет { code: '…' },
// сайт ищет текст в notices.kinds, history.notes или host.configWhy.
for (const m of serverSrc.matchAll(/code: '([a-z_]+)'/g)) {
  const code = m[1];
  if (![`notices.kinds.${code}`, `history.notes.${code}`, `host.configWhy.${code}`].some((k) => t(k) !== k)) {
    missing.add(code + '   ← server code (notices.kinds / history.notes / host.configWhy)');
  }
}
// Причины в ответе на состав: skipped[e] = '…', kept[e] = '…'.
for (const m of serverSrc.matchAll(/(?:skipped|kept)\[e\] = '([a-z_]+)'/g)) check('host.rosterWhy.' + m[1], 'server roster');

// Ключи, которые код собирает сам.
const dynamic = {
  'statuses.': ['active', 'bankrupt', 'civil_service', 'freelance', 'custom_employed', 'left', 'setup', 'running', 'finished'],
  'institutions.': ['landlord', 'bank', 'insurer', 'utility', 'landlordWhat', 'bankWhat', 'insurerWhat', 'utilityWhat'],
  'institutionsOf.': ['landlord', 'bank', 'insurer', 'utility'],
  'leagues.': ['start', 'growth', 'elite', 'startWho', 'growthWho', 'eliteWho'],
  'board.views.': ['teams', 'economy', 'money', 'rating'],
  'board.metrics.': ['capital', 'cash', 'profit', 'marketSharePct', 'served', 'price', 'brand', 'reputation', 'quality',
    'capacity', 'marketingTotal', 'qualityInvest', 'tax', 'dividends'],
  'board.citySeries.': ['profitTax', 'companies', 'otherIncome', 'spending'],
  'host.confirmStake.': ['sell', 'buyback', 'deal'],
  'host.': ['run', 'teams', 'cityTab', 'settings', 'sell', 'buyback', 'deal'],
  'host.configWhy.': ['not_editable', 'not_number', 'not_whole', 'range'],
  'guide.channels.': ['seo', 'promo', 'maps', 'social', 'outdoor', 'affiliate'],
  'money.': ['suppliers', 'staff', 'advertising', 'quality', 'landlord', 'insurer', 'utility', 'bank', 'cityTax', 'kept'],
  'rating.': ['how1', 'how2', 'how3', 'how4'],
  'ocean.water.': ['red', 'choppy', 'blue'],
  'ocean.questions.': ['red', 'choppy', 'blue'],
  'ocean.summary.': ['earned', 'lost'],
  'ocean.driver.': ['priceWar', 'priceOk', 'adRace', 'adOk', 'crowded', 'roomy', 'feedsHow', 'quality', 'noQuality']
};
for (const c of ['seo', 'promo', 'maps', 'social', 'outdoor', 'affiliate']) {
  dynamic['channels.' + c + '.'] = ['name', 'blurb'];
}
for (const s of ['goal', 'ocean', 'month', 'pnl', 'market', 'choice', 'price', 'capacity', 'quality', 'marketing', 'brand',
  'costs', 'tax', 'bank', 'cash', 'deals', 'owners', 'city', 'board', 'scoring', 'leagues']) {
  dynamic['guide.s.' + s + '.'] = ['title', 'body'];
}
// Часовые пояса формы игры: [пояс, ключ] в create.js.
const create = readFileSync(join(root, 'web/assets/js/views/create.js'), 'utf8');
dynamic['tz.'] = [...create.matchAll(/\['[A-Za-z_/]+', '([a-zA-Z]+)'\]/g)].map((m) => m[1]);
// Столбцы CSV: списки ключей в history.js (TEAM_COLS и […].map(colName)).
const history = readFileSync(join(root, 'web/assets/js/views/history.js'), 'utf8');
const colLists = [...history.matchAll(/TEAM_COLS = \[([\s\S]*?)\];|\[([^\[\]]*)\]\s*\.map\(colName\)/g)]
  .map((m) => m[1] || m[2]).join(',');
dynamic['csv.'] = [...new Set([...colLists.matchAll(/'([a-zA-Z]+)'/g)].map((m) => m[1]))];
if (dynamic['csv.'].length < 20) missing.add('(could not read CSV columns from history.js)');
// Виды записей журнала денег — из схемы базы.
const schema = readFileSync(join(root, 'supabase/migrations/20260924120000_v5_schema.sql'), 'utf8');
const ledgerKinds = /create table ledger[\s\S]*?kind\s+text\s+not null\s+check\s*\(kind in \(([^)]*)\)/i.exec(schema);
if (!ledgerKinds) missing.add('(could not read ledger kinds from the schema)');
else dynamic['history.kinds.'] = [...ledgerKinds[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
// Настройки, которые ведущий меняет на ходу.
const presets = readFileSync(join(root, 'supabase/functions/game/presets.ts'), 'utf8');
const editable = /EDITABLE_CONFIG[^{]*\{([\s\S]*?)\n\};/.exec(presets);
dynamic['upcoming.keys.'] = [...editable[1].matchAll(/^\s+([A-Z_]+):/gm)].map((m) => m[1]);

for (const [prefix, keys] of Object.entries(dynamic)) for (const k of keys) check(prefix + k, 'dynamic');
for (const m of missing) problems.push('en: missing ' + m);

// ----------------------------------------------------------------- 2. переводы

const PLURAL_FORMS = { es: ['one'], pt: ['one'], ru: ['one', 'few', 'many'] };
// Текст, который во всех языках одинаков: названия, сокращения, коды.
const SAME_OK = /^(Market Game|OK|SEO|Google Maps|UTC|Total|Toronto|Bangkok|Dubai|São Paulo|Sydney|Capital|Marketing|Menu|Ranking|Elite|No)$/;

const placeholders = (s) => new Set([...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]));
const bold = (s) => (String(s).match(/\*\*/g) || []).length;

function leaves(obj, prefix = '', out = new Map()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? prefix + '.' + k : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) leaves(v, key, out);
    else out.set(key, v);
  }
  return out;
}

const en = leaves(EN);
for (const lang of ['es', 'pt', 'ru']) {
  const dict = (await import(`../web/assets/js/i18n/${lang}.js`)).default;
  const tr = leaves(dict);
  for (const [key, ev] of en) {
    const v = tr.get(key);
    if (v === undefined) { problems.push(`${lang}: missing ${key}`); continue; }
    if (Array.isArray(ev) !== Array.isArray(v)) { problems.push(`${lang}: ${key} must be ${Array.isArray(ev) ? 'a list' : 'a string'}`); continue; }
    const evText = Array.isArray(ev) ? ev.join('\n') : ev;
    const vText = Array.isArray(v) ? v.join('\n') : v;
    if (Array.isArray(v) && !v.length) problems.push(`${lang}: ${key} is empty`);
    const want = placeholders(evText);
    const got = placeholders(vText);
    for (const p of got) if (!want.has(p)) problems.push(`${lang}: ${key} has unknown {${p}}`);
    for (const p of want) if (!got.has(p)) problems.push(`${lang}: ${key} lost {${p}}`);
    for (const line of Array.isArray(v) ? v : [v]) {
      if (bold(line) % 2) problems.push(`${lang}: ${key} has an unpaired **`);
    }
    // Названия мест (tz.*) часто совпадают на всех языках — это не пропуск.
    if (typeof v === 'string' && v === ev && !key.startsWith('tz.') && /[a-z]{3,}.*\s.*[a-z]{3,}/i.test(v) && !SAME_OK.test(v)) {
      problems.push(`${lang}: ${key} is still in English: "${v}"`);
    }
  }
  for (const key of tr.keys()) {
    if (en.has(key)) continue;
    const base = key.replace(/_(one|few|many)$/, '');
    if (base !== key && en.has(base)) continue;
    problems.push(`${lang}: extra key ${key} (not in English)`);
  }
  // Формы числа: где у английского есть _one, у языка — все свои формы.
  for (const key of en.keys()) {
    if (!key.endsWith('_one')) continue;
    const base = key.slice(0, -4);
    for (const form of PLURAL_FORMS[lang]) {
      if (!tr.has(base + '_' + form)) problems.push(`${lang}: missing plural form ${base}_${form}`);
    }
  }
}
// rating.months — 12, 24 и 36 месяцев: по-русски «месяцев» и «месяца».
{
  const ru = leaves((await import('../web/assets/js/i18n/ru.js')).default);
  for (const f of ['one', 'few', 'many']) if (!ru.has('rating.months_' + f)) problems.push('ru: missing rating.months_' + f);
}

if (problems.length) {
  console.error('Dictionary problems:\n  ' + problems.sort().join('\n  '));
  process.exit(1);
}
console.log('i18n: all keys present in en, es, pt, ru');
