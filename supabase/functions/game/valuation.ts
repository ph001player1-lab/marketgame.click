// ============================================================================
//  Оценка компаний и долей — капитализация дохода.
//
//  Арендодатель, банк, страховая и коммунальщики стоят, как настоящий
//  бизнес: сколько денег нужно положить под ставку по кредитам игры, чтобы
//  получать такую же прибыль.
//
//    стоимость компании = прибыль в месяц × 12 ÷ ставка по кредитам
//
//  Прибыль — средняя за последние три рассчитанных месяца, не меньше нуля;
//  ставка — не меньше 1%. Пока месяцев не было — прогноз по правилам игры:
//  аренда (страховка, коммунальные) × работающие рестораны, у банка —
//  проценты по выданным кредитам.
//
//  Доля команды входит в её капитал: доля × стоимость компании. Каждый
//  месяц при расчёте оценка записывается (institution_months.value), а
//  стоимость долей команды на конец месяца — в results / wallet_entries.
//  В играх, рассчитанных до этой правки, оценок нет — доли там не
//  считаются, итоги не меняются.
// ============================================================================

import { type Sql, type Row, num, cents, INSTITUTIONS } from './lib.ts';
import type { Config } from './economy.ts';

/** Ставка ниже этой не берётся: при нулевой ставке оценка была бы бесконечной. */
export const MIN_RATE = 0.01;

/** Стоимость компании: прибыль в месяц × 12 ÷ ставка по кредитам. */
export function companyValue(monthlyProfit: number, rate: number): number {
  return cents((Math.max(0, monthlyProfit) * 12) / Math.max(MIN_RATE, Number(rate) || 0));
}

/** Прибыль компании в месяц по правилам — пока ни одного месяца не рассчитано. */
export function forecastProfit(kind: string, cfg: Config, active: number, loans: number): number {
  if (kind === 'landlord') return cfg.RENT * active;
  if (kind === 'insurer') return (cfg.INSURANCE ?? 0) * active;
  if (kind === 'utility') return (cfg.UTILITIES ?? 0) * active;
  if (kind === 'bank') return (loans * cfg.LOAN_RATE_ANNUAL) / 12;
  return 0;
}

export interface Valuation {
  kind: string;
  value: number;           // стоимость 100% компании
  monthlyProfit: number;   // прибыль в месяц, из которой оценка
  months: number;          // за сколько месяцев средняя; 0 — прогноз
  rate: number;            // ставка по кредитам, по которой оценка
  legacy?: boolean;        // игра рассчитана до правки — доли не в капитале
}

/**
 * Оценка компаний сейчас — та же, что записана при расчёте последнего
 * месяца; месяцев ещё нет — прогноз по нынешним правилам.
 */
export async function valuations(sql: Sql, game: Row): Promise<Record<string, Valuation>> {
  const gameId = String(game.id);
  const cfg = game.config as Config;
  const [rows, [last], [p]]: Row[][] = await Promise.all([
    sql`select kind, round_number, profit, value from institution_months
        where game_id = ${gameId} order by round_number desc`,
    sql`select config from rounds where game_id = ${gameId} and status = 'closed'
        order by round_number desc limit 1`,
    sql`select count(*) filter (where status = 'active')::int as active,
               coalesce(sum(loan_balance) filter (where status in ('active', 'bankrupt')), 0) as loans
        from players where game_id = ${gameId}`
  ]);
  const out: Record<string, Valuation> = {};
  for (const kind of INSTITUTIONS) {
    const mine = rows.filter((r) => r.kind === kind);
    if (mine.length) {
      const recent = mine.slice(0, 3);
      const monthly = recent.reduce((a, r) => a + num(r.profit), 0) / recent.length;
      const rate = num((last?.config as Row | undefined)?.LOAN_RATE_ANNUAL ?? cfg.LOAN_RATE_ANNUAL);
      const legacy = mine[0].value === null || mine[0].value === undefined;
      out[kind] = { kind, value: legacy ? 0 : num(mine[0].value), monthlyProfit: cents(monthly), months: recent.length,
        rate, ...(legacy ? { legacy } : {}) };
    } else {
      const monthly = forecastProfit(kind, cfg, Number(p.active), num(p.loans));
      out[kind] = { kind, value: companyValue(monthly, cfg.LOAN_RATE_ANNUAL), monthlyProfit: cents(monthly), months: 0,
        rate: cfg.LOAN_RATE_ANNUAL };
    }
  }
  return out;
}

/** Доли каждой команды и их стоимость по оценке: { playerId: { value, holdings } }. */
export async function holdingsByPlayer(sql: Sql, gameId: string, values: Record<string, Valuation>) {
  const stakes: Row[] = await sql`select player_id, kind, pct from stakes where game_id = ${gameId} order by pct desc`;
  const out = new Map<string, { value: number; holdings: Array<{ kind: string; pct: number; value: number }> }>();
  for (const s of stakes) {
    const pid = String(s.player_id);
    const v = cents((num(s.pct) / 100) * (values[String(s.kind)]?.value ?? 0));
    const e = out.get(pid) ?? { value: 0, holdings: [] };
    e.holdings.push({ kind: String(s.kind), pct: num(s.pct), value: v });
    e.value = cents(e.value + v);
    out.set(pid, e);
  }
  return out;
}

/**
 * При расчёте месяца: оценка компаний (по прибыли последних трёх месяцев и
 * ставке этого месяца) и стоимость долей каждой команды на конец месяца.
 */
export async function recordValues(tx: Sql, gameId: string, rn: number, cfg: Config): Promise<void> {
  const hist: Row[] = await tx`
    select kind, profit from institution_months
    where game_id = ${gameId} and round_number <= ${rn} order by round_number desc`;
  const values: Record<string, number> = {};
  for (const kind of INSTITUTIONS) {
    const recent = hist.filter((r) => r.kind === kind).slice(0, 3);
    if (!recent.length) continue;
    values[kind] = companyValue(recent.reduce((a, r) => a + num(r.profit), 0) / recent.length, cfg.LOAN_RATE_ANNUAL);
    await tx`update institution_months set value = ${values[kind]}
             where game_id = ${gameId} and round_number = ${rn} and kind = ${kind}`;
  }
  const stakes: Row[] = await tx`select player_id, kind, pct from stakes where game_id = ${gameId}`;
  const byPlayer = new Map<string, number>();
  for (const s of stakes) {
    const pid = String(s.player_id);
    byPlayer.set(pid, (byPlayer.get(pid) ?? 0) + (num(s.pct) / 100) * (values[String(s.kind)] ?? 0));
  }
  for (const [pid, v] of byPlayer) {
    if (!(v > 0)) continue;
    await tx`update results set stake_value = ${cents(v)}
             where game_id = ${gameId} and round_number = ${rn} and player_id = ${pid}`;
    await tx`update wallet_entries set stake_value = ${cents(v)}
             where game_id = ${gameId} and round_number = ${rn} and player_id = ${pid}`;
  }
}
