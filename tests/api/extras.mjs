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
const { call, authUsers } = makeApi(sql, { admins: [ADMIN] });

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
  // Спрос 2 500 на ресторан × 4 команды = рынок 10 000 гостей, как в v4.9.
  const g = await call(HOST, 'createGame', { title: 'Extras', league: 'start', region: 'north_america', country: 'US',
    demandPerTeam: 2500 });
  ok(g);
  gameId = g.gameId;
  ok(await call(HOST, 'setRoster', { gameId, emails: [ANN, BOB, CAT, DAN] }));
  for (const [e, r] of [[ANN, 'A'], [BOB, 'B'], [CAT, 'C'], [DAN, 'D']]) {
    ok(await call(e, 'setProfile', { gameId, displayName: r, restaurantName: 'Rest ' + r }));
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
  assert.equal(landlord.ownership.cityPct, 100);
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

await step('звёзды качества: строго за полный пункт, у города — по среднему', async () => {
  const g = await call(HOST, 'createGame', { title: 'Stars', league: 'start', region: 'europe', country: 'DE', area: 'Berlin' });
  ok(g);
  const gid = g.gameId;
  ok(await call(HOST, 'setRoster', { gameId: gid, emails: [ANN, BOB] }));
  for (const [e, r] of [[ANN, 'A'], [BOB, 'B']]) {
    ok(await call(e, 'setProfile', { gameId: gid, displayName: r, restaurantName: 'Star ' + r }));
  }
  const m0 = await monitor(gid);
  const sid = Object.fromEntries(m0.players.map((p) => [p.email, p.id]));
  // Стартовой кассы на полный пункт не хватает — деньги на качество даёт город.
  for (const e of [ANN, BOB]) ok(await call(HOST, 'adjust', { gameId: gid, playerId: sid[e], amount: 60000, reason: 'Quality fund' }));
  const decide = (e, qualityInvest) => call(e, 'submitDecision', { gameId: gid, price: 30, seoSpend: 0, promoSpend: 0,
    mapsSpend: 0, socialSpend: 0, outdoorSpend: 0, affiliateSpend: 0, shiftsDelta: 0, qualityInvest });
  const playMonth = async (ann, bob) => {
    ok(await call(HOST, 'openRound', { gameId: gid }));
    ok(await decide(ANN, ann));
    ok(await decide(BOB, bob));
    ok(await call(HOST, 'calculateRound', { gameId: gid }));
  };
  const starsOf = async () => {
    const b = await call(ANN, 'board', { gameId: gid });
    ok(b);
    const byId = Object.fromEntries(b.players.map((p) => [p.id, p]));
    return { ann: byId[sid[ANN]], bob: byId[sid[BOB]], city: b.ocean.at(-1).stars };
  };

  // Месяц 1: Ann покупает полный пункт — первая звезда. Bob — полпункта: звезды нет.
  await playMonth(40000, 20000);
  let s = await starsOf();
  assert.equal(s.ann.stars, 1, 'полный пункт — звезда');
  assert.equal(s.ann.starsGained, 1, 'звезда получена в этом месяце');
  assert.equal(s.ann.series.at(-1).stars, 1);
  assert.equal(s.bob.stars, 0, 'полпункта — ещё не звезда');
  assert.equal(s.city, 0, 'среднее качество 0,75 — у города звезды нет');
  assert.equal((await dash(ANN, gid)).player.stars, 1, 'кабинет видит ту же звезду');
  assert.equal((await monitor(gid)).players.find((p) => p.email === ANN).stars, 1, 'пульт тоже');

  // Месяц 2: Bob докупает: 0,5 × 0,95 + 0,6 = 1,075 — звезда. Качество Ann тает
  // до 0,95 — звезда гаснет сразу. Среднее (0,95 + 1,075) ÷ 2 ≈ 1,01 — у
  // города первая звезда.
  await playMonth(0, 24000);
  s = await starsOf();
  assert.equal(s.ann.stars, 0, '0,95 — ниже полного пункта, звезда погасла');
  assert.equal(s.ann.starsGained, 0);
  assert.deepEqual(s.ann.series.map((e) => e.stars), [1, 0]);
  assert.equal(s.bob.stars, 1);
  assert.equal(s.bob.starsGained, 1);
  assert.equal(s.city, 1, 'среднее качество выше 1 — у города первая звезда');

  // Звёзд ровно столько, сколько полных пунктов: подставим итог месяца.
  const setQuality = async (q) => {
    await sql`update results set quality = ${q} where game_id = ${gid} and round_number = 2 and player_id = ${sid[ANN]}`;
    await sql`update players set quality = ${q} where id = ${sid[ANN]}`;
    return (await starsOf()).ann.stars;
  };
  for (const [q, n] of [[0.9999, 0], [1, 1], [1.9999, 1], [2, 2], [2.9999, 2], [3, 3]]) {
    assert.equal(await setQuality(q), n, `качество ${q} — звёзд ${n}`);
  }
  // Ресторан закрылся и открылся заново — качество с нуля, звёзд нет.
  await sql`update players set quality = 0 where id = ${sid[ANN]}`;
  s = await starsOf();
  assert.equal(s.ann.stars, 0, 'новый ресторан начинает без звёзд');
  assert.equal((await dash(ANN, gid)).player.stars, 0);
});

await step('сбой подключения к базе: сервер повторяет сам, действие не задваивается и не теряется', async () => {
  // Первая игра этого файла (уже закончена: поправки ведущего после финала разрешены).
  const playerId = ids[BOB];
  const grants = async () => (await sql`
    select count(*)::int as n from ledger where player_id = ${playerId} and reason = 'Reliability check'`)[0].n;
  // База: первые два подключения отказывают («нет мест»), а запись ответа
  // действия один раз обрывается посреди транзакции.
  let refuse = 2;
  let breakAnswer = 1;
  const connectError = () => Object.assign(new Error('Max client connections reached'), { code: 'XX000' });
  const flaky = new Proxy(sql, {
    apply(target, self, args) {
      if (refuse > 0) { refuse--; return Promise.reject(connectError()); }
      return Reflect.apply(target, self, args);
    },
    get(target, prop) {
      if (prop !== 'begin') return Reflect.get(target, prop);
      return (fn) => target.begin((tx) => fn(new Proxy(tx, {
        get(t, p) {
          if (p === 'json' && breakAnswer > 0) { breakAnswer--; return () => { throw new Error('connection lost'); }; }
          return Reflect.get(t, p);
        }
      })));
    }
  });
  const handler = createHandler({ sql: flaky, adminEmails: [ADMIN], allowedOrigins: [],
    verifyToken: async (t) => t.slice(5), ensureAuthUser: async () => {} });
  const send = (requestId) => handler(new Request('http://x/game', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer test:' + HOST },
    body: JSON.stringify({ action: 'adjust', gameId, playerId, amount: 10, reason: 'Reliability check', requestId })
  }));
  const requestId = crypto.randomUUID();
  const before = await grants();
  // 1. Два отказа подключения сервер переживает сам; обрыв при записи ответа
  //    откатывает и действие, и отметку запроса: ответ 500, денег не прибавилось.
  const first = await send(requestId);
  assert.equal(refuse, 0, 'сервер повторил запрос после отказов подключения');
  assert.equal(first.status, 500);
  assert.equal(await grants(), before, 'сорвавшееся действие не оставило следа');
  // 2. Повтор с тем же requestId выполняет действие — не «Уже сделано».
  const second = await send(requestId);
  assert.equal(second.status, 200);
  ok(await second.json(), 'повтор после обрыва');
  assert.equal(await grants(), before + 1);
  // 3. Ещё один повтор — сохранённый ответ, второй раз деньги не начисляются.
  ok(await (await send(requestId)).json(), 'повтор выполненного');
  assert.equal(await grants(), before + 1, 'деньги начислены один раз');
  await moneyInvariants(sql, gameId);
});

await step('заявка по QR-коду: почта и ресторан, ведущий принимает, игра по ключу браузера', async () => {
  const EVE = 'eve@test.com', FAY = 'fay@test.com', GUS = 'gus@test.com';
  const g = await call(HOST, 'createGame', { title: 'Bangkok night', league: 'start', region: 'asia', country: 'TH', area: 'Bangkok' });
  ok(g);
  const gid = g.gameId;
  const code = (await monitor(gid)).game.code;
  // Баты — для игры в Таиланде.
  const [cur] = await sql`select currency, config->>'P_REF' as pref, config->>'PROFIT_TAX_RATE' as tax from games where id = ${gid}`;
  assert.deepEqual({ ...cur }, { currency: 'THB', pref: '1050', tax: '0.2' });

  // Страница заявки: название игры без почт.
  const info = await call(null, 'joinInfo', { code: code.toLowerCase() });
  ok(info);
  assert.equal(info.game.title, 'Bangkok night');
  assert.equal(JSON.stringify(info).includes('@'), false, 'no emails on the join page');
  err(await call(null, 'joinInfo', { code: 'NOPE42' }), 'game_not_found');

  // Заявки: почта и название ресторана, без кода.
  const eve = await call(null, 'joinRequest', { code, email: 'Eve@Test.com', restaurantName: 'Pad Thai Lab' });
  ok(eve);
  assert.match(eve.token, /^[0-9a-f]{64}$/);
  const fay = await call(null, 'joinRequest', { code, email: FAY, restaurantName: 'Mango Sticky' });
  ok(fay);
  err(await call(null, 'joinRequest', { code, email: GUS, restaurantName: 'pad thai lab' }), 'restaurant_taken');
  err(await call(null, 'joinRequest', { code, email: 'not-an-email', restaurantName: 'X' }), 'bad_email');
  err(await call(null, 'joinRequest', { code, email: HOST, restaurantName: 'Host Cafe' }), 'join_host');
  // Повторная заявка с той же почты — новое устройство, старый ключ больше не действует.
  const fay2 = await call(null, 'joinRequest', { code, email: FAY, restaurantName: 'Mango Sticky Rice' });
  ok(fay2);
  err(await call(null, 'joinStatus', { token: fay.token }), 'join_gone');
  const gus = await call(null, 'joinRequest', { code, email: GUS, restaurantName: 'Tom Yum Club' });
  ok(gus);
  assert.equal((await call(null, 'joinStatus', { token: eve.token })).status, 'pending');

  // Пока заявку не приняли, ключ ничего не открывает.
  err(await call(null, 'dashboard', { gameId: gid, joinToken: eve.token }), 'auth_required');

  // Ведущий видит заявки; чужой ведущий и игроки — нет.
  const m = await monitor(gid);
  assert.deepEqual(m.joinRequests.map((r) => [r.email, r.restaurant]),
    [[EVE, 'Pad Thai Lab'], [FAY, 'Mango Sticky Rice'], [GUS, 'Tom Yum Club']]);
  err(await call(HOST2, 'approveJoins', { gameId: gid, ids: [m.joinRequests[0].id] }), 'not_host');
  // Табло до старта — сколько записалось.
  const before = await call(HOST, 'board', { gameId: gid });
  assert.deepEqual(before.signup, { teams: 0, waiting: 3 });

  // Ведущий удаляет одну заявку и принимает две.
  const byEmail = Object.fromEntries(m.joinRequests.map((r) => [r.email, r.id]));
  ok(await call(HOST, 'dropJoin', { gameId: gid, id: byEmail[GUS] }));
  err(await call(null, 'joinStatus', { token: gus.token }), 'join_gone');
  const ap = await call(HOST, 'approveJoins', { gameId: gid, ids: [byEmail[EVE], byEmail[FAY]] });
  ok(ap);
  assert.equal(ap.approved, 2);
  assert.equal(ap.state.joinRequests.length, 0);
  assert.deepEqual(ap.state.players.map((p) => [p.email, p.restaurant]).sort(),
    [[EVE, 'Pad Thai Lab'], [FAY, 'Mango Sticky Rice']]);
  assert.ok(authUsers.has(EVE) && authUsers.has(FAY), 'approved emails can sign in by code later');
  assert.equal((await call(null, 'joinStatus', { token: eve.token })).status, 'approved');
  assert.deepEqual((await call(HOST, 'board', { gameId: gid })).signup, { teams: 2, waiting: 0 });

  // Принятый игрок играет по ключу браузера: только в своей игре.
  const me = await call(null, 'me', { joinToken: eve.token });
  ok(me);
  assert.equal(me.email, EVE);
  assert.deepEqual(me.playing.map((x) => x.id), [gid]);
  assert.deepEqual(me.hosting, []);
  const d = await call(null, 'dashboard', { gameId: gid, joinToken: eve.token });
  ok(d);
  assert.equal(d.needsProfile, true, 'name still asked, the restaurant is prefilled');
  ok(await call(null, 'setProfile', { gameId: gid, joinToken: eve.token, displayName: 'Eve', restaurantName: 'Pad Thai Lab',
    requestId: crypto.randomUUID() }));
  ok(await call(null, 'board', { gameId: gid, joinToken: eve.token }));
  err(await call(null, 'dashboard', { gameId, joinToken: eve.token }), 'auth_required');
  err(await call(null, 'monitor', { gameId: gid, joinToken: eve.token }), 'auth_required');
  err(await call(null, 'approveJoins', { gameId: gid, joinToken: eve.token, ids: [] }), 'auth_required');
  err(await call(null, 'dashboard', { gameId: gid, joinToken: fay.token }), 'auth_required');
  ok(await call(null, 'dashboard', { gameId: gid, joinToken: fay2.token }));

  // Игра идёт: решения по ключу, как обычно.
  ok(await call(HOST, 'openRound', { gameId: gid, requestId: crypto.randomUUID() }));
  ok(await call(null, 'submitDecision', { gameId: gid, joinToken: eve.token, requestId: crypto.randomUUID(),
    price: 1050, seoSpend: 0, promoSpend: 0, mapsSpend: 0, socialSpend: 0, outdoorSpend: 0, affiliateSpend: 0,
    shiftsDelta: 0, qualityInvest: 0 }));
  assert.equal((await call(HOST, 'board', { gameId: gid })).signup, null, 'no signup panel once the game runs');

  // Игра закончилась — ключ больше не действует, дальше вход по коду.
  ok(await call(HOST, 'calculateRound', { gameId: gid, requestId: crypto.randomUUID() }));
  ok(await call(HOST, 'finishGame', { gameId: gid, requestId: crypto.randomUUID() }));
  err(await call(null, 'dashboard', { gameId: gid, joinToken: eve.token }), 'auth_required');
  err(await call(null, 'joinRequest', { code, email: 'late@test.com', restaurantName: 'Late' }), 'game_finished');
  ok(await call(EVE, 'dashboard', { gameId: gid }));
  await moneyInvariants(sql, gid);
});

await step('ссылка для входа команды; деньги: прибыль прибыльных и убытки убыточных; доля спроса', async () => {
  // Три команды и рынок около прежних 10 000 гостей: одни в плюсе, другие в минусе.
  const g = await call(HOST, 'createGame', { title: 'Link night', league: 'start', region: 'north_america', country: 'US',
    demandPerTeam: 3500 });
  ok(g);
  const gid = g.gameId;
  ok(await call(HOST, 'setRoster', { gameId: gid, emails: [ANN, BOB, CAT].join('\n') }));
  for (const [e, name] of [[ANN, 'Ann Diner'], [BOB, 'Bob Bistro'], [CAT, 'Cat Cafe']]) {
    ok(await call(e, 'setProfile', { gameId: gid, displayName: e.split('@')[0], restaurantName: name }));
  }
  const bob = (await monitor(gid)).players.find((p) => p.email === BOB);

  // Ссылку выдаёт только ведущий этой игры.
  err(await call(HOST2, 'teamLink', { gameId: gid, playerId: bob.id }), 'not_host');
  err(await call(BOB, 'teamLink', { gameId: gid, playerId: bob.id }), 'not_host');
  err(await call(HOST, 'teamLink', { gameId: gid, playerId: crypto.randomUUID() }), 'player_not_found');
  const l1 = await call(HOST, 'teamLink', { gameId: gid, playerId: bob.id, requestId: crypto.randomUUID() });
  ok(l1);
  assert.match(l1.token, /^[0-9a-f]{64}$/);
  // В базе — только хеш ключа, и в журнале повторов ключа нет.
  const [{ n: plain }] = await sql`select count(*)::int as n from mutations where result::text like ${'%' + l1.token + '%'}`;
  assert.equal(plain, 0, 'the link key is not stored');
  const [{ n: hashed }] = await sql`select count(*)::int as n from team_links where token_hash = encode(sha256(${l1.token}::bytea), 'hex')`;
  assert.equal(hashed, 1);

  // Куда ведёт ссылка: игра и команда.
  const info = await call(null, 'linkInfo', { token: l1.token });
  ok(info);
  assert.deepEqual([info.gameId, info.email, info.restaurant, info.finished], [gid, BOB, 'Bob Bistro', false]);
  err(await call(null, 'linkInfo', { token: 'f'.repeat(64) }), 'link_gone');

  // Браузер со ссылкой играет за эту команду — только в этой игре.
  const me = await call(null, 'me', { joinToken: l1.token });
  ok(me);
  assert.deepEqual([me.email, me.playing.map((x) => x.id)], [BOB, [gid]]);
  ok(await call(null, 'dashboard', { gameId: gid, joinToken: l1.token }));
  err(await call(null, 'dashboard', { gameId, joinToken: l1.token }), 'auth_required');
  err(await call(null, 'monitor', { gameId: gid, joinToken: l1.token }), 'auth_required');
  err(await call(null, 'teamLink', { gameId: gid, joinToken: l1.token, playerId: bob.id }), 'auth_required');

  // Новая ссылка отменяет прежнюю.
  const l2 = await call(HOST, 'teamLink', { gameId: gid, playerId: bob.id, requestId: crypto.randomUUID() });
  ok(l2);
  err(await call(null, 'dashboard', { gameId: gid, joinToken: l1.token }), 'auth_required');
  err(await call(null, 'linkInfo', { token: l1.token }), 'link_gone');
  ok(await call(null, 'dashboard', { gameId: gid, joinToken: l2.token }));

  // Три месяца: одни в плюсе, другие в минусе.
  for (let i = 0; i < 3; i++) {
    ok(await call(HOST, 'openRound', { gameId: gid }));
    for (const [e, price, social] of [[ANN, 32, 0], [BOB, 20, 3000], [CAT, 30, 0]]) {
      const tok = e === BOB ? { joinToken: l2.token } : {};
      const who = e === BOB ? null : e;
      if ((await call(who, 'dashboard', { gameId: gid, ...tok })).lifecycle !== 'active') continue;
      ok(await call(who, 'submitDecision', { gameId: gid, ...tok, requestId: crypto.randomUUID(),
        price, seoSpend: 0, promoSpend: 0, mapsSpend: 0, socialSpend: social, outdoorSpend: 0, affiliateSpend: 0,
        shiftsDelta: 0, qualityInvest: 0 }));
    }
    ok(await call(HOST, 'calculateRound', { gameId: gid }));
  }
  const board = await call(HOST, 'board', { gameId: gid });
  ok(board);
  const mm = board.moneyMap;
  const near = (a, b) => Math.abs(a - b) < 0.02;
  const perTeam = await sql`select player_id, sum(profit)::float as p from results where game_id = ${gid} group by player_id`;
  const wins = perTeam.reduce((a, r) => a + Math.max(0, r.p), 0);
  const losses = perTeam.reduce((a, r) => a + Math.max(0, -r.p), 0);
  assert.ok(wins > 0 && losses > 0, 'some teams earn, some lose ' + JSON.stringify(perTeam));
  assert.ok(near(mm.restaurantsTo.teamProfits, wins) && near(mm.restaurantsTo.teamLosses, losses),
    'game: profits of winners and losses of losers ' + JSON.stringify(mm.restaurantsTo));
  assert.ok(near(mm.restaurantsTo.teamProfits - mm.restaurantsTo.teamLosses, mm.restaurantsTo.keptByRestaurants));
  for (const mo of mm.months) {
    const rows = await sql`select profit::float as p from results where game_id = ${gid} and round_number = ${mo.round}`;
    assert.ok(near(mo.restaurantsTo.teamProfits, rows.reduce((a, r) => a + Math.max(0, r.p), 0)), 'month ' + mo.round);
    assert.ok(near(mo.restaurantsTo.teamProfits - mo.restaurantsTo.teamLosses, mo.restaurantsTo.keptByRestaurants));
  }
  // Доля спроса — от всех гостей города, как доля рынка, но по выбравшим.
  for (const p of board.players) {
    for (const e of p.series.filter((x) => x.inBusiness)) {
      const [r] = await sql`select demand::float as d, served::float as s, market_total::float as m from results
        where player_id = ${p.id} and round_number = ${e.round}`;
      assert.ok(Math.abs(e.demandSharePct - Math.round((r.d / r.m) * 10000) / 100) < 0.011, 'demand share');
      assert.ok(e.demandSharePct >= e.marketSharePct - 0.01, 'demand share ≥ market share');
    }
  }

  // Игра закончилась — ссылка больше не действует, дальше вход по коду.
  ok(await call(HOST, 'finishGame', { gameId: gid, requestId: crypto.randomUUID() }));
  err(await call(null, 'dashboard', { gameId: gid, joinToken: l2.token }), 'auth_required');
  assert.equal((await call(null, 'linkInfo', { token: l2.token })).finished, true);
  err(await call(HOST, 'teamLink', { gameId: gid, playerId: bob.id, requestId: crypto.randomUUID() }), 'game_finished');
  ok(await call(BOB, 'dashboard', { gameId: gid }));
  await moneyInvariants(sql, gid);
});

await step('спрос на ресторан: рынок = команды × спрос, по составу и со следующего месяца', async () => {
  const cfgOf = async (gid) => (await sql`select config from games where id = ${gid}`)[0].config;
  // Без спроса в запросе — 2 000 на ресторан; неверный спрос — ошибка.
  const g0 = await call(HOST, 'createGame', { title: 'Demand default', league: 'start', region: 'north_america', country: 'US' });
  ok(g0);
  assert.equal((await cfgOf(g0.gameId)).DEMAND_PER_TEAM, 2000);
  for (const bad of [50, 2500.5, 'many', 1e6]) {
    err(await call(HOST, 'createGame', { title: 'x', league: 'start', demandPerTeam: bad }), 'bad_demand');
  }
  const g = await call(HOST, 'createGame', { title: 'Demand', league: 'start', region: 'north_america', country: 'US',
    demandPerTeam: 1500 });
  ok(g);
  const gid = g.gameId;
  // Состав — рынок пересчитывается сам.
  ok(await call(HOST, 'setRoster', { gameId: gid, emails: [ANN, BOB, CAT].join('\n') }));
  let m = await monitor(gid);
  assert.equal(m.config.DEMAND_PER_TEAM, 1500);
  assert.equal(m.config.MARKET_SIZE_PER_PLAYER, 4500);
  assert.equal(m.rules.demandPerTeam, 1500);
  assert.equal(m.rules.marketBase, 4500);
  // Рынок со спросом числом не задаётся — только через спрос.
  const direct = await call(HOST, 'updateConfig', { gameId: gid, updates: { MARKET_SIZE_PER_PLAYER: 99999 } });
  assert.deepEqual(direct.rejected, { MARKET_SIZE_PER_PLAYER: { code: 'not_editable' } });
  const up = await call(HOST, 'updateConfig', { gameId: gid, updates: { DEMAND_PER_TEAM: 2000 } });
  ok(up);
  assert.deepEqual(up.applied, { DEMAND_PER_TEAM: 2000 });
  assert.equal(up.state.config.MARKET_SIZE_PER_PLAYER, 6000);
  err(await call(HOST, 'updateConfig', { gameId: gid, updates: { DEMAND_PER_TEAM: 10 } }).then((r) =>
    ({ error: r.rejected?.DEMAND_PER_TEAM?.code })), 'range');
  // Заявка по QR-коду — ещё команда, рынок больше.
  const code = (await monitor(gid)).game.code;
  ok(await call(null, 'joinRequest', { code, email: DAN, restaurantName: 'Dan Deli' }));
  m = await monitor(gid);
  ok(await call(HOST, 'approveJoins', { gameId: gid, ids: m.joinRequests.map((r) => r.id) }));
  assert.equal((await cfgOf(gid)).MARKET_SIZE_PER_PLAYER, 8000);
  for (const [e, name] of [[ANN, 'Ann'], [BOB, 'Bob'], [CAT, 'Cat'], [DAN, 'Dan']]) {
    ok(await call(e, 'setProfile', { gameId: gid, displayName: name, restaurantName: name + ' Diner' }));
  }
  // Месяц открыт — рынок месяца по составу на эту минуту: 4 × 2 000.
  ok(await call(HOST, 'openRound', { gameId: gid }));
  const [r1] = await sql`select config from rounds where game_id = ${gid} and round_number = 1`;
  assert.equal(r1.config.MARKET_SIZE_PER_PLAYER, 8000);
  // Спрос поменяли посреди месяца — новый рынок со следующего месяца.
  ok(await call(HOST, 'updateConfig', { gameId: gid, updates: { DEMAND_PER_TEAM: 2500 } }));
  const d = await call(ANN, 'dashboard', { gameId: gid });
  ok(d);
  assert.equal(d.rules.marketBase, 8000, 'this month keeps its market');
  assert.deepEqual(d.upcomingChanges.map((c) => [c.key, c.from, c.to]).sort(),
    [['DEMAND_PER_TEAM', 2000, 2500], ['MARKET_SIZE_PER_PLAYER', 8000, 10000]]);
  for (const e of [ANN, BOB, CAT, DAN]) {
    ok(await call(e, 'submitDecision', { gameId: gid, price: 30, seoSpend: 0, promoSpend: 0, mapsSpend: 0,
      socialSpend: 0, outdoorSpend: 0, affiliateSpend: 0, shiftsDelta: 0, qualityInvest: 0 }));
  }
  ok(await call(HOST, 'calculateRound', { gameId: gid }));
  const [res] = await sql`select market_total::float as m from results where game_id = ${gid} and round_number = 1 limit 1`;
  assert.ok(Math.abs(res.m - 8000) < 1, 'month 1 market 4 × 2,000 at the reference price: ' + res.m);
  ok(await call(HOST, 'openRound', { gameId: gid }));
  const [r2] = await sql`select config from rounds where game_id = ${gid} and round_number = 2`;
  assert.equal(r2.config.MARKET_SIZE_PER_PLAYER, 10000);
  // Ушла из игры — рынок со следующего месяца меньше.
  ok(await call(DAN, 'chooseCareerPath', { gameId: gid, path: 'end' }));
  assert.equal((await cfgOf(gid)).MARKET_SIZE_PER_PLAYER, 7500);
  // Старая игра без спроса — рынок задан числом, как раньше.
  await sql`update games set config = config - 'DEMAND_PER_TEAM' where id = ${g0.gameId}`;
  const old = await call(HOST, 'updateConfig', { gameId: g0.gameId, updates: { MARKET_SIZE_PER_PLAYER: 12000 } });
  assert.deepEqual(old.applied, { MARKET_SIZE_PER_PLAYER: 12000 });
  ok(await call(HOST, 'setRoster', { gameId: g0.gameId, emails: [ANN, BOB].join('\n') }));
  assert.equal((await cfgOf(g0.gameId)).MARKET_SIZE_PER_PLAYER, 12000);
  assert.equal((await monitor(g0.gameId)).rules.demandPerTeam, null);
});

await step('конец последней игры — без входа и без данных игроков', async () => {
  const r = await call(null, 'lastFinished');
  ok(r);
  const [db] = await sql`select count(*)::int as n, max(finished_at) as at from games where status = 'finished'`;
  assert.ok(db.n > 0, 'в этом файле уже есть законченная игра');
  assert.equal(r.finished, db.n);
  assert.equal(r.at, new Date(db.at).toISOString());
  assert.equal(typeof r.title, 'string');
  assert.deepEqual(Object.keys(r).sort(), ['at', 'finished', 'ok', 'title']);
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
