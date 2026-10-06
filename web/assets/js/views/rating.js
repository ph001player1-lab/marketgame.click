// Рейтинг: все засчитанные игры лиги. Открыт без входа — на него ссылается
// marketgame.biz, а игроки хвастаются местом.

import { t, tn } from '../i18n.js';
import { h, replace } from '../dom.js';
import { dec2, pctRaw, usd, dateOnly, currentLocale } from '../fmt.js';
import { read } from '../api.js';
import { placeText, countryName, areaName, hasAreaList, regionOf, regionName, REGION_KEYS } from '../geo.js';

const LEAGUES = ['start', 'growth', 'elite'];

// Где команда вела бизнес в своей последней игре: там, где шла игра, или —
// в онлайн-игре — где указала сама.
const locOf = (p) => ({ country: p.location_country, area: p.location_area });

/** Таблица рейтинга; в строке команды — история её игр. */
export function ratingTable(players, { limit = 50 } = {}) {
  const rows = players.slice(0, limit);
  const num = (text) => h('td', { class: 'r' }, text);
  const opt = (text) => h('td', { class: 'r opt' }, text);
  // На узком экране — только место, команда, где, приумножение и балл.
  return h('div', { class: 'table-wrap table-wrap--cq' }, h('table', { class: 'table table--rating' },
    h('thead', {}, h('tr', {},
      h('th', { class: 'r', scope: 'col' }, '#'),
      h('th', { scope: 'col' }, t('rating.columns.team')),
      h('th', { scope: 'col' }, t('rating.columns.where')),
      h('th', { class: 'r opt', scope: 'col' }, t('rating.columns.games')),
      h('th', { class: 'r opt', scope: 'col' }, t('rating.columns.wins')),
      h('th', { class: 'r', scope: 'col' }, t('rating.columns.mult')),
      h('th', { class: 'r opt', scope: 'col' }, t('rating.columns.place')),
      h('th', { class: 'r opt', scope: 'col' }, t('rating.columns.share')),
      h('th', { class: 'r', scope: 'col' }, t('rating.columns.score')))),
    h('tbody', {}, rows.map((p, i) => h('tr', {},
      num(i + 1),
      h('td', {},
        h('div', { class: 'team-cell__name' }, p.restaurant || '—'),
        p.display_name ? h('div', { class: 'team-cell__who' }, p.display_name) : null,
        Array.isArray(p.history) && p.history.length ? h('details', { class: 'rating-history' },
          h('summary', {}, tn('rating.gamesList', p.history.length)),
          h('ul', {}, p.history.map((g) => h('li', {},
            g.title + (g.organizer ? ' · ' + g.organizer : '') + ' · ' + dateOnly(g.finishedAt) + ': ' +
            t('rating.gameLine', { place: g.place, rivals: g.rivals, capital: usd(g.capital), mult: dec2(g.multiplier) }))))) : null),
      h('td', {}, placeText(locOf(p), true) || '—'),
      opt(p.games), opt(p.wins), num('×' + dec2(p.avg_multiplier)), opt(dec2(p.avg_place_score)),
      opt(pctRaw(p.avg_share_pct)), h('td', { class: 'r' }, h('b', {}, dec2(p.score))))))));
}

/** Страница рейтинга: вкладки лиг и фильтр по месту. */
export function renderRatingPage(page) {
  let league = sessionStorage.getItem('mg-rating-league') || 'start';
  let where = 'all';
  let data = null;

  const tabs = h('div', { class: 'seg', role: 'group', 'aria-label': t('rating.leagueLabel') });
  const filter = h('select', { class: 'input input--inline', 'aria-label': t('rating.filter'),
    onchange: (e) => { where = e.target.value; paint(); } });
  const body = h('div', {}, h('div', { class: 'spinner', role: 'status' }));

  replace(page,
    h('div', { class: 'page__head' }, h('h1', {}, t('rating.title'))),
    h('p', { class: 'muted' }, t('rating.lead')),
    h('details', { class: 'card card--soft' },
      h('summary', {}, h('b', {}, t('rating.howTitle'))),
      h('ul', {}, ['how1', 'how2', 'how3', 'how4'].map((k) => h('li', {}, t('rating.' + k))))),
    h('div', { class: 'toolbar' }, tabs, h('label', { class: 'toolbar__field' }, t('rating.filter') + ' ', filter)),
    body);

  read('rating', {}, { auth: false }).then((res) => {
    if (!res.ok) { replace(body, h('div', { class: 'banner banner--bad' }, t('errors.network'))); return; }
    data = res;
    paint();
  });

  function paint() {
    replace(tabs, LEAGUES.map((l) => h('button', { type: 'button', 'aria-pressed': l === league ? 'true' : 'false',
      onclick: () => { league = l; sessionStorage.setItem('mg-rating-league', l); where = 'all'; paint(); } },
      t('leagues.' + l) + ' · ' + tn('rating.months', { start: 12, growth: 24, elite: 36 }[l]))));
    if (!data) return;
    const all = (data.leagues || []).find((x) => x.league === league)?.players || [];

    // Фильтр — только по тем местам, что есть в этой лиге: часть света,
    // в ней страны, а в США и России — штаты и регионы.
    const byName = (a, b) => a[1].localeCompare(b[1], currentLocale());
    const pad = '\u00a0\u00a0\u00a0';
    const options = [['all', t('rating.all')]];
    for (const r of REGION_KEYS) {
      const here = all.filter((p) => regionOf(p.location_country) === r);
      if (!here.length) continue;
      options.push(['r:' + r, regionName(r)]);
      const countries = [...new Set(here.map((p) => p.location_country))].map((c) => [c, countryName(c)]).sort(byName);
      for (const [c, name] of countries) {
        options.push(['c:' + c, pad + name]);
        if (!hasAreaList(c)) continue;
        const areas = [...new Set(here.filter((p) => p.location_country === c && p.location_area).map((p) => p.location_area))]
          .map((a) => [a, areaName(c, a)]).sort(byName);
        for (const [a, aName] of areas) options.push(['a:' + c + ':' + a, pad + pad + aName]);
      }
    }
    if (!options.some(([v]) => v === where)) where = 'all';
    replace(filter, options.map(([v, label]) => h('option', { value: v, selected: v === where }, label)));

    const [kind, x, y] = where.split(':');
    const list = all.filter((p) => kind === 'all' ||
      (kind === 'r' ? regionOf(p.location_country) === x
        : kind === 'c' ? p.location_country === x
          : p.location_country === x && p.location_area === y));
    replace(body, list.length
      ? ratingTable(list, { limit: 200 })
      : h('p', { class: 'muted' }, t('rating.empty')));
  }
}
