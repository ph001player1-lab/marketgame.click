// ============================================================================
//  Табло, бюджет города, участники экономики, «Куда ушли деньги», рейтинг,
//  история игр и отчёт команды.
//
//  Табло открыто всем по коду игры: оно и так висит на проекторе. Почт здесь
//  нет нигде — команда видна по названию ресторана и имени.
// ============================================================================

import { type Config } from './economy.ts';
import { isLeague } from './presets.ts';
import {
  type Sql, type Row, fail, num, cents, round2, currentRound, activeConfig, teamLabel, INSTITUTIONS
} from './lib.ts';
import { gameMeta, rulesFor, formatResult } from './player.ts';

// ----------------------------------------------------------------- бюджет города

const CITY_KINDS = ['profit_tax', 'fine', 'city_tax', 'dividend', 'stake_sale',
                    'grant', 'civil_salary', 'stake_buyback'] as const;

export async function cityBudget(sql: Sql, gameId: string) {
  const rows: Row[] = await sql`
    select round_number, kind, sum(amount) as amount
    from city_ledger where game_id = ${gameId}
    group by round_number, kind order by round_number`;
  const byRound = new Map<number, Row>();
  for (const r of rows) {
    const rn = num(r.round_number);
    if (!byRound.has(rn)) {
      byRound.set(rn, Object.fromEntries([['round', rn], ...CITY_KINDS.map((k) => [k, 0])]));
    }
    byRound.get(rn)![r.kind] = cents(num(r.amount));
  }
  let balance = 0;
  const months = [...byRound.values()].sort((a, b) => a.round - b.round).map((m) => {
    const total = cents(CITY_KINDS.reduce((a, k) => a + num(m[k]), 0));
    balance = cents(balance + total);
    return {
      round: m.round,
      income: {
        profitTax: m.profit_tax, fines: m.fine, cityTaxes: m.city_tax,
        dividends: m.dividend, stakeSales: m.stake_sale
      },
      spending: {
        grants: -m.grant, civilSalaries: -m.civil_salary, stakeBuybacks: -m.stake_buyback
      },
      total, balance
    };
  });
  return { balance, months };
}

// ----------------------------------------------------------------- участники экономики

export async function institutionsState(sql: Sql, gameId: string) {
  const insts: Row[] = await sql`select * from institutions where game_id = ${gameId} order by kind`;
  const stakes: Row[] = await sql`
    select s.kind, s.pct, p.id, p.restaurant_name, p.display_name
    from stakes s join players p on p.id = s.player_id
    where s.game_id = ${gameId} order by s.pct desc`;
  const months: Row[] = await sql`
    select * from institution_months where game_id = ${gameId} order by round_number`;

  const order = (k: string) => (INSTITUTIONS as readonly string[]).indexOf(k);
  return insts.sort((a, b) => order(a.kind) - order(b.kind)).map((inst) => {
    const kind = String(inst.kind);
    const holders = stakes.filter((s) => s.kind === kind).map((s) => ({
      playerId: String(s.id), restaurant: teamLabel(s), pct: num(s.pct)
    }));
    const playersPct = round2(holders.reduce((a, h) => a + h.pct, 0));
    const mine = months.filter((m) => m.kind === kind);
    // Ориентир цены доли для ведущего: средняя выплата последних трёх
    // месяцев в пересчёте на год — за каждый процент.
    const recent = mine.slice(-3);
    const avgPayout = recent.length ? recent.reduce((a, m) => a + num(m.payout), 0) / recent.length : 0;
    return {
      kind,
      ownership: {
        cityPct: num(inst.city_pct), playersPct,
        privatePct: round2(Math.max(0, 100 - num(inst.city_pct) - playersPct)),
        holders
      },
      lossCarryforward: num(inst.loss_cf),
      yearlyPayoutPerPct: cents(avgPayout * 12 / 100),
      months: mine.map((m) => ({
        round: num(m.round_number), income: num(m.income), writeOffs: num(m.write_offs),
        profit: num(m.profit), payout: num(m.payout), toCity: num(m.to_city),
        toPlayers: num(m.to_players), toPrivate: num(m.to_private),
        loansOutstanding: m.loans_outstanding === null ? null : num(m.loans_outstanding)
      }))
    };
  });
}

// ----------------------------------------------------------------- «Куда ушли деньги»

/**
 * Потоки денег за всю игру: гости → рестораны → все, кому рестораны
 * платят, → владельцы. Строится из записанных итогов, экономику не трогает.
 */
export async function moneyMap(sql: Sql, gameId: string) {
  const [r] = await sql`
    select coalesce(sum(revenue), 0) as revenue, coalesce(sum(cogs_total), 0) as suppliers,
           coalesce(sum(payroll + shift_cost), 0) as staff,
           coalesce(sum(marketing_total), 0) as advertising,
           coalesce(sum(quality_upkeep + quality_invest), 0) as quality,
           coalesce(sum(rent), 0) as landlord, coalesce(sum(insurance), 0) as insurer,
           coalesce(sum(utilities), 0) as utility, coalesce(sum(interest), 0) as bank,
           coalesce(sum(tax), 0) as tax, coalesce(sum(profit), 0) as kept
    from results where game_id = ${gameId}`;
  const inst: Row[] = await sql`
    select kind, sum(income) as income, sum(write_offs) as write_offs,
           sum(to_city) as to_city, sum(to_players) as to_players, sum(to_private) as to_private
    from institution_months where game_id = ${gameId} group by kind`;
  const [c] = await sql`
    select coalesce(sum(amount) filter (where kind = 'grant'), 0)         as grants,
           coalesce(sum(amount) filter (where kind = 'civil_salary'), 0)  as civil,
           coalesce(sum(amount) filter (where kind = 'fine'), 0)          as fines,
           coalesce(sum(amount) filter (where kind = 'city_tax'), 0)      as city_taxes,
           coalesce(sum(amount) filter (where kind = 'stake_sale'), 0)    as stake_sales,
           coalesce(sum(amount) filter (where kind = 'stake_buyback'), 0) as buybacks
    from city_ledger where game_id = ${gameId}`;
  const [t] = await sql`
    select coalesce(sum(amount), 0) as transfers from transfers where game_id = ${gameId}`;

  return {
    guestsToRestaurants: cents(num(r.revenue)),
    restaurantsTo: {
      suppliers: cents(num(r.suppliers)), staff: cents(num(r.staff)),
      advertising: cents(num(r.advertising)), quality: cents(num(r.quality)),
      landlord: cents(num(r.landlord)), insurer: cents(num(r.insurer)),
      utility: cents(num(r.utility)), bank: cents(num(r.bank)),
      cityTax: cents(num(r.tax)), keptByRestaurants: cents(num(r.kept))
    },
    institutions: Object.fromEntries(inst.map((i) => [i.kind, {
      income: cents(num(i.income)), writeOffs: cents(num(i.write_offs)),
      toCity: cents(num(i.to_city)), toPlayers: cents(num(i.to_players)),
      toPrivate: cents(num(i.to_private))
    }])),
    city: {
      grants: cents(-num(c.grants)), civilSalaries: cents(-num(c.civil)),
      fines: cents(num(c.fines)), cityTaxes: cents(num(c.city_taxes)),
      stakeSales: cents(num(c.stake_sales)), stakeBuybacks: cents(-num(c.buybacks))
    },
    betweenPlayers: cents(num(t.transfers))
  };
}

// ----------------------------------------------------------------- табло

async function timeline(sql: Sql, gameId: string) {
  const players: Row[] = await sql`select * from players where game_id = ${gameId} order by created_at, id`;
  const results: Row[] = await sql`select * from results where game_id = ${gameId} order by round_number`;
  const wallets: Row[] = await sql`select * from wallet_entries where game_id = ${gameId} order by round_number`;

  const byPlayer = new Map<string, Row>();
  for (const p of players) {
    byPlayer.set(String(p.id), {
      id: String(p.id), restaurant: teamLabel(p), displayName: p.display_name ?? null,
      status: String(p.status),
      location: { kind: p.location_kind ?? null, state: p.location_state ?? null, country: p.location_country ?? null },
      // Капитал сейчас — по тому же правилу, что и v_standings: касса минус
      // долг банку или накопления. Штраф или перевод между месяцами виден
      // на табло сразу.
      capital: Math.round(p.status === 'left' ? 0
        : ['active', 'bankrupt'].includes(String(p.status)) ? num(p.cash) - num(p.loan_balance)
          : num(p.employment_savings)),
      series: [] as Row[]
    });
  }
  for (const r of results) {
    byPlayer.get(String(r.player_id))?.series.push({
      round: num(r.round_number), inBusiness: true,
      profit: Math.round(num(r.profit)), cash: Math.round(num(r.cash_after)),
      capital: Math.round(num(r.cash_after) - num(r.loan_balance_after)),
      marketSharePct: round2(num(r.market_share) * 100), served: Math.round(num(r.served)),
      price: round2(num(r.price)), brand: round2(num(r.brand_after)),
      reputation: round2(num(r.reputation_after)), quality: round2(num(r.quality)),
      capacity: Math.round(num(r.capacity)), marketingTotal: Math.round(num(r.marketing_total)),
      qualityInvest: Math.round(num(r.quality_invest)), tax: Math.round(num(r.tax)),
      dividends: Math.round(num(r.dividends))
    });
  }
  // Месяцы вне бизнеса: капитал и доход реальные, а доли рынка и бренда у
  // человека без заведения нет — честный null, линия на графике рвётся.
  // Разорившийся, пока не выбрал, чем заняться, ещё не начал копить: у него
  // долг, а не ноль, поэтому и здесь null.
  for (const w of wallets) {
    const broke = w.status === 'bankrupt';
    byPlayer.get(String(w.player_id))?.series.push({
      round: num(w.round_number), inBusiness: false, offBusinessStatus: w.status,
      profit: broke ? null : Math.round(num(w.income)), cash: broke ? null : Math.round(num(w.savings)),
      capital: broke ? null : Math.round(num(w.savings)),
      marketSharePct: null, served: null, price: null, brand: null, reputation: null,
      quality: null, capacity: null, marketingTotal: null, qualityInvest: null, tax: null, dividends: null
    });
  }
  for (const p of byPlayer.values()) p.series.sort((a: Row, b: Row) => a.round - b.round);

  const marketTotals: Record<number, number> = {};
  for (const r of results) marketTotals[num(r.round_number)] = Math.round(num(r.market_total));
  return { players: [...byPlayer.values()], marketTotals };
}

export async function boardData(sql: Sql, game: Row) {
  const round = await currentRound(sql, game.id);
  const cfg = activeConfig(game, round);
  return {
    ok: true,
    game: gameMeta(game, round),
    rules: rulesFor(cfg),
    ...(await timeline(sql, game.id)),
    institutions: await institutionsState(sql, game.id),
    city: await cityBudget(sql, game.id),
    moneyMap: await moneyMap(sql, game.id)
  };
}

export async function board(sql: Sql, b: Row) {
  const code = String(b.code ?? '').trim().toUpperCase();
  if (!code) fail('bad_code');
  const [game] = await sql`select * from games where code = ${code}`;
  if (!game) fail('game_not_found');
  return await boardData(sql, game);
}

// ----------------------------------------------------------------- рейтинг

export async function rating(sql: Sql, b: Row) {
  const league = isLeague(b.league) ? b.league : null;
  const [row] = await sql`select player_ratings(${league}) as data`;
  return { ok: true, ...(row?.data ?? { leagues: [] }) };
}

// ----------------------------------------------------------------- история

/** Место, капитал и доля рынка команды в игре — из v_standings. */
async function standing(sql: Sql, gameId: string, playerId: string) {
  const [s] = await sql`select * from v_standings where game_id = ${gameId} and player_id = ${playerId}`;
  if (!s) return null;
  return {
    place: num(s.place), rivals: num(s.rivals), capital: cents(num(s.capital)),
    multiplier: round2(num(s.multiplier)), sharePct: round2(num(s.share) * 100),
    monthsPlayed: num(s.months_played), lastRound: num(s.last_round)
  };
}

/** Игры почты: где она играла и какие ведёт. Для экрана My games. */
export async function myGames(sql: Sql, email: string, isAdmin: boolean) {
  const playing: Row[] = await sql`
    select g.*, p.id as player_id, p.restaurant_name, p.report_token, game_is_rated(g.id) as rated
    from players p join games g on g.id = p.game_id
    where p.email = ${email} order by g.created_at desc`;
  const hosting: Row[] = isAdmin
    ? await sql`select * from games order by created_at desc limit 200`
    : await sql`select * from games where host_email = ${email} order by created_at desc`;

  const short = (g: Row) => ({
    id: String(g.id), code: String(g.code), title: String(g.title), league: String(g.league),
    totalRounds: num(g.total_rounds), currentRound: num(g.current_round), status: String(g.status),
    practice: !!g.practice, organizer: g.organizer ?? null, createdAt: g.created_at,
    finishedAt: g.finished_at ?? null, scheduledAt: g.scheduled_at ?? null, timezone: String(g.timezone)
  });

  const out = [];
  for (const g of playing) {
    out.push({
      ...short(g), playerId: String(g.player_id), restaurant: g.restaurant_name ?? null,
      rated: !!g.rated, reportToken: String(g.report_token),
      standing: await standing(sql, g.id, g.player_id)
    });
  }
  return { playing: out, hosting: hosting.map((g) => ({ ...short(g), hostEmail: String(g.host_email) })) };
}

/** Всё о команде в одной игре: помесячный отчёт, решения, движения денег, доли. */
async function teamDetail(sql: Sql, playerId: string) {
  const results: Row[] = await sql`select * from results where player_id = ${playerId} order by round_number`;
  const decisions: Row[] = await sql`select * from decisions where player_id = ${playerId} order by round_number`;
  const ledger: Row[] = await sql`
    select round_number, kind, amount, target, reason, created_at
    from ledger where player_id = ${playerId} order by id`;
  const wallets: Row[] = await sql`select * from wallet_entries where player_id = ${playerId} order by round_number`;
  const stakes: Row[] = await sql`select kind, pct from stakes where player_id = ${playerId}`;
  return {
    results: results.map(formatResult),
    decisions: decisions.map(decisionOut),
    offBusinessMonths: wallets.map((w) => ({
      round: num(w.round_number), status: w.status, savings: num(w.savings), income: num(w.income)
    })),
    moneyLog: ledger.map((l) => ({
      round: num(l.round_number), kind: l.kind, amount: num(l.amount), target: l.target,
      reason: l.reason, at: l.created_at
    })),
    stakes: stakes.map((s) => ({ kind: s.kind, pct: num(s.pct) }))
  };
}

function decisionOut(d: Row) {
  return {
    round: num(d.round_number), autoplay: !!d.autoplay, price: num(d.price),
    seoSpend: num(d.seo_spend), promoSpend: num(d.promo_spend), mapsSpend: num(d.maps_spend),
    socialSpend: num(d.social_spend), outdoorSpend: num(d.outdoor_spend),
    affiliateSpend: num(d.affiliate_spend), shiftsDelta: num(d.shifts_delta),
    qualityInvest: num(d.quality_invest)
  };
}

/**
 * Решения всех команд. Во время игры их не видит никто, кроме ведущего:
 * иначе игроки подсматривали бы. После финала — открыты всем участникам,
 * чтобы разбирать партию вместе, если ведущий не отключил.
 */
async function allDecisions(sql: Sql, gameId: string) {
  const players: Row[] = await sql`select * from players where game_id = ${gameId} order by created_at, id`;
  const decisions: Row[] = await sql`select * from decisions where game_id = ${gameId} order by round_number`;
  return players.map((p) => ({
    playerId: String(p.id), restaurant: teamLabel(p),
    decisions: decisions.filter((d) => String(d.player_id) === String(p.id)).map(decisionOut)
  }));
}

/** Отчёт по игре для участника или ведущего. */
export async function gameReport(sql: Sql, game: Row, playerId: string | null, isHost: boolean) {
  const data = await boardData(sql, game);
  const open = isHost || (game.status === 'finished' && !!game.open_book);
  return {
    ...data,
    team: playerId ? {
      playerId, standing: await standing(sql, game.id, playerId), ...(await teamDetail(sql, playerId))
    } : null,
    allDecisions: open ? await allDecisions(sql, game.id) : null
  };
}

/** Отчёт команды по ссылке — для напарников, без входа, только чтение. */
export async function publicReport(sql: Sql, b: Row) {
  const token = String(b.token ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(token)) fail('report_not_found');
  const [p] = await sql`select * from players where report_token = ${token}`;
  if (!p) fail('report_not_found');
  const [game] = await sql`select * from games where id = ${p.game_id}`;
  const report = await gameReport(sql, game, String(p.id), false);
  return { ...report, teamName: teamLabel(p) };
}

export type { Config };
