// ============================================================================
//  Маршрутизация запросов функции game.
//
//  Все запросы — POST с JSON: { action, gameId?, ...параметры }. Вход — токен
//  Supabase Auth в заголовке Authorization. Табло, рейтинг, отчёт по ссылке и
//  проверка почты перед входом открыты без токена.
//
//  Действие возвращает уже пересчитанное состояние (поле state): клиенту не
//  нужен второй запрос, а значит нет гонки с фоновым опросом — как в v4.9.
// ============================================================================

import { type Deps, type Row, ApiError, fail, normEmail, isEmail } from './lib.ts';
import * as P from './player.ts';
import * as H from './host.ts';
import * as B from './board.ts';
import { openMonth, calculateMonth } from './round.ts';

export const VERSION = '5.0';

interface Me { email: string; isAdmin: boolean; isHost: boolean }

type PlayerAction = (deps: Deps, game: Row, playerId: string, b: Row, actor: string) => Promise<Row>;
type HostAction = (deps: Deps, game: Row, b: Row, actor: string) => Promise<Row>;

const PLAYER_ACTIONS: Record<string, PlayerAction> = {
  dashboard: (d, g, pid, _b, _a) => Promise.resolve({}),   // особый случай, см. ниже
  setProfile: (d, g, pid, b) => P.setProfile(d.sql, g, pid, b),
  markNoticesRead: (d, _g, pid) => P.markNoticesRead(d.sql, pid),
  submitDecision: (d, g, pid, b) => P.submitDecision(d.sql, g, pid, b),
  requestLoan: (d, g, pid, b, a) => P.requestLoan(d.sql, g, pid, b, a),
  repayLoan: (d, g, pid, b, a) => P.repayLoan(d.sql, g, pid, b, a),
  transferMoney: (d, g, pid, b, a) => P.transferMoney(d.sql, g, pid, b, a),
  chooseCareerPath: (d, g, pid, b, a) => P.chooseCareerPath(d.sql, g, pid, b, a),
  reopenBusiness: (d, g, pid, _b, a) => P.reopenBusiness(d.sql, g, pid, a),
  proposeEmployment: (d, g, pid, b) => P.proposeEmployment(d.sql, g, pid, b),
  respondToEmployment: (d, g, pid, b) => P.respondToEmployment(d.sql, g, pid, b),
  paySalary: (d, g, pid, b, a) => P.paySalary(d.sql, g, pid, b, a)
};

const HOST_ACTIONS: Record<string, HostAction> = {
  monitor: () => Promise.resolve({}),                        // особый случай, см. ниже
  updateGame: (d, g, b, a) => H.updateGame(d.sql, g, a, b),
  deleteGame: (d, g, _b, a) => H.deleteGame(d.sql, g, a),
  setRoster: (d, g, b, a) => H.setRoster(d.sql, g, a, b, d.ensureAuthUser),
  openRound: (d, g) => openMonth(d.sql, g.id),
  calculateRound: (d, g) => calculateMonth(d.sql, g.id),
  adjust: (d, g, b, a) => H.adjust(d.sql, g, a, b),
  massAdjust: (d, g, b, a) => H.massAdjust(d.sql, g, a, b),
  updateConfig: (d, g, b, a) => H.updateConfig(d.sql, g, a, b),
  setCityShare: (d, g, b, a) => H.setCityShare(d.sql, g, a, b),
  sellStake: (d, g, b, a) => H.sellStake(d.sql, g, a, b),
  buybackStake: (d, g, b, a) => H.buybackStake(d.sql, g, a, b),
  transferStake: (d, g, b, a) => H.transferStake(d.sql, g, a, b),
  finishGame: (d, g, _b, a) => H.finishGame(d.sql, g, a),
  playAgain: (d, g, _b, a) => H.playAgain(d.sql, g, a, d.ensureAuthUser)
};

// Действия, после которых клиенту не нужно состояние: игра удалена или
// создана новая.
const NO_STATE = new Set(['deleteGame', 'playAgain']);

// ----------------------------------------------------------------- HTTP

function corsHeaders(origin: string | null, allowed: string[]): Record<string, string> {
  const allow = !allowed.length ? '*' : (origin && allowed.includes(origin) ? origin : allowed[0]);
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Vary': 'Origin'
  };
}

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' }
  });
}

export function createHandler(deps: Deps) {
  return async (req: Request): Promise<Response> => {
    const cors = corsHeaders(req.headers.get('origin'), deps.allowedOrigins);
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
    if (req.method !== 'POST') return json({ ok: true, service: 'marketgame', version: VERSION }, 200, cors);

    let body: Row;
    try {
      body = await req.json();
    } catch {
      return json({ ok: false, error: 'bad_request' }, 400, cors);
    }
    if (!body || typeof body.action !== 'string') return json({ ok: false, error: 'bad_request' }, 400, cors);

    const auth = req.headers.get('authorization') ?? '';
    const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';

    try {
      return json(await route(deps, body, token), 200, cors);
    } catch (e) {
      if (e instanceof ApiError) return json({ ok: false, error: e.code, ...e.details }, 200, cors);
      console.error(e);
      return json({ ok: false, error: 'server_error' }, 500, cors);
    }
  };
}

// ----------------------------------------------------------------- маршруты

async function identity(deps: Deps, email: string): Promise<Me> {
  const isAdmin = deps.adminEmails.includes(email);
  const [h] = await deps.sql`select 1 from hosts where email = ${email}`;
  return { email, isAdmin, isHost: isAdmin || !!h };
}

/**
 * Можно ли выслать код на эту почту. Код уходит только тем, кого внёс
 * ведущий или администратор, — самостоятельной регистрации нет.
 */
async function preflightLogin(deps: Deps, b: Row) {
  const email = normEmail(b.email);
  if (!isEmail(email)) fail('bad_email');
  const me = await identity(deps, email);
  let allowed = me.isHost;
  if (!allowed) {
    const [p] = await deps.sql`select 1 from players where email = ${email} limit 1`;
    allowed = !!p;
  }
  if (!allowed) fail('not_registered');
  await deps.ensureAuthUser(email);
  return { ok: true };
}

async function route(deps: Deps, b: Row, token: string): Promise<Row> {
  const { sql } = deps;
  const action = b.action as string;

  switch (action) {
    case 'ping': return { ok: true, version: VERSION };
    case 'board': return await B.board(sql, b);
    case 'rating': return await B.rating(sql, b);
    case 'report': return await B.publicReport(sql, b);
    case 'preflightLogin': return await preflightLogin(deps, b);
  }

  const email = token ? await deps.verifyToken(token) : null;
  if (!email) fail('auth_required');
  const me = await identity(deps, normEmail(email));

  switch (action) {
    case 'me':
      return { ok: true, email: me.email, isAdmin: me.isAdmin, isHost: me.isHost,
               ...(await B.myGames(sql, me.email, me.isAdmin)) };
    case 'listHosts':
      if (!me.isAdmin) fail('not_admin');
      return await H.listHosts(sql, deps.adminEmails);
    case 'addHost':
      if (!me.isAdmin) fail('not_admin');
      return { ...(await H.addHost(sql, me.email, b, deps.ensureAuthUser)),
               state: await H.listHosts(sql, deps.adminEmails) };
    case 'removeHost':
      if (!me.isAdmin) fail('not_admin');
      return { ...(await H.removeHost(sql, me.email, b)),
               state: await H.listHosts(sql, deps.adminEmails) };
    case 'createGame':
      if (!me.isHost) fail('not_host');
      return await H.createGame(sql, me.email, b);
  }

  // ---- всё остальное — внутри конкретной игры
  const gameId = String(b.gameId ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(gameId)) fail('bad_game');
  const [game] = await sql`select * from games where id = ${gameId}`;
  if (!game) fail('game_not_found');
  const isGameHost = me.isAdmin || game.host_email === me.email;

  if (action === 'gameReport') {
    const [p] = await sql`select id from players where game_id = ${gameId} and email = ${me.email}`;
    if (!p && !isGameHost) fail('not_in_game');
    return await B.gameReport(sql, game, p ? String(p.id) : null, isGameHost);
  }

  if (HOST_ACTIONS[action]) {
    if (!isGameHost) fail('not_host');
    if (action === 'monitor') return await H.monitor(sql, game);
    const result = await once(deps, b, game.id, me.email, action,
      () => HOST_ACTIONS[action](deps, game, b, me.email));
    if (NO_STATE.has(action) || result.ok !== true) return result;
    const [fresh] = await sql`select * from games where id = ${gameId}`;
    return { ...result, state: await H.monitor(sql, fresh) };
  }

  if (PLAYER_ACTIONS[action]) {
    // Ведущий может открыть кабинет любой команды своей игры: посмотреть,
    // что у неё происходит, или сыграть за неё при обкатке.
    let playerId: string;
    let impersonating = false;
    if (b.asPlayerId && isGameHost) {
      const [p] = await sql`select id from players where id = ${String(b.asPlayerId)} and game_id = ${gameId}`;
      if (!p) fail('player_not_found');
      playerId = String(p.id);
      impersonating = true;
    } else {
      const [p] = await sql`select id from players where game_id = ${gameId} and email = ${me.email}`;
      if (!p) fail('not_in_game');
      playerId = String(p.id);
    }
    if (action === 'dashboard') return await P.dashboard(sql, game, playerId, impersonating);
    if (game.status === 'finished' && !['setProfile', 'markNoticesRead'].includes(action)) fail('game_finished');

    const actor = impersonating ? me.email + ' (host)' : me.email;
    const result = await once(deps, b, game.id, me.email, action,
      () => PLAYER_ACTIONS[action](deps, game, playerId, b, actor));
    if (result.ok !== true) return result;
    const [fresh] = await sql`select * from games where id = ${gameId}`;
    return { ...result, state: await P.dashboard(sql, fresh, playerId, impersonating) };
  }

  fail('unknown_action');
}

/**
 * Защита от повторов. Клиент присылает requestId на каждое нажатие; повтор
 * того же запроса при обрыве связи вернёт сохранённый ответ, а не спишет
 * деньги второй раз.
 */
async function once(deps: Deps, b: Row, gameId: string, email: string, action: string,
                    run: () => Promise<Row>): Promise<Row> {
  const id = typeof b.requestId === 'string' && /^[0-9a-f-]{36}$/i.test(b.requestId) ? b.requestId : null;
  if (!id) return await run();

  const [seen] = await deps.sql`select result from mutations where id = ${id}`;
  if (seen) return seen.result ?? { ok: false, error: 'duplicate_request' };
  const [claimed] = await deps.sql`
    insert into mutations (id, game_id, email, action) values (${id}, ${gameId}, ${email}, ${action})
    on conflict (id) do nothing returning id`;
  if (!claimed) return { ok: false, error: 'duplicate_request' };

  let result: Row;
  try {
    result = await run();
  } catch (e) {
    if (e instanceof ApiError) result = { ok: false, error: e.code, ...e.details };
    else { await deps.sql`delete from mutations where id = ${id}`; throw e; }
  }
  await deps.sql`update mutations set result = ${deps.sql.json(result)} where id = ${id}`;
  return result;
}
