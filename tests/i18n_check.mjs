// Проверка словаря сайта: у каждого текста, который вызывает код, есть
// перевод. Иначе игрок увидел бы на экране «board.metrics.cash» вместо слов.
//
//   node tests/i18n_check.mjs
//
// Проверяются ключи-строки в t('…') и ключи, которые код собирает сам:
// коды ошибок сервера, виды записей в журнале денег, настройки ведущего.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { t } from '../web/assets/js/i18n.js';

const root = new URL('..', import.meta.url).pathname;
const missing = new Set();
const check = (key, where) => { if (t(key) === key) missing.add(key + '   ← ' + where); };

function files(dir, ext) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p, ext) : p.endsWith(ext) ? [p] : [];
  });
}

// 1. t('literal') во всех модулях сайта.
for (const file of files(join(root, 'web/assets/js'), '.js').filter((f) => !f.endsWith('i18n.js'))) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/\btn?\(\s*'([a-zA-Z0-9_.]+)'/g)) {
    if (m[1].endsWith('.')) continue;          // префикс, к нему приклеивают часть ключа
    check(m[1], file.replace(root, ''));
  }
}

// 2. Коды ошибок, которые может вернуть сервер.
const serverSrc = files(join(root, 'supabase/functions/game'), '.ts').map((f) => readFileSync(f, 'utf8')).join('\n');
for (const m of serverSrc.matchAll(/fail\('([a-z_]+)'/g)) check('errors.' + m[1], 'server fail()');

// 3. Ключи, которые код собирает сам.
const dynamic = {
  'statuses.': ['active', 'bankrupt', 'civil_service', 'freelance', 'custom_employed', 'left', 'setup', 'running', 'finished'],
  'institutions.': ['landlord', 'bank', 'insurer', 'utility', 'landlordWhat', 'bankWhat', 'insurerWhat', 'utilityWhat'],
  'leagues.': ['start', 'growth', 'elite', 'startWho', 'growthWho', 'eliteWho'],
  'board.views.': ['teams', 'economy', 'money', 'rating'],
  'board.metrics.': ['cash', 'profit', 'marketSharePct', 'served', 'price', 'brand', 'reputation', 'quality',
    'capacity', 'marketingTotal', 'qualityInvest', 'tax', 'dividends'],
  'board.citySeries.': ['profitTax', 'companies', 'otherIncome', 'spending'],
  'host.confirmStake.': ['sell', 'buyback', 'deal'],
  'host.': ['run', 'teams', 'cityTab', 'settings', 'sell', 'buyback', 'deal'],
  'guide.channels.': ['seo', 'promo', 'maps', 'social', 'outdoor', 'affiliate'],
  'money.': ['suppliers', 'staff', 'advertising', 'quality', 'landlord', 'insurer', 'utility', 'bank', 'cityTax', 'kept'],
  'rating.': ['how1', 'how2', 'how3', 'how4']
};
for (const c of ['seo', 'promo', 'maps', 'social', 'outdoor', 'affiliate']) {
  dynamic['channels.' + c + '.'] = ['name', 'blurb'];
}
for (const s of ['goal', 'month', 'pnl', 'market', 'choice', 'price', 'capacity', 'quality', 'marketing', 'brand',
  'costs', 'tax', 'bank', 'cash', 'deals', 'owners', 'city', 'board', 'scoring', 'leagues']) {
  dynamic['guide.s.' + s + '.'] = ['title', 'body'];
}
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

if (missing.size) {
  console.error('Missing translations:\n  ' + [...missing].sort().join('\n  '));
  process.exit(1);
}
console.log('i18n: all keys present');
