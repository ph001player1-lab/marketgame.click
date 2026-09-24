// Общие куски разделов: где работает команда, значки статуса, плашка
// спонсора, карточка «график или таблица», выгрузка CSV.

import { t } from '../i18n.js';
import { h, replace, toast } from '../dom.js';

// 50 штатов и округ Колумбия — как на marketgame.biz.
export const US_STATES = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'], ['CA', 'California'],
  ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'], ['DC', 'District of Columbia'],
  ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'], ['ID', 'Idaho'], ['IL', 'Illinois'],
  ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'],
  ['ME', 'Maine'], ['MD', 'Maryland'], ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'],
  ['MS', 'Mississippi'], ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'],
  ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'], ['NY', 'New York'],
  ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'], ['OR', 'Oregon'],
  ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'], ['SD', 'South Dakota'],
  ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'], ['VT', 'Vermont'], ['VA', 'Virginia'],
  ['WA', 'Washington'], ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming']
];
const STATE_NAME = Object.fromEntries(US_STATES);

/** Где команда ведёт бизнес: «TX», «Across the U.S.», «Mexico». */
export function locationText(loc, long = false) {
  if (!loc || !loc.kind) return '';
  if (loc.kind === 'state') return long ? (STATE_NAME[loc.state] || loc.state || '') : (loc.state || '');
  if (loc.kind === 'multistate') return long ? t('rating.multistate') : 'U.S.';
  return loc.country || t('rating.international');
}

export function locationBadge(loc) {
  const text = locationText(loc);
  return text ? h('span', { class: 'badge', title: locationText(loc, true) }, text) : null;
}

export function statusBadge(status) {
  if (!status || status === 'active') return null;
  const kind = status === 'bankrupt' ? 'badge--bad' : status === 'left' ? null : 'badge--warn';
  return h('span', { class: ['badge', kind] }, t('statuses.' + status));
}

/** Цветная метка команды рядом с её названием — связь с линией на графике. */
export function swatch(color) {
  return h('i', { class: 'swatch', style: { background: color }, 'aria-hidden': 'true' });
}

/**
 * Плашка спонсора. Спонсор — реклама, а не участник игры: банк в игре
 * вымышленный и безымянный, поэтому рядом всегда стоит оговорка.
 */
export function sponsorBanner(sponsor) {
  if (!sponsor || !sponsor.name) return null;
  const logo = sponsor.logoUrl
    ? h('img', { src: sponsor.logoUrl, alt: sponsor.name, loading: 'lazy', referrerpolicy: 'no-referrer' })
    : null;
  const name = sponsor.url
    ? h('a', { class: 'sponsor__name', href: sponsor.url, target: '_blank', rel: 'sponsored noopener noreferrer' }, sponsor.name)
    : h('span', { class: 'sponsor__name' }, sponsor.name);
  return h('aside', { class: 'sponsor', 'aria-label': t('common.sponsoredBy') + ' ' + sponsor.name },
    h('span', { class: 'sponsor__label' }, t('common.sponsoredBy')), logo, name,
    h('p', { class: 'sponsor__note' }, t('common.sponsorNote')));
}

/**
 * Карточка с графиком и кнопкой «Table»: у каждого графика есть таблица с
 * теми же числами. chart(box) рисует график и возвращает { destroy }.
 */
export function chartCard({ title, note, controls, chart, table, asTable = false, onToggle, big = false }) {
  let showTable = asTable;
  let inst = null;
  const box = h('div', { class: 'chart-host' });
  const toggle = h('button', { class: 'btn btn--ghost btn--small', type: 'button',
    onclick: () => { showTable = !showTable; onToggle?.(showTable); paint(); } });
  const el = h('section', { class: ['card', big ? 'card--big' : null] },
    h('div', { class: 'card__head' }, h('h3', { class: 'card__title' }, title),
      h('div', { class: 'card__tools' }, controls, toggle)),
    note ? h('p', { class: 'muted small' }, note) : null,
    box);
  function paint() {
    inst?.destroy?.();
    inst = null;
    replace(box);
    toggle.textContent = showTable ? t('board.showChart') : t('board.showTable');
    toggle.setAttribute('aria-pressed', showTable ? 'true' : 'false');
    if (showTable) box.append(table());
    else inst = chart(box);
  }
  paint();
  return { el, repaint: paint, destroy() { inst?.destroy?.(); inst = null; } };
}

/** Простая таблица: заголовки и строки; числа — справа. */
export function simpleTable(head, rows, { numeric = [], rowClass } = {}) {
  const isNumCol = (i) => numeric === true ? i > 0 : numeric.includes(i);
  return h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
    h('thead', {}, h('tr', {}, head.map((c, i) => h('th', { class: isNumCol(i) ? 'r' : null, scope: 'col' }, c)))),
    h('tbody', {}, rows.map((r, k) => h('tr', { class: rowClass ? rowClass(k) : null },
      r.map((c, i) => h('td', { class: isNumCol(i) ? 'r' : null }, c)))))));
}

// ----------------------------------------------------------------- файлы и ссылки

function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/** CSV для Excel и Google Sheets: запятые, UTF-8 с BOM. */
export function downloadCsv(filename, rows) {
  const text = '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function copyText(text, okMessage) {
  try {
    await navigator.clipboard.writeText(text);
    toast(okMessage || t('common.copied'), 'ok');
  } catch {
    // Без доступа к буферу: покажем ссылку, чтобы скопировать руками.
    window.prompt(t('common.copy'), text);
  }
}

/** Имя файла без пробелов и знаков: «taco-town-report.csv». */
export function fileSlug(text) {
  return String(text || 'market-game').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'market-game';
}

/** Адрес сайта для ссылок: работает и на marketgame.click, и на github.io. */
export function siteBase() {
  const path = location.pathname.replace(/(board|report|rating)\/(index\.html)?$/, '').replace(/index\.html$/, '');
  return location.origin + path;
}
