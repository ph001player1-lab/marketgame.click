// Сценарий целой игры против функции game на локальной базе.
//
//   node tests/api/game_flow.mjs
//
// Проверяет роли и доступ, состав по почтам, месяцы, автоход, кредит,
// переводы, банкротство и списание кредита, доли и дивиденды, налог,
// бюджет города, финал, рейтинг, историю и отчёт по ссылке. После каждого
// месяца сверяет деньги: касса и накопления каждой команды равны сумме её
// журнала, выплаты участников экономики сходятся с их доходами.

import assert from 'node:assert/strict';
import { freshDatabase, makeApi, moneyInvariants } from './harness.mjs';

const ADMIN = 'admin@test.com';
const HOST = 'host@test.com';
const TEAMS = ['ann@test.com', 'bob@test.com', 'cat@test.com', 'dan@test.com'];
const [ANN, BOB, CAT, DAN] = TEAMS;

const sql = await freshDatabase();
const { call, authUsers } = makeApi(sql, { admins: [ADMIN] });

let steps = 0;
async function step(name, fn) {
  steps++;
  try {
    await fn();
    console.log('  ok  ' + name);
  } catch (e) {
    console.log('  FAIL ' + name);
    console.log(e);
    await sql.end();
    process.exit(1);
  }
}
const ok = (r, msg) => assert.equal(r.ok, true, (msg ? msg + ': ' : '') + JSON.stringify(r).slice(0, 400));
const err = (r, code) => assert.equal(r.error, code, 'ожидалась ошибка ' + code + ', пришло ' + JSON.stringify(r).slice(0, 300));
const uuid = () => crypto.randomUUID();

async function dash(email, gameId) {
  const d = await call(email, 'dashboard', { gameId });
  ok(d, 'dashboard ' + email);
  return d;
}

async function decide(email, gameId, overrides = {}) {
  const d = await dash(email, gameId);
  return call(email, 'submitDecision', {
    gameId, price: 32, seoSpend: 0, promoSpend: 500, mapsSpend: 0, socialSpend: 0,
    outdoorSpend: 0, affiliateSpend: 0, shiftsDelta: 0, qualityInvest: 0,
    requestId: uuid(), ...overrides
  });
}

async function playMonth(gameId, skip = [], overrides = {}) {
  ok(await call(HOST, 'openRound', { gameId, requestId: uuid() }), 'openRound');
  for (const e of TEAMS) {
    if (skip.includes(e)) continue;
    const d = await dash(e, gameId);
    // Команде без денег решать нечего — за неё сработает автоход.
    if (d.lifecycle !== 'active' || d.player.cash < 1000) continue;
    const r = await decide(e, gameId, overrides[e] ?? {});
    ok(r, 'decision ' + e);
  }
  const r = await call(HOST, 'calculateRound', { gameId, requestId: uuid() });
  ok(r, 'calculateRound');
  await moneyInvariants(sql, gameId);
  return r;
}

console.log('Сценарий игры');

// ---------------------------------------------------------------- вход и роли
await step('без входа закрытые действия недоступны', async () => {
  err(await call(null, 'me'), 'auth_required');
});

await step('код входа уходит только тем, кого внесли', async () => {
  err(await call(null, 'preflightLogin', { email: 'stranger@test.com' }), 'not_registered');
  ok(await call(null, 'preflightLogin', { email: ADMIN }));
  err(await call(null, 'preflightLogin', { email: 'не почта' }), 'bad_email');
});

await step('администратор назначает ведущего', async () => {
  err(await call(HOST, 'addHost', { email: HOST }), 'not_admin');
  const r = await call(ADMIN, 'addHost', { email: HOST });
  ok(r);
  assert.ok(r.state.hosts.some((h) => h.email === HOST));
  assert.ok(authUsers.has(HOST), 'ведущий заведён в Auth');
  const me = await call(HOST, 'me');
  assert.equal(me.isHost, true);
  assert.equal(me.isAdmin, false);
});

let gameId, code;
await step('ведущий создаёт игру лиги Start', async () => {
  err(await call(ANN, 'createGame', { title: 'x', league: 'start' }), 'not_host');
  err(await call(HOST, 'createGame', { title: 'x', league: 'pro' }), 'bad_league');
  const r = await call(HOST, 'createGame', {
    title: 'Austin Chamber Night', league: 'start', organizer: 'Austin Chamber of Commerce',
    sponsorName: 'Example Bank', sponsorLogoUrl: 'https://example.com/logo.png',
    timezone: 'America/Chicago'
  });
  ok(r);
  gameId = r.gameId; code = r.code;
  assert.match(code, /^[A-Z2-9]{6}$/);
  const m = await call(HOST, 'monitor', { gameId });
  ok(m);
  assert.equal(m.game.totalRounds, 12);
  assert.equal(m.game.leagueName, 'Start');
  assert.equal(m.rules.rent, 7500);
  assert.equal(m.institutions.length, 4);
  assert.ok(m.institutions.every((i) => i.ownership.cityPct === 50));
});

await step('состав — вставленный список почт', async () => {
  const r = await call(HOST, 'setRoster', {
    gameId, emails: `Ann@Test.com, bob@test.com\ncat@test.com; dan@test.com, ann@test.com, junk, ${HOST}`
  });
  ok(r);
  assert.deepEqual(r.added.sort(), [...TEAMS].sort());
  assert.equal(r.skipped['junk'], 'not an email');
  assert.ok(r.skipped[HOST]);
  assert.ok(TEAMS.every((e) => authUsers.has(e)), 'почты команд заведены в Auth');
  ok(await call(null, 'preflightLogin', { email: BOB }));
});

await step('чужой не видит игру, игрок не может вести', async () => {
  err(await call('eve@test.com', 'dashboard', { gameId }), 'not_in_game');
  err(await call(ANN, 'openRound', { gameId }), 'not_host');
  err(await call(ANN, 'monitor', { gameId }), 'not_host');
});

await step('первый вход команды — профиль', async () => {
  const d = await dash(ANN, gameId);
  assert.equal(d.needsProfile, true);
  assert.equal(d.game.leagueName, 'Start');
  assert.equal(d.game.sponsor.name, 'Example Bank');
  err(await call(ANN, 'setProfile', { gameId, displayName: 'Ann', restaurantName: 'Ann’s Diner', locationKind: 'state', locationState: 'Texas' }), 'bad_state');
  const places = [
    [ANN, 'Ann', 'Ann’s Diner', 'state', 'TX'],
    [BOB, 'Bob', 'Bob’s BBQ', 'multistate', null],
    [CAT, 'Cat', 'Cat Café', 'international', null],
    [DAN, 'Dan', 'Dan’s Deli', 'state', 'OH']
  ];
  for (const [e, name, rest, kind, st] of places) {
    ok(await call(e, 'setProfile', { gameId, displayName: name, restaurantName: rest,
      locationKind: kind, locationState: st, locationCountry: kind === 'international' ? 'Canada' : null }));
  }
  err(await call(BOB, 'setProfile', { gameId, displayName: 'Bob', restaurantName: 'ann’s diner', locationKind: 'multistate' }), 'restaurant_taken');
  const d2 = await dash(ANN, gameId);
  assert.equal(d2.needsProfile, false);
  assert.equal(d2.player.cash, 10000);
});

await step('стартовый кредит открыт ещё до первого месяца', async () => {
  const d = await dash(CAT, gameId);
  assert.equal(d.loan.tier, 1);
  assert.equal(d.loan.available, 30000);
  ok(await call(CAT, 'requestLoan', { gameId, amount: 5000 }));
  const d2 = await dash(CAT, gameId);
  assert.equal(d2.player.cash, 15000);
  assert.equal(d2.loan.balance, 5000);
  // Заём сам по себе капитал не меняет: касса выросла ровно на долг.
  const [s] = await sql`select capital from v_standings where player_id = ${d2.player.id}`;
  assert.equal(s, undefined, 'до первого месяца команды нет в итогах');
  ok(await call(CAT, 'repayLoan', { gameId, amount: 5000 }));
  await moneyInvariants(sql, gameId);
});

await step('табло по коду открыто без входа и без почт', async () => {
  const b = await call(null, 'board', { code });
  ok(b);
  assert.equal(b.players.length, 4);
  assert.ok(!JSON.stringify(b).includes('@test.com'), 'в табло утекли почты');
  err(await call(null, 'board', { code: 'NOPE00' }), 'game_not_found');
});

// ---------------------------------------------------------------- месяцы
await step('месяц 1: решения, автоход за Dan, расчёт', async () => {
  err(await call(ANN, 'submitDecision', { gameId, price: 30 }), 'round_closed');
  ok(await call(HOST, 'openRound', { gameId }));
  err(await call(HOST, 'openRound', { gameId }), 'already_open');
  err(await decide(ANN, gameId, { price: 5 }), 'price_too_low');
  err(await decide(ANN, gameId, { promoSpend: 50000 }), 'insufficient_cash');
  for (const e of [ANN, BOB, CAT]) ok(await decide(e, gameId), 'decision ' + e);
  const m = await call(HOST, 'monitor', { gameId });
  assert.equal(m.players.filter((p) => p.submitted).length, 3);
  const r = await call(HOST, 'calculateRound', { gameId, requestId: uuid() });
  ok(r);
  err(await call(HOST, 'calculateRound', { gameId }), 'no_open_round');
  const [auto] = await sql`select autoplay from decisions d join players p on p.id = d.player_id
                           where p.email = ${DAN} and d.round_number = 1`;
  assert.equal(auto.autoplay, true, 'за Dan сработал автоход');
  await moneyInvariants(sql, gameId);
  const d = await dash(ANN, gameId);
  assert.equal(d.lastResult.roundNumber, 1);
  assert.equal(d.lastResult.opex.rent, 7500);
  assert.equal(d.lastResult.opex.insurance, 1200);
  assert.equal(d.lastResult.opex.utilities, 6300);
  assert.equal(d.loan.tier, 1, 'после первого месяца кредит на том же уровне');
});

await step('цвет воды: итог всех ресторанов месяца и его причины', async () => {
  const b = await call(null, 'board', { code });
  assert.equal(b.ocean.length, 1);
  const o = b.ocean[0];
  const [sums] = await sql`
    select count(*)::int as n, sum(revenue) as revenue, sum(ebit) as ebit, avg(price) as price,
           max(market_total) as market
    from results where game_id = ${gameId} and round_number = 1`;
  assert.equal(o.round, 1);
  assert.equal(o.restaurants, sums.n);
  assert.ok(Math.abs(o.revenue - sums.revenue) < 0.01 && Math.abs(o.ebit - sums.ebit) < 0.01);
  const margin = sums.ebit / sums.revenue;
  assert.equal(o.water, margin < 0 ? 'red' : margin < 0.05 ? 'choppy' : 'blue');
  // Рынок кормит столько ресторанов, сколько покрывают постоянные расходы
  // при опорной цене: гость приносит $30 − $12 = $18, расходы — $37,000.
  assert.equal(o.feeds, Math.floor((sums.market * 18) / 37000));
  assert.equal(o.pRef, 30);
  assert.ok(Math.abs(o.avgPrice - sums.price) < 0.01);
  const m = await call(HOST, 'monitor', { gameId });
  assert.deepEqual(m.ocean, b.ocean, 'ведущий видит ту же воду для разбора');
});

await step('кредит, досрочное погашение, лимит', async () => {
  err(await call(ANN, 'requestLoan', { gameId, amount: 999999 }), 'over_limit');
  const r = await call(ANN, 'requestLoan', { gameId, amount: 20000, requestId: uuid() });
  ok(r);
  assert.equal(r.state.loan.balance, 20000);
  ok(await call(ANN, 'repayLoan', { gameId, amount: 5000 }));
  const d = await dash(ANN, gameId);
  assert.equal(d.loan.balance, 15000);
  await moneyInvariants(sql, gameId);
});

await step('перевод — один раз, даже если запрос пришёл дважды', async () => {
  const anns = await dash(ANN, gameId);
  const bobId = anns.others.find((o) => o.restaurant === 'Bob’s BBQ').id;
  const rid = uuid();
  const before = (await dash(BOB, gameId)).player.cash;
  const r1 = await call(ANN, 'transferMoney', { gameId, toPlayerId: bobId, amount: 1000, requestId: rid });
  ok(r1);
  const r2 = await call(ANN, 'transferMoney', { gameId, toPlayerId: bobId, amount: 1000, requestId: rid });
  assert.equal(r2.ok, true);
  const after = (await dash(BOB, gameId)).player.cash;
  assert.equal(after - before, 1000, 'деньги пришли ровно один раз');
  err(await call(ANN, 'transferMoney', { gameId, toPlayerId: bobId, amount: 10 ** 9 }), 'insufficient_cash');
  await moneyInvariants(sql, gameId);
});

await step('правки ведущего действуют со следующего месяца', async () => {
  ok(await call(HOST, 'openRound', { gameId }));
  const r = await call(HOST, 'updateConfig', { gameId, updates: { INSURANCE: 1500, TOTAL_ROUNDS: 99, RENT: -1 } });
  ok(r);
  assert.equal(r.applied.INSURANCE, 1500);
  assert.ok(r.rejected.TOTAL_ROUNDS && r.rejected.RENT);
  const d = await dash(ANN, gameId);
  assert.equal(d.rules.insurance, 1200, 'открытый месяц идёт по старым правилам');
  assert.deepEqual(d.upcomingChanges, [{ key: 'INSURANCE', from: 1200, to: 1500 }]);
  for (const e of TEAMS) ok(await decide(e, gameId));
  ok(await call(HOST, 'calculateRound', { gameId }));
  const [r2] = await sql`select insurance from results where game_id = ${gameId} and round_number = 2 limit 1`;
  assert.equal(r2.insurance, 1200);
  await moneyInvariants(sql, gameId);
});

await step('доля в страховой: покупка у города и дивиденды', async () => {
  const m = await call(HOST, 'monitor', { gameId });
  const ann = m.players.find((p) => p.email === ANN);
  err(await call(HOST, 'sellStake', { gameId, kind: 'insurer', playerId: ann.id, pct: 60, price: 1 }), 'city_has_less');
  const r = await call(HOST, 'sellStake', { gameId, kind: 'insurer', playerId: ann.id, pct: 10, price: 2000, requestId: uuid() });
  ok(r);
  const insurer = r.state.institutions.find((i) => i.kind === 'insurer');
  assert.equal(insurer.ownership.cityPct, 40);
  assert.equal(insurer.ownership.playersPct, 10);
  const d = await dash(ANN, gameId);
  assert.equal(d.stakes[0].kind, 'insurer');
  assert.ok(d.notices.some((n) => n.kind === 'stake'));
  await moneyInvariants(sql, gameId);

  await playMonth(gameId);   // месяц 3: страховка уже $1,500
  const [row] = await sql`select * from institution_months where game_id = ${gameId} and round_number = 3 and kind = 'insurer'`;
  assert.equal(row.income, 1500 * 4, 'четыре работающих ресторана платят по $1,500');
  assert.equal(row.to_players, 600, '10% от $6,000');
  const [div] = await sql`select dividends from results r join players p on p.id = r.player_id
                          where p.email = ${ANN} and r.round_number = 3`;
  assert.equal(div.dividends, 600);
  assert.equal(row.to_city, 2400, 'город после продажи владеет 40%');
  const [landlord] = await sql`select * from institution_months where game_id = ${gameId} and round_number = 3 and kind = 'landlord'`;
  assert.equal(landlord.to_city, 15000, 'половина аренды четырёх ресторанов');
  const budget = (await call(HOST, 'monitor', { gameId })).city;
  const m3 = budget.months.find((x) => x.round === 3);
  const [cityDiv] = await sql`select sum(to_city) as s from institution_months where game_id = ${gameId} and round_number = 3`;
  assert.ok(Math.abs(m3.income.dividends - cityDiv.s) < 0.011, 'дивиденды города в бюджете');
});

await step('штраф, налог со всех, грант — в бюджет города', async () => {
  const m = await call(HOST, 'monitor', { gameId });
  const dan = m.players.find((p) => p.email === DAN);
  const before = m.city.balance;
  ok(await call(HOST, 'adjust', { gameId, playerId: dan.id, amount: -500, reason: 'Health inspection' }));
  ok(await call(HOST, 'massAdjust', { gameId, kind: 'tax_active', amount: 100, reason: 'Street repair' }));
  const m2 = await call(HOST, 'monitor', { gameId });
  assert.equal(m2.city.balance - before, 500 + 400, 'штраф и налог между месяцами не потерялись');
  const d = await dash(DAN, gameId);
  assert.ok(d.notices.some((n) => n.kind === 'fine' && n.message.includes('Health inspection')));
  await moneyInvariants(sql, gameId);
});

await step('банкротство: закрытие, списание кредита, госслужба', async () => {
  const m = await call(HOST, 'monitor', { gameId });
  const dan = m.players.find((p) => p.email === DAN);
  ok(await call(DAN, 'requestLoan', { gameId, amount: 20000 }));
  ok(await call(HOST, 'adjust', { gameId, playerId: dan.id, amount: -80000, reason: 'Lawsuit' }));
  await playMonth(gameId);   // месяц 4
  const d = await dash(DAN, gameId);
  assert.equal(d.lifecycle, 'bankrupt');
  ok(await call(DAN, 'chooseCareerPath', { gameId, path: 'civil_service' }));
  const [wo] = await sql`select sum(amount) as s from loan_write_offs where game_id = ${gameId}`;
  assert.ok(wo.s > 0, 'кредит банкрота списан');
  const d2 = await dash(DAN, gameId);
  assert.equal(d2.lifecycle, 'civil_service');
  await playMonth(gameId);   // месяц 5
  const [bank] = await sql`select * from institution_months where game_id = ${gameId} and round_number = 5 and kind = 'bank'`;
  assert.equal(bank.write_offs, wo.s, 'списание — убыток банка следующего месяца');
  const d3 = await dash(DAN, gameId);
  assert.equal(d3.player.savings, 3500, 'зарплата госслужбы');
  const budget = (await call(HOST, 'monitor', { gameId })).city;
  assert.equal(budget.months.find((x) => x.round === 5).spending.civilSalaries, 3500);
  await moneyInvariants(sql, gameId);
});

await step('ведущий открывает кабинет команды', async () => {
  const m = await call(HOST, 'monitor', { gameId });
  const cat = m.players.find((p) => p.email === CAT);
  const d = await call(HOST, 'dashboard', { gameId, asPlayerId: cat.id });
  ok(d);
  assert.equal(d.impersonating, true);
  assert.equal(d.player.restaurant, 'Cat Café');
  const bob = await call(BOB, 'dashboard', { gameId, asPlayerId: cat.id });
  assert.equal(bob.player.restaurant, 'Bob’s BBQ', 'игроку чужой кабинет не открывается');
});

await step('решения соперников скрыты до финала', async () => {
  const r = await call(ANN, 'gameReport', { gameId });
  ok(r);
  assert.equal(r.allDecisions, null);
  assert.ok(r.team.results.length >= 5);
  const h = await call(HOST, 'gameReport', { gameId });
  assert.ok(Array.isArray(h.allDecisions));
});

await step('месяцы 6–12 и автоматический финал', async () => {
  for (let i = 6; i <= 12; i++) {
    const r = await playMonth(gameId);
    assert.equal(r.finished, i === 12);
  }
  err(await call(HOST, 'openRound', { gameId }), 'game_finished');
  const m = await call(HOST, 'monitor', { gameId });
  assert.equal(m.game.status, 'finished');
  err(await call(ANN, 'submitDecision', { gameId, price: 30 }), 'game_finished');
});

await step('рейтинг обновился сразу после финала, без почт', async () => {
  const r = await call(null, 'rating', { league: 'start' });
  ok(r);
  const start = r.leagues.find((l) => l.league === 'start');
  assert.ok(start, 'лига Start в рейтинге');
  assert.ok(start.players.length >= 3);
  assert.ok(!JSON.stringify(r).includes('@test.com'), 'в рейтинг утекли почты');
  assert.ok(start.players.every((p) => p.history.length === 1 && p.player_key));
});

await step('история: My games, открытые решения, отчёт по ссылке', async () => {
  const me = await call(ANN, 'me');
  ok(me);
  const g = me.playing.find((x) => x.id === gameId);
  assert.ok(g && g.rated && g.standing && g.standing.rivals === 4);
  const rep = await call(ANN, 'gameReport', { gameId });
  assert.ok(Array.isArray(rep.allDecisions) && rep.allDecisions.length === 4, 'после финала решения открыты');
  const pub = await call(null, 'report', { token: g.reportToken });
  ok(pub);
  assert.equal(pub.teamName, 'Ann’s Diner');
  assert.ok(!JSON.stringify(pub).includes('@test.com'));
  err(await call(null, 'report', { token: uuid() }), 'report_not_found');
});

await step('сыграть ещё раз тем же составом', async () => {
  const r = await call(HOST, 'playAgain', { gameId });
  ok(r);
  const m = await call(HOST, 'monitor', { gameId: r.gameId });
  assert.equal(m.players.length, 4);
  assert.equal(m.config.INSURANCE, 1500, 'подкрученные настройки перенеслись');
  assert.equal(m.game.status, 'setup');
  const d = await dash(ANN, r.gameId);
  assert.equal(d.needsProfile, true, 'профиль подтверждают заново');
  assert.equal(d.player.restaurant, 'Ann’s Diner', 'но он подставлен из прошлой игры');
});

await step('учебная игра, законченная раньше, в рейтинг не идёт', async () => {
  const g = await call(HOST, 'createGame', { title: 'Demo', league: 'start', practice: true });
  ok(g);
  ok(await call(HOST, 'setRoster', { gameId: g.gameId, emails: [ANN, BOB] }));
  ok(await call(HOST, 'openRound', { gameId: g.gameId }));
  err(await call(HOST, 'finishGame', { gameId: g.gameId }), 'round_open');
  ok(await call(HOST, 'calculateRound', { gameId: g.gameId }));
  const f = await call(HOST, 'finishGame', { gameId: g.gameId });
  ok(f);
  assert.equal(f.rated, false);
  err(await call(HOST, 'deleteGame', { gameId: g.gameId }), 'game_has_history');
});

await step('игру без сыгранных месяцев можно удалить', async () => {
  const g = await call(HOST, 'createGame', { title: 'Oops', league: 'elite' });
  const r = await call(HOST, 'deleteGame', { gameId: g.gameId });
  ok(r);
  err(await call(HOST, 'monitor', { gameId: g.gameId }), 'game_not_found');
});

await sql.end();
console.log(`\nВСЕ ШАГИ ПРОЙДЕНЫ (${steps}) — сервер 5.0 ведёт игру от входа до рейтинга.`);
