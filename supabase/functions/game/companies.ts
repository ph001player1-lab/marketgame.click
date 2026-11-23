// ============================================================================
//  Решения акционеров — цены компаний.
//
//  Цену услуги компании решают её владельцы, а не голосование горожан:
//
//    арендодатель — аренда (RENT),      страховая — страховка (INSURANCE),
//    коммунальщики — коммунальные (UTILITIES), банк — ставка по кредитам
//    (LOAN_RATE_ANNUAL).
//
//  Владельцы — команды с долями и город: долей города голосует ведущий.
//  Частные владельцы и вышедшие из игры команды не голосуют.
//
//  • Больше 50% — контрольный пакет: владелец сам ставит цену. У владельца
//    больше 30% (блокирующий пакет) есть 3 минуты, чтобы её запретить —
//    вето. Блокирующего пакета ни у кого нет — цена принята сразу.
//  • Контрольного пакета нет — собрание акционеров на 3 минуты. Предложить
//    может любой владелец, голоса весят по долям: принято, если «за» больше
//    50% всех долей компании. «Против» владельца больше 30% — вето.
//
//  Реестр владельцев — на момент предложения, как «дата отсечки» у
//  настоящих собраний. Принятая цена вступает в силу со следующего месяца.
//  Закон «Потолок цены» (голосование горожан, votes.ts) ограничивает цену
//  сверху: выше потолка не предложить, а цену выше нового потолка закон
//  сам снижает до потолка.
//
//  Напрямую, в настройках, ведущий меняет эти цены, только пока город
//  владеет больше чем половиной компании и ни у одной команды нет больше
//  30% (host.ts, updateConfig).
// ============================================================================

import {
  type Sql, type Row, type InstitutionKind, fail, num, cents, round2, currentRound, accountingRound,
  logHostAction, teamLabel, isInstitution, INSTITUTIONS, nested, lockGame
} from './lib.ts';
import { editableFor } from './presets.ts';

/** Цена услуги каждой компании — настройка игры. */
export const COMPANY_PRICE: Record<InstitutionKind, string> = {
  landlord: 'RENT', bank: 'LOAN_RATE_ANNUAL', insurer: 'INSURANCE', utility: 'UTILITIES'
};
/** Потолок цены по закону горожан — тоже в настройках игры; нет ключа — потолка нет. */
export const CAP_KEY: Record<InstitutionKind, string> = {
  landlord: 'RENT_CAP', bank: 'LOAN_RATE_CAP', insurer: 'INSURANCE_CAP', utility: 'UTILITIES_CAP'
};
/** Какая компания решает эту настройку. */
export const KIND_OF_PRICE: Record<string, InstitutionKind> = Object.fromEntries(
  Object.entries(COMPANY_PRICE).map(([k, v]) => [v, k as InstitutionKind]));

/** Контрольный пакет — больше 50%, блокирующий — больше 30%. */
export const CONTROL_PCT = 50;
export const BLOCK_PCT = 30;
/** Сколько длится собрание и окно вето, секунд. */
export const DECISION_SECONDS = 180;
const EPS = 1e-6;
const CITY = 'city';

/** Ставка банка задаётся в процентах, остальные цены — деньгами. */
export const unitOf = (kind: string): 'pct' | 'money' => kind === 'bank' ? 'pct' : 'money';
/** Из того, что ввели (12 — это 12%), — в единицы настройки (0.12). */
export function toConfig(kind: string, v: number): number {
  return unitOf(kind) === 'pct' ? Math.round(v * 100) / 10000 : cents(v);
}
/** Из единиц настройки — в то, что показываем. */
export function toShown(kind: string, v: number): number {
  return unitOf(kind) === 'pct' ? Math.round(v * 1_000_000) / 10000 : v;
}

/** Допустимая цена компании — тот же диапазон, что у правки ведущего. */
export function priceRange(game: Row, kind: InstitutionKind) {
  const r = editableFor(game.currency)[COMPANY_PRICE[kind]];
  return { min: r.min, max: r.max };
}

export function capOf(cfg: Row, kind: InstitutionKind): number | null {
  const v = cfg?.[CAP_KEY[kind]];
  return v === undefined || v === null ? null : num(v);
}

// ----------------------------------------------------------------- владельцы

export interface Owner { id: string; label: string | null; pct: number }
export interface Ownership {
  owners: Owner[];        // кто голосует: город и команды в игре, по убыванию доли
  passivePct: number;     // частные владельцы и вышедшие команды — не голосуют
}

/** Владельцы каждой компании сейчас. */
export async function ownership(sql: Sql, gameId: string): Promise<Record<string, Ownership>> {
  const [insts, stakes]: Row[][] = await Promise.all([
    sql`select kind, city_pct from institutions where game_id = ${gameId}`,
    sql`select s.kind, s.pct, p.id, p.status, p.restaurant_name, p.display_name
        from stakes s join players p on p.id = s.player_id
        where s.game_id = ${gameId} order by s.pct desc, p.created_at`
  ]);
  const out: Record<string, Ownership> = {};
  for (const inst of insts) {
    const kind = String(inst.kind);
    const owners: Owner[] = [];
    if (num(inst.city_pct) > 0) owners.push({ id: CITY, label: null, pct: num(inst.city_pct) });
    for (const s of stakes) {
      if (s.kind !== kind || s.status === 'left' || !(num(s.pct) > 0)) continue;
      owners.push({ id: String(s.id), label: teamLabel(s), pct: num(s.pct) });
    }
    owners.sort((a, b) => b.pct - a.pct);
    const voting = owners.reduce((a, o) => a + o.pct, 0);
    out[kind] = { owners, passivePct: round2(Math.max(0, 100 - voting)) };
  }
  return out;
}

/** Кто что может: контрольный пакет, блокирующие пакеты, собрание. */
export function rights(st: Ownership) {
  const controller = st.owners.find((o) => o.pct > CONTROL_PCT + EPS) ?? null;
  const blockers = st.owners.filter((o) => o.pct > BLOCK_PCT + EPS && o !== controller);
  const votingPct = st.owners.reduce((a, o) => a + o.pct, 0);
  return {
    mode: controller ? 'control' as const : 'meeting' as const,
    controller, blockers,
    // Собрание может принять решение, только если голосующих долей больше 50%.
    canDecide: votingPct > CONTROL_PCT + EPS
  };
}

/** Может ли ведущий поменять цену прямо в настройках: город — контроль, блокирующих пакетов нет. */
export function hostMayEdit(st: Ownership | undefined): boolean {
  if (!st) return true;
  const r = rights(st);
  return r.controller?.id === CITY && r.blockers.length === 0;
}

// ----------------------------------------------------------------- решение

/** Итог решения по поданным голосам; null — ещё не ясно. */
function outcome(d: Row, ballots: Row[], expired: boolean) {
  const owners = d.owners as Owner[];
  const choice = new Map(ballots.map((b) => [String(b.owner), String(b.choice)]));
  const sum = (list: Owner[]) => round2(list.reduce((a, o) => a + o.pct, 0));
  const yesPct = sum(owners.filter((o) => choice.get(o.id) === 'yes'));
  const noPct = sum(owners.filter((o) => choice.get(o.id) === 'no'));
  const leftPct = sum(owners.filter((o) => !choice.has(o.id)));
  // Право вето — у владельцев больше 30%, кроме того, кто предложил.
  const vetoers = owners.filter((o) => o.pct > BLOCK_PCT + EPS && o.id !== d.proposer);
  const vetoBy = vetoers.filter((o) => choice.get(o.id) === 'no').map((o) => o.id);
  const vetoPending = vetoers.some((o) => !choice.has(o.id));
  const result = { yesPct, noPct, notVotedPct: leftPct, needPct: CONTROL_PCT, vetoBy };
  let status: string | null = null;
  if (vetoBy.length) status = 'vetoed';
  else if (d.mode === 'control') status = !vetoPending || expired ? 'passed' : null;
  else if (yesPct > CONTROL_PCT + EPS && (!vetoPending || expired)) status = 'passed';
  else if (expired || yesPct + leftPct <= CONTROL_PCT + EPS) status = 'rejected';
  return { status, result };
}

/** Закрыть решение; принятую цену — в настройки игры (со следующего месяца). */
async function settle(tx: Sql, d: Row, status: string, result: Row, actor: string) {
  let applied: Row | null = null;
  if (status === 'passed') {
    const kind = d.kind as InstitutionKind;
    const key = COMPANY_PRICE[kind];
    const [g] = await tx`select config from games where id = ${d.game_id} for update`;
    const cap = capOf(g.config as Row, kind);
    // Потолок, принятый, пока шло решение, тоже действует.
    const value = cap !== null ? Math.min(num(d.value), cap) : num(d.value);
    await tx`update games set config = config || ${tx.json({ [key]: value })} where id = ${d.game_id}`;
    applied = { key, value, capped: value < num(d.value) };
  }
  await tx`update company_decisions set status = ${status}, result = ${tx.json(result)},
    applied = ${applied ? tx.json(applied) : null}, closed_at = now() where id = ${d.id}`;
  await logHostAction(tx, String(d.game_id), actor, 'company_' + status,
    { decisionId: String(d.id), kind: d.kind, value: num(d.value), ...result, applied });
}

/** Решения, у которых вышло время, — закрыть. Вызывается при каждом запросе к игре. */
export async function closeDue(sql: Sql, gameId: string): Promise<number> {
  const due: Row[] = await sql`select id from company_decisions
    where game_id = ${gameId} and status = 'open' and closes_at <= now()`;
  let n = 0;
  for (const x of due) {
    n += await sql.begin(async (tx: Sql) => {
      await lockGame(tx, gameId);
      const [d] = await tx`select * from company_decisions where id = ${x.id} for update`;
      if (!d || d.status !== 'open') return 0;
      const ballots: Row[] = await tx`select owner, choice from company_ballots where decision_id = ${d.id}`;
      const { status, result } = outcome(d, ballots, true);
      await settle(tx, d, status ?? 'rejected', result, 'system');
      return 1;
    });
  }
  return n;
}

/**
 * Предложить новую цену компании. proposer — 'city' (ведущий за город)
 * или id команды. value — как вводят: ставка в процентах, цены деньгами.
 */
export async function propose(sql: Sql, game: Row, proposer: string, actor: string, b: Row) {
  if (game.status === 'finished') fail('game_finished');
  const kind = String(b.kind ?? '');
  if (!isInstitution(kind)) fail('bad_institution');
  const shown = Number(b.value);
  if (b.value === null || b.value === undefined || b.value === '' || !Number.isFinite(shown)) fail('bad_price');
  const value = toConfig(kind, shown);
  const range = priceRange(game, kind);
  if (value < range.min - EPS || value > range.max + EPS) {
    if (unitOf(kind) === 'pct') fail('rate_range', { fromPct: toShown(kind, range.min), toPct: toShown(kind, range.max) });
    fail('price_range', { min: range.min, max: range.max });
  }
  const gameId = String(game.id);
  return await sql.begin(async (tx: Sql) => {
    const [g] = await tx`select * from games where id = ${gameId} for update`;
    await closeDue(nested(tx), gameId);
    const [open] = await tx`select 1 from company_decisions where game_id = ${gameId} and kind = ${kind} and status = 'open'`;
    if (open) fail('company_busy');
    const cfg = g.config as Row;
    const key = COMPANY_PRICE[kind];
    const current = num(cfg[key]);
    if (Math.abs(value - current) < EPS) fail('same_price');
    const cap = capOf(cfg, kind);
    if (cap !== null && value > cap + EPS) {
      if (unitOf(kind) === 'pct') fail('over_rate_cap', { capPct: toShown(kind, cap) });
      fail('over_cap', { max: cap });
    }

    const st = (await ownership(tx, gameId))[kind];
    const me = st?.owners.find((o) => o.id === proposer);
    if (!st || !me) fail('not_owner');
    const r = rights(st);
    if (r.mode === 'control' && r.controller!.id !== proposer) {
      fail('not_controller', { controllerPct: r.controller!.pct });
    }
    if (r.mode === 'meeting' && !r.canDecide) fail('no_quorum');

    const round = await currentRound(tx, gameId);
    // Контроль без блокирующих пакетов — вето некому наложить: принято сразу.
    const instant = r.mode === 'control' && r.blockers.length === 0;
    const [d] = await tx`
      insert into company_decisions ${tx({
        game_id: gameId, kind, round_number: accountingRound(round), mode: r.mode, value, old_value: current,
        proposer, owners: tx.json(st.owners), created_by: actor,
        closes_at: new Date(Date.now() + (instant ? 0 : DECISION_SECONDS * 1000))
      })} returning *`;
    await tx`insert into company_ballots ${tx({ decision_id: d.id, game_id: gameId, owner: proposer, choice: 'yes' })}`;
    await logHostAction(tx, gameId, actor, 'company_propose', { decisionId: String(d.id), kind, value, mode: r.mode, proposer });
    const { status, result } = outcome(d, [{ owner: proposer, choice: 'yes' }], instant);
    if (status) await settle(tx, d, status, result, actor);
    return { ok: true, decisionId: String(d.id), status: status ?? 'open' };
  });
}

/**
 * Голос владельца по решению: 'yes' или 'no'. При контрольном пакете
 * голосуют только владельцы блокирующих пакетов: «против» — вето,
 * «за» — не возражаю. Голос можно изменить, пока решение открыто.
 */
export async function castBallot(sql: Sql, game: Row, voter: string, actor: string, b: Row) {
  const id = String(b.decisionId ?? '');
  const choice = String(b.choice ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(id) || !['yes', 'no'].includes(choice)) fail('bad_params');
  return await sql.begin(async (tx: Sql) => {
    const [d] = await tx`select * from company_decisions where id = ${id} and game_id = ${game.id} for update`;
    if (!d || d.status !== 'open' || new Date(d.closes_at).getTime() <= Date.now()) fail('decision_closed');
    const owner = (d.owners as Owner[]).find((o) => o.id === voter);
    if (!owner || voter === d.proposer) fail('not_owner');
    if (d.mode === 'control' && !(owner.pct > BLOCK_PCT + EPS)) fail('no_veto_right');
    await tx`
      insert into company_ballots ${tx({ decision_id: id, game_id: game.id, owner: voter, choice })}
      on conflict (decision_id, owner) do update set choice = excluded.choice, cast_at = now()`;
    const ballots: Row[] = await tx`select owner, choice from company_ballots where decision_id = ${id}`;
    const { status, result } = outcome(d, ballots, false);
    if (status) await settle(tx, d, status, result, actor);
    return { ok: true, status: status ?? 'open' };
  });
}

/** Ведущий снимает решение (например, ошиблись в цене): ничего не применяется. */
export async function cancelDecision(sql: Sql, game: Row, actor: string, b: Row) {
  const id = String(b.decisionId ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) fail('bad_params');
  const [d] = await sql`update company_decisions set status = 'cancelled', closed_at = now()
    where id = ${id} and game_id = ${game.id} and status = 'open' returning id`;
  if (!d) fail('decision_closed');
  await logHostAction(sql, game.id, actor, 'company_cancel', { decisionId: id });
  return { ok: true };
}

/**
 * Закон «Потолок цены» (подписанное голосование горожан): потолок цены
 * компании; null — потолок снят. Цена выше потолка снижается до него —
 * со следующего месяца, как любая правка настроек.
 */
export async function setCap(tx: Sql, gameId: string, kind: InstitutionKind, cap: number | null) {
  const [g] = await tx`select config from games where id = ${gameId} for update`;
  const cfg = g.config as Row;
  const key = COMPANY_PRICE[kind];
  if (cap === null) {
    await tx`update games set config = config - ${CAP_KEY[kind]}::text where id = ${gameId}`;
    return { kind, cap: null };
  }
  const price = num(cfg[key]);
  const patch: Row = { [CAP_KEY[kind]]: cap };
  if (price > cap + EPS) patch[key] = cap;
  await tx`update games set config = config || ${tx.json(patch)} where id = ${gameId}`;
  return { kind, cap, ...(price > cap + EPS ? { lowered: { from: price, to: cap } } : {}) };
}

// ----------------------------------------------------------------- для экранов

function decisionOut(d: Row, ballots: Row[]) {
  const owners = d.owners as Owner[];
  const label = (id: string) => id === CITY ? null : (owners.find((o) => o.id === id)?.label ?? null);
  const mine = ballots.filter((b) => String(b.decision_id) === String(d.id));
  const live = d.status === 'open' ? outcome(d, mine, false).result : null;
  return {
    id: String(d.id), kind: String(d.kind), mode: String(d.mode), status: String(d.status),
    value: num(d.value), oldValue: d.old_value === null ? null : num(d.old_value),
    roundNumber: num(d.round_number),
    proposer: { id: String(d.proposer), city: d.proposer === CITY, label: label(String(d.proposer)) },
    owners: owners.map((o) => ({ id: o.id, city: o.id === CITY, label: o.label, pct: o.pct,
      veto: o.pct > BLOCK_PCT + EPS && o.id !== d.proposer,
      choice: (mine.find((b) => String(b.owner) === o.id)?.choice as string | undefined) ?? null })),
    openedAt: d.opened_at, closesAt: d.closes_at, closedAt: d.closed_at ?? null,
    result: d.result ?? live, applied: d.applied ?? null
  };
}

/**
 * Компании для экранов: владельцы и их права, цена (со следующего месяца),
 * потолок, идущее решение и последнее закончившееся. viewer — 'city' для
 * ведущего, id команды для команды, null для табло.
 */
export async function companiesState(sql: Sql, game: Row, viewer: string | null) {
  const gameId = String(game.id);
  const [owned, open, last]: [Record<string, Ownership>, Row[], Row[]] = await Promise.all([
    ownership(sql, gameId),
    sql`select * from company_decisions where game_id = ${gameId} and status = 'open'`,
    sql`select distinct on (kind) * from company_decisions
        where game_id = ${gameId} and status in ('passed', 'rejected', 'vetoed')
        order by kind, closed_at desc`
  ]);
  const ballots: Row[] = open.length
    ? await sql`select decision_id, owner, choice from company_ballots where decision_id = any(${open.map((d) => d.id)})`
    : [];
  const cfg = game.config as Row;
  return INSTITUTIONS.map((kind) => {
    const st = owned[kind] ?? { owners: [], passivePct: 100 };
    const r = rights(st);
    const d = open.find((x) => x.kind === kind);
    const l = last.find((x) => x.kind === kind);
    const me = viewer ? st.owners.find((o) => o.id === viewer) ?? null : null;
    const role = !me ? null : r.controller === me ? 'control' : me.pct > BLOCK_PCT + EPS ? 'block' : 'vote';
    const openOut = d ? decisionOut(d, ballots) : null;
    const myVote = openOut && viewer ? openOut.owners.find((o) => o.id === viewer) ?? null : null;
    return {
      kind, key: COMPANY_PRICE[kind], unit: unitOf(kind),
      price: num(cfg[COMPANY_PRICE[kind]]), cap: capOf(cfg, kind),
      range: priceRange(game, kind),
      owners: st.owners.map((o) => ({ id: o.id, city: o.id === CITY, label: o.label, pct: o.pct,
        role: r.controller === o ? 'control' : o.pct > BLOCK_PCT + EPS ? 'block' : 'vote' })),
      passivePct: st.passivePct,
      mode: r.mode, canDecide: r.mode === 'control' || r.canDecide,
      controller: r.controller ? { id: r.controller.id, city: r.controller.id === CITY, label: r.controller.label, pct: r.controller.pct } : null,
      hostMayEdit: hostMayEdit(st),
      myPct: me?.pct ?? 0, myRole: role,
      canPropose: !!me && game.status !== 'finished' && !d
        && (r.mode === 'control' ? r.controller === me : r.canDecide),
      open: openOut,
      // Голосовать может владелец из реестра решения (кроме предложившего);
      // при контрольном пакете — только с блокирующим пакетом.
      canVote: !!openOut && !!myVote && openOut.proposer.id !== viewer
        && (openOut.mode === 'meeting' || myVote.pct > BLOCK_PCT + EPS),
      mine: myVote?.choice ?? null,
      last: l ? decisionOut(l, []) : null
    };
  });
}

/** Все закончившиеся решения игры — для отчёта. */
export async function decisionHistory(sql: Sql, gameId: string) {
  const rows: Row[] = await sql`select * from company_decisions
    where game_id = ${gameId} and status in ('passed', 'rejected', 'vetoed') order by opened_at`;
  return rows.map((d) => decisionOut(d, []));
}
