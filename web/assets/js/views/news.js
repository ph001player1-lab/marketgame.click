// Лента «Новости»: законы горожан, решения акционеров, сделки с долями,
// банкротства — от новых к старым. Сервер — newsFeed в board.ts; здесь
// событие пишется на языке читателя.

import { t } from '../i18n.js';
import { h, replace } from '../dom.js';
import { usd, pctRaw } from '../fmt.js';
import { teamName } from './common.js';
import { voteQuestion } from './vote.js';
import { COMPANY_ICONS } from './wealth.js';
import { priceText, whatOf, ownerName } from './companies.js';

/** Сколько событий видно сразу; остальные — по «Показать все». */
const FIRST = 5;

/** Одно событие текстом. */
export function newsText(x) {
  if (x.type === 'law') {
    const q = voteQuestion(x);
    const key = !x.passed ? 'news.lawFailed' : x.decision === 'pending' ? 'news.lawPending'
      : x.decision === 'vetoed' ? 'news.lawVetoed' : 'news.lawSigned';
    return t(key, { q }) + (x.proposer ? ' ' + t('news.initiative', { team: teamName(x.proposer) }) : '');
  }
  if (x.type === 'company') {
    const vars = { company: t('institutions.' + x.kind), what: whatOf(x.kind), value: priceText(x.kind, x.value),
      who: ownerName(x.proposer) };
    return (COMPANY_ICONS[x.kind] || '') + ' ' + t('news.company.' + x.status, vars);
  }
  if (x.type === 'stake') {
    return (COMPANY_ICONS[x.kind] || '') + ' ' + t(x.seller ? 'news.stakeFromTeam' : 'news.stakeFromCity', {
      buyer: teamName(x.buyer), seller: teamName(x.seller || ''), pct: pctRaw(x.pct),
      inst: t('institutionsOf.' + x.kind), price: usd(x.price) }) + (x.via === 'auction' ? ' ' + t('news.viaAuction') : '');
  }
  if (x.type === 'bankrupt') return t('news.bankrupt', { team: teamName(x.team) });
  return '';
}

/** Карточка ленты; update(news) — новые события сверху. */
export function newsCard() {
  const list = h('ul', { class: 'news' });
  const more = h('ul', { class: 'news' });
  const moreBox = h('details', { class: 'news__more', hidden: true }, h('summary', {}, t('news.showAll')), more);
  const empty = h('p', { class: 'muted small' }, t('news.empty'));
  const el = h('section', { class: 'card news-card' }, h('h3', { class: 'card__title' }, t('news.title')), empty, list, moreBox);
  let sig = '';
  // Время события, а не месяц: сделка между месяцами учитывается в
  // следующем, и «Месяц 2» в шапке «Месяц 1» сбивал бы с толку.
  const at = (iso) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString(document.documentElement.lang || undefined,
      { hour: '2-digit', minute: '2-digit' });
  };
  const item = (x) => h('li', { class: 'news__item news__item--' + x.type },
    h('time', { class: 'news__month', datetime: x.at }, at(x.at)),
    h('span', {}, newsText(x)));
  return {
    el,
    update(news) {
      const items = news || [];
      const next = items.map((x) => x.id + ':' + (x.decision || x.status || '')).join('|');
      if (next === sig) return;
      sig = next;
      empty.hidden = items.length > 0;
      replace(list, items.slice(0, FIRST).map(item));
      replace(more, items.slice(FIRST).map(item));
      moreBox.hidden = items.length <= FIRST;
    }
  };
}
