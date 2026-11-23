// Решения акционеров — цены компаний. Сервер — supabase/functions/game/companies.ts.
//
// Цену услуги компании (аренду, страховку, коммунальные, ставку по
// кредитам) решают её владельцы: больше 50% — ставит цену сам, у владельцев
// больше 30% есть 3 минуты на вето; без контрольного пакета — собрание
// акционеров, голоса весят по долям. Долей города голосует ведущий.
//
// Здесь: карточка компаний у команды (вкладка «Инвестиции») и у ведущего
// (пульт, «Город»), крупно на проекторе, тексты решений для «Новостей» и
// отчёта.

import { t } from '../i18n.js';
import { h, replace, field } from '../dom.js';
import { usd, pct, pctRaw, clock, parseMoney, currencySign } from '../fmt.js';
import { teamName } from './common.js';
import { COMPANY_ICONS } from './wealth.js';

const KINDS = ['landlord', 'bank', 'insurer', 'utility'];

/** Цена компании: «$7 500 в месяц» или «12% годовых». */
export function priceText(kind, value) {
  if (value === null || value === undefined) return '—';
  return kind === 'bank' ? t('companies.perYear', { value: pct(value, 2) }) : t('companies.perMonth', { value: usd(value) });
}

/** Что решают: «аренда», «ставка по кредитам»… */
export const whatOf = (kind) => t('companies.what.' + kind);

/** Кто: команда по названию или «Город». */
export const ownerName = (o) => (o?.city ? t('companies.city') : teamName(o?.label || '—'));

/** Итог решения одной строкой: «аренда $9 000 в месяц — принято». */
export function decisionLine(d) {
  return t('companies.line', { what: whatOf(d.kind), value: priceText(d.kind, d.applied?.value ?? d.value),
    status: t('companies.status.' + d.status) });
}

/** Секунд до конца по часам сервера. */
const secondsLeft = (iso, offset) => (new Date(iso).getTime() - (Date.now() + offset)) / 1000;

/** Часы решения: тикают раз в секунду, пока элемент на странице. */
function runClock(el, iso, offsetRef) {
  const paint = () => {
    if (!el.isConnected) { clearInterval(id); return; }
    const left = secondsLeft(iso, offsetRef.value);
    el.textContent = left > 0 ? t('companies.left', { time: clock(left) }) : t('companies.counting');
    el.classList.toggle('is-urgent', left <= 15);
  };
  const id = setInterval(paint, 1000);
  paint();
}

/** Полоса владельцев: город, команды (своя — ярче), частные. */
function ownersBar(c, viewer) {
  const seg = (o) => h('span', {
    class: ['own', o.city ? 'own--city' : o.id === viewer ? 'own--mine' : 'own--team'],
    style: { flexGrow: String(o.pct) }
  });
  return h('div', { class: 'owners-bar', 'aria-hidden': 'true' },
    c.owners.map(seg), c.passivePct > 0 ? h('span', { class: 'own own--passive', style: { flexGrow: String(c.passivePct) } }) : null);
}

/** Владельцы списком: «Город 40% · вето», «Ann Diner 60% · контроль», «частные 20%». */
function ownersList(c) {
  return h('ul', { class: 'owners-list' },
    c.owners.map((o) => h('li', {}, h('b', {}, ownerName(o)), ' ' + pctRaw(o.pct),
      o.role !== 'vote' ? h('span', { class: 'chip chip--' + o.role }, t('companies.roles.' + o.role)) : null)),
    c.passivePct > 0 ? h('li', { class: 'muted' }, t('companies.private') + ' ' + pctRaw(c.passivePct) + ' — ' + t('companies.passive')) : null);
}

/** Кто решает цену этой компании. */
function whoDecides(c) {
  if (c.mode === 'control') {
    const vetoes = c.owners.filter((o) => o.role === 'block');
    return h('p', { class: 'small' },
      t(c.controller.city ? 'companies.whoControlCity' : 'companies.whoControl',
        { who: ownerName(c.controller), pct: pctRaw(c.controller.pct) }), ' ',
      vetoes.length ? t('companies.vetoBy', { list: vetoes.map((o) => ownerName(o) + ' (' + pctRaw(o.pct) + ')').join(', ') })
        : t('companies.noVeto'));
  }
  return h('p', { class: 'small' }, c.canDecide ? t('companies.meeting') : t('companies.noQuorum'));
}

/**
 * Карточка компаний. host — у ведущего: голос и предложения от имени
 * города, «Снять» у идущего решения. run(button, action, params, okText).
 */
export function companiesPart(run, { host = false } = {}) {
  const offset = { value: 0 };
  const blocks = {};
  const list = h('div', { class: 'companies' });
  const el = h('div', {}, h('p', { class: 'muted small' }, t(host ? 'companies.hostLead' : 'companies.lead')), list);
  const viewer = () => (host ? 'city' : state?.player?.id);
  let state = null;

  function block(kind) {
    const info = h('div', {});
    const open = h('div', {});
    const input = h('input', { class: 'input', inputmode: 'decimal', autocomplete: 'off' });
    const label = h('span', {});
    const hint = h('p', { class: 'field__hint' });
    const btn = h('button', { class: 'btn btn--primary', type: 'button', onclick: (e) => propose(e.currentTarget, kind) },
      t('companies.propose'));
    const form = h('div', { class: 'company__form', hidden: true },
      field(label, input, hint), h('div', { class: 'btn-row' }, btn));
    const lastBox = h('p', { class: 'small muted company__last' });
    const box = h('section', { class: 'company', id: 'company-' + kind }, info, open, form, lastBox);
    list.append(box);
    return { box, info, open, form, input, label, hint, lastBox, sig: {} };
  }

  async function propose(btn, kind) {
    const raw = String(blocks[kind].input.value).replace('%', '');
    const value = parseMoney(raw);
    const res = await run(btn, host ? 'cityProposePrice' : 'proposePrice', { kind, value },
      (r) => t(r.status === 'passed' ? 'companies.acceptedToast' : 'companies.proposedToast'));
    if (res?.ok) blocks[kind].input.value = '';
  }

  function decisionBox(c) {
    const d = c.open;
    const clockBox = h('span', { class: 'vote__clock', role: 'timer' });
    const r = d.result || {};
    const vetoes = d.owners.filter((o) => o.veto);
    const tally = d.mode === 'meeting'
      ? h('div', {},
          h('div', { class: 'vote-bar', 'aria-hidden': 'true' },
            r.yesPct > 0 ? h('span', { class: 'vote-bar__yes', style: { flexGrow: String(r.yesPct) } }) : null,
            r.noPct > 0 ? h('span', { class: 'vote-bar__no', style: { flexGrow: String(r.noPct) } }) : null,
            r.notVotedPct > 0 ? h('span', { class: 'vote-bar__none', style: { flexGrow: String(r.notVotedPct) } }) : null),
          h('p', { class: 'small' }, t('companies.tally', { yes: pctRaw(r.yesPct), no: pctRaw(r.noPct) })))
      : h('p', { class: 'small' }, t('companies.vetoWait', {
          list: vetoes.map((o) => ownerName(o) + ' (' + pctRaw(o.pct) + ')').join(', ') }));
    const mineVeto = d.owners.find((o) => o.id === viewer())?.veto;
    const choice = (value, text, cls) => h('button', {
      class: ['btn', cls], type: 'button', 'aria-pressed': c.mine === value ? 'true' : 'false',
      onclick: (e) => run(e.currentTarget, host ? 'cityCompanyVote' : 'companyVote', { decisionId: d.id, choice: value },
        t('companies.votedToast'))
    }, text);
    const buttons = c.canVote
      ? h('div', { class: 'btn-row' },
          d.mode === 'control'
            ? [choice('no', t('companies.veto'), 'btn--danger'), choice('yes', t('companies.noObjection'), null)]
            : [choice('yes', t('companies.yes'), 'btn--primary'), choice('no', t('companies.no'), null)])
      : null;
    const out = h('div', { class: 'banner banner--warn company__open' },
      h('div', { class: 'vote__head' }, h('b', {}, t(d.mode === 'control' ? 'companies.openControl' : 'companies.openMeeting')), clockBox),
      h('p', { class: 'vote__q' }, t('companies.proposed', { who: ownerName(d.proposer), what: whatOf(c.kind),
        value: priceText(c.kind, d.value), old: priceText(c.kind, d.oldValue) })),
      tally,
      c.canVote && d.mode === 'meeting' && mineVeto ? h('p', { class: 'small' }, t('companies.vetoHint')) : null,
      buttons,
      c.mine ? h('p', { class: 'small muted' }, t('companies.myVote', { choice: t('companies.choices.' + c.mine) })) : null,
      host ? h('div', { class: 'btn-row' }, h('button', { class: 'btn btn--ghost btn--small', type: 'button',
        onclick: (e) => run(e.currentTarget, 'cancelCompanyDecision', { decisionId: d.id }, t('companies.cancelledToast')) },
        t('companies.cancel'))) : null);
    runClock(clockBox, d.closesAt, offset);
    return out;
  }

  function update(s) {
    state = s;
    if (s.vote?.serverNow) offset.value = new Date(s.vote.serverNow).getTime() - Date.now();
    const companies = s.companies || [];
    for (const c of companies) {
      const b = blocks[c.kind] || (blocks[c.kind] = block(c.kind));
      const me = viewer();
      const infoSig = JSON.stringify([c.price, c.cap, c.owners, c.passivePct, c.mode, c.canDecide, c.myRole, c.hostMayEdit]);
      if (b.sig.info !== infoSig) {
        b.sig.info = infoSig;
        replace(b.info,
          h('div', { class: 'company__head' },
            h('span', { class: 'company__icon', 'aria-hidden': 'true' }, COMPANY_ICONS[c.kind] || '•'),
            h('h4', { class: 'company__name' }, t('institutions.' + c.kind)),
            c.myPct > 0 ? h('span', { class: 'chip chip--' + c.myRole },
              t(host ? 'companies.cityPct' : 'companies.myPct', { pct: pctRaw(c.myPct) }) + ' · ' + t('companies.roles.' + c.myRole)) : null),
          h('p', { class: 'company__price' }, h('b', {}, t('companies.priceLabel.' + c.kind) + ': ' + priceText(c.kind, c.price)),
            c.cap !== null ? h('span', { class: 'muted' }, ' · ' + t('companies.cap', { value: priceText(c.kind, c.cap) })) : null),
          ownersBar(c, me), ownersList(c), whoDecides(c),
          host && c.hostMayEdit ? h('p', { class: 'small muted' }, t('companies.hostMayEdit')) : null);
      }
      const openSig = JSON.stringify(c.open && [c.open.id, c.open.result, c.mine, c.canVote, c.open.closesAt]);
      if (b.sig.open !== openSig) {
        b.sig.open = openSig;
        replace(b.open, c.open ? decisionBox(c) : null);
      }
      b.form.hidden = !c.canPropose;
      if (c.canPropose) {
        b.label.textContent = c.unit === 'pct' ? t('companies.newRate') : t('companies.newPrice') + ', ' + currencySign();
        b.input.placeholder = c.unit === 'pct' ? String(Math.round(c.price * 10000) / 100) : String(c.price);
        b.hint.textContent = c.mode === 'meeting' ? t('companies.proposeMeeting')
          : c.owners.some((o) => o.role === 'block') ? t('companies.proposeControl') : t('companies.proposeInstant');
      }
      b.lastBox.textContent = c.last ? t('companies.last', { line: decisionLine(c.last) }) : '';
      b.lastBox.hidden = !c.last;
    }
  }

  return { el, update };
}

/** Сколько решений ждут голоса этого владельца — для значка на вкладке. */
export function waitingDecisions(companies) {
  return (companies || []).filter((c) => c.canVote && !c.mine);
}

// ----------------------------------------------------------------- проектор

/** Крупно на проекторе: идущие решения акционеров с часами. */
export function projectorCompanies(box, offsetRef) {
  let sig = '';
  return function paint(companies) {
    const open = (companies || []).filter((c) => c.open);
    const next = JSON.stringify(open.map((c) => [c.open.id, c.open.result, c.open.closesAt]));
    if (next === sig) return;
    sig = next;
    box.hidden = !open.length;
    replace(box, open.map((c) => {
      const d = c.open;
      const clockBox = h('span', { class: 'vote__clock', role: 'timer' });
      const r = d.result || {};
      const el = h('div', { class: 'vote-projector company-projector' },
        h('div', { class: 'vote__head' },
          h('b', {}, (COMPANY_ICONS[c.kind] || '') + ' ' + t('institutions.' + c.kind) + ' · ' +
            t(d.mode === 'control' ? 'companies.openControl' : 'companies.openMeeting')), clockBox),
        h('div', { class: 'vote-projector__q' }, t('companies.proposed', { who: ownerName(d.proposer), what: whatOf(c.kind),
          value: priceText(c.kind, d.value), old: priceText(c.kind, d.oldValue) })),
        h('div', { class: 'muted' }, d.mode === 'meeting'
          ? t('companies.tally', { yes: pctRaw(r.yesPct), no: pctRaw(r.noPct) })
          : t('companies.vetoWait', { list: d.owners.filter((o) => o.veto).map((o) => ownerName(o)).join(', ') })));
      runClock(clockBox, d.closesAt, offsetRef);
      return el;
    }));
  };
}

// ----------------------------------------------------------------- отчёт

/** Все решения акционеров игры — в отчёте. */
export function decisionHistoryCard(list) {
  if (!list?.length) return null;
  return h('section', { class: 'card' },
    h('h2', { class: 'card__title' }, t('companies.history')),
    h('ul', { class: 'news' }, list.map((d) => h('li', { class: 'news__item' },
      h('span', { class: 'news__month' }, t('common.month') + ' ' + d.roundNumber),
      h('span', {}, (COMPANY_ICONS[d.kind] || '') + ' ' + t('institutions.' + d.kind) + ': ' + decisionLine(d) +
        ' · ' + t('companies.by', { who: ownerName(d.proposer) }))))));
}

export { KINDS };
