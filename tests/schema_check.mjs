// Проверка схемы базы по файлам миграций.
//
//   1. У каждой таблицы, привязанной к игре, связь с games — on delete
//      cascade: удаление игры не должно оставлять хвостов. Именно забытая
//      таблица в v4.9 переносила казну из старой партии в новую.
//   2. RLS включён на всех таблицах: публичный ключ не может ничего.
//   3. Представления и функции с правами владельца (мимо RLS) закрыты от
//      публичного ключа: после последнего create — revoke.

import { readFileSync, readdirSync } from 'fs';

const dir = 'supabase/migrations';
const sqlText = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
  .map((f) => readFileSync(`${dir}/${f}`, 'utf8')).join('\n');

const tables = [];
const re = /create table (\w+)\s*\(([\s\S]*?)\n\);/g;
let m;
while ((m = re.exec(sqlText)) !== null) tables.push({ name: m[1], body: m[2] });

let problems = 0;
for (const t of tables) {
  const gameCol = t.body.match(/game_id\s+uuid[^,\n]*/);
  if (gameCol && t.name !== 'games') {
    const cascade = /references games\(id\) on delete cascade/.test(gameCol[0]);
    console.log(`  ${t.name.padEnd(20)} ${cascade ? 'удаляется вместе с игрой' : 'НЕТ on delete cascade'}`);
    if (!cascade) problems++;
  }
  if (!new RegExp(`alter table ${t.name}\\s+enable row level security`).test(sqlText)) {
    console.log(`  ${t.name.padEnd(20)} RLS НЕ ВКЛЮЧЁН`);
    problems++;
  }
}

// Представления и security definer функции: последний create должен быть
// раньше последнего revoke для этого имени.
const exposed = new Set();
for (const v of sqlText.matchAll(/create (?:or replace )?view (\w+)/g)) exposed.add(v[1]);
for (const f of sqlText.matchAll(/create (?:or replace )?function (\w+)\([^)]*\)[\s\S]*?\$\$/g)) {
  if (/security definer/.test(f[0])) exposed.add(f[1]);
}
for (const name of exposed) {
  const created = Math.max(...[...sqlText.matchAll(new RegExp(`create (?:or replace )?(?:view|function) ${name}\\b`, 'g'))].map((x) => x.index));
  const revoked = Math.max(-1, ...[...sqlText.matchAll(new RegExp(`revoke [^;]*\\b${name}\\b`, 'g'))].map((x) => x.index));
  const ok = revoked > created;
  console.log(`  ${name.padEnd(20)} ${ok ? 'закрыто от публичного ключа' : 'ОТКРЫТО публичному ключу (нужен revoke)'}`);
  if (!ok) problems++;
}

if (problems) { console.log(`\nПРОБЛЕМ: ${problems}`); process.exit(1); }
console.log(`\nСХЕМА В ПОРЯДКЕ — ${tables.length} таблиц, у всех RLS, игра удаляется целиком.`);
