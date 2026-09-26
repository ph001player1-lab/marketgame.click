// Красный или голубой океан — метацель игры («Стратегия голубого океана»).
//
// Цвет воды — операционный результат всех ресторанов города вместе:
// потеряли — красная, около нуля — неспокойная, заработали — голубая.
// Рядом — причины месяца: ценовая война, гонка рекламы, теснота и качество,
// которое растит рынок для всех. Участники видят, когда и от чего рынок
// краснеет, а ведущий получает вопросы для разбора.

import { t, tn } from '../i18n.js';
import { h } from '../dom.js';
import { usd, usdc, usdShort, pct, dec2, int } from '../fmt.js';
import { barChart, PALETTE } from '../charts.js';
import { chartCard, simpleTable } from './common.js';

// Расходящаяся пара: заработали — синий, потеряли — красный, между ними —
// нейтральный ноль. Метка всегда с подписью, цвет не единственный признак.
export const WATER_COLORS = { red: PALETTE[7], choppy: PALETTE[3], blue: PALETTE[0] };

/** Значок «Red water» / «Blue water» с цветной точкой. */
export function waterChip(water) {
  if (!water) return null;
  return h('span', { class: ['water', 'water--' + water] },
    h('i', { class: 'water__dot', style: { background: WATER_COLORS[water] }, 'aria-hidden': 'true' }),
    t('ocean.water.' + water));
}

function margin(m) {
  return pct(m.margin, 1);
}

/**
 * Причины месяца: что сделало воду красной или голубой. Каждая — про этот
 * месяц и с арифметикой: «рынок кормит 5» без расчёта непонятно.
 */
export function drivers(m) {
  const items = [];
  const warn = (text) => items.push(h('li', { class: 'driver driver--warn' }, h('b', { 'aria-hidden': 'true' }, '!'), text));
  const good = (text) => items.push(h('li', { class: 'driver driver--ok' }, h('b', { 'aria-hidden': 'true' }, '✓'), text));
  // Сколько гостей добавило качество: рынок без качества был бы market ÷ (1 + boost).
  const extra = m.qualityBoost > 0 ? Math.round(m.market - m.market / (1 + m.qualityBoost)) : 0;
  const vars = {
    n: m.round, avg: usdc(m.avgPrice), ref: usd(m.pRef), share: pct(m.adShare, 1),
    restaurants: tn('ocean.nRestaurants', m.restaurants),
    feeds: m.feeds === null ? '—' : tn('ocean.nRestaurants', m.feeds),
    guests: int(m.market), breakEven: m.breakEven ? int(m.breakEven) : '—',
    fixed: m.fixed ? usd(m.fixed) : '—', perGuest: m.perGuest ? usd(m.perGuest) : '—',
    boost: pct(m.qualityBoost, 1), quality: dec2(m.avgQuality), extra: int(extra),
    gain: pct(m.qualityGain ?? 0.15, 0)
  };
  if (m.avgPrice < m.pRef * 0.95) warn(t('ocean.driver.priceWar', vars));
  else good(t('ocean.driver.priceOk', vars));
  if (m.adShare > 0.08) warn(t('ocean.driver.adRace', vars));
  else good(t('ocean.driver.adOk', vars));
  if (m.feeds !== null && m.feeds !== undefined && m.restaurants > m.feeds) warn(t('ocean.driver.crowded', vars));
  else good(t('ocean.driver.roomy', vars));
  if (m.feeds !== null && m.feeds !== undefined && m.breakEven) {
    items.push(h('li', { class: 'driver driver--note' }, h('b', { 'aria-hidden': 'true' }, '='), t('ocean.driver.feedsHow', vars)));
  }
  if (m.qualityBoost > 0.001) good(t('ocean.driver.quality', vars));
  else warn(t('ocean.driver.noQuality', vars));
  return h('ul', { class: 'drivers' }, items);
}

function summary(m) {
  return t(m.ebit >= 0 ? 'ocean.summary.earned' : 'ocean.summary.lost',
    { n: m.round, amount: usd(Math.abs(m.ebit)), revenue: usd(m.revenue), pct: margin(m) });
}

/** Карточка табло: цвет воды, причины, график по месяцам, таблица. */
export function oceanCard(ocean, { big = false } = {}) {
  const months = ocean.map((m) => m.round);
  const last = ocean[ocean.length - 1];
  const card = chartCard({
    title: t('ocean.title'), note: t('ocean.lead'), big,
    chart: (box) => barChart(box, {
      x: months, big, fmt: usd, tick: usdShort, totalLabel: t('board.net'),
      series: [
        { key: 'earned', name: t('ocean.earned'), color: WATER_COLORS.blue, values: ocean.map((m) => Math.max(0, m.ebit)) },
        { key: 'lost', name: t('ocean.lost'), color: WATER_COLORS.red, values: ocean.map((m) => Math.min(0, m.ebit)) }
      ],
      label: t('ocean.chartTitle'), xName: t('board.mo'), xLabel: (n) => t('common.month') + ' ' + n,
      legendLabel: t('board.legend'), height: big ? 'min(34vh, 320px)' : '190px'
    }),
    table: () => h('div', {}, simpleTable(
      [t('common.month'), t('ocean.columns.restaurants'), t('ocean.columns.guests'), t('ocean.columns.feeds'),
        t('ocean.columns.avgPrice'), t('ocean.columns.adShare'), t('ocean.columns.quality'), t('ocean.columns.result'),
        t('ocean.columns.margin'), t('ocean.columns.water')],
      ocean.map((m) => [m.round, m.restaurants, int(m.market), m.feeds ?? '—', usdc(m.avgPrice), pct(m.adShare, 1),
        dec2(m.avgQuality), usd(m.ebit), margin(m), t('ocean.water.' + m.water)]),
      { numeric: [1, 2, 3, 4, 5, 6, 7, 8] }),
    h('p', { class: 'muted small' }, t('ocean.feedsNote')))
  });
  const host = card.el.querySelector('.chart-host');
  card.el.insertBefore(h('div', { class: 'ocean-now' },
    h('div', { class: 'ocean-now__head' }, waterChip(last.water)),
    h('p', { class: 'ocean-now__text' }, summary(last)),
    h('h4', { class: 'chart-sub' }, t('ocean.driversTitle')),
    drivers(last),
    h('h4', { class: 'chart-sub' }, t('ocean.chartTitle'))), host);
  card.el.append(h('p', { class: 'muted small' }, t('ocean.guideHint')));
  return card;
}

/** Разбор для ведущего после месяца: цвет воды, причины и вопросы командам. */
export function debriefCard(ocean) {
  if (!ocean || !ocean.length) return null;
  const last = ocean[ocean.length - 1];
  const questions = t('ocean.questions.' + last.water);
  return h('section', { class: 'card' },
    h('div', { class: 'card__head' },
      h('h3', { class: 'card__title' }, t('ocean.debriefTitle', { n: last.round })), waterChip(last.water)),
    h('p', { class: 'small' }, summary(last)),
    drivers(last),
    h('h4', { class: 'chart-sub' }, t('ocean.questionsTitle')),
    h('ol', { class: 'questions' }, (Array.isArray(questions) ? questions : []).map((q) => h('li', {}, q))));
}
