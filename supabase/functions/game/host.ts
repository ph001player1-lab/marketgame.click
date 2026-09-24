// ============================================================================
//  Пульт ведущего и администратора.
//
//  Ведущий создаёт игры, вносит почты команд, открывает и считает месяцы,
//  управляет городом: штрафы, гранты, налоги, доли города в арендодателе,
//  банке, страховой и коммунальщиках, продажа и выкуп долей. Администратор
//  назначает ведущих.
// ============================================================================

import { computeCapacity, type Config } from './economy.ts';
import {
  configForLeague, isLeague, EDITABLE_CONFIG, DEFAULT_CITY_SHARE_PCT, LEAGUES
} from './presets.ts';
import {
  type Sql, type Row, fail, num, cents, round2, normEmail, isEmail, currentRound, accountingRound,
  activeConfig, addLedger, addCity, addNotice, logHostAction, moneyTarget, available,
  OFF_BUSINESS, INSTITUTIONS, isInstitution, usd, teamLabel, STARTUP_LOAN_TIER
} from './lib.ts';
import { gameMeta, rulesFor, upcomingChanges } from './player.ts';
import { cityBudget, institutionsState } from './board.ts';

const INSTITUTION_NAMES: Record<string, string> = {
  landlord: 'the landlord', bank: 'the bank', insurer: 'the insurer', utility: 'the utility company'
};

// ----------------------------------------------------------------- администратор

export async function listHosts(sql: Sql, adminEmails: string[]) {
  const rows: Row[] = await sql`select email, added_by, created_at from hosts order by created_at`;
  return {
    ok: true,
    admins: adminEmails,
    hosts: rows.map((h) => ({ email: h.email, addedBy: h.added_by, addedAt: h.created_at }))
  };
}

export async function addHost(sql: Sql, actor: string, b: Row, ensureAuthUser: (e: string) => Promise<void>) {
  const email = normEmail(b.email);
  if (!isEmail(email)) fail('bad_email');
  await sql`insert into hosts (email, added_by) values (${email}, ${actor}) on conflict (email) do nothing`;
  await ensureAuthUser(email);
  await logHostAction(sql, null, actor, 'add_host', { email });
  return { ok: true, email };
}

export async function removeHost(sql: Sql, actor: string, b: Row) {
  const email = normEmail(b.email);
  await sql`delete from hosts where email = ${email}`;
  await logHostAction(sql, null, actor, 'remove_host', { email });
  return { ok: true, email };
}

// ----------------------------------------------------------------- игры

// Без похожих знаков: код читают с проектора в зале.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function newCode(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return [...bytes].map((x) => CODE_ALPHABET[x % CODE_ALPHABET.length]).join('');
}

function text(v: unknown, max: number): string | null {
  const s = String(v ?? '').trim().slice(0, max);
  return s || null;
}

function url(v: unknown): string | null {
  const s = text(v, 500);
  if (!s) return null;
  if (!/^https:\/\/[^\s"'<>]+$/i.test(s)) fail('bad_url');
  return s;
}

function validTimezone(v: unknown): string {
  const tz = String(v ?? 'America/New_York');
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    fail('bad_timezone');
  }
}

export async function createGame(sql: Sql, hostEmail: string, b: Row) {
  const title = text(b.title, 80);
  if (!title) fail('empty_title');
  if (!isLeague(b.league)) fail('bad_league');
  const league = b.league;
  const cfg = configForLeague(league);
  const scheduledAt = b.scheduledAt ? new Date(String(b.scheduledAt)) : null;
  if (scheduledAt && isNaN(scheduledAt.getTime())) fail('bad_date');

  return await sql.begin(async (tx: Sql) => {
    let code = newCode();
    for (let i = 0; i < 5; i++) {
      const [taken] = await tx`select 1 from games where code = ${code}`;
      if (!taken) break;
      code = newCode();
    }
    const [game] = await tx`insert into games ${tx({
      code, title, league, total_rounds: LEAGUES[league].months, practice: !!b.practice,
      host_email: hostEmail, organizer: text(b.organizer, 120),
      sponsor_name: text(b.sponsorName, 120), sponsor_logo_url: url(b.sponsorLogoUrl),
      sponsor_url: url(b.sponsorUrl), timezone: validTimezone(b.timezone),
      scheduled_at: scheduledAt, open_book: b.openBook === undefined ? true : !!b.openBook,
      config: tx.json(cfg)
    })} returning *`;
    await tx`update games set series_id = id where id = ${game.id}`;
    await tx`insert into institutions ${tx(INSTITUTIONS.map((kind) => ({
      game_id: game.id, kind, city_pct: DEFAULT_CITY_SHARE_PCT
    })))}`;
    await logHostAction(tx, game.id, hostEmail, 'create_game', { title, league });
    return { ok: true, gameId: String(game.id), code };
  });
}

export async function updateGame(sql: Sql, game: Row, actor: string, b: Row) {
  const upd: Row = {};
  if (b.title !== undefined) { upd.title = text(b.title, 80); if (!upd.title) fail('empty_title'); }
  if (b.organizer !== undefined) upd.organizer = text(b.organizer, 120);
  if (b.sponsorName !== undefined) upd.sponsor_name = text(b.sponsorName, 120);
  if (b.sponsorLogoUrl !== undefined) upd.sponsor_logo_url = url(b.sponsorLogoUrl);
  if (b.sponsorUrl !== undefined) upd.sponsor_url = url(b.sponsorUrl);
  if (b.timezone !== undefined) upd.timezone = validTimezone(b.timezone);
  if (b.scheduledAt !== undefined) {
    const d = b.scheduledAt ? new Date(String(b.scheduledAt)) : null;
    if (d && isNaN(d.getTime())) fail('bad_date');
    upd.scheduled_at = d;
  }
  if (b.openBook !== undefined) upd.open_book = !!b.openBook;
  if (b.practice !== undefined) {
    // Пометку Practice меняем только до первого месяца: иначе ведущий мог
    // бы вычеркнуть неудачную для кого-то игру из рейтинга задним числом.
    if (num(game.current_round) > 0) fail('game_started');
    upd.practice = !!b.practice;
  }
  if (!Object.keys(upd).length) return { ok: true };
  await sql`update games set ${sql(upd)} where id = ${game.id}`;
  await logHostAction(sql, game.id, actor, 'update_game', upd);
  return { ok: true };
}

export async function deleteGame(sql: Sql, game: Row, actor: string) {
  const [played] = await sql`select 1 from rounds where game_id = ${game.id} and status = 'closed' limit 1`;
  if (played) fail('game_has_history');
  await sql`delete from games where id = ${game.id}`;
  await logHostAction(sql, null, actor, 'delete_game', { gameId: game.id, title: game.title });
  return { ok: true };
}

/**
 * Состав игры. Переданный список почт — итоговый: кого нет, того добавляем,
 * кого убрали из списка — удаляем. Команду с сыгранными месяцами не
 * удаляем: порвалась бы история на табло. Об этом сообщаем ведущему.
 */
export async function setRoster(sql: Sql, game: Row, actor: string, b: Row,
                                ensureAuthUser: (e: string) => Promise<void>) {
  const raw: unknown[] = Array.isArray(b.emails)
    ? b.emails
    : String(b.emails ?? '').split(/[\s,;]+/);
  const wanted: string[] = [];
  const skipped: Record<string, string> = {};
  for (const item of raw) {
    const e = normEmail(item);
    if (!e) continue;
    if (!isEmail(e)) { skipped[e] = 'not an email'; continue; }
    if (e === game.host_email) { skipped[e] = 'the host cannot play in own game'; continue; }
    if (wanted.includes(e)) { skipped[e] = 'repeated'; continue; }
    wanted.push(e);
  }
  if (wanted.length > 40) fail('too_many_teams', { max: 40 });

  const result = await sql.begin(async (tx: Sql) => {
    const round = await currentRound(tx, game.id);
    const cfg = activeConfig(game, round);
    const existing: Row[] = await tx`select id, email from players where game_id = ${game.id}`;
    const have = new Map(existing.map((p) => [String(p.email), String(p.id)]));

    // Прошлые данные команды подставляем, чтобы не вводить заново.
    const added: string[] = [];
    for (const e of wanted) {
      if (have.has(e)) continue;
      const [prev] = await tx`
        select display_name, restaurant_name, location_kind, location_state, location_country
        from players where email = ${e} order by created_at desc limit 1`;
      const [p] = await tx`insert into players ${tx({
        game_id: game.id, email: e, cash: cfg.START_CAPITAL, reputation: 1, status: 'active',
        loan_tier: STARTUP_LOAN_TIER,
        display_name: prev?.display_name ?? null, restaurant_name: prev?.restaurant_name ?? null,
        location_kind: prev?.location_kind ?? null, location_state: prev?.location_state ?? null,
        location_country: prev?.location_country ?? null
      })} returning id`;
      await addLedger(tx, [{
        game_id: game.id, player_id: p.id, round_number: accountingRound(round),
        kind: 'start_capital', amount: cfg.START_CAPITAL, target: 'cash',
        reason: 'Starting capital', actor
      }]);
      added.push(e);
    }

    const removed: string[] = [];
    const kept: Record<string, string> = {};
    for (const [e, id] of have) {
      if (wanted.includes(e)) continue;
      const [played] = await tx`
        select 1 from results where player_id = ${id}
        union all select 1 from wallet_entries where player_id = ${id} limit 1`;
      if (played) { kept[e] = 'already played — removing would break the history'; continue; }
      await tx`delete from players where id = ${id}`;
      removed.push(e);
    }
    await logHostAction(tx, game.id, actor, 'roster', { added, removed, kept, skipped });
    return { ok: true, total: wanted.length, added, removed, kept, skipped };
  });

  // Вход по коду возможен только для заведённых в Supabase Auth почт.
  for (const e of result.added) await ensureAuthUser(e);
  return result;
}

// ----------------------------------------------------------------- пульт

export async function monitor(sql: Sql, game: Row) {
  const round = await currentRound(sql, game.id);
  const cfg = activeConfig(game, round);
  const players: Row[] = await sql`select * from players where game_id = ${game.id} order by created_at, id`;
  const submitted: Row[] = await sql`
    select player_id from decisions
    where game_id = ${game.id} and round_number = ${round.round_number} and not autoplay`;
  const sub = new Set(submitted.map((s) => String(s.player_id)));

  return {
    ok: true,
    game: { ...gameMeta(game, round), hostEmail: String(game.host_email) },
    rules: rulesFor(cfg),
    upcomingChanges: await upcomingChanges(sql, game, round),
    config: game.config,
    editable: EDITABLE_CONFIG,
    players: players.map((p) => {
      const off = OFF_BUSINESS.includes(String(p.status));
      const noBiz = p.status !== 'active';
      return {
        id: String(p.id), email: String(p.email), restaurant: p.restaurant_name ?? null,
        displayName: p.display_name ?? null, status: String(p.status),
        location: { kind: p.location_kind ?? null, state: p.location_state ?? null, country: p.location_country ?? null },
        profileDone: !!(p.display_name && p.restaurant_name && p.location_kind),
        // Вне бизнеса касса по определению ноль: показываем накопления.
        money: off ? num(p.employment_savings) : num(p.cash), offBusiness: off,
        brand: noBiz ? null : round2(num(p.brand)),
        capacity: noBiz ? null : computeCapacity(cfg, num(p.capacity_shifts)),
        loanBalance: num(p.loan_balance), loanTier: num(p.loan_tier),
        submitted: round.status === 'open' && p.status === 'active' ? sub.has(String(p.id)) : null
      };
    }),
    city: await cityBudget(sql, game.id),
    institutions: await institutionsState(sql, game.id)
  };
}

export async function updateConfig(sql: Sql, game: Row, actor: string, b: Row) {
  const updates = (b.updates && typeof b.updates === 'object') ? b.updates as Row : {};
  const cfg = { ...(game.config as Row) };
  const applied: Record<string, number> = {};
  const rejected: Record<string, string> = {};
  for (const [key, raw] of Object.entries(updates)) {
    const rule = EDITABLE_CONFIG[key];
    if (!rule) { rejected[key] = 'not editable'; continue; }
    const v = Number(raw);
    if (!Number.isFinite(v)) { rejected[key] = 'not a number'; continue; }
    if (rule.int && !Number.isInteger(v)) { rejected[key] = 'must be a whole number'; continue; }
    if (v < rule.min || v > rule.max) { rejected[key] = `allowed ${rule.min}–${rule.max}`; continue; }
    cfg[key] = v;
    applied[key] = v;
  }
  if (Object.keys(applied).length) {
    await sql`update games set config = ${sql.json(cfg)} where id = ${game.id}`;
    await logHostAction(sql, game.id, actor, 'config', applied);
    game.config = cfg;
  }
  return { ok: true, applied, rejected, effective: 'next month' };
}

// ----------------------------------------------------------------- город

/**
 * Штраф или грант одной команде. Деньги ложатся туда, где команда их
 * держит: работающему бизнесу — в кассу, остальным — в накопления.
 * Накопления в минус не уходят: город получает столько, сколько взял.
 */
export async function adjust(sql: Sql, game: Row, actor: string, b: Row) {
  const playerId = String(b.playerId ?? '');
  const amount = cents(num(b.amount));
  const reason = text(b.reason, 200);
  if (!playerId || !amount) fail('bad_params');
  return await sql.begin(async (tx: Sql) => {
    const round = await currentRound(tx, game.id);
    const rn = accountingRound(round);
    const [p] = await tx`select * from players where id = ${playerId} and game_id = ${game.id} for update`;
    if (!p) fail('player_not_found');
    if (p.status === 'left') fail('player_left');
    const target = moneyTarget(p.status);
    const col = target === 'cash' ? 'cash' : 'employment_savings';
    const before = num(p[col]);
    const afterV = target === 'savings' ? Math.max(0, before + amount) : before + amount;
    const actual = cents(afterV - before);
    await tx`update players set ${tx({ [col]: cents(afterV) })} where id = ${playerId}`;

    // Штраф больше кассы уводит бизнес в минус, но город получает только
    // то, что было в кассе: денег из воздуха не бывает. Неоплаченный остаток
    // спишется вместе с долгами, если бизнес закроется.
    const kind = amount < 0 ? 'fine' : 'grant';
    const collected = kind === 'fine' ? Math.min(-actual, Math.max(0, before)) : -actual;
    await addLedger(tx, [{ game_id: game.id, player_id: playerId, round_number: rn, kind,
      amount: actual, target, reason, actor }]);
    await addCity(tx, [{ game_id: game.id, round_number: rn, kind, amount: collected,
      player_id: playerId, reason, actor }]);
    await addNotice(tx, game.id, playerId, rn, kind,
      (kind === 'fine' ? 'City fine ' + usd(-actual) : 'City grant ' + usd(actual)) + (reason ? '. ' + reason : '.'));
    await logHostAction(tx, game.id, actor, kind, { amount: actual, target }, reason, playerId);
    return { ok: true, applied: actual, target };
  });
}

/** Налог со всех работающих ресторанов или грант всем, кто вне бизнеса. */
export async function massAdjust(sql: Sql, game: Row, actor: string, b: Row) {
  const kind = String(b.kind ?? '');
  const amount = cents(num(b.amount));
  const reason = text(b.reason, 200);
  if (!['tax_active', 'grant_off_business'].includes(kind) || !(amount > 0)) fail('bad_params');
  return await sql.begin(async (tx: Sql) => {
    const round = await currentRound(tx, game.id);
    const rn = accountingRound(round);
    const rows: Row[] = kind === 'tax_active'
      ? await tx`select * from players where game_id = ${game.id} and status = 'active' for update`
      : await tx`select * from players where game_id = ${game.id} and status = any(${OFF_BUSINESS}) for update`;
    // Сколько город реально получил (налог) или выплатил (грант).
    let total = 0;
    for (const p of rows) {
      if (kind === 'tax_active') {
        // Как и штраф: город получает только то, что было в кассе.
        total = cents(total + Math.min(amount, Math.max(0, num(p.cash))));
        await tx`update players set cash = ${cents(num(p.cash) - amount)} where id = ${p.id}`;
        await addLedger(tx, [{ game_id: game.id, player_id: p.id, round_number: rn, kind: 'city_tax',
          amount: -amount, target: 'cash', reason, actor }]);
        await addNotice(tx, game.id, p.id, rn, 'city_tax', 'City tax ' + usd(amount) + (reason ? '. ' + reason : '.'));
      } else {
        total = cents(total + amount);
        await tx`update players set employment_savings = ${cents(num(p.employment_savings) + amount)} where id = ${p.id}`;
        await addLedger(tx, [{ game_id: game.id, player_id: p.id, round_number: rn, kind: 'grant',
          amount, target: 'savings', reason, actor }]);
        await addNotice(tx, game.id, p.id, rn, 'grant', 'City grant ' + usd(amount) + (reason ? '. ' + reason : '.'));
      }
    }
    await addCity(tx, [{ game_id: game.id, round_number: rn,
      kind: kind === 'tax_active' ? 'city_tax' : 'grant',
      amount: kind === 'tax_active' ? total : -total, reason, actor }]);
    await logHostAction(tx, game.id, actor, kind, { amount, teams: rows.length }, reason);
    return { ok: true, teams: rows.length, total };
  });
}

// ----------------------------------------------------------------- доли

async function lockInstitution(tx: Sql, gameId: string, kind: string) {
  if (!isInstitution(kind)) fail('bad_institution');
  const [inst] = await tx`select * from institutions where game_id = ${gameId} and kind = ${kind} for update`;
  if (!inst) fail('bad_institution');
  const [{ total }] = await tx`
    select coalesce(sum(pct), 0) as total from stakes where game_id = ${gameId} and kind = ${kind}`;
  return { inst, playersPct: num(total) };
}

function pctOf(v: unknown): number {
  const p = round2(num(v));
  if (!(p > 0) || p > 100) fail('bad_pct');
  return p;
}

/** Доля города задаётся ведущим. Проданные игрокам доли она не трогает. */
export async function setCityShare(sql: Sql, game: Row, actor: string, b: Row) {
  const pct = round2(num(b.pct, -1));
  if (pct < 0 || pct > 100) fail('bad_pct');
  return await sql.begin(async (tx: Sql) => {
    const { playersPct } = await lockInstitution(tx, game.id, String(b.kind));
    if (pct + playersPct > 100.0001) fail('over_100', { maxCityPct: round2(100 - playersPct) });
    await tx`update institutions set city_pct = ${pct} where game_id = ${game.id} and kind = ${b.kind}`;
    await logHostAction(tx, game.id, actor, 'city_share', { kind: b.kind, pct });
    return { ok: true, kind: b.kind, cityPct: pct };
  });
}

async function changeStake(tx: Sql, gameId: string, kind: string, playerId: string, delta: number) {
  const [s] = await tx`
    select pct from stakes where game_id = ${gameId} and kind = ${kind} and player_id = ${playerId} for update`;
  const next = round2(num(s?.pct) + delta);
  if (next < -0.0001) fail('not_enough_stake', { has: num(s?.pct) });
  if (next <= 0.0001) {
    await tx`delete from stakes where game_id = ${gameId} and kind = ${kind} and player_id = ${playerId}`;
  } else if (s) {
    await tx`update stakes set pct = ${next} where game_id = ${gameId} and kind = ${kind} and player_id = ${playerId}`;
  } else {
    await tx`insert into stakes (game_id, kind, player_id, pct) values (${gameId}, ${kind}, ${playerId}, ${next})`;
  }
}

async function lockBuyer(tx: Sql, gameId: string, playerId: string): Promise<Row> {
  const [p] = await tx`select * from players where id = ${playerId} and game_id = ${gameId} for update`;
  if (!p) fail('player_not_found');
  if (p.status === 'left' || p.status === 'bankrupt') fail('player_cannot_trade');
  return p;
}

async function moveMoney(tx: Sql, p: Row, delta: number) {
  const col = moneyTarget(p.status) === 'cash' ? 'cash' : 'employment_savings';
  await tx`update players set ${tx({ [col]: cents(num(p[col]) + delta) })} where id = ${p.id}`;
}

/** Город продаёт команде часть своей доли. Деньги — в бюджет, дивиденды — команде. */
export async function sellStake(sql: Sql, game: Row, actor: string, b: Row) {
  const kind = String(b.kind);
  const pct = pctOf(b.pct);
  const price = cents(num(b.price, -1));
  if (price < 0) fail('bad_price');
  return await sql.begin(async (tx: Sql) => {
    const round = await currentRound(tx, game.id);
    const rn = accountingRound(round);
    const { inst } = await lockInstitution(tx, game.id, kind);
    if (num(inst.city_pct) + 0.0001 < pct) fail('city_has_less', { cityPct: num(inst.city_pct) });
    const p = await lockBuyer(tx, game.id, String(b.playerId));
    if (available(p) < price) fail('insufficient_cash', { available: available(p) });

    await tx`update institutions set city_pct = ${round2(num(inst.city_pct) - pct)}
             where game_id = ${game.id} and kind = ${kind}`;
    await changeStake(tx, game.id, kind, String(p.id), pct);
    await moveMoney(tx, p, -price);
    const reason = `${pct}% of ${INSTITUTION_NAMES[kind]}`;
    await addLedger(tx, [{ game_id: game.id, player_id: p.id, round_number: rn, kind: 'stake_buy',
      amount: -price, target: moneyTarget(p.status), reason: 'Bought ' + reason, actor }]);
    await addCity(tx, [{ game_id: game.id, round_number: rn, kind: 'stake_sale', amount: price,
      player_id: p.id, institution: kind, reason: 'Sold ' + reason, actor }]);
    await addNotice(tx, game.id, p.id, rn, 'stake',
      `You bought ${reason} for ${usd(price)}. Its profit share is paid to you every month.`);
    await logHostAction(tx, game.id, actor, 'sell_stake', { kind, pct, price }, null, p.id);
    return { ok: true };
  });
}

/** Город выкупает долю у команды. Бюджет может уйти в минус — это дефицит. */
export async function buybackStake(sql: Sql, game: Row, actor: string, b: Row) {
  const kind = String(b.kind);
  const pct = pctOf(b.pct);
  const price = cents(num(b.price, -1));
  if (price < 0) fail('bad_price');
  return await sql.begin(async (tx: Sql) => {
    const round = await currentRound(tx, game.id);
    const rn = accountingRound(round);
    const { inst } = await lockInstitution(tx, game.id, kind);
    const [p] = await tx`select * from players where id = ${String(b.playerId)} and game_id = ${game.id} for update`;
    if (!p) fail('player_not_found');
    await changeStake(tx, game.id, kind, String(p.id), -pct);
    await tx`update institutions set city_pct = ${round2(num(inst.city_pct) + pct)}
             where game_id = ${game.id} and kind = ${kind}`;
    const target = p.status === 'left' ? null : moneyTarget(p.status);
    if (target) {
      await moveMoney(tx, p, price);
      await addLedger(tx, [{ game_id: game.id, player_id: p.id, round_number: rn, kind: 'stake_sell',
        amount: price, target, reason: `Sold ${pct}% of ${INSTITUTION_NAMES[kind]} to the city`, actor }]);
    }
    await addCity(tx, [{ game_id: game.id, round_number: rn, kind: 'stake_buyback', amount: -price,
      player_id: p.id, institution: kind, reason: `Bought back ${pct}% of ${INSTITUTION_NAMES[kind]}`, actor }]);
    await addNotice(tx, game.id, p.id, rn, 'stake',
      `The city bought back ${pct}% of ${INSTITUTION_NAMES[kind]} from you for ${usd(price)}.`);
    await logHostAction(tx, game.id, actor, 'buyback_stake', { kind, pct, price }, null, p.id);
    return { ok: true };
  });
}

/** Сделка между командами — через ведущего, как запись в реестре. */
export async function transferStake(sql: Sql, game: Row, actor: string, b: Row) {
  const kind = String(b.kind);
  const pct = pctOf(b.pct);
  const price = cents(num(b.price, -1));
  const fromId = String(b.fromPlayerId ?? '');
  const toId = String(b.toPlayerId ?? '');
  if (price < 0) fail('bad_price');
  if (!fromId || !toId || fromId === toId) fail('bad_params');
  return await sql.begin(async (tx: Sql) => {
    const round = await currentRound(tx, game.id);
    const rn = accountingRound(round);
    await lockInstitution(tx, game.id, kind);
    const locked: Row[] = await tx`
      select * from players where id in (${fromId}, ${toId}) and game_id = ${game.id} order by id for update`;
    const seller = locked.find((x) => String(x.id) === fromId);
    const buyer = locked.find((x) => String(x.id) === toId);
    if (!seller || !buyer) fail('player_not_found');
    if (buyer.status === 'left' || buyer.status === 'bankrupt') fail('player_cannot_trade');
    if (seller.status === 'left') fail('player_cannot_trade');
    if (available(buyer) < price) fail('insufficient_cash', { available: available(buyer) });

    await changeStake(tx, game.id, kind, fromId, -pct);
    await changeStake(tx, game.id, kind, toId, pct);
    await moveMoney(tx, buyer, -price);
    await moveMoney(tx, seller, price);
    const what = `${pct}% of ${INSTITUTION_NAMES[kind]}`;
    await addLedger(tx, [
      { game_id: game.id, player_id: toId, round_number: rn, kind: 'stake_buy', amount: -price,
        target: moneyTarget(buyer.status), reason: `Bought ${what} from ${teamLabel(seller)}`, actor },
      { game_id: game.id, player_id: fromId, round_number: rn, kind: 'stake_sell', amount: price,
        target: moneyTarget(seller.status), reason: `Sold ${what} to ${teamLabel(buyer)}`, actor }
    ]);
    await addNotice(tx, game.id, toId, rn, 'stake', `You bought ${what} from ${teamLabel(seller)} for ${usd(price)}.`);
    await addNotice(tx, game.id, fromId, rn, 'stake', `You sold ${what} to ${teamLabel(buyer)} for ${usd(price)}.`);
    await logHostAction(tx, game.id, actor, 'transfer_stake', { kind, pct, price, fromId, toId });
    return { ok: true };
  });
}

// ----------------------------------------------------------------- финал

/**
 * Закрыть игру и обновить рейтинг. Последний месяц лиги закрывает игру сам;
 * кнопка нужна, чтобы закончить раньше, — тогда игра в рейтинг не идёт.
 */
export async function finishGame(sql: Sql, game: Row, actor: string) {
  const round = await currentRound(sql, game.id);
  if (round.status === 'open') fail('round_open');
  const early = num(round.round_number) < num(game.total_rounds);
  await sql`update games set status = 'finished', finished_at = coalesce(finished_at, now())
            where id = ${game.id}`;
  await logHostAction(sql, game.id, actor, 'finish', { round: num(round.round_number), early });
  const [{ rated }] = await sql`select game_is_rated(${game.id}) as rated`;
  return { ok: true, rated: !!rated, early };
}

/** Сыграть ещё раз: новая игра с теми же настройками и составом. */
export async function playAgain(sql: Sql, game: Row, actor: string,
                                ensureAuthUser: (e: string) => Promise<void>) {
  const created = await createGame(sql, String(game.host_email), {
    title: game.title, league: game.league, practice: game.practice, organizer: game.organizer,
    sponsorName: game.sponsor_name, sponsorLogoUrl: game.sponsor_logo_url, sponsorUrl: game.sponsor_url,
    timezone: game.timezone, openBook: game.open_book
  });
  const newId = created.gameId;
  // Настройки, которые ведущий подкрутил, переносим; длина — по лиге.
  const cfg = { ...(game.config as Config), TOTAL_ROUNDS: num(game.total_rounds) };
  await sql`update games set config = ${sql.json(cfg)}, series_id = ${game.series_id ?? game.id}
            where id = ${newId}`;
  const [fresh] = await sql`select * from games where id = ${newId}`;
  const players: Row[] = await sql`select email from players where game_id = ${game.id} order by created_at, id`;
  await setRoster(sql, fresh, actor, { emails: players.map((p) => p.email) }, ensureAuthUser);
  await logHostAction(sql, game.id, actor, 'play_again', { newGameId: newId });
  return { ok: true, gameId: newId, code: created.code };
}
