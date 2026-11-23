// «Обезьяний» тест сервера: команды и ведущий делают случайные действия —
// правильные, неправильные и откровенный мусор, по одному и пачками
// одновременно, — а после каждого месяца проверяются инварианты учёта.
//
// Случайность воспроизводимая: у каждой партии свой seed. Упала партия —
// её можно повторить:  MONKEY_SEED_FROM=7 MONKEY_SEEDS=1 node tests/api/monkey.mjs
//
//   MONKEY_SEEDS        сколько партий (по умолчанию 3)
//   MONKEY_SEED_FROM    с какого seed начинать (по умолчанию 1)
//   MONKEY_MONTHS       сколько месяцев в партии (по умолчанию 6)
//   MONKEY_ACTIONS      случайных действий за месяц (по умолчанию 70)
//
// Что считается ошибкой:
//   - ответ 500 (сервер упал) на любое действие;
//   - код ошибки, у которого нет текста на сайте (errors.<код> в en.js);
//   - нарушенный инвариант: деньги ≠ журналам, доли компании ≠ 100%,
//     доля ≤ 0, доли у вышедшей команды, накопления меньше нуля, цена выше
//     потолка, нечисло в настройках, два открытых голосования и т. п.;
//   - кабинет, пульт, табло или отчёт не открываются.

import assert from 'node:assert/strict';
import { freshDatabase, makeApi, moneyInvariants } from './harness.mjs';

const SEEDS = Number(process.env.MONKEY_SEEDS || 3);
const SEED_FROM = Number(process.env.MONKEY_SEED_FROM || 1);
const MONTHS = Number(process.env.MONKEY_MONTHS || 6);
const ACTIONS = Number(process.env.MONKEY_ACTIONS || 70);

const ADMIN = 'admin@monkey.test';
const HOST = 'host@monkey.test';
const STRANGER = 'stranger@monkey.test';
const TEAMS = Array.from({ length: 6 }, (_, i) => `team${i + 1}@monkey.test`);
const KINDS = ['landlord', 'bank', 'insurer', 'utility', 'casino'];
const CAP_OF = { landlord: ['RENT', 'RENT_CAP'], bank: ['LOAN_RATE_ANNUAL', 'LOAN_RATE_CAP'],
  insurer: ['INSURANCE', 'INSURANCE_CAP'], utility: ['UTILITIES', 'UTILITIES_CAP'] };

const en = (await import('../../web/assets/js/i18n/en.js')).default;
const sql = await freshDatabase('mg_api_monkey');
const { call } = makeApi(sql, { admins: [ADMIN] });

// ----------------------------------------------------------------- случайность

/** mulberry32: маленький генератор с seed — партию можно повторить. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let R = rng(1);
const chance = (p) => R() < p;
const int = (a, b) => a + Math.floor(R() * (b - a + 1));
const pick = (list) => list[Math.floor(R() * list.length)];
const uuid = () => crypto.randomUUID();
/** Мусор для любого поля. */
const junk = () => pick([-1, 0, 1e15, 'abc', '', null, [], {}, 'casino', '00000000-0000-0000-0000-000000000000',
  uuid(), 'x'.repeat(500), NaN, true, '1e9', '<script>', -0.0001, 0.005]);

// ----------------------------------------------------------------- учёт

const stats = { calls: 0, ok: 0, codes: new Map(), byAction: new Map() };
const failures = [];

async function act(seed, who, action, params) {
  stats.calls++;
  const tally = stats.byAction.get(action) ?? { calls: 0, ok: 0 };
  tally.calls++;
  stats.byAction.set(action, tally);
  let res;
  try {
    res = await call(who, action, { ...params, requestId: chance(0.8) ? uuid() : undefined });
  } catch (e) {
    failures.push(`seed ${seed}: ${action} от ${who} упал: ${String(e.message).slice(0, 400)} · ${JSON.stringify(params).slice(0, 300)}`);
    return { ok: false, error: 'thrown' };
  }
  if (res.ok) { stats.ok++; tally.ok++; return res; }
  stats.codes.set(res.error, (stats.codes.get(res.error) ?? 0) + 1);
  // Любой код ошибки сайт должен уметь сказать словами.
  if (!en.errors?.[res.error] && res.error !== 'thrown') {
    failures.push(`seed ${seed}: код ошибки «${res.error}» (${action}) без текста на сайте`);
  }
  return res;
}

// ----------------------------------------------------------------- инварианты

async function invariants(seed, gameId, where) {
  try {
    await moneyInvariants(sql, gameId);
    const own = await sql`
      select i.kind, i.city_pct, coalesce(sum(s.pct), 0) as teams
      from institutions i left join stakes s on s.game_id = i.game_id and s.kind = i.kind
      where i.game_id = ${gameId} group by i.kind, i.city_pct`;
    for (const o of own) {
      assert.ok(Math.abs(o.city_pct + o.teams - 100) < 0.02, `${o.kind}: город ${o.city_pct}% + команды ${o.teams}% ≠ 100%`);
      assert.ok(o.city_pct >= -0.001, `${o.kind}: доля города ${o.city_pct}`);
    }
    const [bad] = await sql`select count(*)::int as n from stakes where game_id = ${gameId} and (pct <= 0 or pct > 100)`;
    assert.equal(bad.n, 0, 'доля ≤ 0 или больше 100%');
    const [left] = await sql`select count(*)::int as n from stakes s join players p on p.id = s.player_id
                             where s.game_id = ${gameId} and p.status = 'left'`;
    assert.equal(left.n, 0, 'доли у вышедшей команды');
    const players = await sql`select email, status, cash, employment_savings, loan_balance from players where game_id = ${gameId}`;
    for (const p of players) {
      for (const k of ['cash', 'employment_savings', 'loan_balance']) assert.ok(Number.isFinite(p[k]), `${p.email}: ${k} = ${p[k]}`);
      assert.ok(p.employment_savings >= -0.01, `${p.email}: накопления ${p.employment_savings}`);
      assert.ok(p.loan_balance >= -0.01, `${p.email}: долг ${p.loan_balance}`);
    }
    const [g] = await sql`select config from games where id = ${gameId}`;
    for (const [k, v] of Object.entries(g.config)) {
      if (typeof v === 'number') assert.ok(Number.isFinite(v), `настройка ${k} = ${v}`);
    }
    for (const [price, cap] of Object.values(CAP_OF)) {
      if (g.config[cap] !== undefined) assert.ok(g.config[price] <= g.config[cap] + 1e-9, `${price} ${g.config[price]} выше потолка ${g.config[cap]}`);
    }
    const [v] = await sql`select count(*) filter (where status = 'open')::int as open,
                                 count(*) filter (where decision = 'pending')::int as pending
                          from votes where game_id = ${gameId}`;
    assert.ok(v.open <= 1 && v.pending <= 1, `голосований: открыто ${v.open}, ждут подписи ${v.pending}`);
    const sold = await sql`select price, start_price, winner_id from auctions where game_id = ${gameId} and status = 'sold'`;
    for (const a of sold) assert.ok(a.winner_id && a.price >= a.start_price, 'продано без победителя или дешевле начальной цены');
    const [offers] = await sql`select count(*)::int as n from (select buyer_id from stake_offers
      where game_id = ${gameId} and status = 'open' group by buyer_id having count(*) > 1) x`;
    assert.equal(offers.n, 0, 'у команды больше одной открытой заявки');
    // Экраны открываются у всех.
    const m = await call(HOST, 'monitor', { gameId });
    assert.equal(m.ok, true, 'пульт: ' + m.error);
    for (const e of TEAMS) {
      const d = await call(e, 'dashboard', { gameId });
      assert.equal(d.ok, true, 'кабинет ' + e + ': ' + d.error);
      assert.ok(Number.isFinite(d.player.cash), 'касса в кабинете');
    }
    const b = await call(TEAMS[0], 'board', { gameId });
    assert.equal(b.ok, true, 'табло: ' + b.error);
  } catch (e) {
    failures.push(`seed ${seed}, ${where}: ${e.message}`);
  }
}

// ----------------------------------------------------------------- действия

/** Что видно сейчас: пульт (всё) и кабинет случайной команды. */
async function look(gameId) {
  const m = await call(HOST, 'monitor', { gameId });
  return m.ok ? m : null;
}

function teamIds(m) { return m.players.map((p) => p.id); }

/** Одно случайное действие команды. */
function teamAction(gameId, m) {
  const me = pick(TEAMS);
  const ids = teamIds(m);
  const other = pick(ids);
  const cfg = m.config || {};
  const company = pick(m.companies || []);
  const vote = m.vote?.active;
  const offers = m.exchange?.offers || [];
  const auctions = (m.exchange?.auctions || []).filter((a) => a.status === 'open');
  // Деньги — в валюте игры: в рублях всё в 50 раз больше, в батах — в 35.
  const scale = (Number(cfg.P_REF) || 30) / 30;
  const money = () => (chance(0.1) ? junk() : Math.round(int(0, 4000) * scale) * (chance(0.05) ? 100 : 1));
  const options = [
    [8, () => [me, 'submitDecision', {
      price: chance(0.1) ? junk() : Math.round(int(10, 70) * scale), seoSpend: money(), promoSpend: money(), mapsSpend: money(),
      socialSpend: money(), outdoorSpend: chance(0.2) ? Math.round(int(4000, 9000) * scale) : 0,
      affiliateSpend: chance(0.2) ? Math.round(int(2000, 4000) * scale) : 0,
      shiftsDelta: chance(0.1) ? junk() : int(-2, 3), qualityInvest: money()
    }]],
    [3, () => [me, 'requestLoan', { amount: chance(0.15) ? junk() : Math.round(int(1, 60) * 1000 * scale) }]],
    [2, () => [me, 'repayLoan', { amount: chance(0.15) ? junk() : Math.round(int(1, 20) * 500 * scale) }]],
    [3, () => [me, 'transferMoney', { toPlayerId: chance(0.1) ? junk() : other, amount: money() }]],
    [0.4, () => [me, 'chooseCareerPath', { path: pick(['civil_service', 'freelance', 'custom', chance(0.2) ? 'end' : 'freelance', 'nope']),
      professionName: pick(['Chef', '', 'x'.repeat(100)]) }]],
    [1, () => [me, 'reopenBusiness', {}]],
    [1, () => [me, 'proposeEmployment', { employerId: other, salary: money() }]],
    [1, () => [me, 'respondToEmployment', { employeeId: other, approve: chance(0.6) }]],
    [1, () => [me, 'paySalary', { employeeId: other }]],
    [vote ? 6 : 0, () => [me, 'castVote', { voteId: vote.id, choice: pick(['yes', 'no', 'abstain', 'maybe']) }]],
    [2, () => [me, 'proposeInitiative', { template: pick(['profit_tax', 'civil_salary', 'price_cap', 'cap_off', 'city_fee', 'grant_off', 'custom', 'rent']),
      target: pick(KINDS), value: chance(0.2) ? junk() : int(1, 40) * (chance(0.5) ? 1 : 300), question: pick(['Park?', '', null]) }]],
    [1, () => [me, 'withdrawInitiative', { initiativeId: chance(0.5) ? uuid() : junk() }]],
    [company ? 3 : 0, () => [me, 'proposePrice', { kind: chance(0.1) ? 'casino' : company.kind,
      value: chance(0.1) ? junk() : company.kind === 'bank' ? int(1, 40) : Math.round(company.price * (0.5 + R())) }]],
    [company?.open ? 5 : 0, () => [me, 'companyVote', { decisionId: company.open.id, choice: pick(['yes', 'no', 'no', 'x']) }]],
    [4, () => {
      const c = pick(m.companies || []);
      const sellers = c ? c.owners.map((o) => o.id) : ['city'];
      return [me, 'requestStake', { kind: chance(0.1) ? junk() : c?.kind, seller: chance(0.1) ? junk() : pick(sellers),
        pct: chance(0.1) ? junk() : pick([1, 5, 10, 25, 31, 51, 60, 100]), price: chance(0.1) ? junk() : Math.round(int(1, 30) * 100 * scale) }];
    }],
    [offers.length ? 6 : 0, () => {
      const o = pick(offers);
      const emailOf = (id) => m.players.find((x) => x.id === id)?.email;
      // Отвечает одна из сторон — или кто-то посторонний.
      const who = chance(0.85) ? (emailOf(o.buyer.id) ?? me) : me;
      const seller = o.seller.city ? null : emailOf(o.seller.id);
      const actor = chance(0.5) && seller ? seller : who;
      return [actor, 'answerOffer', { offerId: o.id, answer: pick(['accept', 'counter', 'reject', 'withdraw', 'auction', 'nope']),
        price: chance(0.1) ? junk() : Math.round(int(1, 40) * 100 * scale) }];
    }],
    [auctions.length ? 6 : 0, () => {
      const a = pick(auctions);
      return [me, 'placeBid', { auctionId: a.id, amount: chance(0.15) ? junk() : a.minBid + int(0, 3) * pick([1, 50, 500]) * scale }];
    }],
    [1, () => [me, 'markNoticesRead', {}]],
    [1, () => [me, 'setProfile', { displayName: pick(['Ann', '', 'x'.repeat(80)]), restaurantName: pick(['Diner', '', '🍕'.repeat(30)]) }]],
    [1, () => [me, 'dashboard', {}]],
    [1, () => [me, 'board', {}]]
  ];
  void cfg;
  return weighted(options);
}

/** Одно случайное действие ведущего. */
function hostAction(gameId, m) {
  const ids = teamIds(m);
  const p = pick(ids);
  const q = pick(ids);
  const vote = m.vote;
  const company = pick(m.companies || []);
  const offers = (m.exchange?.offers || []).filter((o) => o.seller.city);
  const auctions = (m.exchange?.auctions || []).filter((a) => a.status === 'open');
  const initiatives = m.initiatives || [];
  const kind = pick(KINDS.slice(0, 4));
  const scale = (Number(m.config?.P_REF) || 30) / 30;
  const options = [
    [2, () => [HOST, 'adjust', { playerId: p, amount: Math.round((chance(0.5) ? -1 : 1) * int(1, 30) * 100 * scale), reason: pick(['', 'Monkey', null]) }]],
    [1, () => [HOST, 'massAdjust', { kind: pick(['tax_active', 'grant_off_business', 'nope']), amount: Math.round(int(0, 20) * 50 * scale) }]],
    [2, () => [HOST, 'sellStake', { kind, playerId: p, pct: pick([1, 5, 10, 20, 35, 51]), price: Math.round(int(0, 20) * 100 * scale) }]],
    [1, () => [HOST, 'buybackStake', { kind, playerId: p, pct: pick([1, 5, 10]), price: int(0, 20) * 100 }]],
    [1, () => [HOST, 'transferStake', { kind, fromPlayerId: p, toPlayerId: q, pct: pick([1, 5, 10]), price: int(0, 20) * 100 }]],
    [!vote?.active && vote?.last?.decision !== 'pending' ? 3 : 1, () => [HOST, 'startVote', {
      template: pick(['profit_tax', 'civil_salary', 'price_cap', 'cap_off', 'city_fee', 'grant_off', 'custom']),
      target: pick(KINDS), value: pick([1, 5, 15, 25, 300, 900, 5000, -1]), question: 'Monkey?',
      seconds: pick([60, 120, 180, 300, 7]), rule: pick(['all', 'voted']) }]],
    [vote?.active ? 3 : 0, () => [HOST, pick(['closeVote', 'cancelVote']), { voteId: vote.active.id }]],
    [vote?.last?.decision === 'pending' ? 4 : 0, () => [HOST, 'decideVote', { voteId: vote.last.id, decision: pick(['sign', 'veto']) }]],
    [initiatives.length ? 3 : 0, () => {
      const i = pick(initiatives);
      return chance(0.6) ? [HOST, 'startVote', { initiativeId: i.id, seconds: 60, rule: 'all' }]
        : [HOST, 'rejectInitiative', { initiativeId: i.id }];
    }],
    [company ? 2 : 0, () => [HOST, 'cityProposePrice', { kind: company.kind,
      value: company.kind === 'bank' ? int(1, 40) : Math.round(company.price * (0.5 + R())) }]],
    [company?.open ? 3 : 0, () => [HOST, pick(['cityCompanyVote', 'cityCompanyVote', 'cancelCompanyDecision']),
      { decisionId: company.open.id, choice: pick(['yes', 'no']) }]],
    [offers.length ? 5 : 0, () => [HOST, 'cityAnswerOffer', { offerId: pick(offers).id,
      answer: pick(['accept', 'counter', 'reject', 'auction', 'auction']), price: int(1, 40) * 100 }]],
    [auctions.length ? 1 : 0, () => [HOST, 'cancelAuction', { auctionId: pick(auctions).id }]],
    [2, () => [HOST, 'updateConfig', { updates: { [pick(['RENT', 'INSURANCE', 'UTILITIES', 'LOAN_RATE_ANNUAL', 'PROFIT_TAX_RATE',
      'CIVIL_SERVICE_SALARY', 'DEMAND_PER_TEAM', 'MARKET_SIZE_PER_PLAYER', 'TOTAL_ROUNDS', 'P_REF'])]:
      chance(0.2) ? junk() : pick([0.1, 0.15, 0.3, 1500, 2500, 7000, 9000, 20000]) } }]],
    [1, () => [HOST, 'monitor', {}]]
  ];
  return weighted(options);
}

/** Мусор: случайное действие со случайными полями от случайного человека. */
function junkAction() {
  const names = ['submitDecision', 'requestLoan', 'transferMoney', 'castVote', 'proposePrice', 'companyVote', 'requestStake',
    'answerOffer', 'placeBid', 'proposeInitiative', 'startVote', 'decideVote', 'sellStake', 'cityAnswerOffer', 'cancelAuction',
    'updateConfig', 'setCityShare', 'dropTable', 'calculateRound', 'openRound', 'deleteGame', 'finishGame'];
  const who = pick([...TEAMS, HOST, STRANGER, null]);
  const action = pick(names);
  // Мусорное удаление и финал — только от тех, кому нельзя.
  const safeWho = ['deleteGame', 'finishGame', 'calculateRound', 'openRound'].includes(action) ? pick([...TEAMS, STRANGER, null]) : who;
  const params = Object.fromEntries(['offerId', 'auctionId', 'voteId', 'decisionId', 'initiativeId', 'playerId', 'toPlayerId',
    'kind', 'seller', 'pct', 'price', 'amount', 'value', 'template', 'target', 'answer', 'choice', 'decision', 'updates']
    .filter(() => chance(0.5)).map((k) => [k, junk()]));
  return [safeWho, action, params];
}

function weighted(options) {
  const live = options.filter(([w]) => w > 0);
  const total = live.reduce((a, [w]) => a + w, 0);
  let x = R() * total;
  for (const [w, make] of live) { x -= w; if (x <= 0) return make(); }
  return live[live.length - 1][1]();
}

/** Время вышло: голосование, решение акционеров, аукцион закроются при следующем запросе. */
async function timeTravel(gameId) {
  const what = pick(['votes', 'company_decisions', 'auctions']);
  await sql.unsafe(`update ${what} set closes_at = now() - interval '1 second' where game_id = $1 and status = 'open'`, [gameId]);
}

// ----------------------------------------------------------------- партия

async function playGame(seed) {
  R = rng(seed);
  const currency = pick(['USD', 'RUB', 'THB']);
  const g = await call(HOST, 'createGame', { title: 'Monkey ' + seed, league: 'start', region: 'north_america', country: 'US',
    currency, demandPerTeam: pick([1500, 2000, 2500]) });
  assert.equal(g.ok, true, 'createGame: ' + JSON.stringify(g));
  const gameId = g.gameId;
  const r = await call(HOST, 'setRoster', { gameId, emails: TEAMS.join('\n') });
  assert.equal(r.ok, true, 'setRoster');
  for (const [i, e] of TEAMS.entries()) {
    await call(e, 'setProfile', { gameId, displayName: 'Team ' + (i + 1), restaurantName: 'Monkey ' + (i + 1) });
  }
  const step = async (who, action, params) => act(seed, who, action, { gameId, ...params });

  // До старта — немного сделок и правок, как бывает на настоящей игре.
  for (let i = 0; i < 8; i++) {
    const m = await look(gameId);
    const [who, action, params] = chance(0.5) ? hostAction(gameId, m) : teamAction(gameId, m);
    await step(who, action, params);
  }
  await invariants(seed, gameId, 'до старта');

  for (let month = 1; month <= MONTHS; month++) {
    await step(HOST, 'openRound', {});
    let done = 0;
    while (done < ACTIONS) {
      const m = await look(gameId);
      if (!m) break;
      if (chance(0.06)) await timeTravel(gameId);
      // Пачка одновременных действий — гонки между командами и ведущим.
      const burst = chance(0.25) ? int(3, 6) : 1;
      const batch = Array.from({ length: burst }, () => {
        const x = R();
        return x < 0.62 ? teamAction(gameId, m) : x < 0.9 ? hostAction(gameId, m) : junkAction();
      });
      await Promise.all(batch.map(([who, action, params]) => step(who, action, params)));
      done += burst;
    }
    // Иногда «Рассчитать» нажимают дважды и одновременно с действиями команд.
    if (chance(0.3)) {
      const m = await look(gameId);
      await Promise.all([step(HOST, 'calculateRound', {}), step(HOST, 'calculateRound', {}),
        ...Array.from({ length: 3 }, () => { const [w, a, p] = teamAction(gameId, m); return step(w, a, p); })]);
    } else {
      await step(HOST, 'calculateRound', {});
    }
    // Месяц должен быть рассчитан.
    const [round] = await sql`select status from rounds where game_id = ${gameId} order by round_number desc limit 1`;
    if (round?.status === 'open') await step(HOST, 'calculateRound', {});
    await invariants(seed, gameId, 'месяц ' + month);
  }

  // Финал раньше срока, отчёт, рейтинг, «сыграть ещё раз».
  await step(HOST, 'finishGame', {});
  await invariants(seed, gameId, 'финал');
  const rep = await call(TEAMS[0], 'gameReport', { gameId });
  if (!rep.ok) failures.push(`seed ${seed}: отчёт не открылся: ${rep.error}`);
  const rating = await call(null, 'rating', { league: 'start' });
  if (!rating.ok) failures.push(`seed ${seed}: рейтинг: ${rating.error}`);
  const again = await call(HOST, 'playAgain', { gameId });
  if (!again.ok) failures.push(`seed ${seed}: сыграть ещё раз: ${again.error}`);
  return gameId;
}

// ----------------------------------------------------------------- запуск

console.log(`Обезьяний тест сервера: партий ${SEEDS} (seed ${SEED_FROM}…${SEED_FROM + SEEDS - 1}), ` +
  `месяцев ${MONTHS}, действий за месяц ${ACTIONS}`);
try {
  assert.equal((await call(ADMIN, 'addHost', { email: HOST })).ok, true);
  for (let seed = SEED_FROM; seed < SEED_FROM + SEEDS; seed++) {
    const started = Date.now();
    const before = failures.length;
    await playGame(seed);
    console.log(`  ${failures.length === before ? 'ok  ' : 'FAIL'} seed ${seed} · ${((Date.now() - started) / 1000).toFixed(1)} с`);
  }
} catch (e) {
  failures.push('партия прервалась: ' + (e.stack || e.message));
}

const top = [...stats.byAction.entries()].sort((a, b) => b[1].calls - a[1].calls)
  .map(([a, x]) => `${a} ${x.ok}/${x.calls}`).join(', ');
const codes = [...stats.codes.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ×${n}`).join(', ');
console.log(`\nВызовов: ${stats.calls}, успешных: ${stats.ok}.`);
console.log('Действия (успешно/всего): ' + top);
console.log('Отказы сервера (ожидаемые): ' + codes);
await sql.end();
if (failures.length) {
  console.log(`\nНАЙДЕНО ОШИБОК: ${failures.length}\n  ` + [...new Set(failures)].slice(0, 40).join('\n  '));
  process.exit(1);
}
console.log('\nОБЕЗЬЯНИЙ ТЕСТ СЕРВЕРА ПРОЙДЕН: ни одного падения, инварианты сходятся.');
