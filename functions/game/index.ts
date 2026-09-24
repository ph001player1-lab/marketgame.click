// ============================================================================
//  "Захвати рынок или закрой бизнес" — API игры v4.9
//  Supabase Edge Function. Файл index.ts рядом с economy.ts.
//
//  ГЛАВНЫЙ ПРИНЦИП: отвечает в ТОЧНО ТОМ ЖЕ формате, что старый Apps Script.
//  Благодаря этому проверенный в бою фронтенд (App.js, tablo.js) переезжает
//  заменой одной строки с адресом, а не переписыванием.
//
//  Что здесь есть: определение игрока, кабинет, приём решений, пульт
//  ведущего, расчёт месяца, табло, штрафы и субсидии государства, вход
//  ведущего в чужой кабинет.
//
//  Полный функционал: банк, переводы, все пути вне бизнеса, наём между
//  игроками, редактор настроек партии и сброс партии.
// ============================================================================

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import {
  calculateRound, computeCapacity, clampDecisionToCash, defaultDecision,
  computeLoanTier, loanLimitFor, round2,
  type Config, type PlayerState, type Decision
} from './economy.ts';

// Мини-приложение живёт на постороннем домене, поэтому браузер сначала
// спрашивает разрешение отдельным запросом OPTIONS. Без этих заголовков
// не пройдёт ни один вызов из Telegram.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' }
  });

// Сервисный ключ обходит RLS. Он живёт ТОЛЬКО здесь, в браузер не попадает
// никогда — именно поэтому мы и не пускаем клиент в базу напрямую.
const db: SupabaseClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } }
);

// GAME_CODE задаёт СЕРИЮ партий, а не одну игру. После каждого перезапуска
// рядом появляется TEST-01#2, TEST-01#3 и так далее; старые партии
// остаются в базе и идут в рейтинг. Функция всегда работает с самой
// свежей игрой серии.
const GAME_CODE = Deno.env.get('GAME_CODE') ?? 'TEST-01';

// --------------------------------------------------------------- утилиты

const norm = (u: unknown) => String(u ?? '').trim().replace(/^@/, '').toLowerCase();
const num = (v: unknown, dflt = 0) => { const n = Number(v); return Number.isFinite(n) ? n : dflt; };

interface Money { thb: number; usd: number }
const money = (thb: number, cfg: Config & { FX_RATE_THB_PER_USD?: number }): Money => ({
  thb: Math.round(thb),
  usd: Math.round((thb / (cfg.FX_RATE_THB_PER_USD || 35)) * 100) / 100
});

/** Строка игрока из базы приводится к тому виду, который ждёт движок. */
function toPlayerState(r: Record<string, unknown>): PlayerState {
  return {
    id: String(r.id), username: String(r.username),
    cash: num(r.cash), brand: num(r.brand), reputation: num(r.reputation, 1),
    quality: num(r.quality), capacity_shifts: num(r.capacity_shifts),
    seo_level: num(r.seo_level), seo_streak: num(r.seo_streak), seo_unlocked: !!r.seo_unlocked,
    maps_level: num(r.maps_level), social_adstock: num(r.social_adstock),
    outdoor_level: num(r.outdoor_level), outdoor_active_until: num(r.outdoor_active_until),
    affiliate_active: !!r.affiliate_active,
    loan_tier: num(r.loan_tier), loan_balance: num(r.loan_balance),
    loan_term_left: num(r.loan_term_left), loan_monthly_principal: num(r.loan_monthly_principal),
    cf_positive_streak: num(r.cf_positive_streak), ever_missed_payment: !!r.ever_missed_payment,
    status: String(r.status)
  };
}

// --------------------------------------------------------------- контекст

interface Ctx {
  game: Record<string, unknown>;
  cfg: Config;
  role: 'admin' | 'player';
  username: string;
  playerId: string | null;
  impersonating: boolean;
  realUsername: string;
}

/**
 * Текущая партия серии. GAME_CODE теперь задаёт СЕРИЮ, а не одну игру:
 * после перезапуска рядом появляется TEST-01#2, TEST-01#3 и так далее,
 * а старые остаются в архиве ради рейтинга. Берём самую свежую.
 */
async function findCurrentGame() {
  const { data } = await db.from('games')
    .select('*')
    .or('code.eq.' + GAME_CODE + ',code.like.' + GAME_CODE + '#%')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function loadContext(usernameRaw: string, asRaw: string | null): Promise<Ctx | { error: string }> {
  const game = await findCurrentGame();
  if (!game) return { error: 'game_not_found' };

  const user = norm(usernameRaw);
  if (!user) return { error: 'no_username' };

  const cfg = game.config as Config;
  const isAdmin = user === norm(game.admin_username);
  const asUser = norm(asRaw);

  // Ведущий открывает чужой кабинет. Обычному игроку параметр as молча
  // игнорируется: подобранная ссылка не даст доступа к чужим данным.
  if (isAdmin && asUser) {
    const { data: p } = await db.from('players')
      .select('id, username').eq('game_id', game.id).eq('username', asUser).maybeSingle();
    if (!p) return { error: 'player_not_found' };
    return {
      game, cfg, role: 'player', username: asUser, playerId: p.id,
      impersonating: true, realUsername: user
    };
  }

  if (isAdmin) {
    return { game, cfg, role: 'admin', username: user, playerId: null, impersonating: false, realUsername: user };
  }

  const { data: p } = await db.from('players')
    .select('id').eq('game_id', game.id).eq('username', user).maybeSingle();
  if (!p) return { error: 'not_in_game' };

  return { game, cfg, role: 'player', username: user, playerId: p.id, impersonating: false, realUsername: user };
}

/** Текущий (последний) месяц игры. Без побочных эффектов. */
async function currentRound(gameId: string) {
  const { data } = await db.from('rounds')
    .select('*').eq('game_id', gameId)
    .order('round_number', { ascending: false }).limit(1).maybeSingle();
  return data ?? { round_number: 0, status: 'closed', deadline: null, opened_at: null };
}

// --------------------------------------------------------------- кабинет игрока

function formatResult(r: Record<string, unknown>, cfg: Config) {
  return {
    roundNumber: num(r.round_number), demand: Math.round(num(r.demand)),
    served: Math.round(num(r.served)), lost: Math.round(num(r.lost)),
    marketShare: round2(num(r.market_share) * 100),
    revenue: money(num(r.revenue), cfg), cogs: money(num(r.cogs_total), cfg),
    grossProfit: money(num(r.gross_profit), cfg),
    opex: {
      rent: money(num(r.rent), cfg), payroll: money(num(r.payroll), cfg),
      shiftCost: money(num(r.shift_cost), cfg), qualityUpkeep: money(num(r.quality_upkeep), cfg),
      qualityInvest: money(num(r.quality_invest), cfg), marketing: money(num(r.marketing_total), cfg)
    },
    marketingByChannel: {
      seo: money(num(r.seo_spend), cfg), promo: money(num(r.promo_spend), cfg),
      maps: money(num(r.maps_spend), cfg), social: money(num(r.social_spend), cfg),
      outdoor: money(num(r.outdoor_spend), cfg), affiliate: money(num(r.affiliate_spend), cfg)
    },
    ebit: money(num(r.ebit), cfg), interest: money(num(r.interest), cfg),
    profit: money(num(r.profit), cfg), principalPaid: money(num(r.principal_paid), cfg),
    cashFlow: money(num(r.cash_flow), cfg)
  };
}

async function getDashboard(ctx: Ctx) {
  const { game, cfg } = ctx;
  const gameId = String(game.id);

  const { data: player } = await db.from('players').select('*').eq('id', ctx.playerId!).single();
  const round = await currentRound(gameId);

  // Итоги последнего сыгранного месяца нужны в любом статусе: и банкроту
  // важно видеть, что именно привело к разорению, а не упираться в заглушку.
  const { data: lastRow } = await db.from('results')
    .select('*').eq('game_id', gameId).eq('player_id', ctx.playerId!)
    .order('round_number', { ascending: false }).limit(1).maybeSingle();
  const lastResult = lastRow ? formatResult(lastRow, cfg) : null;

  const base = { impersonating: ctx.impersonating, viewedBy: ctx.impersonating ? ctx.realUsername : null };

  if (player.status === 'left') {
    return { ok: true, ...base, lifecycle: 'left',
      player: { restaurant: player.restaurant_name || ('@' + ctx.username) }, lastResult };
  }

  if (player.status === 'bankrupt') {
    return { ok: true, ...base, lifecycle: 'bankrupt',
      player: { restaurant: player.restaurant_name || ('@' + ctx.username), cash: money(num(player.cash), cfg) },
      careerOptions: {
        civilServiceSalary: money(cfg.CIVIL_SERVICE_SALARY, cfg),
        reopenThreshold: money(cfg.REOPEN_THRESHOLD, cfg)
      },
      lastResult };
  }

  if (['civil_service', 'freelance', 'custom_employed'].includes(player.status)) {
    const savings = num(player.employment_savings);
    const res: Record<string, unknown> = {
      ok: true, ...base, lifecycle: player.status,
      player: { restaurant: player.restaurant_name || ('@' + ctx.username), displayName: player.display_name || '' },
      employment: {
        savings: money(savings, cfg), threshold: money(cfg.REOPEN_THRESHOLD, cfg),
        canReopen: savings >= cfg.REOPEN_THRESHOLD
      },
      careerOptions: {
        civilServiceSalary: money(cfg.CIVIL_SERVICE_SALARY, cfg),
        reopenThreshold: money(cfg.REOPEN_THRESHOLD, cfg)
      },
      lastResult
    };
    // Фрилансеру и наёмному нужен список тех, к кому можно обратиться:
    // первому за переводом, второму с предложением о работе.
    // Список активных нужен всем, кто вне бизнеса: фрилансеру — попросить
    // перевод, наёмному — предложить себя, госслужащему — кого-то
    // профинансировать со своей зарплаты.
    const { data: act } = await db.from('players')
      .select('username, restaurant_name').eq('game_id', gameId).eq('status', 'active');
    res.otherActivePlayers = (act ?? []).filter((a) => a.restaurant_name)
      .map((a) => ({ username: a.username, restaurant: a.restaurant_name }));

    // Перевести можно и другому «безбизнесному»: скинуться товарищу на
    // открытие дела — законный ход, и запрещать его нет причин.
    const { data: off } = await db.from('players')
      .select('username, display_name, status').eq('game_id', gameId)
      .in('status', ['civil_service', 'freelance', 'custom_employed'])
      .neq('id', ctx.playerId!);
    res.otherOffBusinessPlayers = (off ?? [])
      .map((a) => ({ username: a.username, restaurant: '@' + a.username }));
    if (player.status === 'custom_employed') {
      Object.assign(res.employment as object, {
        professionName: player.custom_profession_name || '',
        employerUsername: player.employer_username || '',
        proposedSalary: money(num(player.proposed_salary), cfg),
        approved: !!player.employment_approved,
        paidThisRound: !!player.salary_paid_this_round
      });
    }
    if (player.status === 'civil_service') {
      const since = num(player.service_since_round);
      const paid = num(player.last_salary_round);
      Object.assign(res.employment as object, {
        salary: money(cfg.CIVIL_SERVICE_SALARY, cfg),
        serviceSinceRound: since || null,
        salaryPaidThroughRound: paid || null,
        salaryPending: since > 0 && num(round.round_number) >= since && paid < num(round.round_number)
      });
    }
    return res;
  }

  // --- активный игрок
  const { data: myDecision } = await db.from('decisions')
    .select('id').eq('game_id', gameId).eq('round_number', round.round_number)
    .eq('player_id', ctx.playerId!).maybeSingle();

  const { data: unread } = await db.from('bank_log')
    .select('message, round_number').eq('game_id', gameId)
    .eq('player_id', ctx.playerId!).eq('read', false).order('id');

  const { data: others } = await db.from('players')
    .select('username, restaurant_name').eq('game_id', gameId)
    .neq('id', ctx.playerId!).neq('status', 'left');

  const tierLimit = loanLimitFor(num(player.loan_tier), cfg);
  const available = Math.max(0, tierLimit - num(player.loan_balance));
  const nextPayment = Math.min(num(player.loan_balance), num(player.loan_monthly_principal))
    + num(player.loan_balance) * (cfg.LOAN_RATE_ANNUAL / 12);

  return {
    ok: true, ...base,
    lifecycle: 'active',
    needsOnboarding: !player.display_name || !player.restaurant_name,
    currency: { base: 'THB', fx: (cfg as Record<string, number>).FX_RATE_THB_PER_USD ?? 35 },
    game: {
      code: String(game.code), roundNumber: num(round.round_number), roundStatus: round.status,
      openedAt: round.opened_at, deadline: round.status === 'open' ? round.deadline : null,
      roundDurationMin: cfg.ROUND_DURATION_MIN, windowSec: 30,
      // v4.6. Отдаём собственное время сервера. Клиент раньше считал
      // остаток как «дедлайн минус часы телефона», и при сбитых часах
      // игрок видел не пять минут, а сколько угодно. Теперь клиент
      // вычисляет поправку и считает по серверному времени.
      serverNow: new Date().toISOString(),
      totalRounds: cfg.TOTAL_ROUNDS,
      priceFloor: money(cfg.P_FLOOR, cfg),
      priceCeiling: money(cfg.P_REF * cfg.P_MAX_MULT * 1.5, cfg),
      gameFinished: round.status === 'closed' && num(round.round_number) >= cfg.TOTAL_ROUNDS
    },
    player: {
      displayName: player.display_name || '',
      restaurant: player.restaurant_name || ('@' + ctx.username),
      cash: money(num(player.cash), cfg),
      brand: round2(num(player.brand)), reputation: round2(num(player.reputation)),
      quality: round2(num(player.quality)), capacityShifts: num(player.capacity_shifts),
      capacity: computeCapacity(cfg, num(player.capacity_shifts)),
      status: player.status
    },
    otherPlayers: (others ?? []).filter((p) => p.restaurant_name)
      .map((p) => ({ username: p.username, restaurant: p.restaurant_name })),
    staff: { shiftStepCapacity: cfg.CAPACITY_STEP, shiftStepCost: money(cfg.CAPACITY_STEP_COST, cfg) },
    marketing: {
      seoUnlocked: !!player.seo_unlocked, seoStreak: num(player.seo_streak),
      seoRampMonths: cfg.SEO_RAMP_MONTHS, seoLevel: round2(num(player.seo_level)),
      mapsLevel: round2(num(player.maps_level)), socialAdstock: round2(num(player.social_adstock)),
      outdoorActive: num(round.round_number) <= num(player.outdoor_active_until),
      outdoorActiveUntil: num(player.outdoor_active_until),
      affiliateActive: !!player.affiliate_active
    },
    loan: {
      tier: num(player.loan_tier), balance: money(num(player.loan_balance), cfg),
      available: money(available, cfg), rateAnnual: cfg.LOAN_RATE_ANNUAL,
      termLeft: num(player.loan_term_left),
      monthlyPrincipal: money(num(player.loan_monthly_principal), cfg),
      estimatedNextPayment: money(nextPayment, cfg),
      limits: {
        tier1: money(cfg.LOAN_TIER1_LIMIT, cfg),
        tier2: money(cfg.LOAN_TIER2_LIMIT, cfg),
        tier3: money(cfg.LOAN_TIER3_LIMIT, cfg)
      }
    },
    myDecisionSubmitted: !!myDecision,
    lastResult,
    bankNotifications: (unread ?? []).map((b) => ({ message: b.message, roundNumber: b.round_number })),
    myEmployees: await loadMyEmployees(ctx),
    careerOptions: {
      civilServiceSalary: money(cfg.CIVIL_SERVICE_SALARY, cfg),
      reopenThreshold: money(cfg.REOPEN_THRESHOLD, cfg)
    }
  };
}

// --------------------------------------------------------------- приём решения

/** Наёмные сотрудники этого игрока — и согласованные, и ждущие решения. */
async function loadMyEmployees(ctx: Ctx) {
  const { data } = await db.from('players')
    .select('username, display_name, custom_profession_name, proposed_salary, employment_approved, salary_paid_this_round')
    .eq('game_id', ctx.game.id).eq('status', 'custom_employed')
    .eq('employer_username', ctx.username);

  return (data ?? []).map((e) => ({
    username: e.username, displayName: e.display_name || e.username,
    profession: e.custom_profession_name || '',
    salary: money(num(e.proposed_salary), ctx.cfg),
    approved: !!e.employment_approved,
    paidThisRound: !!e.salary_paid_this_round
  }));
}

async function submitDecision(ctx: Ctx, q: URLSearchParams) {
  const { game, cfg } = ctx;
  const gameId = String(game.id);
  const round = await currentRound(gameId);

  if (round.status !== 'open') return { ok: false, error: 'round_closed' };

  const { data: player } = await db.from('players').select('*').eq('id', ctx.playerId!).single();
  if (player.status !== 'active') return { ok: false, error: 'not_active' };

  const price = num(q.get('price'), cfg.P_REF);
  const d: Decision = {
    price,
    seo_spend: num(q.get('seoSpend')), promo_spend: num(q.get('promoSpend')),
    maps_spend: num(q.get('mapsSpend')), social_spend: num(q.get('socialSpend')),
    outdoor_spend: num(q.get('outdoorSpend')), affiliate_spend: num(q.get('affiliateSpend')),
    shifts_delta: num(q.get('shiftsDelta')), quality_invest: num(q.get('qualityInvest'))
  };

  // Плохие значения отклоняем, а не подгоняем молча: игрок должен понимать,
  // что именно он ввёл не так, а не обнаружить потом чужие цифры в отчёте.
  const ceiling = cfg.P_REF * cfg.P_MAX_MULT * 1.5;
  if (price < cfg.P_FLOOR) {
    return { ok: false, error: 'price_too_low', min: money(cfg.P_FLOOR, cfg), max: money(ceiling, cfg) };
  }
  if (price > ceiling) {
    return { ok: false, error: 'price_too_high', min: money(cfg.P_FLOOR, cfg), max: money(ceiling, cfg) };
  }
  const spends = [d.seo_spend, d.promo_spend, d.maps_spend, d.social_spend,
                  d.outdoor_spend, d.affiliate_spend, d.quality_invest];
  if (spends.some((v) => v < 0)) return { ok: false, error: 'negative_spend' };

  const totalSpend = spends.reduce((a, b) => a + b, 0);
  if (totalSpend > num(player.cash)) {
    return {
      ok: false, error: 'insufficient_cash',
      totalSpend: money(totalSpend, cfg), available: money(num(player.cash), cfg)
    };
  }

  const nextShifts = num(player.capacity_shifts) + d.shifts_delta;
  if (nextShifts < cfg.CAPACITY_SHIFTS_MIN || nextShifts > cfg.CAPACITY_SHIFTS_MAX) {
    return { ok: false, error: 'shifts_out_of_range' };
  }

  // Повторная отправка перезаписывает решение, а не плодит дубли —
  // за это отвечает уникальный индекс по (игра, месяц, игрок).
  const { error } = await db.from('decisions').upsert({
    game_id: gameId, round_number: round.round_number, player_id: ctx.playerId,
    price: d.price, seo_spend: d.seo_spend, promo_spend: d.promo_spend,
    maps_spend: d.maps_spend, social_spend: d.social_spend,
    outdoor_spend: d.outdoor_spend, affiliate_spend: d.affiliate_spend,
    shifts_delta: d.shifts_delta, quality_invest: d.quality_invest,
    autoplay: false, submitted_at: new Date().toISOString()
  }, { onConflict: 'game_id,round_number,player_id' });

  if (error) return { ok: false, error: String(error.message) };
  return { ok: true, roundNumber: round.round_number };
}

// --------------------------------------------------------------- пульт ведущего

/**
 * Казна помесячно. Земля государственная — аренда идёт сюда; банк
 * государственный — проценты тоже. Штрафы пополняют, субсидии и зарплата
 * госслужащих расходуют.
 */
async function loadTreasury(gameId: string, cfg: Config) {
  const { data } = await db.from('treasury')
    .select('*').eq('game_id', gameId).order('round_number');

  const rows = (data ?? []).map((t) => ({
    round: num(t.round_number),
    rent: money(num(t.rent), cfg),
    interest: money(num(t.interest), cfg),
    fines: money(num(t.fines), cfg),
    subsidies: money(num(t.subsidies), cfg),
    income: money(num(t.income), cfg),
    balance: money(num(t.balance), cfg)
  }));

  const last = rows.length ? rows[rows.length - 1] : null;
  return {
    rows,
    balance: last ? last.balance : money(0, cfg),
    lastIncome: last ? last.income : money(0, cfg)
  };
}

async function adminMonitor(ctx: Ctx) {
  const { game, cfg } = ctx;
  const gameId = String(game.id);
  const round = await currentRound(gameId);

  const { data: players } = await db.from('players')
    .select('*').eq('game_id', gameId).order('username');

  const { data: submitted } = await db.from('decisions')
    .select('player_id').eq('game_id', gameId).eq('round_number', round.round_number);
  const submittedSet = new Set((submitted ?? []).map((s) => s.player_id));

  return {
    ok: true,
    round: {
      // Клиент читает round.number — имя из старого API. Дублируем в
      // roundNumber на случай, если где-то в разметке используется оно.
      number: num(round.round_number),
      roundNumber: num(round.round_number),
      status: round.status,
      openedAt: round.opened_at,
      serverNow: new Date().toISOString(),
      deadline: round.status === 'open' ? round.deadline : null,
      totalRounds: cfg.TOTAL_ROUNDS,
      gameFinished: round.status === 'closed' && num(round.round_number) >= cfg.TOTAL_ROUNDS
    },
    gameCode: String(ctx.game.code),
    config: {
      ROUND_DURATION_MIN: cfg.ROUND_DURATION_MIN,
      RENT: cfg.RENT,
      PAYROLL_BASE: cfg.PAYROLL_BASE,
      TOTAL_ROUNDS: cfg.TOTAL_ROUNDS,
      START_CAPITAL: cfg.START_CAPITAL,
      CIVIL_SERVICE_SALARY: cfg.CIVIL_SERVICE_SALARY,
      REOPEN_THRESHOLD: cfg.REOPEN_THRESHOLD,
      P_REF: cfg.P_REF,
      MARKET_SIZE_PER_PLAYER: cfg.MARKET_SIZE_PER_PLAYER,
      LOAN_RATE_ANNUAL: cfg.LOAN_RATE_ANNUAL,
      LOAN_TERM_MONTHS: cfg.LOAN_TERM_MONTHS
    },
    treasury: await loadTreasury(String(game.id), cfg),
    players: (players ?? []).map((p) => {
      // Игрок вне бизнеса держит деньги не в кассе (там ноль по
      // определению), а в накоплениях. Показывать ему ноль — это ровно
      // тот баг, из-за которого казалось, что при смене деятельности
      // всё обнулилось.
      const off = ['civil_service', 'freelance', 'custom_employed'].includes(p.status);
      const noBiz = off || p.status === 'left' || p.status === 'bankrupt';
      return {
        username: p.username,
        restaurant: p.restaurant_name || ('@' + p.username + ' — ещё не открыл(а) кабинет'),
        joined: !!p.restaurant_name,
        cash: money(off ? num(p.employment_savings) : num(p.cash), cfg),
        offBusiness: off,
        brand: noBiz ? null : round2(num(p.brand)),
        reputation: noBiz ? null : round2(num(p.reputation)),
        capacity: noBiz ? null : computeCapacity(cfg, num(p.capacity_shifts)),
        loanTier: noBiz ? null : num(p.loan_tier),
        status: p.status,
        submitted: noBiz ? null : submittedSet.has(p.id)
      };
    })
  };
}

async function adminOpenRound(ctx: Ctx) {
  const gameId = String(ctx.game.id);
  const cfg = ctx.cfg;
  const round = await currentRound(gameId);

  if (round.status === 'open') return { ok: false, error: 'already_open' };
  if (num(round.round_number) >= cfg.TOTAL_ROUNDS) return { ok: false, error: 'game_finished' };

  const next = num(round.round_number) + 1;
  const deadline = new Date(Date.now() + cfg.ROUND_DURATION_MIN * 60 * 1000).toISOString();

  const { error } = await db.from('rounds').insert({
    game_id: gameId, round_number: next, status: 'open',
    opened_at: new Date().toISOString(), deadline
  });
  if (error) return { ok: false, error: String(error.message) };

  await db.from('games').update({ current_round: next, status: 'running' }).eq('id', gameId);
  return { ok: true, roundNumber: next, deadline };
}

async function adminCalculateRound(ctx: Ctx) {
  const gameId = String(ctx.game.id);
  const cfg = ctx.cfg;
  const round = await currentRound(gameId);

  if (num(round.round_number) < 1) return { ok: false, error: 'no_round' };
  if (round.status === 'closed') return { ok: false, error: 'already_closed' };

  const roundNumber = num(round.round_number);

  const { data: rows } = await db.from('players')
    .select('*').eq('game_id', gameId).eq('status', 'active');
  const players = (rows ?? []).map(toPlayerState);

  const { data: decRows } = await db.from('decisions')
    .select('*').eq('game_id', gameId).eq('round_number', roundNumber);

  const decisions: Record<string, Decision> = {};
  for (const r of decRows ?? []) {
    decisions[String(r.player_id)] = {
      price: num(r.price, cfg.P_REF),
      seo_spend: num(r.seo_spend), promo_spend: num(r.promo_spend),
      maps_spend: num(r.maps_spend), social_spend: num(r.social_spend),
      outdoor_spend: num(r.outdoor_spend), affiliate_spend: num(r.affiliate_spend),
      shifts_delta: num(r.shifts_delta), quality_invest: num(r.quality_invest)
    };
  }

  // Автоход. Игрок не подал решение — берём его последнее известное и
  // ужимаем под текущую кассу. Без ужатия открытое заново дело улетало
  // в минус в первый же месяц старыми рекламными бюджетами, не дав
  // игроку ничего нажать.
  for (const p of players) {
    if (decisions[p.id]) continue;
    const { data: prev } = await db.from('decisions')
      .select('*').eq('game_id', gameId).eq('player_id', p.id)
      .lt('round_number', roundNumber)
      .order('round_number', { ascending: false }).limit(1).maybeSingle();

    const source: Partial<Decision> = prev ? {
      price: num(prev.price, cfg.P_REF),
      seo_spend: num(prev.seo_spend), promo_spend: num(prev.promo_spend),
      maps_spend: num(prev.maps_spend), social_spend: num(prev.social_spend),
      outdoor_spend: num(prev.outdoor_spend), affiliate_spend: num(prev.affiliate_spend),
      shifts_delta: num(prev.shifts_delta), quality_invest: num(prev.quality_invest)
    } : defaultDecision(cfg);

    decisions[p.id] = clampDecisionToCash(source, p.cash, cfg);
    await db.from('decisions').upsert({
      game_id: gameId, round_number: roundNumber, player_id: p.id,
      ...decisions[p.id], autoplay: true
    }, { onConflict: 'game_id,round_number,player_id' });
  }

  const out = calculateRound({ roundNumber, cfg, players, decisions });

  // Записываем результат одной транзакцией на стороне базы: либо весь
  // месяц лёг целиком, либо не лёг вовсе. Половинчатого состояния,
  // из-за которого в версии на таблицах разъезжались цифры, быть не может.
  const { data: applied, error } = await db.rpc('apply_round_results', {
    p_game_id: gameId,
    p_round_number: roundNumber,
    p_results: out.results,
    p_players: out.players.map((p) => ({
      id: p.id, cash: p.cash, brand: p.brand, reputation: p.reputation,
      quality: p.quality, capacity_shifts: p.capacity_shifts,
      seo_level: p.seo_level, seo_streak: p.seo_streak, seo_unlocked: p.seo_unlocked,
      maps_level: p.maps_level, social_adstock: p.social_adstock,
      outdoor_level: p.outdoor_level, outdoor_active_until: p.outdoor_active_until,
      affiliate_active: p.affiliate_active,
      loan_balance: p.loan_balance, loan_term_left: p.loan_term_left,
      loan_monthly_principal: p.loan_monthly_principal,
      cf_positive_streak: p.cf_positive_streak, ever_missed_payment: p.ever_missed_payment,
      status: p.status,
      loan_tier: Math.max(num(rows?.find((r) => r.id === p.id)?.loan_tier),
                          computeLoanTier(p, cfg, roundNumber))
    })),
    p_salary: cfg.CIVIL_SERVICE_SALARY
  });

  if (error) return { ok: false, error: String(error.message) };
  return { ok: true, roundNumber, marketTotal: Math.round(out.marketTotal), players: out.playerCount, applied };
}

/** Штраф или субсидия конкретному игроку. Сумма со знаком. */
async function adminAdjust(ctx: Ctx, q: URLSearchParams) {
  const target = norm(q.get('playerUsername'));
  const amount = num(q.get('amount'));
  const reason = String(q.get('reason') ?? '').slice(0, 200);
  if (!target || !amount) return { ok: false, error: 'bad_params' };

  const { data: p } = await db.from('players')
    .select('id').eq('game_id', ctx.game.id).eq('username', target).maybeSingle();
  if (!p) return { ok: false, error: 'player_not_found' };

  const kind = amount < 0 ? 'admin_fine' : 'admin_subsidy';
  const { data, error } = await db.rpc('admin_adjust_balance', {
    p_game_id: ctx.game.id, p_player_id: p.id, p_amount: amount,
    p_kind: kind, p_reason: reason, p_admin_username: ctx.username
  });
  if (error) return { ok: false, error: String(error.message) };
  return { ok: true, ...(data as object) };
}

// --------------------------------------------------------------- табло

async function getTimeline() {
  const game = await findCurrentGame();
  if (!game) return { ok: false, error: 'game_not_found' };

  const cfg = game.config as Config;
  const round = await currentRound(game.id);

  const { data: players } = await db.from('players').select('*').eq('game_id', game.id).order('username');
  const { data: results } = await db.from('results')
    .select('*').eq('game_id', game.id).order('round_number');
  const { data: wallets } = await db.from('wallet_entries')
    .select('*').eq('game_id', game.id).order('round_number');
  const { data: treasuryRows } = await db.from('treasury')
    .select('*').eq('game_id', game.id).order('round_number');

  const byPlayer: Record<string, Record<string, unknown>> = {};
  for (const p of players ?? []) {
    byPlayer[p.id] = {
      restaurant: p.restaurant_name || ('@' + p.username),
      status: p.status, inBusiness: p.status === 'active', series: [] as unknown[]
    };
  }

  for (const r of results ?? []) {
    const e = byPlayer[r.player_id]; if (!e) continue;
    (e.series as unknown[]).push({
      round: num(r.round_number), inBusiness: true,
      profit: Math.round(num(r.profit)), cash: Math.round(num(r.cash_after)),
      marketSharePct: round2(num(r.market_share) * 100), served: Math.round(num(r.served)),
      price: Math.round(num(r.price)), brand: round2(num(r.brand_after)),
      reputation: round2(num(r.reputation_after)), quality: round2(num(r.quality)),
      capacity: Math.round(num(r.capacity)), marketingTotal: Math.round(num(r.marketing_total)),
      qualityInvest: Math.round(num(r.quality_invest))
    });
  }

  // Месяцы вне бизнеса. Капитал и доход у этих игроков реальные, и на
  // табло они должны быть видны наравне со всеми. А доли рынка, клиентов
  // и бренда у человека без заведения не существует — там честный null,
  // и линия на графике рвётся, как и должна.
  for (const w of wallets ?? []) {
    const e = byPlayer[w.player_id]; if (!e) continue;
    (e.series as unknown[]).push({
      round: num(w.round_number), inBusiness: false, offBusinessStatus: w.status,
      profit: Math.round(num(w.income)), cash: Math.round(num(w.savings)),
      marketSharePct: null, served: null, price: null, brand: null,
      reputation: null, quality: null, capacity: null,
      marketingTotal: null, qualityInvest: null
    });
  }

  for (const k of Object.keys(byPlayer)) {
    (byPlayer[k].series as { round: number }[]).sort((a, b) => a.round - b.round);
  }

  const marketTotals: Record<number, number> = {};
  for (const r of results ?? []) marketTotals[num(r.round_number)] = Math.round(num(r.market_total));

  const rounds = Object.keys(marketTotals).map(Number).sort((a, b) => a - b);
  const latestMarketTotal = rounds.length ? marketTotals[rounds[rounds.length - 1]] : null;

  // Табло читает эти поля с ВЕРХНЕГО уровня — так было в старом API.
  // Вложенный game оставляем для совместимости на будущее.
  return {
    ok: true,
    roundNumber: num(round.round_number),
    roundStatus: round.status,
    deadline: round.status === 'open' ? round.deadline : null,
    serverNow: new Date().toISOString(),
    totalRounds: cfg.TOTAL_ROUNDS,
    gameFinished: round.status === 'closed' && num(round.round_number) >= cfg.TOTAL_ROUNDS,
    game: {
      code: String(game.code), roundNumber: num(round.round_number), roundStatus: round.status,
      totalRounds: cfg.TOTAL_ROUNDS
    },
    players: Object.values(byPlayer),
    marketTotals,

    // Вкладка «Казна» на табло: два графика — сколько пришло за месяц и
    // сколько накоплено всего. Видно всем: это общая рамка партии, а не
    // секрет ведущего.
    treasury: ((): unknown => {
      const rows = (treasuryRows ?? []).map((t) => ({
        round: num(t.round_number),
        income: Math.round(num(t.income)),
        balance: Math.round(num(t.balance)),
        rent: Math.round(num(t.rent)),
        interest: Math.round(num(t.interest)),
        fines: Math.round(num(t.fines)),
        subsidies: Math.round(num(t.subsidies))
      }));
      return rows;
    })(),

    // Вкладка "технические данные" на табло: общие для всех правила игры.
    // Ведущий выводит её на проектор, когда объясняет механику, поэтому
    // цифры берутся из живого конфига, а не из памяти рассказчика.
    techInfo: {
      playersCount: (players ?? []).length,
      currentMarketTotal: latestMarketTotal,
      pRef: money(cfg.P_REF, cfg),
      cogsBase: money(cfg.P_REF * cfg.COGS_PCT, cfg),
      rent: money(cfg.RENT, cfg),
      payroll: money(cfg.PAYROLL_BASE, cfg),
      capacityBase: cfg.CAPACITY_BASE,
      capacityStep: cfg.CAPACITY_STEP,
      startCapital: money(cfg.START_CAPITAL, cfg),
      loanRateAnnual: cfg.LOAN_RATE_ANNUAL,
      roundDurationMin: cfg.ROUND_DURATION_MIN,
      totalRounds: cfg.TOTAL_ROUNDS,
      quality: {
        weight: cfg.K_QUALITY, investDivisor: money(cfg.QUALITY_INVEST_DIVISOR, cfg),
        decay: cfg.QUALITY_DECAY, upkeep: money(cfg.QUALITY_UPKEEP, cfg),
        cogsAdd: cfg.QUALITY_COGS_ADD
      },
      marketing: {
        seo: { weight: cfg.K_SEO, alpha: cfg.SEO_ALPHA, refBudget: money(cfg.SEO_REF, cfg),
               rampMonths: cfg.SEO_RAMP_MONTHS, decay: cfg.SEO_DECAY },
        promo: { weight: cfg.K_PROMO, alpha: cfg.PROMO_ALPHA, refBudget: money(cfg.PROMO_REF, cfg) },
        maps: { weight: cfg.K_MAPS, alpha: cfg.MAPS_ALPHA, refBudget: money(cfg.MAPS_REF, cfg),
                decay: cfg.MAPS_DECAY },
        social: { weight: cfg.K_SOCIAL, alpha: cfg.SOCIAL_ALPHA, refBudget: money(cfg.SOCIAL_REF, cfg),
                  decay: cfg.SOCIAL_DECAY },
        outdoor: { weight: cfg.K_OUTDOOR, alpha: cfg.OUTDOOR_ALPHA, refBudget: money(cfg.OUTDOOR_REF, cfg),
                   minSpend: money(cfg.OUTDOOR_MIN_SPEND, cfg),
                   durationMonths: cfg.OUTDOOR_DURATION_MONTHS },
        affiliate: { minSpend: money(cfg.AFFILIATE_MIN_SPEND, cfg), bonusPct: cfg.AFFILIATE_BONUS_PCT }
      }
    }
  };
}



// --------------------------------------------------------------- пути вне бизнеса

// Аналог PLAYER_DEFAULTS_ из версии на таблицах: полный сброс всего, что
// относится к заведению. Применяется и при закрытии дела, и при открытии
// нового — новое дело начинается с чистого листа, без унаследованного
// бренда, репутации и разогретых рекламных каналов.
function businessReset() {
  return {
    brand: 0, reputation: 1, quality: 0, capacity_shifts: 0,
    seo_level: 0, seo_streak: 0, seo_unlocked: false,
    maps_level: 0, social_adstock: 0,
    outdoor_level: 0, outdoor_active_until: 0, affiliate_active: false,
    loan_tier: 0, loan_balance: 0, loan_term_left: 0, loan_monthly_principal: 0,
    cf_positive_streak: 0, ever_missed_payment: false
  };
}

const OFF_BUSINESS = ['civil_service', 'freelance', 'custom_employed'];

/**
 * Смена деятельности. Доступна и банкроту (обязательный выбор), и
 * активному игроку (добровольный уход), и тому, кто уже вне бизнеса
 * (переключение между путями).
 */
async function chooseCareerPath(ctx: Ctx, q: URLSearchParams) {
  const cfg = ctx.cfg;
  const path = String(q.get('path') ?? '');
  const professionName = String(q.get('professionName') ?? '').trim().slice(0, 60);

  const { data: p } = await db.from('players').select('*').eq('id', ctx.playerId!).single();
  const status = String(p.status);

  const fromActiveOrBankrupt = status === 'active' || status === 'bankrupt';
  const fromOff = OFF_BUSINESS.includes(status);
  if (!fromActiveOrBankrupt && !fromOff) return { ok: false, error: 'invalid_state' };

  // Что человек уносит с собой. Уходя из работающего дела — кассу за
  // вычетом непогашенного кредита: долг закрывается первым. Банкрот не
  // уносит ничего, у него касса уже в минусе.
  let settleCash: number;
  if (status === 'active') settleCash = Math.max(0, num(p.cash) - num(p.loan_balance));
  else if (fromOff) settleCash = num(p.employment_savings);
  else settleCash = 0;

  const round = await currentRound(String(ctx.game.id));
  const rn = num(round.round_number);

  if (path === 'end') {
    await db.from('players').update({
      ...businessReset(), cash: 0, employment_savings: 0, status: 'left',
      custom_profession_name: null, employer_username: null, proposed_salary: 0,
      employment_approved: false, salary_paid_this_round: false,
      service_since_round: 0, last_salary_round: 0, savings_last_round: 0
    }).eq('id', ctx.playerId!);
    return { ok: true, left: true, settled: money(settleCash, cfg) };
  }

  if (!['civil_service', 'freelance', 'custom'].includes(path)) {
    return { ok: false, error: 'invalid_path' };
  }

  const newStatus = path === 'custom' ? 'custom_employed' : path;
  const isCivil = newStatus === 'civil_service';

  // Месяц поступления на службу фиксируем ЯВНО. Если месяц сейчас открыт,
  // человек служит уже в нём и получит за него; если закрыт (идёт
  // обсуждение) — служба начинается со следующего. Без этой отметки
  // зарплата «съезжала» на месяц, когда выбор совпадал с закрытием.
  const serviceSince = round.status === 'open' ? rn : rn + 1;

  await db.from('players').update({
    ...businessReset(),
    cash: 0,
    employment_savings: settleCash,
    status: newStatus,
    custom_profession_name: path === 'custom' ? professionName : null,
    employer_username: null, proposed_salary: 0,
    employment_approved: false, salary_paid_this_round: false,
    service_since_round: isCivil ? serviceSince : 0,
    last_salary_round: isCivil ? serviceSince - 1 : 0,
    // Выходное пособие — не доход месяца, иначе на табло был бы фальшивый
    // всплеск дохода ровно в месяц ухода из бизнеса.
    savings_last_round: settleCash
  }).eq('id', ctx.playerId!);

  if (settleCash > 0) {
    await db.from('ledger').insert({
      game_id: ctx.game.id, player_id: ctx.playerId, round_number: rn,
      kind: 'settlement', amount: settleCash, target: 'savings',
      reason: 'Остаток при закрытии дела', actor: ctx.username
    });
  }

  return { ok: true, settled: money(settleCash, cfg) };
}

/** Накопил порог — открывает новое дело. Полный сброс показателей. */
async function reopenBusiness(ctx: Ctx) {
  const cfg = ctx.cfg;
  const { data: p } = await db.from('players').select('*').eq('id', ctx.playerId!).single();

  if (!OFF_BUSINESS.includes(String(p.status))) return { ok: false, error: 'not_eligible' };
  const savings = num(p.employment_savings);
  if (savings < cfg.REOPEN_THRESHOLD) return { ok: false, error: 'not_enough_savings' };

  await db.from('players').update({
    ...businessReset(),
    cash: savings, employment_savings: 0, status: 'active',
    custom_profession_name: null, employer_username: null, proposed_salary: 0,
    employment_approved: false, salary_paid_this_round: false,
    service_since_round: 0, last_salary_round: 0, savings_last_round: 0
  }).eq('id', ctx.playerId!);

  const round = await currentRound(String(ctx.game.id));
  await db.from('ledger').insert({
    game_id: ctx.game.id, player_id: ctx.playerId, round_number: num(round.round_number),
    kind: 'reopen', amount: savings, target: 'cash',
    reason: 'Открытие нового дела', actor: ctx.username
  });

  return { ok: true, cash: money(savings, cfg) };
}

/** Наёмный предлагает себя активному игроку за зарплату. */
async function proposeEmployment(ctx: Ctx, q: URLSearchParams) {
  const employerUsername = norm(q.get('employerUsername'));
  const salary = Math.max(0, Math.floor(num(q.get('salary'))));

  const { data: me } = await db.from('players').select('*').eq('id', ctx.playerId!).single();
  if (me.status !== 'custom_employed') return { ok: false, error: 'not_custom_path' };
  if (employerUsername === ctx.username) return { ok: false, error: 'self_employer' };

  const { data: employer } = await db.from('players')
    .select('id, status').eq('game_id', ctx.game.id).eq('username', employerUsername).maybeSingle();
  if (!employer) return { ok: false, error: 'employer_not_found' };
  if (employer.status !== 'active') return { ok: false, error: 'employer_not_active' };

  await db.from('players').update({
    employer_username: employerUsername, proposed_salary: salary,
    employment_approved: false, salary_paid_this_round: false
  }).eq('id', ctx.playerId!);

  return { ok: true };
}

/** Наниматель одобряет или отклоняет кандидата. */
async function respondToEmployment(ctx: Ctx, q: URLSearchParams) {
  const employeeUsername = norm(q.get('employeeUsername'));
  const approve = q.get('approve') === 'true' || q.get('approve') === '1';

  const { data: emp } = await db.from('players')
    .select('*').eq('game_id', ctx.game.id).eq('username', employeeUsername).maybeSingle();

  if (!emp || emp.status !== 'custom_employed' || norm(emp.employer_username) !== ctx.username) {
    return { ok: false, error: 'not_your_employee' };
  }

  if (approve) {
    await db.from('players').update({ employment_approved: true }).eq('id', emp.id);
  } else {
    // Отклонённый исчезает из списка нанимателя и может предложить себя
    // другому игроку — путь остаётся, пропадает только эта договорённость.
    await db.from('players').update({
      employer_username: null, proposed_salary: 0,
      employment_approved: false, salary_paid_this_round: false
    }).eq('id', emp.id);
  }

  return { ok: true, approved: approve };
}

/** Наниматель платит зарплату за текущий месяц. */
async function paySalary(ctx: Ctx, q: URLSearchParams) {
  const cfg = ctx.cfg;
  const employeeUsername = norm(q.get('employeeUsername'));

  const { data: employer } = await db.from('players').select('*').eq('id', ctx.playerId!).single();
  const { data: emp } = await db.from('players')
    .select('*').eq('game_id', ctx.game.id).eq('username', employeeUsername).maybeSingle();

  if (!emp || emp.status !== 'custom_employed' ||
      norm(emp.employer_username) !== ctx.username || !emp.employment_approved) {
    return { ok: false, error: 'not_your_employee' };
  }
  if (emp.salary_paid_this_round) return { ok: false, error: 'already_paid' };

  const salary = num(emp.proposed_salary);
  if (salary > num(employer.cash)) {
    return {
      ok: false, error: 'insufficient_cash',
      needed: money(salary, cfg), available: money(num(employer.cash), cfg)
    };
  }

  await db.from('players').update({ cash: num(employer.cash) - salary }).eq('id', employer.id);
  await db.from('players').update({
    employment_savings: num(emp.employment_savings) + salary,
    salary_paid_this_round: true
  }).eq('id', emp.id);

  const round = await currentRound(String(ctx.game.id));
  const rn = num(round.round_number);
  await db.from('ledger').insert([
    { game_id: ctx.game.id, player_id: employer.id, round_number: rn, kind: 'employer_salary',
      amount: -salary, target: 'cash', reason: 'Зарплата @' + employeeUsername, actor: ctx.username },
    { game_id: ctx.game.id, player_id: emp.id, round_number: rn, kind: 'employer_salary',
      amount: salary, target: 'savings', reason: 'Зарплата от @' + ctx.username, actor: ctx.username }
  ]);

  return { ok: true, paid: money(salary, cfg) };
}

/**
 * Полный сброс партии. Структура таблиц не трогается.
 *
 * Вся работа делается одной транзакцией на стороне базы (reset_game).
 * Раньше здесь была цепочка отдельных удалений, и у неё было две беды:
 * обрыв связи посередине оставлял партию наполовину сброшенной, а список
 * таблиц жил в этом файле — из-за чего при добавлении казны про неё
 * забыли, и старое государство переезжало в новую партию.
 */
async function adminResetGame(ctx: Ctx, q: URLSearchParams) {
  // Подтверждение берёт на себя интерфейс: две кнопки вместо ввода кода
  // руками. Параметр остаётся защитой от случайного вызова по ссылке.
  if (q.get('confirm') !== 'yes') return { ok: false, error: 'confirm_required' };

  // Партия не стирается, а закрывается и уходит в архив: рядом
  // создаётся новая с тем же составом и настройками. Иначе рейтинг по
  // всем партиям считать было бы не из чего — каждая новая игра
  // затирала бы предыдущую.
  const { data, error } = await db.rpc('archive_and_restart_game', {
    p_game_id: ctx.game.id,
    p_admin_username: ctx.username
  });
  if (error) return { ok: false, error: String(error.message) };
  return { ok: true, ...(data as object) };
}


/**
 * Состав партии. Переданный список ников — это и есть итоговый состав:
 * кого нет в базе, того добавляем; кого нет в списке, того убираем.
 *
 * Убираем ОСТОРОЖНО: если у игрока уже есть сыгранные месяцы, удаление
 * порвало бы историю и графики на табло. Такого игрока не трогаем и
 * сообщаем об этом ведущему, а не молча оставляем его в партии.
 */
async function adminSetPlayers(ctx: Ctx, q: URLSearchParams) {
  const cfg = ctx.cfg;
  const gameId = String(ctx.game.id);

  let raw: unknown;
  try { raw = JSON.parse(q.get('usernames') ?? '[]'); }
  catch { return { ok: false, error: 'bad_json' }; }
  if (!Array.isArray(raw)) return { ok: false, error: 'bad_list' };

  // Собачка, регистр и пробелы срезаются: @Ivan, Ivan и ivan — один человек.
  const wanted: string[] = [];
  const skipped: Record<string, string> = {};
  for (const item of raw) {
    const u = norm(item);
    if (!u) continue;
    if (u === norm(ctx.game.admin_username)) { skipped[u] = 'это ник ведущего'; continue; }
    if (wanted.includes(u)) { skipped[u] = 'повторяется в списке'; continue; }
    if (!/^[a-z0-9_]{3,32}$/.test(u)) { skipped[u] = 'недопустимый ник Telegram'; continue; }
    wanted.push(u);
  }

  const { data: existing } = await db.from('players')
    .select('id, username').eq('game_id', gameId);
  const have = new Map((existing ?? []).map((p) => [String(p.username), String(p.id)]));

  const added: string[] = [];
  for (const u of wanted) {
    if (have.has(u)) continue;
    const { data: created } = await db.from('players')
      .insert({ game_id: gameId, username: u, cash: cfg.START_CAPITAL, reputation: 1, status: 'active' })
      .select('id').single();
    if (created) {
      await db.from('ledger').insert({
        game_id: gameId, player_id: created.id, kind: 'start_capital',
        amount: cfg.START_CAPITAL, target: 'cash', reason: 'Стартовый капитал', actor: ctx.username
      });
      added.push(u);
    }
  }

  const removed: string[] = [];
  const kept: Record<string, string> = {};
  for (const [u, id] of have) {
    if (wanted.includes(u)) continue;
    const { count } = await db.from('results')
      .select('id', { count: 'exact', head: true }).eq('game_id', gameId).eq('player_id', id);
    if ((count ?? 0) > 0) { kept[u] = 'уже играл — удаление порвало бы историю'; continue; }
    await db.from('players').delete().eq('id', id);
    removed.push(u);
  }

  await db.from('admin_actions').insert({
    game_id: gameId, admin_username: ctx.username, action: 'roster',
    payload: { added, removed, kept, skipped }, reason: 'Правка состава игроков'
  });

  return { ok: true, total: wanted.length, added, removed, kept, skipped };
}

// --------------------------------------------------------------- банк



async function requestLoan(ctx: Ctx, q: URLSearchParams) {
  const cfg = ctx.cfg;
  const amount = Math.floor(num(q.get('amount')));
  if (!(amount > 0)) return { ok: false, error: 'bad_amount' };

  const { data: p } = await db.from('players').select('*').eq('id', ctx.playerId!).single();
  if (p.status !== 'active') return { ok: false, error: 'not_active' };

  const tier = num(p.loan_tier);
  if (tier < 1) return { ok: false, error: 'no_tier' };

  const available = Math.max(0, loanLimitFor(tier, cfg) - num(p.loan_balance));
  if (amount > available) {
    return { ok: false, error: 'over_limit', available: money(available, cfg) };
  }

  const balance = num(p.loan_balance) + amount;
  // Тело долга гасится равными долями за срок кредита, проценты идут
  // сверху на остаток. Пересчитываем платёж от НОВОГО остатка, иначе
  // второй кредит гасился бы по графику первого.
  const monthly = Math.ceil(balance / cfg.LOAN_TERM_MONTHS);

  await db.from('players').update({
    cash: num(p.cash) + amount,
    loan_balance: balance,
    loan_term_left: cfg.LOAN_TERM_MONTHS,
    loan_monthly_principal: monthly
  }).eq('id', ctx.playerId!);

  const round = await currentRound(String(ctx.game.id));
  await db.from('ledger').insert({
    game_id: ctx.game.id, player_id: ctx.playerId, round_number: num(round.round_number),
    kind: 'loan_out', amount, target: 'cash', reason: 'Кредит получен', actor: ctx.username
  });

  // Клиент показывает res.received. Раньше сервер отдавал amount, и в
  // окне подтверждения игрок видел прочерк вместо суммы: механика
  // отрабатывала верно, а сообщение молчало.
  return {
    ok: true,
    received: money(amount, cfg),
    balance: money(balance, cfg),
    remaining: money(balance, cfg),
    available: money(Math.max(0, loanLimitFor(tier, cfg) - balance), cfg)
  };
}

async function repayLoan(ctx: Ctx, q: URLSearchParams) {
  const cfg = ctx.cfg;
  const amount = Math.floor(num(q.get('amount')));
  if (!(amount > 0)) return { ok: false, error: 'bad_amount' };

  const { data: p } = await db.from('players').select('*').eq('id', ctx.playerId!).single();
  if (num(p.loan_balance) <= 0) return { ok: false, error: 'no_loan' };
  if (amount > num(p.cash)) return { ok: false, error: 'insufficient_cash' };

  const pay = Math.min(amount, num(p.loan_balance));
  const balance = num(p.loan_balance) - pay;
  const monthly = balance > 0 ? Math.min(num(p.loan_monthly_principal), balance) : 0;

  await db.from('players').update({
    cash: num(p.cash) - pay,
    loan_balance: balance,
    loan_monthly_principal: monthly,
    loan_term_left: balance > 0 ? num(p.loan_term_left) : 0
  }).eq('id', ctx.playerId!);

  const round = await currentRound(String(ctx.game.id));
  await db.from('ledger').insert({
    game_id: ctx.game.id, player_id: ctx.playerId, round_number: num(round.round_number),
    kind: 'loan_repay', amount: -pay, target: 'cash',
    reason: 'Досрочное погашение', actor: ctx.username
  });

  return {
    ok: true,
    paid: money(pay, cfg),
    remaining: money(balance, cfg),
    balance: money(balance, cfg)
  };
}

// --------------------------------------------------------------- переводы

async function transferMoney(ctx: Ctx, q: URLSearchParams) {
  const cfg = ctx.cfg;
  const to = norm(q.get('toUsername'));
  const amount = Math.floor(num(q.get('amount')));
  if (!to || !(amount > 0)) return { ok: false, error: 'bad_params' };

  const { data: from } = await db.from('players').select('*').eq('id', ctx.playerId!).single();

  // v4.6. Переводить теперь может и тот, кто вне бизнеса. У него деньги
  // лежат не в кассе (там ноль по определению), а в накоплениях — раньше
  // проверка смотрела только на кассу, и госслужащий со ста тысячами на
  // счету получал отказ «недостаточно средств».
  //
  // Это не мелочь для баланса: госслужащий с гарантированным доходом
  // становится источником финансирования, а значит и стороной в
  // переговорах. Раньше он мог только копить на себя.
  const fromOff = OFF_BUSINESS.includes(String(from.status));
  if (from.status === 'left') return { ok: false, error: 'not_active' };

  const fromBalance = fromOff ? num(from.employment_savings) : num(from.cash);
  if (amount > fromBalance) {
    return { ok: false, error: 'insufficient_cash', available: money(fromBalance, cfg) };
  }

  const { data: target } = await db.from('players')
    .select('*').eq('game_id', ctx.game.id).eq('username', to).maybeSingle();
  if (!target) return { ok: false, error: 'recipient_not_found' };
  if (target.id === from.id) return { ok: false, error: 'self_transfer' };

  // Получателю вне бизнеса деньги идут в накопления: касса закрытого
  // заведения ему недоступна, и перевод туда просто исчез бы с экрана.
  const toSavings = ['civil_service', 'freelance', 'custom_employed'].includes(target.status);

  await db.from('players').update(
    fromOff
      ? { employment_savings: num(from.employment_savings) - amount }
      : { cash: num(from.cash) - amount }
  ).eq('id', from.id);
  await db.from('players').update(
    toSavings
      ? { employment_savings: num(target.employment_savings) + amount }
      : { cash: num(target.cash) + amount }
  ).eq('id', target.id);

  const round = await currentRound(String(ctx.game.id));
  const rn = num(round.round_number);
  await db.from('transfers').insert({
    game_id: ctx.game.id, from_player: from.id, to_player: target.id,
    amount, round_number: rn
  });
  await db.from('ledger').insert([
    { game_id: ctx.game.id, player_id: from.id, round_number: rn, kind: 'transfer_out',
      amount: -amount, target: fromOff ? 'savings' : 'cash',
      reason: 'Перевод игроку @' + to, actor: ctx.username },
    { game_id: ctx.game.id, player_id: target.id, round_number: rn, kind: 'transfer_in',
      amount, target: toSavings ? 'savings' : 'cash',
      reason: 'Перевод от @' + ctx.username, actor: ctx.username }
  ]);

  return {
    ok: true,
    sent: money(amount, cfg),
    to,
    toRestaurant: target.restaurant_name || ('@' + to),
    available: money(fromBalance - amount, cfg)
  };
}

// --------------------------------------------------------------- конфиг

// Менять разрешено только эти ключи. Белый список, а не свобода: опечатка
// в коэффициенте эластичности посреди партии обрушила бы экономику так,
// что игроки этого даже не поняли бы.
const EDITABLE_CONFIG: Record<string, { min: number; max: number; int?: boolean }> = {
  ROUND_DURATION_MIN:   { min: 1,    max: 120,      int: true },
  RENT:                 { min: 0,    max: 5000000 },
  PAYROLL_BASE:         { min: 0,    max: 5000000 },
  TOTAL_ROUNDS:         { min: 1,    max: 36,       int: true },
  START_CAPITAL:        { min: 0,    max: 10000000 },
  CIVIL_SERVICE_SALARY: { min: 0,    max: 1000000 },
  REOPEN_THRESHOLD:     { min: 0,    max: 10000000 },
  P_REF:                { min: 10,   max: 100000 },
  MARKET_SIZE_PER_PLAYER: { min: 100, max: 1000000, int: true },
  // Ставка задаётся долей, а не процентами: 0.15 = 15% годовых.
  LOAN_RATE_ANNUAL:     { min: 0,    max: 1 },
  LOAN_TERM_MONTHS:     { min: 1,    max: 36,       int: true }
};

async function adminUpdateConfig(ctx: Ctx, q: URLSearchParams) {
  let updates: Record<string, unknown>;
  try {
    updates = JSON.parse(q.get('updates') ?? '{}');
  } catch {
    return { ok: false, error: 'bad_json' };
  }

  const cfg = { ...(ctx.game.config as Record<string, unknown>) };
  const applied: Record<string, number> = {};
  const rejected: Record<string, string> = {};

  for (const [key, raw] of Object.entries(updates)) {
    const rule = EDITABLE_CONFIG[key];
    if (!rule) { rejected[key] = 'этот параметр менять нельзя'; continue; }

    const v = Number(raw);
    if (!Number.isFinite(v)) { rejected[key] = 'не число'; continue; }
    if (rule.int && !Number.isInteger(v)) { rejected[key] = 'нужно целое число'; continue; }
    if (v < rule.min || v > rule.max) {
      rejected[key] = 'допустимо от ' + rule.min + ' до ' + rule.max;
      continue;
    }
    cfg[key] = v;
    applied[key] = v;
  }

  if (Object.keys(applied).length) {
    await db.from('games').update({
      config: cfg,
      total_rounds: Number(cfg.TOTAL_ROUNDS) || ctx.game.total_rounds
    }).eq('id', ctx.game.id);

    await db.from('admin_actions').insert({
      game_id: ctx.game.id, admin_username: ctx.username,
      action: 'config', payload: applied, reason: 'Правка настроек игры'
    });
    ctx.cfg = cfg as unknown as Config;
    ctx.game.config = cfg;
  }

  return { ok: true, applied, rejected };
}

// --------------------------------------------------------------- маршрутизация


const PLAYER_STATE_ACTIONS = ['submitDecision', 'setProfile', 'markBankRead',
                             'requestLoan', 'repayLoan', 'transferMoney',
                             'chooseCareerPath', 'reopenBusiness', 'proposeEmployment',
                             'respondToEmployment', 'paySalary'];
const ADMIN_STATE_ACTIONS = ['adminOpenRound', 'adminCalculateRound', 'adminAdjust',
                             'adminUpdateConfig', 'adminResetGame', 'adminSetPlayers'];

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const url = new URL(req.url);
    const q = url.searchParams;
    const action = q.get('action') ?? '';

    // Табло открыто всем: оно и так висит на проекторе.
    if (action === 'timeline') return json(await getTimeline());

    // Рейтинг тоже публичный: любой игрок подходит к экрану и смотрит
    // своё место и то, из чего оно сложилось. Считается по всем партиям
    // в базе, поэтому обновляется сам после каждой закрытой игры.
    if (action === 'rating') {
      // Две партии для попадания в рейтинг: первая уходит на знакомство с
      // правилами, со второй человек играет осознанно.
      const minGames = Math.max(1, num(q.get('minGames'), 1));
      const minMonths = Math.max(1, num(q.get('minMonths'), 9));
      const idleHours = Math.max(1, num(q.get('idleHours'), 1));
      const { data, error } = await db.rpc('player_ratings', {
        p_min_games: minGames, p_min_months: minMonths, p_idle_hours: idleHours
      });
      if (error) return json({ ok: false, error: String(error.message) });
      // Форма ответа изменилась: теперь это лиги 12/24/36 плюс список
      // прошедших учебную партию, а не плоский список игроков.
      const payload = (data ?? {}) as Record<string, unknown>;
      return json({
        ok: true, minGames, minMonths,
        leagues: payload.leagues ?? [],
        trainees: payload.trainees ?? []
      });
    }

    const ctxOrErr = await loadContext(q.get('u') ?? '', q.get('as'));
    if ('error' in ctxOrErr) return json({ ok: false, error: ctxOrErr.error });
    const ctx = ctxOrErr;

    const requireAdmin = () => ctx.role === 'admin';
    const requirePlayer = () => ctx.role === 'player' && ctx.playerId;

    let result: Record<string, unknown>;

    switch (action) {
      case 'identify':
        return json({
          ok: true, role: ctx.role, username: ctx.username,
          impersonating: ctx.impersonating, realUsername: ctx.realUsername
        });

      case 'dashboard':
        if (!requirePlayer()) return json({ ok: false, error: 'not_player' });
        return json(await getDashboard(ctx));

      case 'monitor':
        if (!requireAdmin()) return json({ ok: false, error: 'not_admin' });
        return json(await adminMonitor(ctx));

      case 'submitDecision':
        if (!requirePlayer()) return json({ ok: false, error: 'not_player' });
        result = await submitDecision(ctx, q);
        break;

      case 'setProfile': {
        if (!requirePlayer()) return json({ ok: false, error: 'not_player' });
        const displayName = String(q.get('displayName') ?? '').trim().slice(0, 60);
        const restaurant = String(q.get('restaurantName') ?? '').trim().slice(0, 60);
        if (!displayName || !restaurant) { result = { ok: false, error: 'empty' }; break; }
        await db.from('players').update({
          display_name: displayName, restaurant_name: restaurant,
          joined_at: new Date().toISOString()
        }).eq('id', ctx.playerId!);
        result = { ok: true };
        break;
      }

      case 'markBankRead':
        if (!requirePlayer()) return json({ ok: false, error: 'not_player' });
        await db.from('bank_log').update({ read: true })
          .eq('game_id', ctx.game.id).eq('player_id', ctx.playerId!).eq('read', false);
        result = { ok: true };
        break;

      case 'requestLoan':
        if (!requirePlayer()) return json({ ok: false, error: 'not_player' });
        result = await requestLoan(ctx, q);
        break;

      case 'repayLoan':
        if (!requirePlayer()) return json({ ok: false, error: 'not_player' });
        result = await repayLoan(ctx, q);
        break;

      case 'transferMoney':
        if (!requirePlayer()) return json({ ok: false, error: 'not_player' });
        result = await transferMoney(ctx, q);
        break;

      case 'chooseCareerPath':
        if (!requirePlayer()) return json({ ok: false, error: 'not_player' });
        result = await chooseCareerPath(ctx, q);
        break;

      case 'reopenBusiness':
        if (!requirePlayer()) return json({ ok: false, error: 'not_player' });
        result = await reopenBusiness(ctx);
        break;

      case 'proposeEmployment':
        if (!requirePlayer()) return json({ ok: false, error: 'not_player' });
        result = await proposeEmployment(ctx, q);
        break;

      case 'respondToEmployment':
        if (!requirePlayer()) return json({ ok: false, error: 'not_player' });
        result = await respondToEmployment(ctx, q);
        break;

      case 'paySalary':
        if (!requirePlayer()) return json({ ok: false, error: 'not_player' });
        result = await paySalary(ctx, q);
        break;

      case 'adminSetPlayers':
        if (!requireAdmin()) return json({ ok: false, error: 'not_admin' });
        result = await adminSetPlayers(ctx, q);
        break;

      case 'adminResetGame':
        if (!requireAdmin()) return json({ ok: false, error: 'not_admin' });
        result = await adminResetGame(ctx, q);
        break;

      case 'adminUpdateConfig':
        if (!requireAdmin()) return json({ ok: false, error: 'not_admin' });
        result = await adminUpdateConfig(ctx, q);
        break;

      case 'adminOpenRound':
        if (!requireAdmin()) return json({ ok: false, error: 'not_admin' });
        result = await adminOpenRound(ctx);
        break;

      case 'adminCalculateRound':
        if (!requireAdmin()) return json({ ok: false, error: 'not_admin' });
        result = await adminCalculateRound(ctx);
        break;

      case 'adminAdjust':
        if (!requireAdmin()) return json({ ok: false, error: 'not_admin' });
        result = await adminAdjust(ctx, q);
        break;

      default:
        return json({ ok: true, status: 'API работает. Откройте игру по ссылке из BotFather.' });
    }

    // Свежее состояние прямо в ответе на действие: клиенту не нужен второй
    // запрос, а значит нет ни гонки с фоновым опросом, ни ожидания цикла.
    if (result.ok === true) {
      if (PLAYER_STATE_ACTIONS.includes(action) && ctx.playerId) result.state = await getDashboard(ctx);
      else if (ADMIN_STATE_ACTIONS.includes(action)) result.state = await adminMonitor(ctx);
    }

    return json(result);
  } catch (err) {
    return json({ ok: false, error: String(err) }, 200);
  }
});
