// ============================================================================
//  Общие помощники функции game: зависимости, ошибки, числа, строки базы.
//
//  Функция работает с базой напрямую через postgres.js, а не через REST:
//  любое действие с деньгами — одна транзакция с блокировкой строк. В v4.9
//  перевод или кредит шли несколькими отдельными запросами, и обрыв связи
//  посередине мог оставить деньги списанными у одного и не зачисленными
//  другому.
// ============================================================================

import type { Config, Decision, PlayerState } from './economy.ts';
import { defaultDecision } from './economy.ts';

// deno-lint-ignore no-explicit-any
export type Sql = any;                 // клиент postgres.js или транзакция
// deno-lint-ignore no-explicit-any
export type Row = Record<string, any>;

/** Всё, что функции нужно снаружи. В проде — Supabase, в тестах — заглушки. */
export interface Deps {
  sql: Sql;
  adminEmails: string[];
  /** Проверяет токен входа и возвращает почту или null. */
  verifyToken: (token: string) => Promise<string | null>;
  /** Заводит пользователя Supabase Auth, чтобы на почту можно было выслать код. */
  ensureAuthUser: (email: string) => Promise<void>;
  /** С каких сайтов можно звать функцию. Пусто — с любых. */
  allowedOrigins: string[];
}

export class ApiError extends Error {
  constructor(public code: string, public details: Record<string, unknown> = {}) {
    super(code);
  }
}

export function fail(code: string, details: Record<string, unknown> = {}): never {
  throw new ApiError(code, details);
}

// ----------------------------------------------------------------- числа

export const num = (v: unknown, dflt = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
};

/** Деньги в ответах — в долларах с центами. */
export const cents = (v: number): number => Math.round(num(v) * 100) / 100;

export const round2 = (v: number): number => Math.round(num(v) * 100) / 100;

// ----------------------------------------------------------------- почты

export const normEmail = (v: unknown): string => String(v ?? '').trim().toLowerCase();

const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]{2,}$/;
export const isEmail = (v: string): boolean => v.length <= 254 && EMAIL_RE.test(v);

// ----------------------------------------------------------------- статусы

export const OFF_BUSINESS = ['civil_service', 'freelance', 'custom_employed'];
export const INSTITUTIONS = ['landlord', 'bank', 'insurer', 'utility'] as const;
export type InstitutionKind = typeof INSTITUTIONS[number];

export function isInstitution(v: unknown): v is InstitutionKind {
  return typeof v === 'string' && (INSTITUTIONS as readonly string[]).includes(v);
}

/** Где у игрока лежат деньги: у работающего бизнеса — касса, у остальных — накопления. */
export function moneyTarget(status: string): 'cash' | 'savings' {
  return status === 'active' ? 'cash' : 'savings';
}

export function available(p: Row): number {
  return p.status === 'active' ? num(p.cash) : num(p.employment_savings);
}

// ----------------------------------------------------------------- строки базы

/** Строка игрока в том виде, который ждёт движок. */
export function toPlayerState(r: Row): PlayerState {
  return {
    id: String(r.id), username: String(r.email),
    cash: num(r.cash), brand: num(r.brand), reputation: num(r.reputation, 1),
    quality: num(r.quality), capacity_shifts: num(r.capacity_shifts),
    seo_level: num(r.seo_level), seo_streak: num(r.seo_streak), seo_unlocked: !!r.seo_unlocked,
    maps_level: num(r.maps_level), social_adstock: num(r.social_adstock),
    outdoor_level: num(r.outdoor_level), outdoor_active_until: num(r.outdoor_active_until),
    affiliate_active: !!r.affiliate_active,
    loan_tier: num(r.loan_tier), loan_balance: num(r.loan_balance),
    loan_term_left: num(r.loan_term_left), loan_monthly_principal: num(r.loan_monthly_principal),
    cf_positive_streak: num(r.cf_positive_streak), ever_missed_payment: !!r.ever_missed_payment,
    status: String(r.status),
    tax_loss_cf: num(r.tax_loss_cf)
  };
}

export function decisionFromRow(r: Row, cfg: Config): Decision {
  return {
    price: num(r.price, cfg.P_REF),
    seo_spend: num(r.seo_spend), promo_spend: num(r.promo_spend),
    maps_spend: num(r.maps_spend), social_spend: num(r.social_spend),
    outdoor_spend: num(r.outdoor_spend), affiliate_spend: num(r.affiliate_spend),
    shifts_delta: num(r.shifts_delta), quality_invest: num(r.quality_invest)
  };
}

export { defaultDecision };

/**
 * Всё, что относится к заведению, — с чистого листа. И при закрытии дела,
 * и при открытии нового: новое дело не наследует бренд, репутацию,
 * разогретую рекламу и прошлые убытки для налога.
 */
/**
 * Стартовый кредит: у нового ресторана лимит первого уровня открыт сразу,
 * а не после первого месяца, как в v4.9. Настоящему ресторану дают
 * кредит на открытие (в США — займы SBA), а без него команды разорялись в
 * первом же месяце, не успев ничего предпринять.
 */
export const STARTUP_LOAN_TIER = 1;

export function businessReset(): Row {
  return {
    brand: 0, reputation: 1, quality: 0, capacity_shifts: 0,
    seo_level: 0, seo_streak: 0, seo_unlocked: false,
    maps_level: 0, social_adstock: 0,
    outdoor_level: 0, outdoor_active_until: 0, affiliate_active: false,
    loan_tier: STARTUP_LOAN_TIER, loan_balance: 0, loan_term_left: 0, loan_monthly_principal: 0,
    cf_positive_streak: 0, ever_missed_payment: false, tax_loss_cf: 0
  };
}

// ----------------------------------------------------------------- месяцы

export interface RoundRow {
  round_number: number;
  status: 'open' | 'closed';
  deadline: string | Date | null;
  opened_at: string | Date | null;
  config: Config | null;
}

/** Последний месяц игры; до первого месяца — нулевой закрытый. */
export async function currentRound(sql: Sql, gameId: string): Promise<RoundRow> {
  const [r] = await sql`
    select round_number, status, deadline, opened_at, config
    from rounds where game_id = ${gameId}
    order by round_number desc limit 1`;
  return r ?? { round_number: 0, status: 'closed', deadline: null, opened_at: null, config: null };
}

/**
 * К какому месяцу относить движение денег. Открыт месяц — к нему. Закрыт —
 * к следующему: его итоги ещё не подведены. Так штраф, выписанный между
 * месяцами, попадает в бюджет, а не теряется, как в v4.9.
 */
export function accountingRound(round: RoundRow): number {
  return round.status === 'open' ? num(round.round_number) : num(round.round_number) + 1;
}

/** Правила, по которым идёт месяц: открытый — свои, иначе — текущие игры. */
export function activeConfig(game: Row, round: RoundRow): Config {
  return (round.status === 'open' && round.config ? round.config : game.config) as Config;
}

// ----------------------------------------------------------------- журналы

export interface LedgerEntry {
  game_id: string; player_id: string; round_number: number;
  kind: string; amount: number; target: 'cash' | 'savings';
  reason?: string | null; actor?: string | null;
}

export async function addLedger(sql: Sql, entries: LedgerEntry[]): Promise<void> {
  const rows = entries.filter((e) => Math.abs(e.amount) >= 0.005)
    .map((e) => ({ reason: null, actor: null, ...e, amount: cents(e.amount) }));
  if (rows.length) await sql`insert into ledger ${sql(rows)}`;
}

export interface CityEntry {
  game_id: string; round_number: number; kind: string; amount: number;
  player_id?: string | null; institution?: string | null;
  reason?: string | null; actor?: string | null;
}

export async function addCity(sql: Sql, entries: CityEntry[]): Promise<void> {
  const rows = entries.filter((e) => Math.abs(e.amount) >= 0.005)
    .map((e) => ({ player_id: null, institution: null, reason: null, actor: null, ...e, amount: cents(e.amount) }));
  if (rows.length) await sql`insert into city_ledger ${sql(rows)}`;
}

export async function addNotice(sql: Sql, gameId: string, playerId: string, roundNumber: number,
                                kind: string, message: string): Promise<void> {
  await sql`insert into notices (game_id, player_id, round_number, kind, message)
            values (${gameId}, ${playerId}, ${roundNumber}, ${kind}, ${message})`;
}

export async function logHostAction(sql: Sql, gameId: string | null, actor: string,
                                    action: string, payload: unknown, reason: string | null = null,
                                    playerId: string | null = null): Promise<void> {
  await sql`insert into host_actions (game_id, actor, player_id, action, payload, reason)
            values (${gameId}, ${actor}, ${playerId}, ${action}, ${sql.json(payload ?? {})}, ${reason})`;
}

/** $12,345 — для текстов уведомлений. */
export function usd(v: number): string {
  const n = Math.round(num(v));
  return (n < 0 ? '−$' : '$') + Math.abs(n).toLocaleString('en-US');
}

/** Имя команды для чужих глаз: ресторан, а без него — имя. Почта — никогда. */
export function teamLabel(p: Row): string {
  return String(p.restaurant_name || p.display_name || 'New team');
}
