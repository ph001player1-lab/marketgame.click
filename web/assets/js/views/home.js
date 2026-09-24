// Мои игры: где я играю и какие веду. Отсюда — в игру, в отчёт, в новую игру.

import { t } from '../i18n.js';
import { h, replace } from '../dom.js';
import { usd, dateOnly, dec2, pctRaw } from '../fmt.js';

function leagueLine(g) {
  const parts = [t('leagues.' + g.league)];
  if (g.practice) parts.push(t('common.practice'));
  if (g.organizer) parts.push(g.organizer);
  parts.push(g.status === 'setup' ? t('common.notStarted')
    : g.status === 'finished' ? t('common.finished') + ' · ' + dateOnly(g.finishedAt)
    : t('common.monthOf', { n: g.currentRound, total: g.totalRounds }));
  return parts.join(' · ');
}

export function renderHome(root, me) {
  const playing = me.playing || [];
  const hosting = me.hosting || [];

  const playingList = playing.length
    ? h('div', { class: 'game-list' }, playing.map((g) => h('div', { class: 'game-item' },
        h('div', {},
          h('div', { class: 'game-item__title' }, g.restaurant || g.title),
          h('div', { class: 'game-item__meta' }, g.title + ' · ' + leagueLine(g)),
          g.standing && g.standing.monthsPlayed > 0
            ? h('div', { class: 'game-item__meta' },
                t('home.place', { place: g.standing.place, rivals: g.standing.rivals }) + ' · ' +
                t('home.capital') + ' ' + usd(g.standing.capital) + ' · ×' + dec2(g.standing.multiplier) +
                ' · ' + t('home.share') + ' ' + pctRaw(g.standing.sharePct) +
                (g.status === 'finished' ? ' · ' + (g.rated ? t('common.rated') : t('common.notRated')) : ''))
            : null),
        h('div', { class: 'btn-row', style: { marginTop: 0 } },
          g.status !== 'finished' ? h('a', { class: 'btn btn--primary', href: '#/g/' + g.id }, t('home.open')) : null,
          h('a', { class: 'btn', href: '#/g/' + g.id + '/report' }, t('home.report'))))))
    : h('p', { class: 'muted' }, t('home.noGames'));

  const hostingBlock = me.isHost ? [
    h('div', { class: 'page__head' },
      h('h2', {}, t('home.hosting')),
      h('a', { class: 'btn btn--primary', href: '#/new' }, t('home.newGame'))),
    hosting.length
      ? h('div', { class: 'game-list' }, hosting.map((g) => h('div', { class: 'game-item' },
          h('div', {},
            h('div', { class: 'game-item__title' }, g.title),
            h('div', { class: 'game-item__meta' }, leagueLine(g) + ' · ' + g.code +
              (me.isAdmin && g.hostEmail !== me.email ? ' · ' + g.hostEmail : ''))),
          h('div', { class: 'btn-row', style: { marginTop: 0 } },
            h('a', { class: 'btn btn--primary', href: '#/g/' + g.id }, t('host.console')),
            g.status !== 'setup' ? h('a', { class: 'btn', href: '#/g/' + g.id + '/report' }, t('home.report')) : null))))
      : h('p', { class: 'muted' }, t('home.noHosted'))
  ] : [];

  replace(root,
    h('div', { class: 'page__head' }, h('h1', {}, t('home.title'))),
    playing.length || !me.isHost ? [h('h2', { style: { margin: '0 0 10px' } }, t('home.playing')), playingList] : null,
    h('div', { style: { height: '22px' } }),
    hostingBlock);
}
