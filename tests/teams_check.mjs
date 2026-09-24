// Диагностика, а не тест: сколько команд переживает первый месяц в
// зависимости от их числа и размера рынка. Решения у всех одинаковые:
// заданная цена, без рекламы, без вложений.
//
// v4.9 обкатана на 4–8 игроках с фиксированным рынком 10 000 гостей.
// marketgame.biz обещает 4–20 команд — этот отчёт показывает, что будет.
//
//   node tests/teams_check.mjs

import { calculateRound } from '../build/economy.mjs';
import { BASELINE_THB, scaleConfig, freshPlayer } from './baseline-config.mjs';

const K = 1 / 10;                          // чек $30 вместо 300 ฿
const CFG = scaleConfig(BASELINE_THB, K);
const TEAMS = [4, 6, 8, 10, 12, 16, 20];
const PRICES = [30, 40, 50];               // долларов

const MARKETS = {
  'рынок 10 000 на всех (v4.9)': () => 10000,
  'рынок 2 000 × команд, не меньше 10 000': (n) => Math.max(10000, 2000 * n)
};

for (const [title, marketFor] of Object.entries(MARKETS)) {
  console.log('\n' + title);
  console.log('команд'.padEnd(8) + PRICES.map((p) => ('цена $' + p).padStart(28)).join(''));
  for (const n of TEAMS) {
    const cfg = { ...CFG, MARKET_SIZE_PER_PLAYER: marketFor(n), MARKET_SCALES_WITH_PLAYERS: false };
    let line = String(n).padEnd(8);
    for (const price of PRICES) {
      const players = Array.from({ length: n }, (_, i) => freshPlayer(i, cfg));
      const decisions = Object.fromEntries(players.map((p) => [p.id, {
        price, seo_spend: 0, promo_spend: 0, maps_spend: 0, social_spend: 0,
        outdoor_spend: 0, affiliate_spend: 0, shifts_delta: 0, quality_invest: 0
      }]));
      const out = calculateRound({ roundNumber: 1, cfg, players, decisions });
      const alive = out.players.filter((p) => p.status === 'active').length;
      const cash = Math.round(out.results[0].cash_after);
      const money = (cash < 0 ? '−$' : '$') + Math.abs(cash).toLocaleString('en-US');
      line += `${alive}/${n} живы, касса ${money}`.padStart(28);
    }
    console.log(line);
  }
}
