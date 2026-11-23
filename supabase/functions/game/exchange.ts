// ============================================================================
//  Биржа: заявки на покупку долей, торг, аукцион.
//
//  Команда просит владельца доли — город (отвечает ведущий) или другую
//  команду — продать ей часть компании: сколько процентов и за сколько.
//  Владелец:
//    • принимает — сделка сразу;
//    • отказывает;
//    • называет свою цену — теперь ход покупателя: принять, назвать свою,
//      отказаться; кругов торга сколько угодно;
//    • объявляет аукцион.
//
//  Деньги не замораживаются: хватает ли их у покупателя и есть ли доля у
//  продавца — проверяется в момент сделки. Платят как везде: работающий
//  ресторан — из кассы, вне бизнеса — из накоплений; банкрот не покупает.
//  Деньги за долю города — в бюджет города. Заявка действует до расчёта
//  текущего месяца; у команды не больше одной открытой заявки.
//
//  Аукцион — 3 минуты, ставки делают все команды, кроме продавца.
//  Начальная цена — цена заявки, она же первая ставка того, кто подал
//  заявку. Ставка — выше лучшей хотя бы на 1 и не больше денег команды;
//  ставка в последние 15 секунд продлевает аукцион на 15 секунд.
//  Победитель платит свою ставку; если к концу у него не хватает денег —
//  доля уходит следующей ставке. Снять аукцион может только ведущий.
//
//  Торг видят двое и ведущий; аукцион — все, и на проекторе; сделки — в
//  «Новостях» (board.ts, newsFeed).
// ============================================================================

import {
  type Sql, type Row, fail, num, cents, round2, currentRound, accountingRound, addLedger, addCity, addNotice,
  logHostAction, moneyTarget, available, teamLabel, isInstitution, INSTITUTIONS, usd, nested, lockGame
} from './lib.ts';
import { lockInstitution, changeStake, moveMoney, INSTITUTION_NAMES } from './host.ts';
import { valuations } from './valuation.ts';

export const AUCTION_SECONDS = 180;
export const SNIPE_SECONDS = 15;
const CITY = 'city';
const ID = /^[0-9a-f-]{36}$/i;
// Итог аукциона виден ещё столько после конца.
const RESULT_SECONDS = 180;

// ----------------------------------------------------------------- сделка

/** Сколько процентов компании у владельца сейчас. */
async function holding(sql: Sql, gameId: string, kind: string, owner: string): Promise<number> {
  if (owner === CITY) {
    const [i] = await sql`select city_pct from institutions where game_id = ${gameId} and kind = ${kind}`;
    return num(i?.city_pct);
  }
  const [s] = await sql`select pct from stakes where game_id = ${gameId} and kind = ${kind} and player_id = ${owner}`;
  return num(s?.pct);
}

interface Deal { kind: string; pct: number; price: number; seller: string; buyerId: string; via: 'offer' | 'auction' }

/**
 * Доля — покупателю, деньги — продавцу (за долю города — в бюджет).
 * mine — сделку подтверждает покупатель: ему «не хватает денег» пишем от
 * первого лица, продавцу — «у покупателя не хватает».
 */
async function executeDeal(tx: Sql, gameId: string, d: Deal, actor: string, mine: boolean) {
  const round = await currentRound(tx, gameId);
  const rn = accountingRound(round);
  const { inst } = await lockInstitution(tx, gameId, d.kind);
  const ids = d.seller === CITY ? [d.buyerId] : [d.buyerId, d.seller].sort();
  const locked: Row[] = await tx`select * from players where id = any(${ids}) and game_id = ${gameId} order by id for update`;
  const buyer = locked.find((p) => String(p.id) === d.buyerId);
  if (!buyer) fail('player_not_found');
  if (buyer.status === 'left' || buyer.status === 'bankrupt') fail('player_cannot_trade');
  if (available(buyer) < d.price) fail(mine ? 'insufficient_cash' : 'buyer_short', { available: available(buyer) });
  const has = d.seller === CITY ? num(inst.city_pct) : await holding(tx, gameId, d.kind, d.seller);
  if (has + 0.0001 < d.pct) fail('seller_has_less', { has });
  const what = `${d.pct}% of ${INSTITUTION_NAMES[d.kind]}`;

  if (d.seller === CITY) {
    await tx`update institutions set city_pct = ${round2(num(inst.city_pct) - d.pct)}
             where game_id = ${gameId} and kind = ${d.kind}`;
    await changeStake(tx, gameId, d.kind, d.buyerId, d.pct);
    await moveMoney(tx, buyer, -d.price);
    await addLedger(tx, [{ game_id: gameId, player_id: d.buyerId, round_number: rn, kind: 'stake_buy',
      amount: -d.price, target: moneyTarget(buyer.status), reason: 'Bought ' + what, actor,
      params: { code: 'stake_bought_city', pct: d.pct, inst: d.kind, via: d.via } }]);
    await addCity(tx, [{ game_id: gameId, round_number: rn, kind: 'stake_sale', amount: d.price,
      player_id: d.buyerId, institution: d.kind, reason: 'Sold ' + what, actor }]);
    await addNotice(tx, gameId, d.buyerId, rn, 'stake',
      `You bought ${what} for ${usd(d.price)}. Its profit share is paid to you every month.`,
      { code: 'stake_bought_city', pct: d.pct, inst: d.kind, amount: d.price });
  } else {
    const seller = locked.find((p) => String(p.id) === d.seller);
    if (!seller || seller.status === 'left') fail('player_cannot_trade');
    await changeStake(tx, gameId, d.kind, d.seller, -d.pct);
    await changeStake(tx, gameId, d.kind, d.buyerId, d.pct);
    await moveMoney(tx, buyer, -d.price);
    await moveMoney(tx, seller, d.price);
    await addLedger(tx, [
      { game_id: gameId, player_id: d.buyerId, round_number: rn, kind: 'stake_buy', amount: -d.price,
        target: moneyTarget(buyer.status), reason: `Bought ${what} from ${teamLabel(seller)}`, actor,
        params: { code: 'stake_bought', pct: d.pct, inst: d.kind, team: teamLabel(seller), via: d.via } },
      { game_id: gameId, player_id: d.seller, round_number: rn, kind: 'stake_sell', amount: d.price,
        target: moneyTarget(seller.status), reason: `Sold ${what} to ${teamLabel(buyer)}`, actor,
        params: { code: 'stake_sold', pct: d.pct, inst: d.kind, team: teamLabel(buyer), via: d.via } }
    ]);
    await addNotice(tx, gameId, d.buyerId, rn, 'stake', `You bought ${what} from ${teamLabel(seller)} for ${usd(d.price)}.`,
      { code: 'stake_bought', pct: d.pct, inst: d.kind, team: teamLabel(seller), amount: d.price });
    await addNotice(tx, gameId, d.seller, rn, 'stake', `You sold ${what} to ${teamLabel(buyer)} for ${usd(d.price)}.`,
      { code: 'stake_sold', pct: d.pct, inst: d.kind, team: teamLabel(buyer), amount: d.price });
  }
  await logHostAction(tx, gameId, actor, 'exchange_deal', { ...d });
}

// ----------------------------------------------------------------- заявки

/** Команда, которая может покупать: в игре и не банкрот. */
async function tradingTeam(sql: Sql, gameId: string, playerId: string): Promise<Row> {
  const [p] = await sql`select * from players where id = ${playerId} and game_id = ${gameId}`;
  if (!p) fail('player_not_found');
  if (p.status === 'left' || p.status === 'bankrupt') fail('player_cannot_trade');
  return p;
}

/** Заявка на покупку: { kind, seller: 'city' | id команды, pct, price }. */
export async function requestStake(sql: Sql, game: Row, buyerId: string, actor: string, b: Row) {
  if (game.status === 'finished') fail('game_finished');
  const gameId = String(game.id);
  const kind = String(b.kind ?? '');
  if (!isInstitution(kind)) fail('bad_institution');
  const seller = String(b.seller ?? '');
  if (seller !== CITY && !ID.test(seller)) fail('bad_params');
  if (seller === buyerId) fail('bad_params');
  const pct = round2(num(b.pct));
  if (!(pct > 0) || pct > 100) fail('bad_pct');
  const price = cents(num(b.price));
  if (!(price > 0)) fail('bad_price');
  return await sql.begin(async (tx: Sql) => {
    const buyer = await tradingTeam(tx, gameId, buyerId);
    if (seller !== CITY) {
      const [s] = await tx`select status from players where id = ${seller} and game_id = ${gameId}`;
      if (!s || s.status === 'left') fail('player_not_found');
    }
    const has = await holding(tx, gameId, kind, seller);
    if (has + 0.0001 < pct) fail('seller_has_less', { has });
    const [busy] = await tx`select 1 from stake_offers where buyer_id = ${buyerId} and status = 'open'`;
    if (busy) fail('offer_pending');
    const round = await currentRound(tx, gameId);
    const rn = accountingRound(round);
    const [o] = await tx`
      insert into stake_offers ${tx({
        game_id: gameId, kind, buyer_id: buyerId, seller, pct, price, round_number: rn,
        history: tx.json([{ by: 'buyer', price, at: new Date().toISOString() }])
      })} returning id`;
    if (seller !== CITY) {
      await addNotice(tx, gameId, seller, rn, 'offer',
        `${teamLabel(buyer)} wants to buy ${pct}% of ${INSTITUTION_NAMES[kind]} from you for ${usd(price)}.`,
        { code: 'offer_in', team: teamLabel(buyer), pct, inst: kind, amount: price });
    }
    await logHostAction(tx, gameId, actor, 'offer', { offerId: String(o.id), kind, seller, pct, price }, null, buyerId);
    return { ok: true, offerId: String(o.id) };
  });
}

/**
 * Ответ по заявке. who — 'city' (ведущий за город) или id команды.
 * answer: accept — сделка по цене на столе (тот, чей ход); counter — своя
 * цена (тот, чей ход); reject — продавец отказывает; withdraw — покупатель
 * забирает заявку; auction — продавец объявляет аукцион (его ход).
 */
export async function answerOffer(sql: Sql, game: Row, who: string, actor: string, b: Row) {
  const gameId = String(game.id);
  const id = String(b.offerId ?? '');
  const answer = String(b.answer ?? '');
  if (!ID.test(id) || !['accept', 'counter', 'reject', 'withdraw', 'auction'].includes(answer)) fail('bad_params');
  if (game.status === 'finished') fail('game_finished');
  return await sql.begin(async (tx: Sql) => {
    const [o] = await tx`select * from stake_offers where id = ${id} and game_id = ${gameId} for update`;
    if (!o || o.status !== 'open') fail('offer_closed');
    const side = who === String(o.seller) ? 'seller' : who === String(o.buyer_id) ? 'buyer' : null;
    if (!side) fail('not_your_offer');
    const myTurn = o.turn === side;
    const round = await currentRound(tx, gameId);
    const rn = accountingRound(round);
    const buyerId = String(o.buyer_id);
    const close = (status: string) => tx`update stake_offers set status = ${status}, updated_at = now(), closed_at = now()
      where id = ${id}`;

    if (answer === 'withdraw') {
      if (side !== 'buyer') fail('not_your_turn');
      await close('withdrawn');
    } else if (answer === 'reject') {
      if (side !== 'seller') fail('not_your_turn');
      await close('rejected');
      await addNotice(tx, gameId, buyerId, rn, 'offer',
        `Your offer for ${num(o.pct)}% of ${INSTITUTION_NAMES[o.kind]} was rejected.`,
        o.seller === CITY ? { code: 'offer_rejected_city', pct: num(o.pct), inst: o.kind }
          : { code: 'offer_rejected', pct: num(o.pct), inst: o.kind, team: await sellerLabel(tx, String(o.seller)) });
    } else if (answer === 'accept') {
      if (!myTurn) fail('not_your_turn');
      await executeDeal(nested(tx), gameId, { kind: String(o.kind), pct: num(o.pct), price: num(o.price),
        seller: String(o.seller), buyerId, via: 'offer' }, actor, side === 'buyer');
      await close('accepted');
    } else if (answer === 'counter') {
      if (!myTurn) fail('not_your_turn');
      const price = cents(num(b.price));
      if (!(price > 0)) fail('bad_price');
      if (Math.abs(price - num(o.price)) < 0.005) fail('same_price');
      const history = [...((o.history as Row[]) ?? []), { by: side, price, at: new Date().toISOString() }];
      await tx`update stake_offers set price = ${price}, turn = ${side === 'seller' ? 'buyer' : 'seller'},
        history = ${tx.json(history)}, updated_at = now() where id = ${id}`;
      // Встречная цена — уведомление другой стороне (команде).
      const to = side === 'seller' ? buyerId : (o.seller === CITY ? null : String(o.seller));
      if (to) {
        const fromCity = side === 'seller' && o.seller === CITY;
        const label = side === 'seller' ? (fromCity ? null : await sellerLabel(tx, String(o.seller))) : await sellerLabel(tx, buyerId);
        await addNotice(tx, gameId, to, rn, 'offer', `New price for ${num(o.pct)}% of ${INSTITUTION_NAMES[o.kind]}: ${usd(price)}.`,
          fromCity ? { code: 'offer_counter_city', pct: num(o.pct), inst: o.kind, amount: price }
            : { code: 'offer_counter', pct: num(o.pct), inst: o.kind, team: label, amount: price });
      }
    } else {
      // Аукцион объявляет продавец в свой ход; заявка — первая ставка.
      if (side !== 'seller' || !myTurn) fail('not_your_turn');
      const has = await holding(tx, gameId, String(o.kind), String(o.seller));
      if (has + 0.0001 < num(o.pct)) fail('seller_has_less', { has });
      const [a] = await tx`
        insert into auctions ${tx({
          game_id: gameId, kind: o.kind, seller: o.seller, pct: o.pct, start_price: o.price, offer_id: id,
          round_number: rn, closes_at: new Date(Date.now() + AUCTION_SECONDS * 1000), created_by: actor
        })} returning id`;
      await tx`insert into auction_bids ${tx({ auction_id: a.id, game_id: gameId, player_id: buyerId, amount: o.price })}`;
      await close('auction');
      await logHostAction(tx, gameId, actor, 'auction_start', { auctionId: String(a.id), offerId: id });
      return { ok: true, auctionId: String(a.id) };
    }
    await logHostAction(tx, gameId, actor, 'offer_' + answer, { offerId: id, price: b.price ?? null });
    return { ok: true };
  });
}

async function sellerLabel(sql: Sql, playerId: string): Promise<string> {
  const [p] = await sql`select restaurant_name, display_name from players where id = ${playerId}`;
  return p ? teamLabel(p) : '—';
}

/** При расчёте месяца: заявки этого месяца больше не действуют. */
export async function expireOffers(tx: Sql, gameId: string): Promise<void> {
  await tx`update stake_offers set status = 'expired', updated_at = now(), closed_at = now()
           where game_id = ${gameId} and status = 'open'`;
}

// ----------------------------------------------------------------- аукцион

/** Ставка: выше лучшей хотя бы на 1, не больше денег команды. */
export async function placeBid(sql: Sql, game: Row, playerId: string, actor: string, b: Row) {
  const gameId = String(game.id);
  const id = String(b.auctionId ?? '');
  const amount = cents(num(b.amount));
  if (!ID.test(id) || !(amount > 0)) fail('bad_params');
  return await sql.begin(async (tx: Sql) => {
    const [a] = await tx`select * from auctions where id = ${id} and game_id = ${gameId} for update`;
    if (!a || a.status !== 'open' || new Date(a.closes_at).getTime() <= Date.now()) fail('auction_closed');
    if (String(a.seller) === playerId) fail('own_auction');
    const p = await tradingTeam(tx, gameId, playerId);
    const [best] = await tx`select amount, player_id from auction_bids where auction_id = ${id} order by amount desc, id limit 1`;
    if (best && String(best.player_id) === playerId) fail('already_best');
    const min = cents(num(best?.amount, num(a.start_price)) + 1);
    if (amount < min) fail('bid_low', { min });
    if (amount > available(p)) fail('bid_over_cash', { available: available(p) });
    await tx`insert into auction_bids ${tx({ auction_id: id, game_id: gameId, player_id: playerId, amount })}`;
    // Ставка в последние 15 секунд — ещё 15 секунд, чтобы другие успели ответить.
    const left = (new Date(a.closes_at).getTime() - Date.now()) / 1000;
    if (left < SNIPE_SECONDS) {
      await tx`update auctions set closes_at = now() + make_interval(secs => ${SNIPE_SECONDS}) where id = ${id}`;
    }
    await logHostAction(tx, gameId, actor, 'auction_bid', { auctionId: id, amount }, null, playerId);
    return { ok: true };
  });
}

/**
 * Закончившиеся аукционы — подвести итог: лучшая ставка, которую команда
 * может оплатить. Вызывается при каждом запросе к игре.
 */
export async function closeDue(sql: Sql, gameId: string): Promise<number> {
  const due: Row[] = await sql`select id from auctions where game_id = ${gameId} and status = 'open' and closes_at <= now()`;
  let n = 0;
  for (const x of due) {
    n += await sql.begin(async (tx: Sql) => {
      await lockGame(tx, gameId);
      const [a] = await tx`select * from auctions where id = ${x.id} for update`;
      if (!a || a.status !== 'open') return 0;
      const bids: Row[] = await tx`select * from auction_bids where auction_id = ${a.id} order by amount desc, id`;
      const tried: Row[] = [];
      let winner: Row | null = null;
      for (const bid of bids) {
        if (tried.some((t) => String(t.player_id) === String(bid.player_id))) continue;
        tried.push(bid);
        try {
          await tx.savepoint((sp: Sql) => executeDeal(nested(sp), gameId, { kind: String(a.kind), pct: num(a.pct),
            price: num(bid.amount), seller: String(a.seller), buyerId: String(bid.player_id), via: 'auction' }, 'system', true));
          winner = bid;
          break;
        } catch (e) {
          const code = (e as { code?: string })?.code;
          // У продавца не осталось доли — продавать нечего.
          if (code === 'seller_has_less') break;
          if (!['insufficient_cash', 'player_cannot_trade', 'player_not_found'].includes(String(code))) throw e;
        }
      }
      await tx`update auctions set status = ${winner ? 'sold' : 'unsold'}, winner_id = ${winner ? winner.player_id : null},
        price = ${winner ? winner.amount : null}, result = ${tx.json({ bids: bids.length, skipped: tried.length - (winner ? 1 : 0) })},
        closed_at = now() where id = ${a.id}`;
      await logHostAction(tx, gameId, 'system', 'auction_' + (winner ? 'sold' : 'unsold'),
        { auctionId: String(a.id), price: winner ? num(winner.amount) : null });
      return 1;
    });
  }
  return n;
}

/** Ведущий снимает аукцион. */
export async function cancelAuction(sql: Sql, game: Row, actor: string, b: Row) {
  const id = String(b.auctionId ?? '');
  if (!ID.test(id)) fail('bad_params');
  const [a] = await sql`update auctions set status = 'cancelled', closed_at = now()
    where id = ${id} and game_id = ${game.id} and status = 'open' returning id`;
  if (!a) fail('auction_closed');
  await logHostAction(sql, game.id, actor, 'auction_cancel', { auctionId: id });
  return { ok: true };
}

// ----------------------------------------------------------------- для экранов

/**
 * Биржа для экрана. viewer — 'city' у ведущего, id команды у команды, null
 * на табло: заявки видят только их стороны и ведущий, аукционы — все.
 */
export async function exchangeState(sql: Sql, game: Row, viewer: string | null) {
  const gameId = String(game.id);
  const host = viewer === CITY;
  const team = viewer && !host ? viewer : null;
  const [offers, auctions, players, values]: [Row[], Row[], Row[], Record<string, { value: number }> | null] = await Promise.all([
    viewer
      ? sql`select * from stake_offers where game_id = ${gameId}
              and (status = 'open' or (buyer_id::text = ${team ?? ''} and closed_at > now() - interval '30 minutes'))
              and (${host} or buyer_id::text = ${team ?? ''} or seller = ${team ?? ''})
            order by created_at`
      : Promise.resolve([]),
    sql`select * from auctions where game_id = ${gameId}
          and (status = 'open' or closed_at > now() - make_interval(secs => ${RESULT_SECONDS}))
        order by opened_at`,
    sql`select id, restaurant_name, display_name, status from players where game_id = ${gameId}`,
    viewer ? valuations(sql, game) : Promise.resolve(null)
  ]);
  const bids: Row[] = auctions.length
    ? await sql`select auction_id, player_id, amount, created_at from auction_bids
                where auction_id = any(${auctions.map((a) => a.id)}) order by amount desc, id`
    : [];
  const label = (id: string) => {
    const p = players.find((x) => String(x.id) === id);
    return p ? teamLabel(p) : '—';
  };
  const who = (id: string) => (id === CITY ? { id: CITY, city: true, label: null } : { id, city: false, label: label(id) });
  const valueOf = (kind: string, pct: number) => (values?.[kind] ? cents((values[kind].value * pct) / 100) : null);

  const offersOut = offers.map((o) => {
    const side = viewer === String(o.seller) ? 'seller' : viewer === String(o.buyer_id) ? 'buyer' : null;
    const open = o.status === 'open';
    const myTurn = open && !!side && o.turn === side;
    return {
      id: String(o.id), kind: String(o.kind), pct: num(o.pct), price: num(o.price), turn: String(o.turn),
      status: String(o.status), round: num(o.round_number), history: o.history ?? [],
      seller: who(String(o.seller)), buyer: who(String(o.buyer_id)), side,
      value: valueOf(String(o.kind), num(o.pct)),
      can: {
        accept: myTurn, counter: myTurn, auction: myTurn && side === 'seller',
        reject: open && side === 'seller', withdraw: open && side === 'buyer'
      },
      updatedAt: o.updated_at
    };
  });

  const me = team ? players.find((p) => String(p.id) === team) : null;
  const auctionsOut = auctions.map((a) => {
    const mine = bids.filter((x) => String(x.auction_id) === String(a.id));
    const best = mine[0] ?? null;
    const open = a.status === 'open';
    return {
      id: String(a.id), kind: String(a.kind), pct: num(a.pct), startPrice: num(a.start_price),
      seller: who(String(a.seller)), status: String(a.status), closesAt: a.closes_at, closedAt: a.closed_at ?? null,
      best: best ? { amount: num(best.amount), team: who(String(best.player_id)) } : null,
      bids: mine.slice(0, 5).map((x) => ({ amount: num(x.amount), team: who(String(x.player_id)) })),
      bidCount: mine.length,
      winner: a.winner_id ? who(String(a.winner_id)) : null, price: a.price === null ? null : num(a.price),
      value: valueOf(String(a.kind), num(a.pct)),
      minBid: cents(num(best?.amount, num(a.start_price)) + 1),
      canBid: open && !!me && String(a.seller) !== team && me.status !== 'left' && me.status !== 'bankrupt'
    };
  });

  return {
    offers: offersOut,
    auctions: auctionsOut,
    // Стоимость 100% каждой компании по оценке — для формы заявки.
    values: values ? Object.fromEntries(INSTITUTIONS.map((k) => [k, values[k]?.value ?? 0])) : null,
    canRequest: !!me && me.status !== 'left' && me.status !== 'bankrupt' && game.status !== 'finished'
      && !offers.some((o) => o.status === 'open' && String(o.buyer_id) === team),
    serverNow: new Date().toISOString()
  };
}
