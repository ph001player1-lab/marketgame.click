// Тестовая партия для проверки экранов: шесть команд с разными стратегиями,
// несколько сыгранных месяцев, доля в страховой, штраф, кредит, перевод.
// Названия и люди вымышленные.

import assert from 'node:assert/strict';
import { makeApi } from '../api/harness.mjs';
import { ADMIN } from './server.mjs';

export const TEAMS = [
  { email: 'team1@example.com', name: 'Maria', restaurant: 'Taco Town', kind: 'state', state: 'TX' },
  { email: 'team2@example.com', name: 'Jake', restaurant: 'Pizza Planet', kind: 'multistate' },
  { email: 'team3@example.com', name: 'Sam', restaurant: 'Burger Barn', kind: 'state', state: 'CA' },
  { email: 'team4@example.com', name: 'Lee', restaurant: 'Noodle Nook', kind: 'international', country: 'Canada' },
  { email: 'team5@example.com', name: 'Ava', restaurant: 'Green Bowl', kind: 'state', state: 'NY' },
  { email: 'team6@example.com', name: 'Ben', restaurant: 'Smokehouse BBQ', kind: 'state', state: 'TX' }
];

// Решение месяца: у каждой команды своя манера.
function decide(i, month, cash) {
  const base = { price: 30, seoSpend: 0, promoSpend: 0, mapsSpend: 0, socialSpend: 0, outdoorSpend: 0,
    affiliateSpend: 0, shiftsDelta: 0, qualityInvest: 0 };
  const cap = (d) => {
    const keys = ['seoSpend', 'promoSpend', 'mapsSpend', 'socialSpend', 'outdoorSpend', 'affiliateSpend', 'qualityInvest'];
    const total = keys.reduce((a, k) => a + d[k], 0);
    if (total > cash * 0.9) for (const k of keys) d[k] = Math.floor((d[k] * cash * 0.9) / total);
    return d;
  };
  // Первый месяц все осторожны: разорение в первом же месяце оставило бы
  // табло для проверки экранов пустым.
  if (month === 1) return cap({ ...base, price: 30 + (i % 3) - 1, [['seoSpend', 'mapsSpend', 'promoSpend'][i % 3]]: 500 });
  switch (i) {
    case 0: return cap({ ...base, price: 28, promoSpend: 2000, socialSpend: 1500 });
    case 1: return cap({ ...base, price: 32, qualityInvest: month === 2 ? 8000 : 0, mapsSpend: 1000 });
    case 2: return cap({ ...base, price: 35, outdoorSpend: month % 4 === 2 ? 4000 : 0 });
    case 3: return cap({ ...base, price: 30, seoSpend: 1000, mapsSpend: 1000 });
    case 4: return cap({ ...base, price: 31, seoSpend: 1500, affiliateSpend: 2000 });
    default: return cap({ ...base, price: 25, promoSpend: 4000, socialSpend: 3000, shiftsDelta: month <= 2 ? 1 : 0 });
  }
}

async function ok(p, what) {
  const res = await p;
  assert.equal(res.ok, true, what + ': ' + JSON.stringify(res));
  return res;
}

/** Партия: months — сколько месяцев рассчитать; finish — закрыть игру. */
export async function seedGame(sql, { months = 4, finish = false, title = 'Austin Chamber · Fall session',
                                      league = 'start', teams = TEAMS, sponsor = true, language = 'en' } = {}) {
  const { call } = makeApi(sql, { admins: [ADMIN] });
  const created = await ok(call(ADMIN, 'createGame', {
    title, league, organizer: 'Austin Chamber of Commerce', timezone: 'America/Chicago', language,
    ...(sponsor ? { sponsorName: 'Lone Star Coffee Roasters', sponsorUrl: 'https://example.com' } : {})
  }), 'createGame');
  const gameId = created.gameId;
  await ok(call(ADMIN, 'setRoster', { gameId, emails: teams.map((x) => x.email).join('\n') }), 'setRoster');
  for (const tm of teams) {
    await ok(call(tm.email, 'setProfile', {
      gameId, displayName: tm.name, restaurantName: tm.restaurant, locationKind: tm.kind,
      locationState: tm.state, locationCountry: tm.country
    }), 'setProfile ' + tm.email);
  }

  for (let m = 1; m <= months; m++) {
    await ok(call(ADMIN, 'openRound', { gameId }), 'openRound ' + m);
    for (let i = 0; i < teams.length; i++) {
      const dash = await call(teams[i].email, 'dashboard', { gameId });
      if (dash.lifecycle !== 'active') continue;
      // Шесть ресторанов на рынок в 10 000 гостей — тесно, как и в v4.9:
      // без кредита до проверки экранов дожили бы не все.
      if (m >= 2 && dash.player.cash < 12000 && dash.loan.available >= 5000) {
        await ok(call(teams[i].email, 'requestLoan', { gameId, amount: Math.min(25000, dash.loan.available) }), 'loan');
      }
      const fresh = await call(teams[i].email, 'dashboard', { gameId });
      const res = await call(teams[i].email, 'submitDecision', { gameId, ...decide(i, m, fresh.player.cash) });
      if (!res.ok && res.error !== 'insufficient_cash') assert.fail('submit ' + JSON.stringify(res));
    }
    await ok(call(ADMIN, 'calculateRound', { gameId }), 'calc ' + m);

    const mon = await call(ADMIN, 'monitor', { gameId });
    const byEmail = Object.fromEntries(mon.players.map((p) => [p.email, p]));
    if (m === 2) {
      // Город продаёт 10% страховой, штрафует и помогает; команды договариваются.
      const taco = byEmail['team1@example.com'];
      if (taco.status === 'active' && taco.money > 2500) {
        await ok(call(ADMIN, 'sellStake', { gameId, kind: 'insurer', playerId: taco.id, pct: 10, price: 2000 }), 'sellStake');
      }
      await ok(call(ADMIN, 'adjust', { gameId, playerId: byEmail['team3@example.com'].id, amount: -500, reason: 'Health code violation' }), 'fine');
      const pizza = byEmail['team2@example.com'];
      if (pizza.status === 'active' && pizza.money > 1000) {
        await ok(call('team2@example.com', 'transferMoney', { gameId, toPlayerId: byEmail['team4@example.com'].id, amount: 1000, note: 'Joint ad campaign' }), 'transfer');
      }
    }
    if (m === 3) {
      await ok(call(ADMIN, 'updateConfig', { gameId, updates: { INSURANCE: 1500 } }), 'config');
    }
  }
  if (finish) await ok(call(ADMIN, 'finishGame', { gameId }), 'finish');
  const mon = await call(ADMIN, 'monitor', { gameId });
  return { gameId, code: created.code, monitor: mon, call };
}
