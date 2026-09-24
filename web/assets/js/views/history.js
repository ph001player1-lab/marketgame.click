// Отчёт по игре: итог команды, месяц за месяцем, решения, движения денег и
// табло. Его разбирают дома или сразу после игры вместе с другими командами.
// Тот же отчёт открывается по ссылке для напарников — без входа.

import { t, tn } from '../i18n.js';
import { h, replace } from '../dom.js';
import { usd, usdc, int, dec2, pctRaw } from '../fmt.js';
import { createScoreboard } from './scoreboard.js';
import { plTable } from './business.js';
import { downloadCsv, copyText, fileSlug, siteBase, simpleTable } from './common.js';

const CHANNELS = ['seo', 'promo', 'maps', 'social', 'outdoor', 'affiliate'];

function decisionRows(list) {
  return list.map((d) => [
    d.round + (d.autoplay ? ' ' + t('history.auto') : ''),
    usdc(d.price), usd(d.seoSpend), usd(d.promoSpend), usd(d.mapsSpend), usd(d.socialSpend),
    usd(d.outdoorSpend), usd(d.affiliateSpend), d.shiftsDelta > 0 ? '+' + d.shiftsDelta : String(d.shiftsDelta),
    usd(d.qualityInvest)
  ]);
}
const decisionHead = () => [t('common.month'), t('decision.price'), ...CHANNELS.map((c) => t('channels.' + c + '.name')),
  t('history.shifts'), t('history.qualityInvest')];

export function renderReport(page, data, opts = {}) {
  const g = data.game;
  const team = data.team;
  const me = team ? (data.players || []).find((p) => p.id === team.playerId) : null;
  const teamName = data.teamName || me?.restaurant || '';
  const scoreboards = [];

  // ---- шапка
  const metaBits = [g.leagueName + ' · ' + t('rating.months', { n: g.totalRounds })];
  if (g.organizer) metaBits.push(g.organizer);
  metaBits.push(g.finished ? t('common.finished') : g.roundNumber > 0
    ? t('common.monthOf', { n: g.roundNumber, total: g.totalRounds }) : t('common.notStarted'));
  const rated = g.finished && !g.practice && g.roundNumber >= g.totalRounds;
  const head = h('div', { class: 'page__head' },
    h('div', {},
      h('h1', {}, team ? teamName : g.title),
      h('p', { class: 'muted', style: { margin: '4px 0 0' } }, (team ? g.title + ' · ' : '') + metaBits.join(' · '), ' ',
        g.practice ? h('span', { class: 'badge badge--warn' }, t('common.practice'))
          : g.finished ? h('span', { class: ['badge', rated ? 'badge--ok' : null] }, rated ? t('common.rated') : t('common.notRated')) : null)),
    opts.isPublic ? null : h('a', { class: 'btn btn--ghost btn--small', href: '#/' }, '← ' + t('common.myGames')));

  const blocks = [head];
  if (!g.finished) blocks.push(h('p', { class: 'banner banner--info' }, t('history.running')));

  // ---- итог команды
  if (team) {
    const s = team.standing;
    blocks.push(h('section', { class: 'card' },
      h('h2', { class: 'card__title' }, t('history.summary')),
      s ? h('div', { class: 'stats' },
        stat(t('history.place'), t('home.place', { place: s.place, rivals: s.rivals })),
        stat(t('home.capital'), usd(s.capital)),
        stat(t('home.multiplier'), '×' + dec2(s.multiplier)),
        stat(t('home.share'), pctRaw(s.sharePct)))
        : h('p', { class: 'muted' }, t('history.noMonths')),
      team.stakes.length ? h('p', { class: 'small' }, t('history.stakesHeld') + ': ' +
        team.stakes.map((x) => t('institutions.' + x.kind) + ' ' + pctRaw(x.pct)).join(', ')) : null,
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn', type: 'button', onclick: () => teamCsv(data, teamName) }, t('history.csv')),
        opts.reportToken ? h('button', { class: 'btn btn--ghost', type: 'button',
          onclick: () => copyText(siteBase() + 'report/?t=' + opts.reportToken, t('history.linkCopied')) }, t('history.shareLink')) : null)));
  } else {
    blocks.push(h('div', { class: 'btn-row' },
      h('button', { class: 'btn', type: 'button', onclick: () => gameCsv(data) }, t('history.csvAll'))));
  }

  // ---- табло
  const boardBox = h('div', {});
  blocks.push(h('h2', { class: 'section-title' }, t('board.title')), boardBox);

  // ---- месяц за месяцем
  if (team && (team.results.length || team.offBusinessMonths.length)) {
    const months = [
      ...team.results.map((r) => ({ round: r.roundNumber, r })),
      ...team.offBusinessMonths.map((w) => ({ round: w.round, w }))
    ].sort((a, b) => a.round - b.round);
    const detail = h('div', {});
    const pick = h('select', { class: 'input input--inline', 'aria-label': t('history.monthDetails'),
      onchange: (e) => showMonth(Number(e.target.value)) },
      team.results.map((r) => h('option', { value: r.roundNumber }, t('common.month') + ' ' + r.roundNumber)));
    function showMonth(n) {
      const r = team.results.find((x) => x.roundNumber === n);
      replace(detail, r ? plTable(r) : null);
    }
    blocks.push(h('section', { class: 'card' },
      h('h2', { class: 'card__title' }, t('history.months')),
      simpleTable([t('common.month'), t('decision.price'), t('history.served'), t('board.share'), t('pl.revenue'),
        t('pl.profit'), t('history.cashEnd'), t('history.loanEnd'), t('board.capital')],
      months.map((x) => x.r
        ? [x.round, usdc(x.r.price), int(x.r.served), pctRaw(x.r.marketSharePct), usd(x.r.revenue), usd(x.r.profit),
            usd(x.r.cashAfter), usd(x.r.loanBalanceAfter), usd(x.r.cashAfter - x.r.loanBalanceAfter)]
        : [x.round, t('statuses.' + x.w.status), '—', '—', '—', usd(x.w.income),
            usd(x.w.savings) + ' ' + t('history.savingsMark'), '—', usd(x.w.savings)]),
      { numeric: [1, 2, 3, 4, 5, 6, 7, 8] }),
      team.results.length ? h('div', { class: 'toolbar' }, h('label', { class: 'toolbar__field' }, t('history.monthDetails') + ' ', pick)) : null,
      detail));
    if (team.results.length) {
      pick.value = String(team.results[team.results.length - 1].roundNumber);
      showMonth(Number(pick.value));
    }
  }

  // ---- решения
  if (team && team.decisions.length) {
    blocks.push(h('section', { class: 'card' },
      h('h2', { class: 'card__title' }, t('history.decisions')),
      simpleTable(decisionHead(), decisionRows(team.decisions), { numeric: [1, 2, 3, 4, 5, 6, 7, 8, 9] }),
      h('p', { class: 'muted small' }, t('history.autoNote'))));
  }
  if (data.allDecisions) {
    blocks.push(h('section', { class: 'card' },
      h('h2', { class: 'card__title' }, t('history.allDecisions')),
      h('p', { class: 'muted small' }, t('history.allDecisionsLead')),
      data.allDecisions.map((x) => h('details', { class: 'details' },
        h('summary', {}, x.restaurant + ' · ' + tn('history.decisionsCount', x.decisions.length)),
        x.decisions.length ? simpleTable(decisionHead(), decisionRows(x.decisions), { numeric: [1, 2, 3, 4, 5, 6, 7, 8, 9] })
          : h('p', { class: 'muted' }, '—')))));
  } else if (team) {
    blocks.push(h('p', { class: 'muted small' }, g.finished ? t('history.closedBook') : t('history.hidden')));
  }

  // ---- движения денег
  if (team && team.moneyLog.length) {
    blocks.push(h('section', { class: 'card' },
      h('h2', { class: 'card__title' }, t('history.log')),
      simpleTable([t('common.month'), t('history.what'), t('history.amount'), t('history.note')],
        team.moneyLog.map((l) => [l.round, t('history.kinds.' + l.kind), usd(l.amount), l.reason || '']),
        { numeric: [2] })));
  }

  replace(page, blocks);
  const board = createScoreboard(boardBox, { mode: 'report', myId: team?.playerId || null });
  board.update(data, null);
  scoreboards.push(board);
  return { destroy() { scoreboards.forEach((b) => b.destroy()); } };
}

function stat(label, value) {
  return h('div', { class: 'stat' }, h('div', { class: 'stat__label' }, label), h('div', { class: 'stat__value' }, value));
}

// ----------------------------------------------------------------- CSV

function teamCsv(data, teamName) {
  const team = data.team;
  const head = ['Month', 'Status', 'Price', 'Guests served', 'Guests turned away', 'Market share %', 'Revenue',
    'Food & supplies', 'Rent', 'Insurance', 'Utilities & other', 'Payroll', 'Extra shifts', 'Quality upkeep',
    'Quality investment', 'Advertising', ...CHANNELS.map((c) => t('channels.' + c + '.name')),
    'Operating profit', 'Loan interest', 'Profit before tax', 'Profit tax', 'Net profit', 'Loan principal paid',
    'Cash flow', 'Dividends', 'Cash / savings at month end', 'Loan balance at month end', 'Capital (cash − loan)',
    'Brand', 'Reputation', 'Quality', 'Capacity', 'Decision sent by team'];
  const dec = new Map(team.decisions.map((d) => [d.round, d]));
  const rows = [
    ...team.results.map((r) => [r.roundNumber, 'open', r.price, r.served, r.lost, r.marketSharePct, r.revenue, r.cogs,
      r.opex.rent, r.opex.insurance, r.opex.utilities, r.opex.payroll, r.opex.shiftCost, r.opex.qualityUpkeep,
      r.opex.qualityInvest, r.opex.marketing, ...CHANNELS.map((c) => r.marketingByChannel[c]),
      r.ebit, r.interest, r.profitBeforeTax, r.tax, r.profit, r.principalPaid, r.cashFlow, r.dividends, r.cashAfter,
      r.loanBalanceAfter, r.cashAfter - r.loanBalanceAfter,
      r.brand, r.reputation, r.quality, r.capacity,
      dec.has(r.roundNumber) ? (dec.get(r.roundNumber).autoplay ? 'no (repeated)' : 'yes') : '']),
    ...team.offBusinessMonths.map((w) => {
      const row = Array(head.length).fill('');
      row[0] = w.round;
      row[1] = w.status;
      row[head.indexOf('Net profit')] = w.income;
      row[head.indexOf('Cash / savings at month end')] = w.savings;
      row[head.indexOf('Capital (cash − loan)')] = w.savings;
      return row;
    })
  ].sort((a, b) => a[0] - b[0]);
  downloadCsv(fileSlug(teamName) + '-' + fileSlug(data.game.title) + '.csv', [head, ...rows.map(roundMoney)]);
}

function gameCsv(data) {
  const head = ['Team', 'Month', 'In business', 'Capital (cash − loan)', 'Cash / savings', 'Profit / income', 'Market share %', 'Guests served',
    'Price', 'Brand', 'Reputation', 'Quality', 'Capacity', 'Advertising', 'Quality investment', 'Profit tax', 'Dividends'];
  const rows = [];
  for (const p of data.players || []) {
    for (const e of p.series) {
      rows.push([p.restaurant, e.round, e.inBusiness ? 'yes' : e.offBusinessStatus, e.capital, e.cash, e.profit, e.marketSharePct,
        e.served, e.price, e.brand, e.reputation, e.quality, e.capacity, e.marketingTotal, e.qualityInvest, e.tax, e.dividends]);
    }
  }
  downloadCsv(fileSlug(data.game.title) + '-teams.csv', [head, ...rows]);
  if (data.allDecisions) {
    const dHead = ['Team', 'Month', 'Repeated automatically', 'Price', ...CHANNELS.map((c) => t('channels.' + c + '.name')),
      'Shift change', 'Quality investment'];
    const dRows = [];
    for (const x of data.allDecisions) {
      for (const d of x.decisions) {
        dRows.push([x.restaurant, d.round, d.autoplay ? 'yes' : 'no', d.price, d.seoSpend, d.promoSpend, d.mapsSpend,
          d.socialSpend, d.outdoorSpend, d.affiliateSpend, d.shiftsDelta, d.qualityInvest]);
      }
    }
    setTimeout(() => downloadCsv(fileSlug(data.game.title) + '-decisions.csv', [dHead, ...dRows]), 400);
  }
}

/** Деньги в CSV — с центами, без хвостов плавающей точки. */
function roundMoney(row) {
  return row.map((v) => (typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 100) / 100 : v));
}

