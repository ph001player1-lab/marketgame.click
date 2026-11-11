// ============================================================================
//  Заявки на игру по QR-коду.
//
//  Ведущий показывает QR-код со ссылкой на игру (#/join/<код игры>). Игрок
//  вводит почту и название ресторана — без кода на почту — и ждёт. Ведущий
//  видит заявки в пульте, принимает отмеченные или удаляет лишние. Принятая
//  заявка становится командой игры, а браузер, подавший её, играет по своему
//  ключу: только в этой игре и пока она идёт. Позже — вход по коду на почту,
//  как обычно: почта уже внесена.
//
//  Ключ видит только браузер игрока; в базе — его хеш.
// ============================================================================

import {
  type Sql, type Row, fail, normEmail, isEmail, currentRound, activeConfig, logHostAction
} from './lib.ts';
import { addPlayers } from './host.ts';

const MAX_TEAMS = 40;

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function newToken(): string {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

const tokenOk = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);

async function gameByCode(sql: Sql, code: unknown): Promise<Row> {
  const c = String(code ?? '').trim().toUpperCase();
  if (!/^[A-Z0-9]{3,12}$/.test(c)) fail('bad_code');
  const [game] = await sql`select * from games where code = ${c}`;
  if (!game) fail('game_not_found');
  return game;
}

/** Что показать на странице заявки: название игры, ведущий, язык. Без почт. */
export async function joinInfo(sql: Sql, b: Row) {
  const game = await gameByCode(sql, b.code);
  return {
    ok: true,
    game: {
      id: String(game.id), code: String(game.code), title: String(game.title), organizer: game.organizer ?? null,
      language: String(game.language ?? 'en'), status: String(game.status), finished: game.status === 'finished'
    }
  };
}

/**
 * Заявка: почта и название ресторана. Повторная заявка с той же почты
 * заменяет прежнюю (и её устройство). Возвращает ключ этого браузера.
 */
export async function joinRequest(sql: Sql, b: Row) {
  const game = await gameByCode(sql, b.code);
  if (game.status === 'finished') fail('game_finished');
  const email = normEmail(b.email);
  if (!isEmail(email)) fail('bad_email');
  const restaurant = String(b.restaurantName ?? '').trim().slice(0, 60);
  if (!restaurant) fail('empty');
  if (email === game.host_email) fail('join_host');

  const token = newToken();
  const hash = await sha256(token);
  await sql.begin(async (tx: Sql) => {
    // Одна заявка за другой в этой игре — по очереди: лимит команд и
    // занятые названия считаются честно.
    await tx`select id from games where id = ${game.id} for update`;
    const [mine] = await tx`select 1 from players where game_id = ${game.id} and email = ${email}`;
    if (mine) fail('already_in_game');
    const [taken] = await tx`
      select 1 from players where game_id = ${game.id} and lower(restaurant_name) = lower(${restaurant})
      union all
      select 1 from join_requests where game_id = ${game.id} and status = 'pending' and email <> ${email}
        and lower(restaurant_name) = lower(${restaurant})
      limit 1`;
    if (taken) fail('restaurant_taken');
    const [{ n }] = await tx`
      select (select count(*) from players where game_id = ${game.id})
           + (select count(*) from join_requests where game_id = ${game.id} and status = 'pending' and email <> ${email})::int as n`;
    if (Number(n) >= MAX_TEAMS) fail('too_many_teams', { max: MAX_TEAMS });
    await tx`
      insert into join_requests ${tx({ game_id: game.id, email, restaurant_name: restaurant, token_hash: hash })}
      on conflict (game_id, email) do update set
        restaurant_name = excluded.restaurant_name, token_hash = excluded.token_hash, created_at = now()`;
  });
  return { ok: true, token, gameId: String(game.id), title: String(game.title) };
}

/** Что с заявкой этого браузера: ждёт ведущего или принята. */
export async function joinStatus(sql: Sql, b: Row) {
  if (!tokenOk(b.token)) fail('join_gone');
  const [r] = await sql`
    select jr.status, jr.game_id, jr.email, jr.restaurant_name, g.title, g.status as game_status
    from join_requests jr join games g on g.id = jr.game_id
    where jr.token_hash = ${await sha256(b.token)}`;
  if (!r) fail('join_gone');
  return {
    ok: true, status: String(r.status), gameId: String(r.game_id), email: String(r.email),
    restaurant: String(r.restaurant_name), title: String(r.title), finished: r.game_status === 'finished'
  };
}

/** Кто играет по ключу браузера: почта и игра. Только принятая заявка в идущей игре. */
export async function joinIdentity(sql: Sql, token: unknown): Promise<{ email: string; gameId: string } | null> {
  if (!tokenOk(token)) return null;
  const [r] = await sql`
    select jr.email, jr.game_id from join_requests jr
    join games g on g.id = jr.game_id
    where jr.token_hash = ${await sha256(token)} and jr.status = 'approved'
      and jr.player_id is not null and g.status <> 'finished'`;
  return r ? { email: String(r.email), gameId: String(r.game_id) } : null;
}

/** Заявки, которые ждут ведущего, — для пульта. */
export async function pendingJoins(sql: Sql, gameId: string) {
  const rows: Row[] = await sql`
    select id, email, restaurant_name, created_at from join_requests
    where game_id = ${gameId} and status = 'pending' order by created_at, id`;
  return rows.map((r) => ({
    id: String(r.id), email: String(r.email), restaurant: String(r.restaurant_name), createdAt: r.created_at
  }));
}

/** Ведущий принимает отмеченные заявки: они становятся командами игры. */
export async function approveJoins(sql: Sql, game: Row, actor: string, b: Row,
                                   ensureAuthUser: (e: string) => Promise<void>) {
  const ids = (Array.isArray(b.ids) ? b.ids : []).map(String).filter((x) => /^[0-9a-f-]{36}$/i.test(x));
  if (!ids.length) fail('bad_params');
  const added = await sql.begin(async (tx: Sql) => {
    if (game.status === 'finished') fail('game_finished');
    const rows: Row[] = await tx`
      select * from join_requests
      where game_id = ${game.id} and status = 'pending' and id = any(${ids}::uuid[])
      order by created_at for update`;
    if (!rows.length) return [];
    const [{ n }] = await tx`select count(*)::int as n from players where game_id = ${game.id}`;
    if (Number(n) + rows.length > MAX_TEAMS) fail('too_many_teams', { max: MAX_TEAMS });
    const round = await currentRound(tx, game.id);
    const cfg = activeConfig(game, round);
    // Почту могли уже внести списком, а название — занять: тогда команда
    // уже есть или вводит название сама при входе.
    const existing: Row[] = await tx`select email, restaurant_name from players where game_id = ${game.id}`;
    const have = new Set(existing.map((p) => String(p.email)));
    const names = new Set(existing.map((p) => String(p.restaurant_name ?? '').toLowerCase()).filter(Boolean));
    const emails = await addPlayers(tx, game, cfg, round, actor, rows
      .filter((r) => !have.has(String(r.email)))
      .map((r) => {
        const name = String(r.restaurant_name);
        const free = !names.has(name.toLowerCase());
        names.add(name.toLowerCase());
        return { email: String(r.email), restaurant: free ? name : null };
      }));
    const players: Row[] = await tx`
      select id, email from players where game_id = ${game.id} and email = any(${rows.map((r) => String(r.email))})`;
    const idOf = new Map(players.map((p) => [String(p.email), String(p.id)]));
    for (const r of rows) {
      await tx`update join_requests set status = 'approved', player_id = ${idOf.get(String(r.email)) ?? null},
        decided_at = now() where id = ${r.id}`;
    }
    await logHostAction(tx, game.id, actor, 'join_approve', { added: emails });
    return emails;
  });
  // Вход по коду на почту — только для заведённых в Supabase Auth почт.
  for (let i = 0; i < added.length; i += 5) {
    await Promise.all(added.slice(i, i + 5).map((e: string) => ensureAuthUser(e)));
  }
  return { ok: true, approved: added.length };
}

/** Ведущий удаляет заявку. Браузер игрока увидит, что заявки больше нет. */
export async function dropJoin(sql: Sql, game: Row, actor: string, b: Row) {
  const id = String(b.id ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) fail('bad_params');
  const [r] = await sql`delete from join_requests where id = ${id} and game_id = ${game.id} and status = 'pending'
    returning email`;
  if (r) await logHostAction(sql, game.id, actor, 'join_drop', { email: String(r.email) });
  return { ok: true };
}
