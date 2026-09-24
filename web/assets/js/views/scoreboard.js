// Табло: команды, экономика города, «Куда ушли деньги», рейтинг лиги.
//
// Одно и то же табло живёт в трёх местах: в игре (правая панель или вкладка
// на телефоне), на проекторе (board/) и в отчёте после игры. Почт здесь нет:
// команда видна по названию ресторана и имени.

import { t, tn } from '../i18n.js';
import { h, replace } from '../dom.js';
import { usd, usdc, int, dec2, pctRaw, usdShort, short } from '../fmt.js';
import { read } from '../api.js';
import { lineChart, barChart, sankey, PALETTE, OTHER, INK } from '../charts.js';
import {
  locationBadge, statusBadge, swatch, sponsorBanner, chartCard, simpleTable
} from './common.js';
import { ratingTable } from './rating.js';

// Что можно показать на графике команд. zero: false — ось не от нуля (цена).
const METRICS = [
  { key: 'capital', fmt: usd, tick: usdShort },
  { key: 'cash', fmt: usd, tick: usdShort },
  { key: 'profit', fmt: usd, tick: usdShort },
  { key: 'marketSharePct', fmt: pctRaw, tick: (v) => short(v) + '%' },
  { key: 'served', fmt: int, tick: short },
  { key: 'price', fmt: usdc, tick: (v) => '$' + short(v), zero: false },
  { key: 'brand', fmt: dec2, tick: (v) => String(v) },
  { key: 'reputation', fmt: dec2, tick: (v) => String(v), zero: false },
  { key: 'quality', fmt: dec2, tick: (v) => String(v) },
  { key: 'capacity', fmt: int, tick: short },
  { key: 'marketingTotal', fmt: usd, tick: usdShort },
  { key: 'qualityInvest', fmt: usd, tick: usdShort },
  { key: 'tax', fmt: usd, tick: usdShort },
  { key: 'dividends', fmt: usd, tick: usdShort }
];

// Цвета экономики закреплены за смыслом во всех её графиках: город всегда
// оранжевый, команды-совладельцы синие, частные владельцы серые.
export const OWNER_COLORS = { city: PALETTE[1], players: PALETTE[0], private: OTHER };
const FLOW_COLORS = {
  cost: '#C9C8C0', institution: PALETTE[6], city: PALETTE[1], kept: PALETTE[2], losses: PALETTE[3]
};
const CITY_SERIES = [
  { key: 'profitTax', color: PALETTE[0] },
  { key: 'companies', color: PALETTE[6] },
  { key: 'otherIncome', color: PALETTE[3] },
  { key: 'spending', color: PALETTE[7] }
];

const VIEWS = ['teams', 'economy', 'money', 'rating'];

export function createScoreboard(root, opts = {}) {
  const mode = opts.mode || 'app';
  const big = mode === 'projector';
  const storeKey = 'mg-board-' + mode + '-';
  const load = (k, d) => { try { return sessionStorage.getItem(storeKey + k) ?? d; } catch { return d; } };
  const save = (k, v) => { try { sessionStorage.setItem(storeKey + k, v); } catch { /* приватный режим */ } };

  let data = null;
  let myId = opts.myId || null;
  let sig = '';
  let view = VIEWS.includes(load('view')) ? load('view') : 'teams';
  let metric = METRICS.some((m) => m.key === load('metric')) ? load('metric') : 'capital';
  let metricTable = load('metricTable', '0') === '1';
  let ratingCache = null;
  let cards = [];

  const buttons = VIEWS.map((v) => h('button', { type: 'button', 'aria-pressed': 'false', onclick: () => setView(v) },
    t('board.views.' + v)));
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': t('board.title') }, buttons);
  const body = h('div', { class: 'board-body' });
  const sponsorBox = h('div', {});
  replace(root, h('div', { class: ['board', big ? 'board--big' : null] }, seg, body, sponsorBox));

  function setView(v) {
    view = v;
    save('view', v);
    render();
  }

  function update(d, last) {
    if (!d || !d.ok) return;
    if (last?.player?.id) myId = last.player.id;
    data = d;
    const next = JSON.stringify([d.players, d.marketTotals, d.institutions, d.city, d.moneyMap,
      d.game.roundNumber, d.game.roundStatus, d.game.status, d.game.sponsor, myId]);
    if (next === sig) return;
    sig = next;
    render();
  }

  function destroyCards() {
    for (const c of cards) c.destroy?.();
    cards = [];
  }

  function render() {
    destroyCards();
    buttons.forEach((b, i) => b.setAttribute('aria-pressed', VIEWS[i] === view ? 'true' : 'false'));
    replace(sponsorBox, data ? sponsorBanner(data.game.sponsor) : null);
    if (!data) { replace(body, h('div', { class: 'spinner', role: 'status' })); return; }
    replace(body);
    if (view === 'teams') renderTeams();
    else if (view === 'economy') renderEconomy();
    else if (view === 'money') renderMoney();
    else renderRating();
  }

  function add(card) {
    cards.push(card);
    body.append(card.el);
    return card;
  }

  // ----------------------------------------------------------------- команды

  function teams() {
    return (data.players || []).map((p, i) => {
      const mine = p.id === myId;
      return {
        ...p, mine,
        color: i < PALETTE.length ? PALETTE[i] : mine ? INK : OTHER,
        other: i >= PALETTE.length && !mine,
        label: p.restaurant + (mine ? ' ' + t('board.you') : '')
      };
    });
  }

  function monthsPlayed() {
    let max = 0;
    for (const p of data.players || []) for (const e of p.series) max = Math.max(max, e.round);
    return Array.from({ length: max }, (_, i) => i + 1);
  }

  const entryAt = (team, month) => team.series.find((e) => e.round === month) || null;

  function valueAt(team, month, key) {
    const e = entryAt(team, month);
    if (!e) return null;
    const v = e[key];
    return v === null || v === undefined ? null : Number(v);
  }

  function renderTeams() {
    const list = teams();
    const months = monthsPlayed();
    const lastMonth = months.length;

    const market = data.marketTotals?.[lastMonth];
    body.append(h('p', { class: 'board-line' },
      months.length ? t('board.afterMonth', { n: lastMonth }) : t('board.beforeStart'),
      market ? ' · ' + t('board.market', { guests: int(market) }) : '',
      ' · ' + tn('board.teamsCount', list.filter((p) => p.status !== 'left').length)));

    body.append(standings(list, lastMonth));

    if (!months.length) {
      body.append(h('p', { class: 'muted' }, t('board.empty')));
      return;
    }

    const M = METRICS.find((m) => m.key === metric) || METRICS[0];
    const select = h('select', { class: 'input input--inline', 'aria-label': t('board.metric'),
      onchange: (e) => { metric = e.target.value; save('metric', metric); render(); } },
      METRICS.map((m) => h('option', { value: m.key, selected: m.key === metric }, t('board.metrics.' + m.key))));
    add(chartCard({
      title: t('board.metrics.' + M.key),
      note: t('board.metricNotes.' + M.key) === 'board.metricNotes.' + M.key ? null : t('board.metricNotes.' + M.key),
      controls: select,
      big,
      asTable: metricTable,
      onToggle: (v) => { metricTable = v; save('metricTable', v ? '1' : '0'); },
      chart: (box) => lineChart(box, {
        x: months,
        series: list.map((tm) => ({
          key: tm.id, name: tm.label, color: tm.color, emphasis: tm.mine, other: tm.other,
          values: months.map((m) => valueAt(tm, m, M.key))
        })),
        fmt: M.fmt, tick: M.tick, zero: M.zero !== false, big,
        label: t('board.chartLabel', { metric: t('board.metrics.' + M.key), n: list.length }),
        otherLabel: t('board.otherTeams'), nullText: t('board.offBusiness'),
        xName: t('board.mo'), xLabel: (m) => t('common.month') + ' ' + m,
        legendLabel: t('board.legend')
      }),
      table: () => h('div', { class: 'table-wrap' }, h('table', { class: 'table table--sticky' },
        h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, t('common.team')),
          months.map((m) => h('th', { class: 'r', scope: 'col' }, t('board.mo') + ' ' + m)))),
        h('tbody', {}, list.map((tm) => h('tr', { class: tm.mine ? 'me' : null },
          h('th', { scope: 'row' }, swatch(tm.color), tm.restaurant),
          months.map((m) => {
            const v = valueAt(tm, m, M.key);
            return h('td', { class: 'r' }, v === null ? '—' : M.fmt(v));
          }))))))
    }));
  }

  /** Таблица мест: по капиталу, как в рейтинге. */
  function standings(list, lastMonth) {
    const rows = list.map((tm) => {
      const last = lastMonth ? entryAt(tm, lastMonth) : null;
      const lastAny = tm.series[tm.series.length - 1] || null;
      const capital = tm.capital ?? lastAny?.cash ?? null;
      return { tm, last, capital };
    });
    rows.sort((a, b) => (b.capital ?? -Infinity) - (a.capital ?? -Infinity));
    rows.forEach((r, i) => {
      r.place = i > 0 && r.capital === rows[i - 1].capital ? rows[i - 1].place : i + 1;
    });
    const cell = (v, f) => (v === null || v === undefined ? '—' : f(v));
    return h('section', { class: ['card', 'card--flush', big ? 'card--big' : null] },
      h('div', { class: 'card__head card__head--pad' }, h('h3', { class: 'card__title' }, t('board.standings'))),
      h('div', { class: 'table-wrap' }, h('table', { class: 'table table--standings' },
        h('thead', {}, h('tr', {},
          h('th', { class: 'r', scope: 'col' }, '#'),
          h('th', { scope: 'col' }, t('common.team')),
          h('th', { class: 'r', scope: 'col' }, t('board.capital')),
          h('th', { class: 'r', scope: 'col' }, t('board.lastMonth')),
          h('th', { class: 'r opt2', scope: 'col' }, t('board.share')),
          h('th', { class: 'r opt', scope: 'col' }, t('board.metrics.price')),
          h('th', { class: 'r opt', scope: 'col' }, t('board.metrics.brand')),
          h('th', { class: 'r opt', scope: 'col' }, t('board.metrics.quality')))),
        h('tbody', {}, rows.map((r) => h('tr', { class: r.tm.mine ? 'me' : null },
          h('td', { class: 'r' }, r.tm.status === 'left' ? '—' : r.place),
          h('td', {},
            h('div', { class: 'team-cell' }, swatch(r.tm.color),
              h('span', { class: 'team-cell__name' }, r.tm.restaurant),
              r.tm.mine ? h('span', { class: 'badge badge--ink' }, t('common.you')) : null,
              locationBadge(r.tm.location), statusBadge(r.tm.status)),
            r.tm.displayName ? h('div', { class: 'team-cell__who' }, r.tm.displayName) : null),
          h('td', { class: 'r' }, cell(r.capital, usd)),
          h('td', { class: ['r', (r.last?.profit ?? 0) < 0 ? 'neg' : null] }, cell(r.last?.profit, usd)),
          h('td', { class: 'r opt2' }, cell(r.last?.marketSharePct, pctRaw)),
          h('td', { class: 'r opt' }, cell(r.last?.price, usdc)),
          h('td', { class: 'r opt' }, cell(r.last?.brand, dec2)),
          h('td', { class: 'r opt' }, cell(r.last?.quality, dec2))))))));
  }

  // ----------------------------------------------------------------- экономика

  function renderEconomy() {
    const mt = data.marketTotals || {};
    const mMonths = Object.keys(mt).map(Number).sort((a, b) => a - b);
    const rules = data.rules || {};

    if (mMonths.length) {
      add(chartCard({
        title: t('board.marketTitle'),
        note: t('board.marketWhy', { base: int(rules.marketBase), gain: Math.round((rules.marketQualityGain || 0) * 100) + '%' }),
        big,
        chart: (box) => lineChart(box, {
          x: mMonths, big, zero: false, fmt: int, tick: short,
          series: [{ key: 'market', name: t('board.guests'), color: PALETTE[0], values: mMonths.map((m) => mt[m]) }],
          label: t('board.marketTitle'), xName: t('board.mo'), xLabel: (m) => t('common.month') + ' ' + m,
          height: big ? 'min(40vh, 380px)' : '200px'
        }),
        table: () => simpleTable([t('common.month'), t('board.guests')], mMonths.map((m) => [m, int(mt[m])]), { numeric: [1] })
      }));
    }

    cityCards();
    for (const inst of data.institutions || []) institutionCard(inst);
  }

  function cityCards() {
    const city = data.city || { balance: 0, months: [] };
    const months = city.months.map((m) => m.round);
    const val = (m, key) => {
      const i = m.income;
      const s = m.spending;
      if (key === 'profitTax') return i.profitTax;
      if (key === 'companies') return i.dividends;
      if (key === 'otherIncome') return i.fines + i.cityTaxes + i.stakeSales;
      return s.grants + s.civilSalaries + s.stakeBuybacks;
    };
    const head = [t('common.month'), t('board.cityIncome.profitTax'), t('board.cityIncome.dividends'),
      t('board.cityIncome.fines'), t('board.cityIncome.cityTaxes'), t('board.cityIncome.stakeSales'),
      t('board.citySpending.grants'), t('board.citySpending.civilSalaries'), t('board.citySpending.stakeBuybacks'),
      t('common.total'), t('board.balance')];
    const cityTable = () => simpleTable(head, city.months.map((m) => [m.round,
      usd(m.income.profitTax), usd(m.income.dividends), usd(m.income.fines), usd(m.income.cityTaxes),
      usd(m.income.stakeSales), usd(m.spending.grants), usd(m.spending.civilSalaries),
      usd(m.spending.stakeBuybacks), usd(m.total), usd(m.balance)]), { numeric: true });

    const title = h('span', {}, t('board.cityTitle'), ' ',
      h('span', { class: ['badge', city.balance < 0 ? 'badge--bad' : 'badge--ink'] },
        t('board.cityBalance', { amount: usd(city.balance) })));
    if (!months.length) {
      body.append(h('section', { class: 'card' }, h('h3', { class: 'card__title' }, title),
        h('p', { class: 'muted small' }, t('board.cityWhat')), h('p', { class: 'muted' }, t('board.empty'))));
      return;
    }
    add(chartCard({
      title, note: t('board.cityWhat'), big,
      chart: (box) => {
        const bars = barChart(box, {
          x: months, big, fmt: usd, tick: usdShort, totalLabel: t('board.net'),
          series: CITY_SERIES.map((se) => ({ key: se.key, name: t('board.citySeries.' + se.key), color: se.color,
            values: city.months.map((m) => val(m, se.key)) })),
          label: t('board.cityTitle'), xName: t('board.mo'), xLabel: (m) => t('common.month') + ' ' + m,
          legendLabel: t('board.legend'), height: big ? 'min(40vh, 380px)' : '220px'
        });
        box.append(h('h4', { class: 'chart-sub' }, t('board.balanceTitle')));
        const line = lineChart(box, {
          x: months, big, fmt: usd, tick: usdShort,
          series: [{ key: 'balance', name: t('board.balance'), color: OWNER_COLORS.city, values: city.months.map((m) => m.balance) }],
          label: t('board.balanceTitle'), xName: t('board.mo'), xLabel: (m) => t('common.month') + ' ' + m,
          height: big ? 'min(30vh, 300px)' : '160px'
        });
        return { destroy() { bars.destroy(); line.destroy(); } };
      },
      table: cityTable
    }));
  }

  function ownershipBar(own) {
    const seg = (pct, color, label) => pct > 0
      ? h('span', { style: { width: pct + '%', background: color }, title: label + ' ' + pctRaw(pct) }) : null;
    return h('div', {},
      h('div', { class: 'owners', role: 'img', 'aria-label': t('board.ownership') + ': ' +
        t('common.city') + ' ' + pctRaw(own.cityPct) + ', ' + t('board.teamOwners') + ' ' + pctRaw(own.playersPct) + ', ' +
        t('common.private') + ' ' + pctRaw(own.privatePct) },
        seg(own.cityPct, OWNER_COLORS.city, t('common.city')),
        seg(own.playersPct, OWNER_COLORS.players, t('board.teamOwners')),
        seg(own.privatePct, OWNER_COLORS.private, t('common.private'))),
      h('div', { class: 'owner-keys' },
        h('span', {}, swatch(OWNER_COLORS.city), t('common.city') + ' ' + pctRaw(own.cityPct)),
        h('span', {}, swatch(OWNER_COLORS.players), t('board.teamOwners') + ' ' + pctRaw(own.playersPct)),
        h('span', {}, swatch(OWNER_COLORS.private), t('common.private') + ' ' + pctRaw(own.privatePct))));
  }

  function institutionCard(inst) {
    const months = inst.months.map((m) => m.round);
    const sum = (k) => inst.months.reduce((a, m) => a + (Number(m[k]) || 0), 0);
    const lastM = inst.months[inst.months.length - 1];
    const facts = [t('board.instTotals', { income: usd(sum('income')), payout: usd(sum('payout')) })];
    if (inst.kind === 'bank') {
      facts.push(t('board.writeOffsTotal', { amount: usd(sum('writeOffs')) }));
      if (lastM && lastM.loansOutstanding !== null) facts.push(t('board.loansNow', { amount: usd(lastM.loansOutstanding) }));
    }
    if (inst.lossCarryforward > 0) facts.push(t('board.lossCf', { amount: usd(inst.lossCarryforward) }));
    const holders = inst.ownership.holders.length
      ? h('p', { class: 'small' }, h('b', {}, t('board.holders') + ': '),
          inst.ownership.holders.map((x) => x.restaurant + ' ' + pctRaw(x.pct)).join(', '))
      : h('p', { class: 'small muted' }, t('board.noHolders'));

    const top = h('div', {},
      h('p', { class: 'muted small' }, t('institutions.' + inst.kind + 'What')),
      ownershipBar(inst.ownership), holders,
      h('p', { class: 'small' }, facts.join(' · ')));

    if (!months.length) {
      body.append(h('section', { class: 'card' }, h('h3', { class: 'card__title' }, t('institutions.' + inst.kind)), top));
      return;
    }
    const card = add(chartCard({
      title: t('institutions.' + inst.kind), big,
      chart: (box) => barChart(box, {
        x: months, big, fmt: usd, tick: usdShort, totalLabel: t('board.payout'),
        series: [
          { key: 'city', name: t('common.city'), color: OWNER_COLORS.city, values: inst.months.map((m) => m.toCity) },
          { key: 'players', name: t('board.teamOwners'), color: OWNER_COLORS.players, values: inst.months.map((m) => m.toPlayers) },
          { key: 'private', name: t('common.private'), color: OWNER_COLORS.private, values: inst.months.map((m) => m.toPrivate) }
        ],
        emptyText: t('board.noPayout'),
        label: t('board.payoutChart', { name: t('institutions.' + inst.kind) }),
        xName: t('board.mo'), xLabel: (m) => t('common.month') + ' ' + m,
        legendLabel: t('board.legend'), height: big ? 'min(34vh, 320px)' : '170px'
      }),
      table: () => simpleTable(
        [t('common.month'), t('board.income'), t('board.writeOffs'), t('board.profitInst'), t('common.city'),
          t('board.teamOwners'), t('common.private')].concat(inst.kind === 'bank' ? [t('board.loans')] : []),
        inst.months.map((m) => [m.round, usd(m.income), usd(m.writeOffs), usd(m.profit), usd(m.toCity),
          usd(m.toPlayers), usd(m.toPrivate)].concat(inst.kind === 'bank' ? [usd(m.loansOutstanding)] : [])),
        { numeric: true })
    }));
    card.el.insertBefore(top, card.el.querySelector('.chart-host'));
    card.el.insertBefore(h('h4', { class: 'chart-sub' }, t('board.payoutChartShort')), card.el.querySelector('.chart-host'));
  }

  // ----------------------------------------------------------------- «Куда ушли деньги»

  function renderMoney() {
    const mm = data.moneyMap;
    if (!mm || !(mm.guestsToRestaurants > 0)) {
      body.append(h('section', { class: 'card' }, h('h3', { class: 'card__title' }, t('money.title')),
        h('p', { class: 'muted' }, t('money.empty'))));
      return;
    }
    const r = mm.restaurantsTo;
    const revenue = mm.guestsToRestaurants;
    const kept = r.keptByRestaurants;
    const flows = [
      ['suppliers', r.suppliers, 'cost'], ['staff', r.staff, 'cost'], ['advertising', r.advertising, 'cost'],
      ['quality', r.quality, 'cost'], ['landlord', r.landlord, 'institution'], ['insurer', r.insurer, 'institution'],
      ['utility', r.utility, 'institution'], ['bank', r.bank, 'institution'], ['cityTax', r.cityTax, 'city'],
      ['kept', Math.max(0, kept), 'kept']
    ];
    const nodes = [
      { id: 'guests', name: t('money.guests'), col: 0, color: INK },
      { id: 'losses', name: t('money.losses'), col: 0, color: FLOW_COLORS.losses },
      { id: 'rest', name: t('money.restaurants'), col: 1, color: INK },
      ...flows.map(([id, , group]) => ({ id, name: t('money.' + id), col: 2, color: FLOW_COLORS[group] }))
    ];
    const links = [
      { source: 'guests', target: 'rest', value: revenue },
      { source: 'losses', target: 'rest', value: Math.max(0, -kept) },
      ...flows.map(([id, v]) => ({ source: 'rest', target: id, value: v }))
    ];
    const share = (v) => pctRaw(Math.round((v / revenue) * 1000) / 10);
    add(chartCard({
      title: t('money.title'), note: t('money.lead'), big,
      chart: (box) => {
        const inst = sankey(box, { nodes, links, fmt: usd, share: (v) => share(v) + ' ' + t('money.ofGuests'), big,
          label: t('money.title'), height: big ? 'min(62vh, 620px)' : '420px' });
        box.append(h('div', { class: 'owner-keys' },
          h('span', {}, swatch(FLOW_COLORS.cost), t('money.groupCost')),
          h('span', {}, swatch(FLOW_COLORS.institution), t('money.groupInstitutions')),
          h('span', {}, swatch(FLOW_COLORS.city), t('money.groupCity')),
          h('span', {}, swatch(FLOW_COLORS.kept), t('money.groupKept')),
          kept < 0 ? h('span', {}, swatch(FLOW_COLORS.losses), t('money.groupLosses')) : null));
        return inst;
      },
      table: () => simpleTable([t('money.flow'), t('money.amount'), t('money.share')],
        [[t('money.guests') + ' → ' + t('money.restaurants'), usd(revenue), '100%'],
          ...(kept < 0 ? [[t('money.losses') + ' → ' + t('money.restaurants'), usd(-kept), share(-kept)]] : []),
          ...flows.filter(([, v]) => v > 0).map(([id, v]) => [t('money.restaurants') + ' → ' + t('money.' + id), usd(v), share(v)])],
        { numeric: [1, 2] })
    }));

    // Кому достались доходы арендодателя, банка, страховой и коммунальщиков.
    const inst = Object.values(mm.institutions || {});
    const total = (k) => inst.reduce((a, x) => a + (Number(x[k]) || 0), 0);
    const income = total('income');
    const toCity = total('toCity');
    const toPlayers = total('toPlayers');
    const toPrivate = total('toPrivate');
    const retained = Math.max(0, income - toCity - toPlayers - toPrivate);
    const part = (v) => (income > 0 ? (v / income) * 100 : 0);
    const seg = (v, color, label) => v > 0
      ? h('span', { style: { width: part(v) + '%', background: color }, title: label + ' ' + usd(v) }) : null;
    const c = mm.city || {};
    body.append(h('section', { class: ['card', big ? 'card--big' : null] },
      h('h3', { class: 'card__title' }, t('money.ownersTitle')),
      h('p', { class: 'muted small' }, t('money.ownersLead', { amount: usd(income) })),
      income > 0 ? h('div', { class: 'owners owners--tall', role: 'img', 'aria-label': t('money.ownersTitle') },
        seg(toCity, OWNER_COLORS.city, t('money.city')),
        seg(toPlayers, OWNER_COLORS.players, t('money.players')),
        seg(toPrivate, OWNER_COLORS.private, t('money.private')),
        seg(retained, '#E4E3DC', t('money.retained'))) : null,
      h('div', { class: 'owner-keys' },
        h('span', {}, swatch(OWNER_COLORS.city), t('money.city') + ' ' + usd(toCity)),
        h('span', {}, swatch(OWNER_COLORS.players), t('money.players') + ' ' + usd(toPlayers)),
        h('span', {}, swatch(OWNER_COLORS.private), t('money.private') + ' ' + usd(toPrivate)),
        h('span', {}, swatch('#E4E3DC'), t('money.retained') + ' ' + usd(retained))),
      h('ul', { class: 'facts' },
        h('li', {}, t('money.cityGot', { tax: usd(r.cityTax), fines: usd((c.fines || 0) + (c.cityTaxes || 0)), stakes: usd(c.stakeSales || 0) })),
        h('li', {}, t('money.cityPaid', { grants: usd(-(c.grants || 0)), salaries: usd(-(c.civilSalaries || 0)), buybacks: usd(-(c.stakeBuybacks || 0)) })),
        h('li', {}, t('money.betweenTeams', { amount: usd(mm.betweenPlayers || 0) })))));
  }

  // ----------------------------------------------------------------- рейтинг лиги

  async function renderRating() {
    const league = data.game.league;
    const box = h('section', { class: ['card', big ? 'card--big' : null] },
      h('h3', { class: 'card__title' }, t('board.ratingTitle', { league: data.game.leagueName })),
      h('p', { class: 'muted small' }, t('rating.lead')),
      h('div', { class: 'spinner', role: 'status' }));
    body.append(box);
    const fresh = ratingCache && ratingCache.league === league && Date.now() - ratingCache.at < 60_000;
    if (!fresh) {
      const res = await read('rating', { league }, { auth: false });
      ratingCache = { league, at: Date.now(), res };
    }
    if (view !== 'rating' || !box.isConnected) return;
    const res = ratingCache.res;
    box.querySelector('.spinner')?.remove();
    if (!res.ok) { box.append(h('p', { class: 'banner banner--bad' }, t('errors.network'))); return; }
    const players = (res.leagues || []).find((l) => l.league === league)?.players || [];
    box.append(players.length ? ratingTable(players, { limit: big ? 15 : 25 }) : h('p', { class: 'muted' }, t('rating.empty')));
    const fullHref = mode === 'app' ? '#/rating' : '../rating/';
    box.append(h('p', { class: 'small' }, h('a', { href: fullHref }, t('board.ratingFull') + ' →')));
  }

  return {
    update,
    showView: setView,
    destroy() { destroyCards(); }
  };
}
