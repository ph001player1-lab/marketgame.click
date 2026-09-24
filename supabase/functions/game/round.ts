// ============================================================================
//  Открытие и расчёт месяца.
//
//  Расчёт — одна транзакция: движок, отчёты команд, зарплаты госслужбы,
//  доходы арендодателя, банка, страховой и коммунальщиков, дивиденды
//  владельцам, налог и бюджет города. Либо месяц лёг целиком, либо не лёг
//  вовсе. Повторное нажатие «Рассчитать» ждёт блокировки месяца и получает
//  отказ: месяц уже закрыт.
// ============================================================================

import {
  calculateRound as runEngine, clampDecisionToCash, computeLoanTier, loanLimitFor,
  type Config, type RoundResult
} from './economy.ts';
import {
  type Sql, type Row, fail, num, cents, currentRound, decisionFromRow, defaultDecision,
  toPlayerState, addLedger, addCity, usd, INSTITUTIONS,
  type LedgerEntry, type CityEntry
} from './lib.ts';

/** Откуда каждый участник экономики получает деньги ресторанов. */
const INCOME_FIELD: Record<string, keyof RoundResult> = {
  landlord: 'rent', bank: 'interest', insurer: 'insurance', utility: 'utilities'
};

export async function openMonth(sql: Sql, gameId: string) {
  return await sql.begin(async (tx: Sql) => {
    const [game] = await tx`select * from games where id = ${gameId} for update`;
    if (game.status === 'finished') fail('game_finished');

    const round = await currentRound(tx, gameId);
    if (round.status === 'open') fail('already_open');
    if (num(round.round_number) >= num(game.total_rounds)) fail('game_finished');

    const [{ n }] = await tx`
      select count(*)::int as n from players where game_id = ${gameId} and status <> 'left'`;
    if (n < 1) fail('no_players');

    // Правила месяца фиксируются здесь. Правки ведущего после этой минуты
    // действуют со следующего месяца: игроки решают по тем цифрам, по
    // которым их и посчитают.
    const cfg = game.config as Config;
    const next = num(round.round_number) + 1;
    const deadline = new Date(Date.now() + num(cfg.ROUND_DURATION_MIN, 5) * 60_000);

    await tx`
      insert into rounds (game_id, round_number, status, opened_at, deadline, config)
      values (${gameId}, ${next}, 'open', now(), ${deadline}, ${tx.json(cfg)})`;
    await tx`
      update games set current_round = ${next}, status = 'running',
                       started_at = coalesce(started_at, now())
      where id = ${gameId}`;

    return { ok: true, roundNumber: next, deadline: deadline.toISOString() };
  });
}

export async function calculateMonth(sql: Sql, gameId: string) {
  return await sql.begin(async (tx: Sql) => {
    const [game] = await tx`select * from games where id = ${gameId} for update`;
    const [round] = await tx`
      select * from rounds where game_id = ${gameId}
      order by round_number desc limit 1 for update`;
    if (!round || round.status !== 'open') fail('no_open_round');

    const rn = num(round.round_number);
    const cfg = round.config as Config;

    const everyone: Row[] = await tx`
      select * from players where game_id = ${gameId} order by created_at, id for update`;
    const before = new Map(everyone.map((p) => [String(p.id), p]));
    const activeRows = everyone.filter((p) => p.status === 'active');

    // ---- Решения и автоход. Кто не успел, за того — прошлое решение,
    // ужатое под текущую кассу.
    const decisions: Record<string, ReturnType<typeof decisionFromRow>> = {};
    const decRows: Row[] = await tx`
      select * from decisions where game_id = ${gameId} and round_number = ${rn}`;
    for (const r of decRows) decisions[String(r.player_id)] = decisionFromRow(r, cfg);

    for (const p of activeRows) {
      if (decisions[p.id]) continue;
      const [prev] = await tx`
        select * from decisions
        where game_id = ${gameId} and player_id = ${p.id} and round_number < ${rn}
        order by round_number desc limit 1`;
      const d = clampDecisionToCash(prev ? decisionFromRow(prev, cfg) : defaultDecision(cfg), num(p.cash), cfg);
      decisions[p.id] = d;
      await tx`insert into decisions ${tx({
        game_id: gameId, round_number: rn, player_id: p.id, ...d, autoplay: true
      })}`;
    }

    const out = runEngine({ roundNumber: rn, cfg, players: activeRows.map(toPlayerState), decisions });
    const after = new Map(out.players.map((p) => [p.id, p]));

    const ledger: LedgerEntry[] = [];
    const city: CityEntry[] = [];
    const notices: Row[] = [];

    // ---- Арендодатель, банк, страховая, коммунальщики.
    //
    // Доход каждого — платежи ресторанов этого месяца. У банка из дохода
    // вычитаются кредиты закрывшихся бизнесов. Убыток переносится: пока он
    // не покрыт, владельцы ничего не получают. Выплата делится по долям:
    // город, игроки, частные владельцы.
    const [{ total: writeOffs }] = await tx`
      select coalesce(sum(amount), 0) as total from loan_write_offs
      where game_id = ${gameId} and round_number = ${rn}`;
    const institutions: Row[] = await tx`
      select * from institutions where game_id = ${gameId} order by kind for update`;
    const stakes: Row[] = await tx`select * from stakes where game_id = ${gameId}`;
    const loansOutstanding = cents(out.players.reduce((a, p) => a + num(p.loan_balance), 0));

    const dividends = new Map<string, number>();
    const instMonths: Row[] = [];

    for (const inst of institutions) {
      const kind = String(inst.kind);
      const field = INCOME_FIELD[kind];
      const income = cents(out.results.reduce((a, r) => a + num(r[field]), 0));
      const wo = kind === 'bank' ? cents(num(writeOffs)) : 0;
      const profit = cents(income - wo);

      let lossCf = num(inst.loss_cf);
      let payout = 0;
      if (profit < 0) {
        lossCf = cents(lossCf - profit);
      } else {
        const offset = Math.min(lossCf, profit);
        lossCf = cents(lossCf - offset);
        payout = cents(profit - offset);
      }

      const holders = stakes.filter((s) => s.kind === kind);
      const playersPct = holders.reduce((a, s) => a + num(s.pct), 0);
      const toCity = cents(payout * num(inst.city_pct) / 100);
      let toPlayers = 0;
      for (const s of holders) {
        const holder = before.get(String(s.player_id));
        // Вышедший из игры дивидендов не получает — его доля достаётся
        // частным владельцам этого месяца.
        if (!holder || holder.status === 'left') continue;
        const amount = cents(payout * num(s.pct) / 100);
        if (amount <= 0) continue;
        dividends.set(String(s.player_id), cents((dividends.get(String(s.player_id)) ?? 0) + amount));
        toPlayers = cents(toPlayers + amount);
      }
      const toPrivate = cents(payout - toCity - toPlayers);

      city.push({
        game_id: gameId, round_number: rn, kind: 'dividend', amount: toCity,
        institution: kind, reason: 'City share of ' + kind + ' profit', actor: 'system'
      });
      instMonths.push({
        game_id: gameId, round_number: rn, kind, income, write_offs: wo, profit, payout,
        to_city: toCity, to_players: toPlayers, to_private: toPrivate,
        city_pct: num(inst.city_pct), players_pct: playersPct, loss_cf_after: lossCf,
        loans_outstanding: kind === 'bank' ? loansOutstanding : null
      });
      await tx`update institutions set loss_cf = ${lossCf} where game_id = ${gameId} and kind = ${kind}`;
    }
    if (instMonths.length) await tx`insert into institution_months ${tx(instMonths)}`;

    // ---- Работающие рестораны: отчёт, новое состояние, налог.
    const resultRows: Row[] = [];
    for (const r of out.results) {
      const pid = String(r.player_id);
      const p = after.get(pid)!;
      const old = before.get(pid)!;
      const div = dividends.get(pid) ?? 0;
      const cash = cents(num(p.cash) + div);

      // Дивиденды — тоже деньги этого месяца: могут спасти от банкротства.
      let status = p.status;
      let everMissed = p.ever_missed_payment;
      if (div > 0) {
        status = cash < 0 ? 'bankrupt' : 'active';
        everMissed = !!old.ever_missed_payment || (cash < 0 && num(old.loan_balance) > 0);
      }
      const tier = Math.max(num(old.loan_tier),
        computeLoanTier({ ...p, ever_missed_payment: everMissed }, cfg, rn));

      resultRows.push({
        game_id: gameId, round_number: rn, player_id: pid,
        price: r.price, demand: r.demand, served: r.served, lost: r.lost,
        revenue: r.revenue, cogs_total: r.cogs_total, gross_profit: r.gross_profit,
        rent: r.rent, insurance: r.insurance, utilities: r.utilities,
        payroll: r.payroll, shift_cost: r.shift_cost,
        quality_upkeep: r.quality_upkeep, quality_invest: r.quality_invest,
        marketing_total: r.marketing_total, marketing_effect: r.marketing_effect,
        ebit: r.ebit, interest: r.interest, profit_before_tax: r.profit_before_tax,
        tax: r.tax, profit: r.profit, principal_paid: r.principal_paid,
        cash_flow: r.cash_flow, cash_after: cash,
        brand_after: r.brand_after, reputation_after: r.reputation_after,
        quality: r.quality, capacity: r.capacity,
        market_share: r.market_share, market_total: r.market_total,
        seo_spend: r.seo_spend, promo_spend: r.promo_spend, maps_spend: r.maps_spend,
        social_spend: r.social_spend, outdoor_spend: r.outdoor_spend, affiliate_spend: r.affiliate_spend,
        dividends: div, loan_balance_after: p.loan_balance
      });

      await tx`update players set ${tx({
        cash, brand: p.brand, reputation: p.reputation, quality: p.quality,
        capacity_shifts: p.capacity_shifts,
        seo_level: p.seo_level, seo_streak: p.seo_streak, seo_unlocked: p.seo_unlocked,
        maps_level: p.maps_level, social_adstock: p.social_adstock,
        outdoor_level: p.outdoor_level, outdoor_active_until: p.outdoor_active_until,
        affiliate_active: p.affiliate_active,
        loan_balance: p.loan_balance, loan_term_left: p.loan_term_left,
        loan_monthly_principal: p.loan_monthly_principal, loan_tier: tier,
        cf_positive_streak: p.cf_positive_streak, ever_missed_payment: everMissed,
        tax_loss_cf: num(p.tax_loss_cf), status
      })} where id = ${pid}`;

      ledger.push({
        game_id: gameId, player_id: pid, round_number: rn, kind: 'month_cash_flow',
        amount: r.cash_flow, target: 'cash', reason: 'Month ' + rn + ' cash flow', actor: 'system'
      });
      if (div > 0) {
        ledger.push({
          game_id: gameId, player_id: pid, round_number: rn, kind: 'dividend',
          amount: div, target: 'cash', reason: 'Dividends from your stakes', actor: 'system'
        });
      }
      city.push({
        game_id: gameId, round_number: rn, kind: 'profit_tax', amount: r.tax,
        player_id: pid, reason: 'Profit tax', actor: 'system'
      });

      if (tier > num(old.loan_tier)) {
        notices.push({ player_id: pid, kind: 'credit',
          message: 'Your credit limit is now ' + usd(loanLimitFor(tier, cfg)) + '.' });
      }
      if (status === 'bankrupt') {
        notices.push({ player_id: pid, kind: 'bankrupt',
          message: 'Your restaurant ran out of cash and closed. Choose what to do next.' });
      }
    }
    if (resultRows.length) await tx`insert into results ${tx(resultRows)}`;

    // ---- Вне бизнеса: зарплата госслужбы из бюджета города, дивиденды,
    // помесячный кошелёк для табло.
    const wallets: Row[] = [];
    for (const old of everyone) {
      if (old.status === 'active' || old.status === 'left') continue;
      const pid = String(old.id);
      let savings = num(old.employment_savings);
      const prev = num(old.savings_last_round);
      const upd: Row = {};

      if (old.status === 'civil_service') {
        // Зарплата с добором: если человек поступил на службу посреди
        // закрытого месяца, он получает и за него.
        const since = num(old.service_since_round) || rn;
        const paid = num(old.last_salary_round) || since - 1;
        const months = rn - Math.max(since, paid + 1) + 1;
        if (months > 0) {
          const pay = cents(months * num(cfg.CIVIL_SERVICE_SALARY));
          savings = cents(savings + pay);
          upd.last_salary_round = rn;
          upd.service_since_round = since;
          ledger.push({
            game_id: gameId, player_id: pid, round_number: rn, kind: 'civil_salary',
            amount: pay, target: 'savings',
            reason: 'Government job salary' + (months > 1 ? ' (' + months + ' months)' : ''), actor: 'system'
          });
          city.push({
            game_id: gameId, round_number: rn, kind: 'civil_salary', amount: -pay,
            player_id: pid, reason: 'Government job salary', actor: 'system'
          });
        }
      }

      const div = dividends.get(pid) ?? 0;
      if (div > 0) {
        savings = cents(savings + div);
        ledger.push({
          game_id: gameId, player_id: pid, round_number: rn, kind: 'dividend',
          amount: div, target: 'savings', reason: 'Dividends from your stakes', actor: 'system'
        });
      }

      await tx`update players set ${tx({ ...upd, employment_savings: savings, savings_last_round: savings })}
               where id = ${pid}`;
      wallets.push({
        game_id: gameId, round_number: rn, player_id: pid, status: old.status,
        savings, income: cents(savings - prev)
      });
    }
    if (wallets.length) await tx`insert into wallet_entries ${tx(wallets)}`;

    await tx`update players set salary_paid_this_round = false
             where game_id = ${gameId} and salary_paid_this_round`;

    await addLedger(tx, ledger);
    await addCity(tx, city);
    if (notices.length) {
      await tx`insert into notices ${tx(notices.map((n) => ({ game_id: gameId, round_number: rn, ...n })))}`;
    }

    // ---- Месяц закрыт. Последний месяц лиги закрывает игру: она сразу
    // попадает в рейтинг, без ожидания.
    await tx`update rounds set status = 'closed', closed_at = now()
             where game_id = ${gameId} and round_number = ${rn}`;
    const finished = rn >= num(game.total_rounds);
    await tx`update games set current_round = ${rn},
                              status = ${finished ? 'finished' : 'running'},
                              finished_at = ${finished ? new Date() : null}
             where id = ${gameId}`;

    return {
      ok: true, roundNumber: rn, finished,
      marketTotal: Math.round(out.marketTotal), players: out.playerCount
    };
  });
}

export { INSTITUTIONS };
