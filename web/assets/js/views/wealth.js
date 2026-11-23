// Состояние команды, как в Forbes: деньги минус долг плюс доли компаний по
// оценке. Значки компаний у названия команды, строка «💼 доли …» под
// капиталом (нажмите — из чего она), карточка «Список Forbes» и пояснение,
// как считается капитал. Оценка — на сервере (supabase/functions/game/valuation.ts):
// прибыль компании в месяц × 12 ÷ ставка по кредитам.

import { t } from '../i18n.js';
import { h } from '../dom.js';
import { usd, pct, usdShort } from '../fmt.js';
import { teamName } from './common.js';

export const COMPANY_ICONS = { landlord: '🏠', bank: '🏦', insurer: '🛡', utility: '💡' };

const pctText = (v) => (Math.round(v * 10) / 10).toLocaleString(undefined, { maximumFractionDigits: 1 }) + '%';

/** Значки долей у названия команды: 🏠 10% 🏦 5%. */
export function holdingBadges(holdings) {
  if (!holdings?.length) return null;
  return h('span', { class: 'holdings' }, holdings.map((x) => h('span', {
    class: 'holding', title: t('institutions.' + x.kind) + ' ' + pctText(x.pct) + ' — ' + usd(x.value)
  }, h('span', { 'aria-hidden': 'true' }, COMPANY_ICONS[x.kind] || '•'),
    h('span', { class: 'sr' }, t('institutions.' + x.kind) + ' '), pctText(x.pct))));
}

/** «💼 доли 1,2 млн» под капиталом; нажали — из чего она. */
export function stakesLine(team) {
  if (!(team.stakesValue > 0) || !team.holdings?.length) return null;
  return h('details', { class: 'stakes-line' },
    h('summary', {}, t('wealth.stakes', { amount: usdShort(team.stakesValue) })),
    h('ul', {}, team.holdings.map((x) => h('li', {},
      (COMPANY_ICONS[x.kind] || '') + ' ' + t('institutions.' + x.kind) + ' ' + pctText(x.pct) + ' — ' + usd(x.value)))));
}

/** Как считается капитал — под таблицей мест и в отчёте. */
export function capitalNote(rate) {
  return h('p', { class: 'muted small capital-note' }, t('wealth.note', { rate: pct(Number(rate) || 0) }));
}

/** Источник состояния: ресторан или накопления — и доли компаний. */
function sources(team) {
  const list = [];
  if (team.status === 'active') list.push(t('wealth.restaurant'));
  else if (team.status !== 'bankrupt' && team.status !== 'left') list.push(t('wealth.savings'));
  for (const x of team.holdings || []) list.push(t('wealth.stakeOf', { pct: pctText(x.pct), inst: t('institutionsOf.' + x.kind) }));
  return list.join(', ');
}

/**
 * «Список Forbes»: команды по состоянию, полоса «деньги / доли» и
 * источник. teams — команды табло (capital, money, stakesValue, holdings).
 */
export function forbesCard(teams, { big = false, rate = 0, colorOf = () => null } = {}) {
  const rows = teams.filter((x) => x.status !== 'left')
    .map((x) => ({ x, capital: Number(x.capital) || 0 }))
    .sort((a, b) => b.capital - a.capital);
  if (!rows.length) return null;
  const top = Math.max(1, ...rows.map((r) => Math.max(0, r.x.money) + Math.max(0, r.x.stakesValue || 0)));
  return h('section', { class: ['card', 'forbes', big ? 'card--big' : null] },
    h('div', { class: 'card__head' }, h('h3', { class: 'card__title' }, t('wealth.forbes'))),
    h('p', { class: 'muted small' }, t('wealth.forbesLead')),
    h('ol', { class: 'forbes__list' }, rows.map(({ x, capital }, i) => {
      const money = Math.max(0, Number(x.money) || 0);
      const stakes = Math.max(0, Number(x.stakesValue) || 0);
      return h('li', { class: ['forbes__row', x.mine ? 'is-mine' : null] },
        h('span', { class: 'forbes__place' }, String(i + 1)),
        h('span', { class: 'forbes__who' },
          h('span', { class: 'forbes__name' }, colorOf(x), teamName(x.restaurant), ' ', holdingBadges(x.holdings)),
          h('span', { class: 'forbes__src muted' }, t('wealth.source', { list: sources(x) || '—' }))),
        h('span', { class: ['forbes__sum', capital < 0 ? 'neg' : null] }, usd(capital)),
        h('span', { class: 'forbes__bar', 'aria-hidden': 'true' },
          money > 0 ? h('span', { class: 'forbes__money', style: { width: (money / top) * 100 + '%' } }) : null,
          stakes > 0 ? h('span', { class: 'forbes__stakes', style: { width: (stakes / top) * 100 + '%' } }) : null));
    })),
    h('div', { class: 'owner-keys' },
      h('span', {}, h('span', { class: 'swatch forbes__money' }), t('wealth.money')),
      h('span', {}, h('span', { class: 'swatch forbes__stakes' }), t('wealth.stakesPart'))),
    capitalNote(rate));
}
