// Контрольная проверка: каждая таблица, у которой есть game_id, должна
// быть либо очищена при сбросе, либо намеренно исключена с объяснением.
// Именно отсутствие такой проверки и привело к тому, что казна пережила
// сброс партии.
import { readFileSync } from 'fs';

const schema = readFileSync('./sql/01_schema.sql', 'utf8')
             + readFileSync('./sql/04_treasury.sql', 'utf8');
const reset  = readFileSync('./sql/05_reset.sql', 'utf8');

// Таблицы с колонкой game_id
const tables = [];
const re = /create table if not exists (\w+)\s*\(([\s\S]*?)\n\);/g;
let m;
while ((m = re.exec(schema)) !== null) {
  if (/game_id\s+uuid/.test(m[2])) tables.push(m[1]);
}

// Намеренные исключения — должны быть объяснены в комментарии файла сброса
const intentional = {
  admin_actions: 'журнал действий ведущего, переживает сброс',
  players: 'состав сохраняется, показатели сбрасываются через update'
};

let problems = 0;
console.log('Таблицы, привязанные к игре:\n');
for (const t of tables) {
  const cleared = new RegExp('delete from ' + t + '\\s+where game_id').test(reset);
  const excused = Object.prototype.hasOwnProperty.call(intentional, t);
  const mentioned = new RegExp('\\b' + t + '\\b').test(reset);

  let verdict;
  if (cleared) verdict = 'очищается';
  else if (excused && mentioned) verdict = 'сохраняется намеренно (' + intentional[t] + ')';
  else { verdict = '✗ НЕ ОЧИЩАЕТСЯ И НЕ ОБЪЯСНЕНА'; problems++; }

  console.log('  ' + t.padEnd(16) + verdict);
}

// players сбрасывается через update, не delete — проверяем отдельно
const playersReset = /update players set[\s\S]*?where game_id = p_game_id/.test(reset);
console.log('  ' + 'players'.padEnd(16) + (playersReset ? 'сбрасывается через update' : '✗ НЕ СБРАСЫВАЕТСЯ'));
if (!playersReset) problems++;

console.log('\n' + (problems === 0
  ? 'ВСЁ УЧТЕНО — новая партия начнётся с чистого состояния.'
  : 'ПРОБЛЕМ: ' + problems));
process.exit(problems ? 1 : 0);
