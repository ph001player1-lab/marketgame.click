// Проверка схемы базы по файлам миграций.
//
//   1. У каждой таблицы, привязанной к игре, связь с games — on delete
//      cascade: удаление игры не должно оставлять хвостов. Именно забытая
//      таблица в v4.9 переносила казну из старой партии в новую.
//   2. RLS включён на всех таблицах: публичный ключ не может ничего.

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

if (problems) { console.log(`\nПРОБЛЕМ: ${problems}`); process.exit(1); }
console.log(`\nСХЕМА В ПОРЯДКЕ — ${tables.length} таблиц, у всех RLS, игра удаляется целиком.`);
