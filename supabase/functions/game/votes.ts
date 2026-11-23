// ============================================================================
//  Голосования — как в парламенте.
//
//  Ведущий выносит вопрос: закон по шаблону (налог на прибыль, аренда,
//  ставка по кредитам, зарплата на госслужбе), разовый сбор с работающих
//  ресторанов, разовый грант тем, кто вне бизнеса, — или свой вопрос.
//  Голосует каждая команда игры, кроме вышедших: «за», «против»,
//  «воздержался»; голос можно изменить до конца. Пока голосование идёт,
//  видно только, сколько команд проголосовало. Итог считается сам, когда
//  время вышло (при первом же запросе к игре), или когда ведущий завершил
//  голосование раньше:
//
//    «за» — N (…%), «против» — …, «воздержались» — …, «не голосовали» — …
//
//  Правило по умолчанию — как в Госдуме: принято, если «за» больше половины
//  всех команд. Можно выбрать «больше половины проголосовавших».
//  Принятое голосованием само не применяется: ведущий подписывает его или
//  накладывает вето. Подписанный закон вступает в силу со следующего
//  месяца (как правка ведущего), сбор и грант исполняются сразу. Пока
//  решение ждёт ведущего, новое голосование не начать. Месяц, в котором
//  голосовали, продлевается на время голосования.
// ============================================================================

import {
  type Sql, type Row, fail, num, currentRound, accountingRound, logHostAction, nested
} from './lib.ts';
import { editableFor } from './presets.ts';
import { updateConfig, massAdjust } from './host.ts';

type Template = { key?: string; mass?: 'tax_active' | 'grant_off_business'; unit?: 'pct' | 'money' };

/** Шаблоны вопросов: закон (настройка игры), разовый сбор или грант, свой вопрос. */
export const VOTE_TEMPLATES: Record<string, Template> = {
  profit_tax: { key: 'PROFIT_TAX_RATE', unit: 'pct' },
  rent: { key: 'RENT', unit: 'money' },
  loan_rate: { key: 'LOAN_RATE_ANNUAL', unit: 'pct' },
  civil_salary: { key: 'CIVIL_SERVICE_SALARY', unit: 'money' },
  city_fee: { mass: 'tax_active', unit: 'money' },
  grant_off: { mass: 'grant_off_business', unit: 'money' },
  custom: {}
};
/** Сколько длится голосование, секунд: 1, 2, 3 или 5 минут. */
export const VOTE_SECONDS = [60, 120, 180, 300];
const CHOICES = ['yes', 'no', 'abstain'];

/** Строка без лишних пробелов, не длиннее max; пустая — null. */
function text(v: unknown, max: number): string | null {
  const s = String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
  return s || null;
}

// ----------------------------------------------------------------- ведущий

/** Ведущий начинает голосование. Открыт месяц — он продлевается на столько же. */
export async function startVote(sql: Sql, game: Row, actor: string, b: Row) {
  if (game.status === 'finished') fail('game_finished');
  const template = String(b.template ?? '');
  const tpl = VOTE_TEMPLATES[template];
  if (!tpl) fail('bad_vote');
  const seconds = Number(b.seconds ?? 120);
  if (!VOTE_SECONDS.includes(seconds)) fail('bad_vote');
  const rule = b.rule === 'voted' ? 'voted' : 'all';
  let value: number | null = null;
  let question: string | null = null;
  if (template === 'custom') {
    question = text(b.question, 200);
    if (!question) fail('empty');
  } else {
    value = Number(b.value);
    if (!Number.isFinite(value)) fail('bad_vote');
    if (tpl.key) {
      // Тот же диапазон, что у правки ведущего; ставки — в процентах.
      const range = editableFor(game.currency)[tpl.key];
      const v = tpl.unit === 'pct' ? value / 100 : value;
      if (!range || v < range.min || v > range.max) {
        fail('vote_range', { min: tpl.unit === 'pct' ? range.min * 100 : range.min, max: tpl.unit === 'pct' ? range.max * 100 : range.max });
      }
    } else if (!(value > 0) || value > 1e9) fail('bad_vote');
  }

  return await sql.begin(async (tx: Sql) => {
    // Одно голосование за раз; закончившееся по времени закрываем сначала.
    await tx`select id from games where id = ${game.id} for update`;
    await closeDue(nested(tx), String(game.id));
    const [open] = await tx`select 1 from votes where game_id = ${game.id} and status = 'open'`;
    if (open) fail('vote_open');
    const [pending] = await tx`select 1 from votes where game_id = ${game.id} and decision = 'pending'`;
    if (pending) fail('vote_pending');
    const round = await currentRound(tx, game.id);
    const [v] = await tx`
      insert into votes ${tx({
        game_id: game.id, round_number: accountingRound(round), template, question, value, rule, seconds,
        closes_at: new Date(Date.now() + seconds * 1000), created_by: actor
      })} returning id`;
    // Время на голосование месяц не съедает: он продлевается ровно на столько же.
    if (round.status === 'open') {
      await tx`update rounds set deadline = deadline + make_interval(secs => ${seconds})
               where game_id = ${game.id} and round_number = ${round.round_number} and status = 'open'
                 and deadline is not null`;
    }
    await logHostAction(tx, game.id, actor, 'vote_start', { template, value, question, rule, seconds });
    return { ok: true, voteId: String(v.id) };
  });
}

/** Ведущий завершает голосование раньше времени: итог — по поданным голосам. */
export async function closeVote(sql: Sql, game: Row, actor: string, b: Row) {
  const id = String(b.voteId ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) fail('bad_params');
  const done = await finishVote(sql, id, String(game.id), actor);
  if (!done) fail('vote_closed');
  return { ok: true };
}

/**
 * Решение ведущего по принятому голосованием: подписать (закон вступает в
 * силу со следующего месяца, сбор или грант — сразу) или наложить вето.
 */
export async function decideVote(sql: Sql, game: Row, actor: string, b: Row) {
  const id = String(b.voteId ?? '');
  const decision = b.decision === 'sign' ? 'signed' : b.decision === 'veto' ? 'vetoed' : null;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !decision) fail('bad_params');
  return await sql.begin(async (tx: Sql) => {
    const [v] = await tx`select * from votes where id = ${id} and game_id = ${game.id} for update`;
    if (!v || v.decision !== 'pending') fail('vote_decided');
    let applied: Row | null = null;
    const tpl = VOTE_TEMPLATES[String(v.template)];
    if (decision === 'signed' && tpl && (tpl.key || tpl.mass)) {
      const [g] = await tx`select * from games where id = ${game.id} for update`;
      if (g.status === 'finished') fail('game_finished');
      const value = num(v.value);
      if (tpl.key) {
        const r = await updateConfig(tx, g, actor, { updates: { [tpl.key]: tpl.unit === 'pct' ? value / 100 : value } });
        applied = { config: r.applied, rejected: r.rejected };
      } else if (tpl.mass) {
        const r = await massAdjust(nested(tx), g, actor, { kind: tpl.mass, amount: value, reason: 'Vote ' + id.slice(0, 8) });
        applied = { teams: r.teams, total: r.total };
      }
    }
    await tx`update votes set decision = ${decision}, decided_at = now(), decided_by = ${actor},
      applied = ${applied ? tx.json(applied) : null} where id = ${id}`;
    await logHostAction(tx, game.id, actor, decision === 'signed' ? 'vote_sign' : 'vote_veto', { voteId: id, applied });
    return { ok: true, decision };
  });
}

/** Ведущий отменяет голосование: итога нет, ничего не применяется. */
export async function cancelVote(sql: Sql, game: Row, actor: string, b: Row) {
  const id = String(b.voteId ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) fail('bad_params');
  const [v] = await sql`update votes set status = 'cancelled', closed_at = now()
    where id = ${id} and game_id = ${game.id} and status = 'open' returning id`;
  if (!v) fail('vote_closed');
  await logHostAction(sql, game.id, actor, 'vote_cancel', { voteId: id });
  return { ok: true };
}

// ----------------------------------------------------------------- команда

/** Голос команды. До конца голосования его можно изменить. */
export async function castVote(sql: Sql, game: Row, playerId: string, b: Row) {
  const id = String(b.voteId ?? '');
  const choice = String(b.choice ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(id) || !CHOICES.includes(choice)) fail('bad_params');
  const [v] = await sql`select id from votes where id = ${id} and game_id = ${game.id}
    and status = 'open' and closes_at > now()`;
  if (!v) fail('vote_closed');
  const [p] = await sql`select status from players where id = ${playerId}`;
  if (!p || p.status === 'left') fail('not_active');
  await sql`
    insert into vote_ballots ${sql({ vote_id: id, game_id: game.id, player_id: playerId, choice })}
    on conflict (vote_id, player_id) do update set choice = excluded.choice, cast_at = now()`;
  return { ok: true };
}

// ----------------------------------------------------------------- итог

/** Голосования, у которых вышло время, — закрыть и посчитать. Вызывается при каждом запросе к игре. */
export async function closeDue(sql: Sql, gameId: string): Promise<void> {
  const due: Row[] = await sql`select id from votes where game_id = ${gameId} and status = 'open' and closes_at <= now()`;
  for (const v of due) await finishVote(sql, String(v.id), gameId, 'system');
}

/**
 * Подсчёт и решение. Голоса считаются у команд, которые в игре сейчас;
 * проценты — от всех команд. Принято: «за» больше половины всех команд
 * (rule = all) или больше половины проголосовавших (rule = voted).
 */
async function finishVote(sql: Sql, voteId: string, gameId: string, actor: string): Promise<boolean> {
  return await sql.begin(async (tx: Sql) => {
    const [v] = await tx`select * from votes where id = ${voteId} and game_id = ${gameId} for update`;
    if (!v || v.status !== 'open') return false;
    const players: Row[] = await tx`select id from players where game_id = ${gameId} and status <> 'left'`;
    const ids = new Set(players.map((p) => String(p.id)));
    const ballots: Row[] = await tx`select player_id, choice from vote_ballots where vote_id = ${voteId}`;
    const counted = ballots.filter((x) => ids.has(String(x.player_id)));
    const yes = counted.filter((x) => x.choice === 'yes').length;
    const no = counted.filter((x) => x.choice === 'no').length;
    const abstain = counted.filter((x) => x.choice === 'abstain').length;
    const total = ids.size;
    const voted = yes + no + abstain;
    const passed = v.rule === 'voted' ? yes * 2 > voted : yes * 2 > total;
    const result = { yes, no, abstain, notVoted: total - voted, total, passed };
    // Принятое ждёт ведущего: подписать или наложить вето (decideVote).
    await tx`update votes set status = 'closed', result = ${tx.json(result)},
      decision = ${passed ? 'pending' : null}, closed_at = now() where id = ${voteId}`;
    await logHostAction(tx, gameId, actor, 'vote_result', { voteId, ...result });
    return true;
  });
}

// ----------------------------------------------------------------- для экранов

function voteRow(v: Row) {
  return {
    id: String(v.id), template: String(v.template), question: v.question ?? null,
    value: v.value === null || v.value === undefined ? null : num(v.value),
    rule: String(v.rule), seconds: num(v.seconds), roundNumber: num(v.round_number),
    openedAt: v.opened_at, closesAt: v.closes_at,
    decision: v.decision ?? null, decidedAt: v.decided_at ?? null
  };
}

/**
 * Что показать: идущее голосование (без разбивки голосов — только сколько
 * проголосовало и голос этой команды) и последний итог.
 */
export async function voteState(sql: Sql, gameId: string, playerId: string | null) {
  const [open] = await sql`select * from votes where game_id = ${gameId} and status = 'open' limit 1`;
  // Последний итог; решение, которое ждёт ведущего, — всегда оно.
  const [last] = await sql`select * from votes where game_id = ${gameId} and status = 'closed'
    order by coalesce(decision = 'pending', false) desc, closed_at desc limit 1`;
  let active = null;
  if (open) {
    const [{ total, voted }] = await sql`
      select (select count(*) from players where game_id = ${gameId} and status <> 'left')::int as total,
             (select count(*) from vote_ballots b join players p on p.id = b.player_id
               where b.vote_id = ${open.id} and p.status <> 'left')::int as voted`;
    let mine = null;
    if (playerId) {
      const [m] = await sql`select choice from vote_ballots where vote_id = ${open.id} and player_id = ${playerId}`;
      mine = m ? String(m.choice) : null;
    }
    active = { ...voteRow(open), total: Number(total), voted: Number(voted), mine };
  }
  return {
    active,
    last: last ? { ...voteRow(last), result: last.result, applied: last.applied ?? null, closedAt: last.closed_at } : null,
    serverNow: new Date().toISOString()
  };
}

/** Все закончившиеся голосования игры — для отчёта. */
export async function voteHistory(sql: Sql, gameId: string) {
  const rows: Row[] = await sql`select * from votes where game_id = ${gameId} and status = 'closed' order by opened_at`;
  return rows.map((v) => ({ ...voteRow(v), result: v.result, applied: v.applied ?? null, closedAt: v.closed_at }));
}
