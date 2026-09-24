// ============================================================================
//  Кабинет команды: что игрок видит и что он может сделать.
// ============================================================================

import { computeCapacity, loanLimitFor, type Config } from './economy.ts';
import { EDITABLE_CONFIG, LEAGUES, type League } from './presets.ts';
import {
  type Sql, type Row, fail, num, cents, round2, currentRound, accountingRound, activeConfig,
  businessReset, addLedger, addNotice, moneyTarget, available, OFF_BUSINESS, usd, teamLabel,
  INSTITUTIONS, directImageUrl, type RoundRow
} from './lib.ts';

// ----------------------------------------------------------------- общее

export function gameMeta(game: Row, round: RoundRow) {
  const league = game.league as League;
  const total = num(game.total_rounds);
  return {
    id: String(game.id), code: String(game.code), title: String(game.title),
    league, leagueName: LEAGUES[league]?.name ?? league, totalRounds: total,
    practice: !!game.practice, status: String(game.status),
    roundNumber: num(round.round_number), roundStatus: round.status,
    deadline: round.status === 'open' ? round.deadline : null,
    serverNow: new Date().toISOString(),
    finished: game.status === 'finished',
    organizer: game.organizer ?? null,
    timezone: String(game.timezone), scheduledAt: game.scheduled_at ?? null,
    openBook: !!game.open_book,
    // Загруженный логотип отдаёт сама функция: GET ?logo=<id>&v=<logoRev>.
    // Ссылку, сохранённую до перевода Drive-ссылок в прямые, переводим здесь.
    sponsor: game.sponsor_name
      ? {
          name: String(game.sponsor_name), url: game.sponsor_url ?? null,
          logoRev: num(game.sponsor_logo_rev) > 0 ? num(game.sponsor_logo_rev) : null,
          logoUrl: num(game.sponsor_logo_rev) > 0 || !game.sponsor_logo_url ? null : directImageUrl(String(game.sponsor_logo_url))
        }
      : null
  };
}

/** Правила месяца для памятки и подсказок — из живых настроек, а не из памяти. */
export function rulesFor(cfg: Config) {
  return {
    pRef: cfg.P_REF, priceFloor: cfg.P_FLOOR,
    priceSoftCap: round2(cfg.P_REF * cfg.P_MAX_MULT),
    priceCeiling: round2(cfg.P_REF * cfg.P_MAX_MULT * 1.5),
    cogsPerMeal: round2(cfg.P_REF * cfg.COGS_PCT), qualityCogsAdd: cfg.QUALITY_COGS_ADD,
    rent: cfg.RENT, insurance: cfg.INSURANCE ?? 0, utilities: cfg.UTILITIES ?? 0,
    payroll: cfg.PAYROLL_BASE,
    fixedTotal: cfg.RENT + (cfg.INSURANCE ?? 0) + (cfg.UTILITIES ?? 0) + cfg.PAYROLL_BASE,
    capacityBase: cfg.CAPACITY_BASE, shiftStepCapacity: cfg.CAPACITY_STEP,
    shiftStepCost: cfg.CAPACITY_STEP_COST,
    shiftsMin: cfg.CAPACITY_SHIFTS_MIN, shiftsMax: cfg.CAPACITY_SHIFTS_MAX,
    qualityInvestPerUnit: cfg.QUALITY_INVEST_DIVISOR, qualityUpkeep: cfg.QUALITY_UPKEEP,
    qualityDecay: cfg.QUALITY_DECAY,
    marketBase: cfg.MARKET_SIZE_PER_PLAYER, marketQualityGain: cfg.MARKET_QUALITY_GAIN ?? 0,
    marketPriceMin: cfg.CAT_MIN, marketPriceMax: cfg.CAT_MAX,
    loanRate: cfg.LOAN_RATE_ANNUAL, loanTermMonths: cfg.LOAN_TERM_MONTHS,
    loanLimits: [cfg.LOAN_TIER1_LIMIT, cfg.LOAN_TIER2_LIMIT, cfg.LOAN_TIER3_LIMIT],
    taxRate: cfg.PROFIT_TAX_RATE ?? 0,
    civilSalary: cfg.CIVIL_SERVICE_SALARY, reopenThreshold: cfg.REOPEN_THRESHOLD,
    startCapital: cfg.START_CAPITAL, roundMinutes: cfg.ROUND_DURATION_MIN,
    brandDecay: cfg.BRAND_DECAY,
    channels: {
      seo: { ref: cfg.SEO_REF, rampMonths: cfg.SEO_RAMP_MONTHS, decay: cfg.SEO_DECAY },
      promo: { ref: cfg.PROMO_REF },
      maps: { ref: cfg.MAPS_REF, decay: cfg.MAPS_DECAY },
      social: { ref: cfg.SOCIAL_REF, decay: cfg.SOCIAL_DECAY },
      outdoor: { ref: cfg.OUTDOOR_REF, minSpend: cfg.OUTDOOR_MIN_SPEND, months: cfg.OUTDOOR_DURATION_MONTHS },
      affiliate: { minSpend: cfg.AFFILIATE_MIN_SPEND, bonusPct: cfg.AFFILIATE_BONUS_PCT }
    }
  };
}

/** Что ведущий поменял и что вступит в силу со следующего месяца. */
export async function upcomingChanges(sql: Sql, game: Row, round: RoundRow) {
  let current: Config | null = round.config;
  if (round.status !== 'open' && num(round.round_number) === 0) current = null;
  if (!current) return [];
  const next = game.config as Record<string, number>;
  const cur = current as unknown as Record<string, number>;
  return Object.keys(EDITABLE_CONFIG)
    .filter((k) => next[k] !== undefined && cur[k] !== undefined && Number(next[k]) !== Number(cur[k]))
    .map((k) => ({ key: k, from: Number(cur[k]), to: Number(next[k]) }));
}

export function formatResult(r: Row | undefined) {
  if (!r) return null;
  return {
    roundNumber: num(r.round_number), price: num(r.price),
    demand: Math.round(num(r.demand)), served: Math.round(num(r.served)), lost: Math.round(num(r.lost)),
    marketSharePct: round2(num(r.market_share) * 100), marketTotal: Math.round(num(r.market_total)),
    revenue: num(r.revenue), cogs: num(r.cogs_total), grossProfit: num(r.gross_profit),
    opex: {
      rent: num(r.rent), insurance: num(r.insurance), utilities: num(r.utilities),
      payroll: num(r.payroll), shiftCost: num(r.shift_cost),
      qualityUpkeep: num(r.quality_upkeep), qualityInvest: num(r.quality_invest),
      marketing: num(r.marketing_total)
    },
    marketingByChannel: {
      seo: num(r.seo_spend), promo: num(r.promo_spend), maps: num(r.maps_spend),
      social: num(r.social_spend), outdoor: num(r.outdoor_spend), affiliate: num(r.affiliate_spend)
    },
    ebit: num(r.ebit), interest: num(r.interest), profitBeforeTax: num(r.profit_before_tax),
    tax: num(r.tax), profit: num(r.profit), principalPaid: num(r.principal_paid),
    cashFlow: num(r.cash_flow), dividends: num(r.dividends), cashAfter: num(r.cash_after),
    loanBalanceAfter: num(r.loan_balance_after),
    brand: round2(num(r.brand_after)), reputation: round2(num(r.reputation_after)),
    quality: round2(num(r.quality)), capacity: Math.round(num(r.capacity))
  };
}

function publicPlayer(p: Row) {
  return {
    id: String(p.id), restaurant: teamLabel(p), displayName: p.display_name ?? null,
    status: String(p.status),
    location: { kind: p.location_kind ?? null, state: p.location_state ?? null, country: p.location_country ?? null }
  };
}

/** Доли команды и сколько они принесли в последний рассчитанный месяц. */
async function myStakes(sql: Sql, gameId: string, playerId: string) {
  const rows: Row[] = await sql`
    select s.kind, s.pct,
           (select payout from institution_months m
             where m.game_id = s.game_id and m.kind = s.kind
             order by round_number desc limit 1) as last_payout
    from stakes s where s.game_id = ${gameId} and s.player_id = ${playerId}
    order by s.kind`;
  return rows.map((s) => ({
    kind: String(s.kind), pct: num(s.pct),
    lastMonthIncome: cents(num(s.last_payout) * num(s.pct) / 100)
  }));
}

// ----------------------------------------------------------------- кабинет

export async function dashboard(sql: Sql, game: Row, playerId: string, impersonating = false) {
  const gameId = String(game.id);
  const [player] = await sql`select * from players where id = ${playerId}`;
  if (!player) fail('player_not_found');
  const round = await currentRound(sql, gameId);
  const cfg = activeConfig(game, round);

  const [last] = await sql`
    select * from results where player_id = ${playerId}
    order by round_number desc limit 1`;
  const notices: Row[] = await sql`
    select id, kind, message, round_number from notices
    where player_id = ${playerId} and not read order by id`;
  const others: Row[] = await sql`
    select * from players where game_id = ${gameId} and id <> ${playerId} and status <> 'left'
    order by created_at, id`;

  const base = {
    ok: true, impersonating,
    game: gameMeta(game, round),
    rules: rulesFor(cfg),
    upcomingChanges: await upcomingChanges(sql, game, round),
    player: {
      id: String(player.id), displayName: player.display_name ?? '',
      restaurant: player.restaurant_name ?? '',
      location: { kind: player.location_kind ?? null, state: player.location_state ?? null,
                  country: player.location_country ?? null },
      status: String(player.status),
      cash: num(player.cash), savings: num(player.employment_savings)
    },
    // Данные из прошлой игры подставлены, но команда подтверждает их в
    // каждой новой игре: название ресторана часто меняют.
    needsProfile: !player.joined_at || !player.display_name || !player.restaurant_name || !player.location_kind,
    lastResult: formatResult(last),
    notices: notices.map((n) => ({ id: num(n.id), kind: n.kind, message: n.message, roundNumber: num(n.round_number) })),
    others: others.filter((o) => o.restaurant_name).map(publicPlayer),
    stakes: await myStakes(sql, gameId, playerId),
    careerOptions: { civilServiceSalary: cfg.CIVIL_SERVICE_SALARY, reopenThreshold: cfg.REOPEN_THRESHOLD },
    reportToken: impersonating ? null : String(player.report_token)
  };

  const status = String(player.status);
  if (status === 'left' || status === 'bankrupt') {
    return { ...base, lifecycle: status };
  }

  if (OFF_BUSINESS.includes(status)) {
    const savings = num(player.employment_savings);
    const employment: Row = {
      savings, threshold: cfg.REOPEN_THRESHOLD, canReopen: savings >= cfg.REOPEN_THRESHOLD
    };
    if (status === 'custom_employed') {
      const [employer] = player.employer_id
        ? await sql`select * from players where id = ${player.employer_id}` : [];
      Object.assign(employment, {
        professionName: player.custom_profession_name ?? '',
        employer: employer ? publicPlayer(employer) : null,
        proposedSalary: num(player.proposed_salary),
        approved: !!player.employment_approved,
        paidThisRound: !!player.salary_paid_this_round
      });
    }
    if (status === 'civil_service') {
      const since = num(player.service_since_round);
      const paid = num(player.last_salary_round);
      Object.assign(employment, {
        salary: cfg.CIVIL_SERVICE_SALARY, serviceSinceRound: since || null,
        salaryPaidThroughRound: paid || null
      });
    }
    return { ...base, lifecycle: status, employment };
  }

  // --- работающий ресторан
  const [myDecision] = await sql`
    select * from decisions
    where player_id = ${playerId} and round_number = ${round.round_number} and not autoplay`;
  const employees: Row[] = await sql`
    select * from players where employer_id = ${playerId} and status = 'custom_employed'
    order by created_at, id`;

  const tierLimit = loanLimitFor(num(player.loan_tier), cfg);
  const balance = num(player.loan_balance);
  return {
    ...base,
    lifecycle: 'active',
    business: {
      brand: round2(num(player.brand)), reputation: round2(num(player.reputation)),
      quality: round2(num(player.quality)), capacityShifts: num(player.capacity_shifts),
      capacity: computeCapacity(cfg, num(player.capacity_shifts)),
      taxLossCarryforward: num(player.tax_loss_cf)
    },
    marketing: {
      seoUnlocked: !!player.seo_unlocked, seoStreak: num(player.seo_streak),
      seoLevel: round2(num(player.seo_level)), mapsLevel: round2(num(player.maps_level)),
      socialAdstock: round2(num(player.social_adstock)),
      outdoorActive: num(round.round_number) <= num(player.outdoor_active_until),
      outdoorActiveUntil: num(player.outdoor_active_until),
      affiliateActive: !!player.affiliate_active
    },
    loan: {
      tier: num(player.loan_tier), balance, limit: tierLimit,
      available: Math.max(0, tierLimit - balance),
      rateAnnual: cfg.LOAN_RATE_ANNUAL, termLeft: num(player.loan_term_left),
      monthlyPrincipal: num(player.loan_monthly_principal),
      nextPayment: cents(Math.min(balance, num(player.loan_monthly_principal)) + balance * cfg.LOAN_RATE_ANNUAL / 12)
    },
    decision: myDecision ? {
      submitted: true, submittedAt: myDecision.submitted_at,
      price: num(myDecision.price), seoSpend: num(myDecision.seo_spend),
      promoSpend: num(myDecision.promo_spend), mapsSpend: num(myDecision.maps_spend),
      socialSpend: num(myDecision.social_spend), outdoorSpend: num(myDecision.outdoor_spend),
      affiliateSpend: num(myDecision.affiliate_spend), shiftsDelta: num(myDecision.shifts_delta),
      qualityInvest: num(myDecision.quality_invest)
    } : { submitted: false },
    employees: employees.map((e) => ({
      id: String(e.id), displayName: e.display_name ?? '', profession: e.custom_profession_name ?? '',
      salary: num(e.proposed_salary), approved: !!e.employment_approved,
      paidThisRound: !!e.salary_paid_this_round
    }))
  };
}

// ----------------------------------------------------------------- действия

async function lockPlayer(tx: Sql, playerId: string): Promise<Row> {
  const [p] = await tx`select * from players where id = ${playerId} for update`;
  if (!p) fail('player_not_found');
  return p;
}

const LOCATION_KINDS = ['state', 'multistate', 'international'];

// 50 штатов и округ Колумбия — как на marketgame.biz.
export const US_STATES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA',
  'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM',
  'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA',
  'WV', 'WI', 'WY'
]);

export async function setProfile(sql: Sql, game: Row, playerId: string, b: Row) {
  const displayName = String(b.displayName ?? '').trim().slice(0, 60);
  const restaurant = String(b.restaurantName ?? '').trim().slice(0, 60);
  const kind = String(b.locationKind ?? '');
  const state = String(b.locationState ?? '').trim().toUpperCase();
  const country = String(b.locationCountry ?? '').trim().slice(0, 60);
  if (!displayName || !restaurant) fail('empty');
  if (!LOCATION_KINDS.includes(kind)) fail('bad_location');
  if (kind === 'state' && !US_STATES.has(state)) fail('bad_state');
  if (kind === 'international' && !country) fail('bad_country');

  const [dup] = await sql`
    select 1 from players where game_id = ${game.id} and id <> ${playerId}
      and lower(restaurant_name) = lower(${restaurant})`;
  if (dup) fail('restaurant_taken');

  await sql`update players set ${sql({
    display_name: displayName, restaurant_name: restaurant,
    location_kind: kind,
    location_state: kind === 'state' ? state : null,
    location_country: kind === 'international' ? country : null,
    joined_at: new Date()
  })} where id = ${playerId}`;
  return { ok: true };
}

export async function markNoticesRead(sql: Sql, playerId: string) {
  await sql`update notices set read = true where player_id = ${playerId} and not read`;
  return { ok: true };
}

export async function submitDecision(sql: Sql, game: Row, playerId: string, b: Row) {
  return await sql.begin(async (tx: Sql) => {
    const round = await currentRound(tx, game.id);
    if (round.status !== 'open') fail('round_closed');
    const cfg = round.config as Config;
    const p = await lockPlayer(tx, playerId);
    if (p.status !== 'active') fail('not_active');

    const d = {
      price: num(b.price, NaN),
      seo_spend: num(b.seoSpend), promo_spend: num(b.promoSpend), maps_spend: num(b.mapsSpend),
      social_spend: num(b.socialSpend), outdoor_spend: num(b.outdoorSpend),
      affiliate_spend: num(b.affiliateSpend),
      shifts_delta: Math.trunc(num(b.shiftsDelta)), quality_invest: num(b.qualityInvest)
    };
    // Плохие значения отклоняем, а не подгоняем молча: игрок должен
    // понимать, что именно ввёл не так.
    const ceiling = round2(cfg.P_REF * cfg.P_MAX_MULT * 1.5);
    if (!Number.isFinite(d.price)) fail('bad_price');
    if (d.price < cfg.P_FLOOR) fail('price_too_low', { min: cfg.P_FLOOR, max: ceiling });
    if (d.price > ceiling) fail('price_too_high', { min: cfg.P_FLOOR, max: ceiling });
    const spends = [d.seo_spend, d.promo_spend, d.maps_spend, d.social_spend,
                    d.outdoor_spend, d.affiliate_spend, d.quality_invest];
    if (spends.some((v) => v < 0)) fail('negative_spend');
    const total = cents(spends.reduce((a, v) => a + v, 0));
    if (total > num(p.cash)) fail('insufficient_cash', { totalSpend: total, available: num(p.cash) });
    if (Math.abs(d.shifts_delta) > 1) fail('shifts_step');
    const nextShifts = num(p.capacity_shifts) + d.shifts_delta;
    if (nextShifts < cfg.CAPACITY_SHIFTS_MIN || nextShifts > cfg.CAPACITY_SHIFTS_MAX) fail('shifts_out_of_range');

    // Повторная отправка перезаписывает решение, а не плодит дубли.
    await tx`
      insert into decisions ${tx({
        game_id: game.id, round_number: round.round_number, player_id: playerId, ...d,
        autoplay: false, submitted_at: new Date()
      })}
      on conflict (game_id, round_number, player_id) do update set
        price = excluded.price, seo_spend = excluded.seo_spend, promo_spend = excluded.promo_spend,
        maps_spend = excluded.maps_spend, social_spend = excluded.social_spend,
        outdoor_spend = excluded.outdoor_spend, affiliate_spend = excluded.affiliate_spend,
        shifts_delta = excluded.shifts_delta, quality_invest = excluded.quality_invest,
        autoplay = false, submitted_at = excluded.submitted_at`;
    return { ok: true, roundNumber: num(round.round_number) };
  });
}

export async function requestLoan(sql: Sql, game: Row, playerId: string, b: Row, actor: string) {
  const amount = Math.floor(num(b.amount));
  if (!(amount > 0)) fail('bad_amount');
  return await sql.begin(async (tx: Sql) => {
    const round = await currentRound(tx, game.id);
    const cfg = activeConfig(game, round);
    const p = await lockPlayer(tx, playerId);
    if (p.status !== 'active') fail('not_active');
    const tier = num(p.loan_tier);
    if (tier < 1) fail('no_credit_yet');
    const room = Math.max(0, loanLimitFor(tier, cfg) - num(p.loan_balance));
    if (amount > room) fail('over_limit', { available: room });

    const balance = cents(num(p.loan_balance) + amount);
    // Тело гасится равными долями; платёж считаем от нового остатка, иначе
    // второй кредит гасился бы по графику первого.
    const monthly = Math.ceil(balance / cfg.LOAN_TERM_MONTHS);
    await tx`update players set ${tx({
      cash: cents(num(p.cash) + amount), loan_balance: balance,
      loan_term_left: cfg.LOAN_TERM_MONTHS, loan_monthly_principal: monthly
    })} where id = ${playerId}`;
    await addLedger(tx, [{
      game_id: game.id, player_id: playerId, round_number: accountingRound(round),
      kind: 'loan_out', amount, target: 'cash', reason: 'Loan received', actor
    }]);
    return { ok: true, received: amount, balance, available: Math.max(0, loanLimitFor(tier, cfg) - balance) };
  });
}

export async function repayLoan(sql: Sql, game: Row, playerId: string, b: Row, actor: string) {
  const amount = Math.floor(num(b.amount));
  if (!(amount > 0)) fail('bad_amount');
  return await sql.begin(async (tx: Sql) => {
    const round = await currentRound(tx, game.id);
    const p = await lockPlayer(tx, playerId);
    if (p.status !== 'active') fail('not_active');
    if (num(p.loan_balance) <= 0) fail('no_loan');
    if (amount > num(p.cash)) fail('insufficient_cash', { available: num(p.cash) });
    const pay = Math.min(amount, num(p.loan_balance));
    const balance = cents(num(p.loan_balance) - pay);
    await tx`update players set ${tx({
      cash: cents(num(p.cash) - pay), loan_balance: balance,
      loan_monthly_principal: balance > 0 ? Math.min(num(p.loan_monthly_principal), balance) : 0,
      loan_term_left: balance > 0 ? num(p.loan_term_left) : 0
    })} where id = ${playerId}`;
    await addLedger(tx, [{
      game_id: game.id, player_id: playerId, round_number: accountingRound(round),
      kind: 'loan_repay', amount: -pay, target: 'cash', reason: 'Early loan repayment', actor
    }]);
    return { ok: true, paid: pay, balance };
  });
}

export async function transferMoney(sql: Sql, game: Row, playerId: string, b: Row, actor: string) {
  const amount = Math.floor(num(b.amount));
  const toId = String(b.toPlayerId ?? '');
  if (!toId || !(amount > 0)) fail('bad_params');
  if (toId === playerId) fail('self_transfer');
  return await sql.begin(async (tx: Sql) => {
    const round = await currentRound(tx, game.id);
    // Две строки блокируем в одном порядке — иначе встречные переводы
    // могли бы заблокировать друг друга.
    const locked: Row[] = await tx`
      select * from players where id in (${playerId}, ${toId}) and game_id = ${game.id}
      order by id for update`;
    const from = locked.find((x) => String(x.id) === playerId);
    const to = locked.find((x) => String(x.id) === toId);
    if (!from) fail('player_not_found');
    if (!to || to.status === 'left') fail('recipient_not_found');
    if (from.status === 'left' || from.status === 'bankrupt') fail('not_active');

    const have = available(from);
    if (amount > have) fail('insufficient_cash', { available: have });

    const fromT = moneyTarget(from.status);
    const toT = moneyTarget(to.status);
    const fromCol = fromT === 'cash' ? 'cash' : 'employment_savings';
    const toCol = toT === 'cash' ? 'cash' : 'employment_savings';
    await tx`update players set ${tx({ [fromCol]: cents(num(from[fromCol]) - amount) })} where id = ${from.id}`;
    await tx`update players set ${tx({ [toCol]: cents(num(to[toCol]) + amount) })} where id = ${to.id}`;

    const rn = accountingRound(round);
    await tx`insert into transfers (game_id, from_player, to_player, amount, round_number)
             values (${game.id}, ${from.id}, ${to.id}, ${amount}, ${rn})`;
    await addLedger(tx, [
      { game_id: game.id, player_id: from.id, round_number: rn, kind: 'transfer_out',
        amount: -amount, target: fromT, reason: 'Transfer to ' + teamLabel(to), actor },
      { game_id: game.id, player_id: to.id, round_number: rn, kind: 'transfer_in',
        amount, target: toT, reason: 'Transfer from ' + teamLabel(from), actor }
    ]);
    await addNotice(tx, game.id, to.id, rn, 'transfer',
      teamLabel(from) + ' sent you ' + usd(amount) + '.');
    return { ok: true, sent: amount, to: teamLabel(to), available: cents(have - amount) };
  });
}

/**
 * Смена деятельности: банкрот выбирает обязательно, работающий уходит
 * добровольно, вне бизнеса — переключается между путями.
 *
 * Уходя из работающего дела, игрок сначала гасит кредит из кассы и уносит
 * остаток в накопления. Если кассы на кредит не хватило, недостача — убыток
 * банка. У банкрота касса в минусе: дыру закрывают кредиторы, весь кредит
 * списывается.
 */
export async function chooseCareerPath(sql: Sql, game: Row, playerId: string, b: Row, actor: string) {
  const path = String(b.path ?? '');
  const profession = String(b.professionName ?? '').trim().slice(0, 60);
  if (!['civil_service', 'freelance', 'custom', 'end'].includes(path)) fail('invalid_path');
  if (path === 'custom' && !profession) fail('empty_profession');

  return await sql.begin(async (tx: Sql) => {
    const round = await currentRound(tx, game.id);
    const rn = accountingRound(round);
    const p = await lockPlayer(tx, playerId);
    const status = String(p.status);
    if (!(status === 'active' || status === 'bankrupt' || OFF_BUSINESS.includes(status))) fail('invalid_state');

    const cash = num(p.cash);
    const loan = num(p.loan_balance);
    let savings = num(p.employment_savings);
    const entries = [];
    let writeOff = 0;

    if (status === 'active' || status === 'bankrupt') {
      if (cash < 0) {
        entries.push({ kind: 'bankruptcy', amount: -cash, target: 'cash', reason: 'Unpaid bills written off' });
        writeOff = loan;
      } else {
        const payoff = Math.min(cash, loan);
        const rest = cents(cash - payoff);
        writeOff = cents(loan - payoff);
        if (payoff > 0) entries.push({ kind: 'loan_repay', amount: -payoff, target: 'cash', reason: 'Loan repaid on closing' });
        if (rest > 0) {
          entries.push({ kind: 'settlement', amount: -rest, target: 'cash', reason: 'Business closed' });
          entries.push({ kind: 'settlement', amount: rest, target: 'savings', reason: 'Cash kept after closing' });
          savings = cents(savings + rest);
        }
      }
      // Сотрудники закрывшегося дела остаются без нанимателя.
      await tx`update players set employer_id = null, employment_approved = false, proposed_salary = 0
               where employer_id = ${playerId}`;
    }

    if (writeOff > 0) {
      await tx`insert into loan_write_offs (game_id, player_id, round_number, amount)
               values (${game.id}, ${playerId}, ${rn}, ${cents(writeOff)})`;
    }

    const common = {
      ...(status === 'active' || status === 'bankrupt' ? businessReset() : {}),
      cash: 0, employer_id: null, proposed_salary: 0, employment_approved: false,
      salary_paid_this_round: false
    };

    if (path === 'end') {
      if (savings > 0) entries.push({ kind: 'settlement', amount: -savings, target: 'savings', reason: 'Left the game' });
      await tx`update players set ${tx({
        ...common, employment_savings: 0, status: 'left', custom_profession_name: null,
        service_since_round: 0, last_salary_round: 0, savings_last_round: 0
      })} where id = ${playerId}`;
      // Доли ушедшего возвращаются городу: город может продать их снова.
      const stakes: Row[] = await tx`delete from stakes where player_id = ${playerId} returning kind, pct`;
      for (const s of stakes) {
        await tx`update institutions set city_pct = least(100, city_pct + ${s.pct})
                 where game_id = ${game.id} and kind = ${s.kind}`;
      }
    } else {
      const newStatus = path === 'custom' ? 'custom_employed' : path;
      const isCivil = newStatus === 'civil_service';
      // Открыт месяц — человек служит уже в нём; закрыт — со следующего.
      const since = round.status === 'open' ? num(round.round_number) : num(round.round_number) + 1;
      const keepService = status === 'civil_service' && isCivil;
      await tx`update players set ${tx({
        ...common, employment_savings: savings, status: newStatus,
        custom_profession_name: path === 'custom' ? profession : null,
        service_since_round: keepService ? num(p.service_since_round) : (isCivil ? since : 0),
        last_salary_round: keepService ? num(p.last_salary_round) : (isCivil ? since - 1 : 0),
        // Выходное пособие — не доход месяца, иначе на табло был бы
        // фальшивый всплеск дохода ровно в месяц ухода из бизнеса.
        savings_last_round: savings
      })} where id = ${playerId}`;
    }

    await addLedger(tx, entries.map((e) => ({
      game_id: game.id, player_id: playerId, round_number: rn, actor, ...e
    })) as never);
    return { ok: true, settled: savings, writtenOff: cents(writeOff) };
  });
}

/** Накопил порог — открывает новое дело с чистого листа. */
export async function reopenBusiness(sql: Sql, game: Row, playerId: string, actor: string) {
  return await sql.begin(async (tx: Sql) => {
    const round = await currentRound(tx, game.id);
    const cfg = activeConfig(game, round);
    const p = await lockPlayer(tx, playerId);
    if (!OFF_BUSINESS.includes(String(p.status))) fail('not_eligible');
    const savings = num(p.employment_savings);
    if (savings < cfg.REOPEN_THRESHOLD) fail('not_enough_savings', { needed: cfg.REOPEN_THRESHOLD });

    await tx`update players set ${tx({
      ...businessReset(), cash: savings, employment_savings: 0, status: 'active',
      custom_profession_name: null, employer_id: null, proposed_salary: 0,
      employment_approved: false, salary_paid_this_round: false,
      service_since_round: 0, last_salary_round: 0, savings_last_round: 0
    })} where id = ${playerId}`;
    const rn = accountingRound(round);
    await addLedger(tx, [
      { game_id: game.id, player_id: playerId, round_number: rn, kind: 'reopen',
        amount: -savings, target: 'savings', reason: 'New business opened', actor },
      { game_id: game.id, player_id: playerId, round_number: rn, kind: 'reopen',
        amount: savings, target: 'cash', reason: 'Starting cash of the new business', actor }
    ]);
    return { ok: true, cash: savings };
  });
}

export async function proposeEmployment(sql: Sql, game: Row, playerId: string, b: Row) {
  const employerId = String(b.employerId ?? '');
  const salary = Math.max(0, Math.floor(num(b.salary)));
  if (!employerId) fail('bad_params');
  if (employerId === playerId) fail('self_employer');
  return await sql.begin(async (tx: Sql) => {
    const me = await lockPlayer(tx, playerId);
    if (me.status !== 'custom_employed') fail('not_custom_path');
    const [employer] = await tx`select * from players where id = ${employerId} and game_id = ${game.id}`;
    if (!employer) fail('employer_not_found');
    if (employer.status !== 'active') fail('employer_not_active');
    await tx`update players set employer_id = ${employerId}, proposed_salary = ${salary},
             employment_approved = false, salary_paid_this_round = false where id = ${playerId}`;
    const round = await currentRound(tx, game.id);
    await addNotice(tx, game.id, employerId, accountingRound(round), 'employment',
      (me.display_name || 'A player') + ' offers to work for you as ' +
      (me.custom_profession_name || 'an employee') + ' for ' + usd(salary) + ' a month.');
    return { ok: true };
  });
}

export async function respondToEmployment(sql: Sql, game: Row, playerId: string, b: Row) {
  const employeeId = String(b.employeeId ?? '');
  const approve = b.approve === true || b.approve === 'true';
  return await sql.begin(async (tx: Sql) => {
    const emp = await lockPlayer(tx, employeeId);
    if (emp.status !== 'custom_employed' || String(emp.employer_id) !== playerId) fail('not_your_employee');
    if (approve) {
      await tx`update players set employment_approved = true where id = ${employeeId}`;
    } else {
      // Отклонённый может предложить себя другому — путь остаётся,
      // пропадает только эта договорённость.
      await tx`update players set employer_id = null, proposed_salary = 0,
               employment_approved = false, salary_paid_this_round = false where id = ${employeeId}`;
    }
    return { ok: true, approved: approve };
  });
}

export async function paySalary(sql: Sql, game: Row, playerId: string, b: Row, actor: string) {
  const employeeId = String(b.employeeId ?? '');
  return await sql.begin(async (tx: Sql) => {
    const round = await currentRound(tx, game.id);
    const locked: Row[] = await tx`
      select * from players where id in (${playerId}, ${employeeId}) order by id for update`;
    const employer = locked.find((x) => String(x.id) === playerId);
    const emp = locked.find((x) => String(x.id) === employeeId);
    if (!employer || !emp || emp.status !== 'custom_employed' ||
        String(emp.employer_id) !== playerId || !emp.employment_approved) fail('not_your_employee');
    if (employer.status !== 'active') fail('not_active');
    if (emp.salary_paid_this_round) fail('already_paid');
    const salary = num(emp.proposed_salary);
    if (salary > num(employer.cash)) fail('insufficient_cash', { needed: salary, available: num(employer.cash) });

    await tx`update players set cash = ${cents(num(employer.cash) - salary)} where id = ${playerId}`;
    await tx`update players set employment_savings = ${cents(num(emp.employment_savings) + salary)},
             salary_paid_this_round = true where id = ${employeeId}`;
    const rn = accountingRound(round);
    await addLedger(tx, [
      { game_id: game.id, player_id: playerId, round_number: rn, kind: 'employer_salary',
        amount: -salary, target: 'cash', reason: 'Salary to ' + (emp.display_name || 'employee'), actor },
      { game_id: game.id, player_id: employeeId, round_number: rn, kind: 'employer_salary',
        amount: salary, target: 'savings', reason: 'Salary from ' + teamLabel(employer), actor }
    ]);
    return { ok: true, paid: salary };
  });
}

export { INSTITUTIONS };
