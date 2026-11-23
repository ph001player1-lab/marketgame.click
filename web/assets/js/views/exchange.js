// Биржа: заявки на покупку долей, торг и аукцион. Сервер —
// supabase/functions/game/exchange.ts.
//
// У команды (вкладка «Инвестиции»): входящие заявки — принять, своя цена,
// аукцион, отклонить; своя заявка и что с ней; аукционы со ставками;
// форма «Купить долю». У ведущего (пульт, «Город»): заявки к городу —
// ответ за город; заявки между командами — только видно; аукционы — снять.

import { t } from '../i18n.js';
import { h, replace, field, moneyInput } from '../dom.js';
import { usd, pctRaw, clock, parseMoney, currencySign } from '../fmt.js';
import { teamName } from './common.js';
import { COMPANY_ICONS } from './wealth.js';

const KINDS = ['landlord', 'bank', 'insurer', 'utility'];
const EPS = 1e-6;

/** «Город» или название команды. */
const nameOf = (x) => (x?.city ? t('companies.city') : teamName(x?.label || '—'));
/** «10% банка». */
export const stakeText = (pct, kind) => t('exchange.stake', { pct: pctRaw(pct), inst: t('institutionsOf.' + kind) });
/** Роль после сделки: больше 50% — контроль, больше 30% — вето, иначе голос. */
const roleOf = (pct) => (pct > 50 + EPS ? 'control' : pct > 30 + EPS ? 'block' : 'vote');

/** Часы аукциона: тикают раз в секунду, пока элемент на странице. */
function runClock(el, iso, offsetRef) {
  // Часы запускают до того, как карточку вставили на страницу: ждём пару
  // секунд, и только потом считаем, что карточку убрали.
  let away = 0;
  const paint = () => {
    if (el.isConnected) away = 0;
    else if (++away > 3) { clearInterval(id); return; }
    const left = (new Date(iso).getTime() - (Date.now() + offsetRef.value)) / 1000;
    el.textContent = left > 0 ? t('companies.left', { time: clock(left) }) : t('companies.counting');
    el.classList.toggle('is-urgent', left <= 15);
  };
  const id = setInterval(paint, 1000);
  paint();
}

/** Торг одной строкой: «Bob $2,000 → Город $3,000 → Bob $2,500». */
function historyLine(o) {
  const list = (o.history || []).map((x) => (x.by === 'buyer' ? nameOf(o.buyer) : nameOf(o.seller)) + ' ' + usd(x.price));
  return list.length > 1 ? h('p', { class: 'small muted' }, t('exchange.history', { list: list.join(' → ') })) : null;
}

/** Своя цена: поле и кнопка — раскрываются по «Своя цена». */
function counterForm(onSend) {
  const input = moneyInput({ placeholder: currencySign() });
  const send = h('button', { class: 'btn btn--primary', type: 'button', onclick: (e) => onSend(e.currentTarget, parseMoney(input.value)) },
    t('exchange.counterSend'));
  const box = h('div', { class: 'offer__counter', hidden: true }, field(t('exchange.yourPrice') + ', ' + currencySign(), input),
    h('div', { class: 'btn-row' }, send));
  return { box, open: () => { box.hidden = false; input.focus(); } };
}

/**
 * Биржа. host — у ведущего: ответы за город, «Снять аукцион».
 * run(button, action, params, okText) — действие, как в кабинете или пульте.
 */
export function exchangePart(run, { host = false } = {}) {
  const offset = { value: 0 };
  const offersBox = h('div', { class: 'offers' });
  const auctionsBox = h('div', { class: 'auctions' });
  const formBox = h('div', {});
  const el = h('div', {}, h('p', { class: 'muted small' }, t(host ? 'exchange.hostLead' : 'exchange.lead')),
    offersBox, auctionsBox, formBox);
  let state = null;
  let sig = { offers: '', auctions: '' };
  const answer = (btn, o, params, okText) =>
    run(btn, host ? 'cityAnswerOffer' : 'answerOffer', { offerId: o.id, ...params }, okText);

  // ---- заявки

  function offerCard(o) {
    const c = counterForm((btn, price) => answer(btn, o, { answer: 'counter', price }, t('exchange.toast.countered')));
    const open = o.status === 'open';
    const mineBuyer = o.side === 'buyer';
    const title = o.side === 'seller'
      ? t(host ? 'exchange.incomingCity' : 'exchange.incoming', { team: nameOf(o.buyer), stake: stakeText(o.pct, o.kind) })
      : mineBuyer
        ? t(o.seller.city ? 'exchange.mineCity' : 'exchange.mineTeam', { stake: stakeText(o.pct, o.kind), team: nameOf(o.seller) })
        : t('exchange.between', { buyer: nameOf(o.buyer), seller: nameOf(o.seller), stake: stakeText(o.pct, o.kind) });
    const waiting = open && !o.can.accept
      ? h('p', { class: 'small' }, t(o.turn === 'seller' ? 'exchange.waitSeller' : 'exchange.waitBuyer')) : null;
    const theirPrice = open && o.can.accept && o.history?.length > 1
      ? h('p', { class: 'small' }, t('exchange.theyOffer', { who: nameOf(o.side === 'seller' ? o.buyer : o.seller), price: usd(o.price) }))
      : null;
    const btn = (text, cls, onclick) => h('button', { class: ['btn', cls], type: 'button', onclick }, text);
    const buttons = open && (o.can.accept || o.can.reject || o.can.withdraw)
      ? h('div', { class: 'offer__buttons' },
          o.can.accept ? btn(mineBuyer ? t('exchange.acceptPrice', { price: usd(o.price) }) : t('exchange.accept'), 'btn--primary',
            (e) => answer(e.currentTarget, o, { answer: 'accept' }, t('exchange.toast.accepted'))) : null,
          o.can.counter ? btn(t('exchange.counter'), null, () => c.open()) : null,
          o.can.auction ? btn(t('exchange.auction'), null,
            (e) => answer(e.currentTarget, o, { answer: 'auction' }, t('exchange.toast.auctionStarted'))) : null,
          o.can.reject ? btn(t('exchange.reject'), 'btn--ghost',
            (e) => answer(e.currentTarget, o, { answer: 'reject' }, t('exchange.toast.rejected'))) : null,
          o.can.withdraw ? btn(t('exchange.withdraw'), 'btn--ghost',
            (e) => answer(e.currentTarget, o, { answer: 'withdraw' }, t('exchange.toast.withdrawn'))) : null)
      : null;
    return h('section', { class: ['offer', open && o.can.accept ? 'offer--turn' : null], id: 'offer-' + o.id },
      h('p', { class: 'offer__title' }, (COMPANY_ICONS[o.kind] || '') + ' ' + title),
      h('div', { class: 'offer__price' }, h('b', {}, usd(o.price)),
        o.value > 0 ? h('span', { class: 'muted small' }, ' ' + t('exchange.byValue', { value: usd(o.value) })) : null),
      historyLine(o), theirPrice, waiting,
      open ? h('p', { class: 'small muted' }, t('exchange.validUntil', { n: o.round })) : h('p', { class: 'small' }, t('exchange.status.' + o.status)),
      buttons, c.box);
  }

  // ---- аукционы

  function auctionCard(a) {
    const clockBox = h('span', { class: 'vote__clock', role: 'timer' });
    const open = a.status === 'open';
    const input = moneyInput({ placeholder: currencySign(), 'aria-label': t('exchange.bid') });
    const available = state?.player ? (state.lifecycle === 'active' ? state.player.cash : state.player.savings) : null;
    const leading = a.best && !host && a.best.team.id === state?.player?.id;
    const bidForm = open && a.canBid
      ? h('div', { class: 'auction__bid' },
          leading ? h('p', { class: 'small offer__lead' }, t('exchange.youLead')) : null,
          field(t('exchange.bid') + ', ' + currencySign(), input,
            t('exchange.bidHint', { min: usd(a.minBid), available: usd(available ?? 0) })),
          h('div', { class: 'btn-row' }, h('button', { class: 'btn btn--primary', type: 'button', disabled: !!leading,
            onclick: (e) => run(e.currentTarget, 'placeBid', { auctionId: a.id, amount: parseMoney(input.value) },
              t('exchange.toast.bidPlaced')) }, t('exchange.placeBid'))))
      : null;
    input.value = String(a.minBid);
    const result = a.status === 'sold' ? t('exchange.sold', { team: nameOf(a.winner), price: usd(a.price) })
      : a.status === 'unsold' ? t('exchange.unsold') : a.status === 'cancelled' ? t('exchange.cancelled') : null;
    const card = h('section', { class: ['offer', 'auction', open ? 'offer--turn' : null], id: 'auction-' + a.id },
      h('div', { class: 'vote__head' }, h('b', {}, (COMPANY_ICONS[a.kind] || '') + ' ' +
        t('exchange.auctionTitle', { stake: stakeText(a.pct, a.kind) })), open ? clockBox : null),
      h('p', { class: 'small muted' }, a.seller.city ? t('exchange.sellerCity') : t('exchange.sellerTeam', { team: nameOf(a.seller) }),
        ' · ', t('exchange.start', { price: usd(a.startPrice) }),
        a.value > 0 ? ' · ' + t('exchange.byValue', { value: usd(a.value) }) : ''),
      a.best ? h('div', { class: 'offer__price' }, h('span', { class: 'small muted' }, t('exchange.best') + ' '),
        h('b', {}, usd(a.best.amount)), h('span', {}, ' — ' + nameOf(a.best.team))) : h('p', { class: 'small' }, t('exchange.noBids')),
      a.bids.length > 1 ? h('ol', { class: 'auction__bids small muted' }, a.bids.slice(1, 4).map((b) =>
        h('li', {}, usd(b.amount) + ' — ' + nameOf(b.team)))) : null,
      result ? h('p', { class: 'offer__result' }, result) : null,
      bidForm,
      open ? h('p', { class: 'small muted' }, t('exchange.snipeNote')) : null,
      host && open ? h('div', { class: 'btn-row' }, h('button', { class: 'btn btn--ghost btn--small', type: 'button',
        onclick: (e) => run(e.currentTarget, 'cancelAuction', { auctionId: a.id }, t('exchange.toast.auctionCancelled')) },
        t('exchange.cancelAuction'))) : null);
    if (open) runClock(clockBox, a.closesAt, offset);
    return card;
  }

  // ---- «Купить долю»

  let form = null;
  function buyForm() {
    const company = h('select', { class: 'input', onchange: () => { priceTouched = false; fillSellers(); paint(); } },
      KINDS.map((k) => h('option', { value: k }, t('institutions.' + k))));
    const sellers = h('div', { class: 'sellers', role: 'radiogroup' });
    const pctIn = h('input', { class: 'input', inputmode: 'decimal', autocomplete: 'off', value: '5',
      oninput: () => { if (!priceTouched) fillPrice(); paint(); } });
    const chips = h('div', { class: 'chips' });
    const price = moneyInput({ placeholder: currencySign(), oninput: () => { priceTouched = true; paint(); } });
    const hint = h('p', { class: 'field__hint' });
    const after = h('p', { class: 'offer__after' });
    const send = h('button', { class: 'btn btn--primary', type: 'button', onclick: (e) => submit(e.currentTarget) },
      t('exchange.send'));
    let priceTouched = false;
    let seller = 'city';
    const box = h('section', { class: 'offer buy-form', id: 'buy-form' },
      h('h4', { class: 'offer__title' }, t('exchange.buyTitle')),
      field(t('exchange.company'), company),
      h('div', { class: 'field' }, h('div', { class: 'field__label' }, t('exchange.from')), sellers),
      field(t('exchange.pct'), pctIn), chips,
      field(t('exchange.price') + ', ' + currencySign(), price), hint, after,
      h('div', { class: 'btn-row' }, send));

    const companyOf = () => (state?.companies || []).find((c) => c.kind === company.value);
    const me = () => state?.player?.id;
    const myPct = () => companyOf()?.owners.find((o) => o.id === me())?.pct ?? 0;
    const owners = () => (companyOf()?.owners || []).filter((o) => o.id !== me());
    const sellerPct = () => owners().find((o) => o.id === seller)?.pct ?? 0;
    const readPct = () => Number(String(pctIn.value).replace(',', '.').replace('%', ''));

    function fillSellers() {
      const list = owners();
      if (!list.some((o) => o.id === seller)) seller = list[0]?.id ?? 'city';
      replace(sellers, list.length ? list.map((o) => h('label', { class: ['seller', o.id === seller ? 'is-on' : null] },
        h('input', { type: 'radio', name: 'buy-seller', value: o.id, checked: o.id === seller,
          onchange: () => { seller = o.id; priceTouched = false; fillSellers(); paint(); } }),
        h('span', { class: 'seller__name' }, o.city ? t('companies.city') : teamName(o.label)),
        h('b', {}, pctRaw(o.pct)))) : h('p', { class: 'muted small' }, t('exchange.nobody')));
      // Быстрые доли: 5%, 10% и сколько не хватает до вето и до контроля.
      const mine = myPct();
      const most = sellerPct();
      const opts = [[5, '5%'], [10, '10%'],
        [Math.ceil(30.01 - mine), t('exchange.toVeto')], [Math.ceil(50.01 - mine), t('exchange.toControl')]]
        .filter(([v]) => v > 0 && v <= most + EPS);
      replace(chips, opts.map(([v, label]) => h('button', { class: 'chip', type: 'button',
        onclick: () => { pctIn.value = String(v); priceTouched = false; fillPrice(); paint(); } },
        label === v + '%' ? label : pctRaw(v) + ' — ' + label)));
    }
    function fillPrice() {
      const v = state?.exchange?.values?.[company.value] ?? 0;
      const p = readPct();
      price.value = v > 0 && p > 0 ? String(Math.round((v * p) / 100)) : '';
    }
    function paint() {
      const v = state?.exchange?.values?.[company.value] ?? 0;
      const p = readPct();
      hint.textContent = v > 0 && p > 0
        ? t('exchange.priceHint', { pct: pctRaw(p), value: usd((v * p) / 100) }) : t('exchange.priceHintNoValue');
      const total = myPct() + (p > 0 ? p : 0);
      after.textContent = p > 0 ? t('exchange.after', { pct: pctRaw(total), role: t('exchange.roles.' + roleOf(total)) }) : '';
      send.disabled = !owners().length || !(p > 0) || p > sellerPct() + EPS || !(parseMoney(price.value) > 0);
    }
    async function submit(btn) {
      const res = await run(btn, 'requestStake', { kind: company.value, seller, pct: readPct(), price: parseMoney(price.value) },
        t('exchange.toast.sent'));
      if (res?.ok) { priceTouched = false; fillPrice(); }
    }
    return {
      box,
      update() {
        if (box.contains(document.activeElement)) { paint(); return; }
        fillSellers();
        if (!priceTouched) fillPrice();
        paint();
      }
    };
  }

  function update(s) {
    state = s;
    const x = s.exchange || { offers: [], auctions: [] };
    if (x.serverNow) offset.value = new Date(x.serverNow).getTime() - Date.now();
    // Сначала то, где ждут вашего ответа.
    const offers = [...x.offers].sort((a, b) => Number(b.can?.accept) - Number(a.can?.accept));
    const offersSig = JSON.stringify(offers.map((o) => [o.id, o.status, o.price, o.turn, o.value]));
    if (offersSig !== sig.offers) {
      sig.offers = offersSig;
      replace(offersBox, offers.length ? [h('h4', { class: 'section-sub' }, t('exchange.offersTitle')), offers.map(offerCard)] : null);
    }
    const auctionsSig = JSON.stringify([x.auctions.map((a) => [a.id, a.status, a.best?.amount, a.closesAt, a.canBid]),
      s.player?.cash, s.player?.savings]);
    if (auctionsSig !== sig.auctions && !auctionsBox.contains(document.activeElement)) {
      sig.auctions = auctionsSig;
      replace(auctionsBox, x.auctions.length ? [h('h4', { class: 'section-sub' }, t('exchange.auctionsTitle')), x.auctions.map(auctionCard)] : null);
    }
    if (host) return;
    if (x.canRequest) {
      if (!form) { form = buyForm(); replace(formBox, form.box); }
      form.update();
    } else {
      form = null;
      const pending = x.offers.some((o) => o.side === 'buyer' && o.status === 'open');
      replace(formBox, h('p', { class: 'muted small' }, t(pending ? 'exchange.onePending' : 'exchange.cantBuy')));
    }
  }

  return { el, update };
}

/** Что ждёт ответа команды: заявки на её ходу и аукционы, где можно ставить. */
export function waitingExchange(x) {
  return {
    offers: (x?.offers || []).filter((o) => o.status === 'open' && o.can?.accept),
    auctions: (x?.auctions || []).filter((a) => a.status === 'open' && a.canBid)
  };
}

/** Крупно на проекторе: идущие аукционы. */
export function projectorAuctions(box, offsetRef) {
  let sig = '';
  return function paint(x) {
    const open = (x?.auctions || []).filter((a) => a.status === 'open');
    const next = JSON.stringify(open.map((a) => [a.id, a.best?.amount, a.closesAt]));
    if (next === sig) return;
    sig = next;
    box.hidden = !open.length;
    replace(box, open.map((a) => {
      const clockBox = h('span', { class: 'vote__clock', role: 'timer' });
      const el = h('div', { class: 'vote-projector company-projector' },
        h('div', { class: 'vote__head' }, h('b', {}, (COMPANY_ICONS[a.kind] || '') + ' ' +
          t('exchange.auctionTitle', { stake: stakeText(a.pct, a.kind) })), clockBox),
        h('div', { class: 'vote-projector__q' }, a.best
          ? t('exchange.bestLine', { price: usd(a.best.amount), team: nameOf(a.best.team) }) : t('exchange.noBids')),
        h('div', { class: 'muted' }, (a.seller.city ? t('exchange.sellerCity') : t('exchange.sellerTeam', { team: nameOf(a.seller) })) +
          ' · ' + t('exchange.bidsCount', { n: a.bidCount })));
      runClock(clockBox, a.closesAt, offsetRef);
      return el;
    }));
  };
}
