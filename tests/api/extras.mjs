// Редкие ветки функции game: найм и зарплата, повторное открытие дела,
// добровольный уход с кредитом, выход из игры с долями, сделки с долями,
// ограничения доли города, два одновременных «Рассчитать», рост рынка от
// качества, поправка ведущего после финала, чужие игры, CORS.
//
//   node tests/api/extras.mjs

import assert from 'node:assert/strict';
import { freshDatabase, makeApi, moneyInvariants } from './harness.mjs';
import { TEST_LOGO_PNG_B64 } from '../fixtures/logo.mjs';
import { createHandler } from '../../build/handler.mjs';

const ADMIN = 'admin@test.com';
const HOST = 'host@test.com';
const HOST2 = 'other-host@test.com';
const [ANN, BOB, CAT, DAN] = ['ann@test.com', 'bob@test.com', 'cat@test.com', 'dan@test.com'];

const sql = await freshDatabase('mg_api_extras');
const { call } = makeApi(sql, { admins: [ADMIN] });

let steps = 0;
async function step(name, fn) {
  steps++;
  try { await fn(); console.log('  ok  ' + name); }
  catch (e) { console.log('  FAIL ' + name); console.log(e); await sql.end(); process.exit(1); }
}
const ok = (r, msg) => assert.equal(r.ok, true, (msg ? msg + ': ' : '') + JSON.stringify(r).slice(0, 400));
const err = (r, code) => assert.equal(r.error, code, 'ожидалась ошибка ' + code + ', пришло ' + JSON.stringify(r).slice(0, 300));

const ids = {};
async function monitor(gameId) { const m = await call(HOST, 'monitor', { gameId }); ok(m); return m; }
async function dash(email, gameId) { const d = await call(email, 'dashboard', { gameId }); ok(d); return d; }
async function decideAll(gameId, extra = {}) {
  for (const e of [ANN, BOB, CAT, DAN]) {
    const d = await dash(e, gameId);
    if (d.lifecycle !== 'active' || d.player.cash < 1000) continue;
    ok(await call(e, 'submitDecision', { gameId, price: 32, seoSpend: 0, promoSpend: 0, mapsSpend: 0,
      socialSpend: 0, outdoorSpend: 0, affiliateSpend: 0, shiftsDelta: 0, qualityInvest: 0, ...(extra[e] ?? {}) }));
  }
}
async function month(gameId, extra = {}) {
  ok(await call(HOST, 'openRound', { gameId }));
  await decideAll(gameId, extra);
  const r = await call(HOST, 'calculateRound', { gameId });
  ok(r);
  await moneyInvariants(sql, gameId);
  return r;
}

console.log('Редкие ветки');

let gameId;
await step('подготовка: ведущие, игра, состав, профили', async () => {
  ok(await call(ADMIN, 'addHost', { email: HOST }));
  ok(await call(ADMIN, 'addHost', { email: HOST2 }));
  const g = await call(HOST, 'createGame', { title: 'Extras', league: 'start' });
  ok(g);
  gameId = g.gameId;
  ok(await call(HOST, 'setRoster', { gameId, emails: [ANN, BOB, CAT, DAN] }));
  for (const [e, r] of [[ANN, 'A'], [BOB, 'B'], [CAT, 'C'], [DAN, 'D']]) {
    ok(await call(e, 'setProfile', { gameId, displayName: r, restaurantName: 'Rest ' + r, locationKind: 'multistate' }));
  }
  const m = await monitor(gameId);
  for (const p of m.players) ids[p.email] = p.id;
});

await step('чужой ведущий не управляет игрой, администратор — может', async () => {
  err(await call(HOST2, 'monitor', { gameId }), 'not_host');
  err(await call(HOST2, 'openRound', { gameId }), 'not_host');
  ok(await call(ADMIN, 'monitor', { gameId }));
  const me = await call(HOST2, 'me');
  assert.ok(!me.hosting.some((g) => g.id === gameId));
  const adm = await call(ADMIN, 'me');
  assert.ok(adm.hosting.some((g) => g.id === gameId), 'администратор видит все игры');
});

await step('рынок растёт от среднего качества', async () => {
  const r = await month(gameId, { [ANN]: { qualityInvest: 9000 }, [BOB]: { qualityInvest: 9000 } });
  // Качество Ann и Bob — 9000 / 40000 = 0.225, среднее по четырём — 0.1125.
  // Цена у всех $32: ценовой множитель (32/30)^-0.4.
  const expect = 10000 * Math.pow(32 / 30, -0.4) * (1 + 0.15 * 0.1125);
  assert.ok(Math.abs(r.marketTotal - expect) < 1, `рынок ${r.marketTotal}, ожидался ${expect.toFixed(0)}`);
});

await step('добровольный уход с кредитом больше кассы — недостача на банк', async () => {
  ok(await call(CAT, 'requestLoan', { gameId, amount: 30000 }));
  const before = await dash(CAT, gameId);
  // Сжигаем кассу переводом, чтобы кредита оказалось больше денег.
  const spend = Math.floor(before.player.cash) - 5000;
  ok(await call(CAT, 'transferMoney', { gameId, toPlayerId: ids[ANN], amount: spend }));
  const r = await call(CAT, 'chooseCareerPath', { gameId, path: 'custom', professionName: 'Chef' });
  ok(r);
  const left = Math.round((before.player.cash - spend) * 100) / 100;
  assert.equal(r.writtenOff, Math.round((30000 - left) * 100) / 100, 'списано: кредит минус остаток кассы');
  const d = await dash(CAT, gameId);
  assert.equal(d.lifecycle, 'custom_employed');
  assert.equal(d.player.savings, 0);
  await moneyInvariants(sql, gameId);
});

await step('найм: предложение, одобрение, зарплата раз в месяц', async () => {
  ok(await call(CAT, 'proposeEmployment', { gameId, employerId: ids[ANN], salary: 3000 }));
  const a = await dash(ANN, gameId);
  assert.equal(a.employees.length, 1);
  assert.ok(a.notices.some((n) => n.kind === 'employment'));
  err(await call(BOB, 'respondToEmployment', { gameId, employeeId: ids[CAT], approve: true }), 'not_your_employee');
  ok(await call(ANN, 'respondToEmployment', { gameId, employeeId: ids[CAT], approve: true }));
  ok(await call(HOST, 'openRound', { gameId }));
  ok(await call(ANN, 'paySalary', { gameId, employeeId: ids[CAT] }));
  err(await call(ANN, 'paySalary', { gameId, employeeId: ids[CAT] }), 'already_paid');
  await decideAll(gameId);
  ok(await call(HOST, 'calculateRound', { gameId }));
  const c = await dash(CAT, gameId);
  assert.equal(c.player.savings, 3000);
  assert.equal(c.employment.paidThisRound, false, 'после расчёта месяца можно платить снова');
  await moneyInvariants(sql, gameId);
});

await step('повторное открытие дела на накопления', async () => {
  err(await call(CAT, 'reopenBusiness', { gameId }), 'not_enough_savings');
  ok(await call(ANN, 'transferMoney', { gameId, toPlayerId: ids[CAT], amount: 8000 }));
  const r = await call(CAT, 'reopenBusiness', { gameId });
  ok(r);
  assert.equal(r.cash, 11000);
  const d = await dash(CAT, gameId);
  assert.equal(d.lifecycle, 'active');
  assert.equal(d.business.brand, 0, 'новое дело — с чистого листа');
  const a = await dash(ANN, gameId);
  assert.equal(a.employees.length, 0, 'у Ann больше нет сотрудника');
  await moneyInvariants(sql, gameId);
});

await step('доли: лимит доли города, сделка между командами, выкуп', async () => {
  ok(await call(HOST, 'sellStake', { gameId, kind: 'bank', playerId: ids[BOB], pct: 20, price: 1000 }));
  err(await call(HOST, 'setCityShare', { gameId, kind: 'bank', pct: 90 }), 'over_100');
  ok(await call(HOST, 'setCityShare', { gameId, kind: 'bank', pct: 80 }));
  err(await call(HOST, 'transferStake', { gameId, kind: 'bank', fromPlayerId: ids[BOB], toPlayerId: ids[DAN], pct: 25, price: 10 }), 'not_enough_stake');
  ok(await call(HOST, 'transferStake', { gameId, kind: 'bank', fromPlayerId: ids[BOB], toPlayerId: ids[DAN], pct: 5, price: 400 }));
  ok(await call(HOST, 'buybackStake', { gameId, kind: 'bank', playerId: ids[BOB], pct: 15, price: 900 }));
  const m = await monitor(gameId);
  const bank = m.institutions.find((i) => i.kind === 'bank');
  assert.equal(bank.ownership.cityPct, 95);
  assert.deepEqual(bank.ownership.holders.map((h) => h.pct), [5]);
  assert.equal(bank.ownership.privatePct, 0);
  err(await call(HOST, 'sellStake', { gameId, kind: 'casino', playerId: ids[BOB], pct: 5, price: 1 }), 'bad_institution');
  await moneyInvariants(sql, gameId);
});

await step('выход из игры: доли возвращаются городу', async () => {
  ok(await call(HOST, 'sellStake', { gameId, kind: 'landlord', playerId: ids[DAN], pct: 10, price: 500 }));
  ok(await call(DAN, 'chooseCareerPath', { gameId, path: 'end' }));
  const m = await monitor(gameId);
  const landlord = m.institutions.find((i) => i.kind === 'landlord');
  assert.equal(landlord.ownership.cityPct, 50);
  const bank = m.institutions.find((i) => i.kind === 'bank');
  assert.equal(bank.ownership.cityPct, 100, 'и доля в банке тоже');
  const d = await dash(DAN, gameId);
  assert.equal(d.lifecycle, 'left');
  await moneyInvariants(sql, gameId);
});

await step('два одновременных «Рассчитать» — месяц считается один раз', async () => {
  ok(await call(HOST, 'openRound', { gameId }));
  await decideAll(gameId);
  const [r1, r2] = await Promise.all([
    call(HOST, 'calculateRound', { gameId }),
    call(HOST, 'calculateRound', { gameId })
  ]);
  const oks = [r1, r2].filter((r) => r.ok).length;
  assert.equal(oks, 1, 'ровно один расчёт: ' + JSON.stringify([r1.error, r2.error]));
  assert.ok([r1, r2].some((r) => r.error === 'no_open_round'));
  const [{ n }] = await sql`select count(*) as n from results where game_id = ${gameId} and round_number = 3`;
  assert.equal(n, 3);
  await moneyInvariants(sql, gameId);
});

await step('капитал — деньги минус долг: кредит в последний момент не помогает', async () => {
  const m = await call(HOST, 'monitor', { gameId });
  const bob = m.players.find((p) => p.email === BOB);
  const capital = async () => {
    const [s] = await sql`select capital from v_standings where player_id = ${bob.id}`;
    const b = await call(BOB, 'board', { code: m.game.code });
    return { view: Math.round(s.capital), board: b.players.find((p) => p.id === bob.id).capital };
  };
  const before = await capital();
  const d = await dash(BOB, gameId);
  assert.equal(d.lifecycle, 'active', 'Bob ведёт дело');
  assert.ok(d.loan.available >= 5000, 'у Bob есть кредитный лимит');
  ok(await call(BOB, 'requestLoan', { gameId, amount: Math.min(20000, d.loan.available) }));
  const after = await capital();
  assert.equal(after.view, before.view, 'заём не меняет капитал в итогах');
  assert.equal(after.board, after.view, 'табло считает капитал так же, как итоги');
  const [p] = await sql`select cash, loan_balance from players where id = ${bob.id}`;
  assert.equal(after.view, Math.round(p.cash - p.loan_balance));
});

await step('поправка ведущего после финала сразу видна в рейтинге', async () => {
  for (let i = 4; i <= 12; i++) await month(gameId);
  const before = (await call(null, 'rating', { league: 'start' })).leagues[0].players;
  const bob = before.find((p) => p.restaurant === 'Rest B');
  ok(await call(HOST, 'adjust', { gameId, playerId: ids[BOB], amount: 50000, reason: 'Correction' }));
  const after = (await call(null, 'rating', { league: 'start' })).leagues[0].players;
  const bob2 = after.find((p) => p.restaurant === 'Rest B');
  assert.equal(Math.round(bob2.avg_capital - bob.avg_capital), 50000);
});

await step('логотип спонсора: файл, ссылка Google Drive, картинка по GET', async () => {
  const m = await call(HOST, 'monitor', { gameId });
  const board = async () => (await call(ANN, 'board', { gameId })).game.sponsor;
  const handler = createHandler({ sql, adminEmails: [], allowedOrigins: [], verifyToken: async () => null,
    ensureAuthUser: async () => {} });
  const getLogo = () => handler(new Request('http://x/game?logo=' + gameId));

  ok(await call(HOST, 'updateGame', { gameId, sponsorName: 'Acme Coffee',
    sponsorLogoData: 'data:image/png;base64,' + TEST_LOGO_PNG_B64 }));
  let s = await board();
  assert.equal(s.logoRev, 1);
  assert.equal(s.logoUrl, null);
  const res = await getLogo();
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/png');
  assert.match(res.headers.get('cache-control'), /max-age=31536000/);
  const bytes = new Uint8Array(await res.arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 4)], [0x89, 0x50, 0x4e, 0x47], 'отдаётся PNG');

  // Ссылка «поделиться» Google Drive превращается в прямую ссылку на картинку.
  ok(await call(HOST, 'updateGame', { gameId,
    sponsorLogoUrl: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view?usp=sharing', sponsorLogoData: '' }));
  s = await board();
  assert.equal(s.logoUrl, 'https://drive.google.com/thumbnail?id=1AbCdEfGhIjKlMnOpQrStUvWxYz012345&sz=w1000');
  assert.equal(s.logoRev, null);
  assert.equal((await getLogo()).status, 404, 'файл удалён, когда логотип стал ссылкой');

  ok(await call(HOST, 'updateGame', { gameId, sponsorLogoUrl: 'https://www.dropbox.com/s/abc/logo.png?dl=0' }));
  assert.equal((await board()).logoUrl, 'https://www.dropbox.com/s/abc/logo.png?raw=1');

  err(await call(HOST, 'updateGame', { gameId, sponsorLogoData: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=' }), 'bad_logo');
  err(await call(HOST, 'updateGame', { gameId, title: 'Renamed', sponsorLogoData: 'not an image' }), 'bad_logo');
  assert.notEqual((await call(HOST, 'monitor', { gameId })).game.title, 'Renamed', 'плохой логотип не сохранил и остальное');

  ok(await call(HOST, 'updateGame', { gameId, sponsorLogoUrl: '', sponsorLogoData: '' }));
  s = await board();
  assert.equal(s.logoUrl, null);
  assert.equal(s.logoRev, null);
  const [log] = await sql`select count(*) as n from host_actions where game_id = ${gameId} and payload::text like '%base64%'`;
  assert.equal(Number(log.n), 0, 'сам файл в журнал ведущего не попадает');
});

await step('CORS: только разрешённые сайты', async () => {
  const handler = createHandler({
    sql, adminEmails: [], allowedOrigins: ['https://marketgame.click'],
    verifyToken: async () => null, ensureAuthUser: async () => {}
  });
  const pre = await handler(new Request('http://x/game', { method: 'OPTIONS', headers: { origin: 'https://evil.example' } }));
  assert.equal(pre.headers.get('access-control-allow-origin'), 'https://marketgame.click');
  const good = await handler(new Request('http://x/game', { method: 'OPTIONS', headers: { origin: 'https://marketgame.click' } }));
  assert.equal(good.headers.get('access-control-allow-origin'), 'https://marketgame.click');
  const bad = await handler(new Request('http://x/game', { method: 'POST', body: 'not json' }));
  assert.equal(bad.status, 400);
});

await sql.end();
console.log(`\nВСЕ ШАГИ ПРОЙДЕНЫ (${steps}).`);
