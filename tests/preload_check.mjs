// Предзагрузка модулей страниц. Сайт собран без сборщика: браузер узнаёт о
// модуле, только когда скачал того, кто его импортирует, — и так уровень за
// уровнем. Из Таиланда до GitHub Pages каждый уровень — лишний круг по сети.
// <link rel="modulepreload"> в <head> просит всё сразу.
//
//   node tests/preload_check.mjs          проверка: списки в HTML свежие
//   node tests/preload_check.mjs --write  переписать списки (npm run preload)
//
// Список — все статические импорты страницы, плюс модуль входа Supabase там,
// где без входа никуда, и латинские шрифты (они нужны на любой странице).

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const web = resolve(new URL('../web', import.meta.url).pathname);
const PAGES = [
  { html: 'index.html', entry: 'assets/js/app.js', auth: true },
  { html: 'board/index.html', entry: 'assets/js/pages/board.js', auth: true },
  { html: 'report/index.html', entry: 'assets/js/pages/report.js', auth: false },
  { html: 'rating/index.html', entry: 'assets/js/pages/rating.js', auth: false }
];
const FONTS = ['assets/fonts/manrope-latin.woff2', 'assets/fonts/unbounded-latin.woff2'];
const AUTH_MODULE = 'assets/js/vendor/supabase-auth.js';
const START = '<!-- preload: npm run preload -->';
const END = '<!-- /preload -->';

/** Все модули, которые страница тянет статическими import/export … from. */
function graph(entry) {
  const seen = new Set();
  const walk = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const src = readFileSync(join(web, file), 'utf8');
    for (const m of src.matchAll(/^\s*(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"](\.{1,2}\/[^'"]+)['"]/gm)) {
      walk(relative(web, resolve(dirname(join(web, file)), m[1])));
    }
  };
  walk(entry);
  return [...seen];
}

function block(page) {
  const base = relative(dirname(join(web, page.html)), web);
  const href = (p) => (base ? base + '/' : '') + p;
  const modules = graph(page.entry).filter((m) => m !== page.entry).sort();
  if (page.auth) modules.push(AUTH_MODULE);
  return [START,
    ...FONTS.map((f) => `<link rel="preload" href="${href(f)}" as="font" type="font/woff2" crossorigin>`),
    ...modules.map((m) => `<link rel="modulepreload" href="${href(m)}">`),
    END].join('\n');
}

const write = process.argv.includes('--write');
const stale = [];
for (const page of PAGES) {
  const path = join(web, page.html);
  const html = readFileSync(path, 'utf8');
  const want = block(page);
  const re = new RegExp(START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?' + END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!re.test(html)) { stale.push(page.html + ' (no preload block)'); continue; }
  const next = html.replace(re, want);
  if (next === html) continue;
  if (write) writeFileSync(path, next);
  else stale.push(page.html);
}
if (stale.length && !write) {
  console.error('Preload lists are out of date — run `npm run preload`:\n  ' + stale.join('\n  '));
  process.exit(1);
}
console.log(write ? 'preload: lists written' : 'preload: lists up to date');
