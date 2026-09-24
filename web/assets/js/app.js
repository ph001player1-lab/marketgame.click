// Market Game — сайт игры: вход, маршруты, экран игры с тремя разделами.
//
// Маршруты (после #):
//   /                  мои игры
//   /g/<id>            игра: кабинет команды или пульт ведущего
//   /g/<id>/as/<team>  ведущий играет за команду
//   /g/<id>/report     отчёт по игре
//   /new               новая игра (ведущий)
//   /hosts             ведущие (администратор)
//   /rating            рейтинг

import { CONFIG } from './config.js';
import { t, errorText } from './i18n.js';
import { h, $, replace, toast } from './dom.js';
import { usd, clock } from './fmt.js';
import { read, poll, markFresh, setAuthLostHandler, actionsInFlight } from './api.js';
import { currentEmail, signOut } from './auth.js';
import { renderLogin } from './views/login.js';
import { renderHome } from './views/home.js';
import { createBusiness } from './views/business.js';
import { createConsole } from './views/console.js';
import { createScoreboard } from './views/scoreboard.js';
import { createGuide } from './views/guide.js';
import { renderReport } from './views/history.js';
import { renderHosts } from './views/admin.js';
import { renderCreate } from './views/create.js';
import { renderRatingPage } from './views/rating.js';

const root = document.getElementById('app');
let me = null;            // кто вошёл: почта, роли, игры
let stopGame = null;      // остановка опроса текущей игры

// ----------------------------------------------------------------- запуск

setAuthLostHandler(() => {
  if (me) { me = null; toast(t('errors.auth_required'), 'bad'); route(); }
});

window.addEventListener('hashchange', route);
boot();

async function boot() {
  replace(root, h('div', { class: 'spinner', role: 'status', 'aria-label': t('common.loading') }));
  const email = await currentEmail();
  if (!email) { showLogin(); return; }
  await loadMe();
  route();
}

async function loadMe() {
  const res = await read('me');
  if (res.ok) me = res;
  else if (res.error !== 'auth_required') {
    replace(root, h('div', { class: 'page' }, h('div', { class: 'banner banner--bad' }, errorText(res)),
      h('button', { class: 'btn', onclick: () => boot() }, t('common.retry'))));
    throw new Error(res.error);
  }
  return me;
}

function showLogin() {
  stopCurrentGame();
  document.title = t('login.title') + ' · ' + t('brand');
  renderLogin(root, { onSignedIn: async () => { await loadMe(); route(); } });
}

function stopCurrentGame() {
  if (stopGame) { stopGame(); stopGame = null; }
}

function parseRoute() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'g' && parts[1]) {
    if (parts[2] === 'as' && parts[3]) return { name: 'game', gameId: parts[1], asPlayerId: parts[3] };
    if (parts[2] === 'report') return { name: 'report', gameId: parts[1] };
    return { name: 'game', gameId: parts[1] };
  }
  if (parts[0] === 'new') return { name: 'new' };
  if (parts[0] === 'hosts') return { name: 'hosts' };
  if (parts[0] === 'rating') return { name: 'rating' };
  return { name: 'home' };
}

async function route() {
  stopCurrentGame();
  const r = parseRoute();
  if (!me) {
    const email = await currentEmail();
    // Рейтинг открыт всем: на него ссылается marketgame.biz.
    if (!email && r.name === 'rating') { showPublicRating(); return; }
    if (!email) { showLogin(); return; }
    try { await loadMe(); } catch { return; }
    if (!me) { showLogin(); return; }
  }
  window.scrollTo(0, 0);
  if (r.name === 'game') {
    // Игра создана только что или команду добавили минуту назад — списки
    // в me устарели.
    const known = me.isAdmin || [...(me.playing || []), ...(me.hosting || [])].some((g) => g.id === r.gameId);
    if (!known) await loadMe().catch(() => {});
    openGame(r.gameId, r.asPlayerId);
    return;
  }

  const page = h('div', { class: 'page' });
  replace(root, topbarSimple(), page);
  if (r.name === 'home') {
    document.title = t('home.title') + ' · ' + t('brand');
    await loadMe().catch(() => {});
    renderHome(page, me);
  } else if (r.name === 'report') {
    document.title = t('history.title') + ' · ' + t('brand');
    const res = await read('gameReport', { gameId: r.gameId });
    if (!res.ok) replace(page, h('div', { class: 'banner banner--bad' }, errorText(res)));
    else {
      const mine = (me.playing || []).find((g) => g.id === r.gameId);
      renderReport(page, res, { reportToken: mine?.reportToken || null });
    }
  } else if (r.name === 'new') {
    document.title = t('host.createTitle') + ' · ' + t('brand');
    renderCreate(page, async (gameId) => { await loadMe(); location.hash = '#/g/' + gameId; });
  } else if (r.name === 'hosts') {
    document.title = t('admin.title') + ' · ' + t('brand');
    renderHosts(page);
  } else if (r.name === 'rating') {
    document.title = t('rating.title') + ' · ' + t('brand');
    renderRatingPage(page);
  }
}

function showPublicRating() {
  document.title = t('rating.title') + ' · ' + t('brand');
  const page = h('div', { class: 'page' });
  replace(root, h('header', { class: 'topbar' },
    h('div', { class: 'topbar__title' }, h('div', { class: 'topbar__name' }, t('brand') + ': ' + t('gameName'))),
    h('a', { class: 'btn btn--small topbar__btn', href: '#/' }, t('login.title'))), page);
  renderRatingPage(page);
}

// ----------------------------------------------------------------- меню

function openMenu() {
  const close = () => overlay.remove();
  const link = (href, label) => h('a', { href, onclick: close }, label);
  const overlay = h('div', { class: 'menu', onclick: (e) => { if (e.target === overlay) close(); } },
    h('nav', { class: 'menu__panel', 'aria-label': t('common.menu') },
      h('div', { class: 'menu__who' }, me?.email ?? ''),
      link('#/', t('common.myGames')),
      me?.isHost ? link('#/new', t('home.newGame')) : null,
      link('#/rating', t('home.ratingLink')),
      me?.isAdmin ? link('#/hosts', t('home.hostsLink')) : null,
      h('button', { type: 'button', onclick: async () => { close(); await signOut(); me = null; location.hash = '#/'; showLogin(); } },
        t('common.signOut'))
    ));
  document.body.append(overlay);
  overlay.querySelector('a')?.focus();
}

function topbarSimple() {
  return h('header', { class: 'topbar' },
    h('button', { class: 'topbar__menu', type: 'button', 'aria-label': t('common.menu'), onclick: openMenu }, '☰'),
    h('div', { class: 'topbar__title' },
      h('div', { class: 'topbar__name' }, t('brand') + ': ' + t('gameName'))));
}

// ----------------------------------------------------------------- экран игры

function openGame(gameId, asPlayerId) {
  const hosted = me.isAdmin || (me.hosting || []).some((g) => g.id === gameId);
  // Администратор, играющий в чужой игре, видит свой бизнес, а не пульт.
  const playing = (me.playing || []).some((g) => g.id === gameId);
  const isHostView = hosted && !asPlayerId && !playing;
  const tabKey = 'mg-tab-' + gameId + (isHostView ? '-host' : '');
  let tab = sessionStorage.getItem(tabKey) || 'main';
  let side = tab === 'guide' ? 'guide' : 'board';
  let last = null;
  let lastRoundKey = '';
  let boardCode = null;
  let boardLoadedAt = 0;

  // ---- каркас
  const nameEl = h('div', { class: 'topbar__name' }, t('common.loading'));
  const subEl = h('div', { class: 'topbar__sub' }, '');
  const timerEl = h('div', { class: 'timer', hidden: true, 'aria-live': 'off' }, '');
  const moneyEl = h('div', { class: 'topbar__money', hidden: isHostView });
  const header = h('header', { class: 'topbar' },
    h('button', { class: 'topbar__menu', type: 'button', 'aria-label': t('common.menu'), onclick: openMenu }, '☰'),
    h('div', { class: 'topbar__title' }, nameEl, subEl),
    timerEl, moneyEl);

  const impersonation = asPlayerId
    ? h('div', { class: 'impersonation' }, h('span', { id: 'imp-text' }, ''),
        h('a', { class: 'btn btn--small', href: '#/g/' + gameId }, t('header.backToConsole')))
    : null;

  const mainTabLabel = isHostView ? t('tabs.console') : t('tabs.business');
  const tabBtn = (id, label) => h('button', {
    class: ['tab', 'tab--' + id], type: 'button', role: 'tab', 'aria-selected': 'false', dataset: { tab: id },
    onclick: () => setTab(id)
  }, label);
  const tabs = h('nav', { class: 'tabs', role: 'tablist' },
    tabBtn('main', mainTabLabel), tabBtn('board', t('tabs.board')), tabBtn('guide', t('tabs.guide')));

  const paneMain = h('section', { class: 'pane pane--main', 'aria-label': mainTabLabel }, h('div', { class: 'pane__inner' }));
  const paneBoard = h('section', { class: 'pane pane--board', 'aria-label': t('tabs.board') }, h('div', { class: 'pane__inner' }));
  const paneGuide = h('section', { class: 'pane pane--guide', 'aria-label': t('tabs.guide') }, h('div', { class: 'pane__inner' }));
  const shell = h('div', { class: 'app game', dataset: { tab, side } },
    header, impersonation, tabs, h('div', { class: 'panes' }, paneMain, paneBoard, paneGuide));
  replace(root, shell);

  const scrollAt = {};
  function setTab(id) {
    const phone = window.innerWidth < 768;
    if (phone && id !== tab) scrollAt[tab] = window.scrollY;
    const changed = id !== tab;
    tab = id;
    if (id !== 'main') side = id;
    shell.dataset.tab = tab;
    shell.dataset.side = side;
    sessionStorage.setItem(tabKey, id);
    for (const b of tabs.querySelectorAll('.tab')) {
      const on = window.innerWidth >= 768 ? b.dataset.tab === side : b.dataset.tab === tab;
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    }
    if (id === 'board') refreshBoard(true);
    if (phone && changed) window.scrollTo(0, scrollAt[id] || 0);
  }
  window.addEventListener('resize', onResize);
  function onResize() { setTab(tab); }

  // ---- модули разделов
  const ctx = {
    gameId, asPlayerId, isHostView,
    showGuide(section) { setTab('guide'); guide.show(section); },
    applyState(state) { markFresh(); render(state); },
    reloadMe: () => loadMe(),
    refreshNow: () => tick(true)
  };
  const main = isHostView ? createConsole(paneMain.firstChild, ctx) : createBusiness(paneMain.firstChild, ctx);
  const board = createScoreboard(paneBoard.firstChild, { mode: 'app' });
  const guide = createGuide(paneGuide.firstChild);
  setTab(tab);

  // ---- таймер по часам сервера: при сбитых часах телефона игрок видел бы
  // не пять минут, а сколько угодно.
  let clockOffset = 0;
  let deadlineMs = null;
  let firedAtZero = false;
  function paintTimer() {
    if (!deadlineMs) { timerEl.hidden = true; return; }
    const left = (deadlineMs - (Date.now() + clockOffset)) / 1000;
    timerEl.hidden = false;
    timerEl.textContent = clock(left);
    timerEl.classList.toggle('is-urgent', left <= 30);
    timerEl.setAttribute('aria-label', t('header.timerOpen') + ' ' + clock(left));
    if (left <= 0 && !firedAtZero) { firedAtZero = true; tick(true); }
  }
  const timerId = setInterval(paintTimer, 250);

  // ---- состояние (объявлено выше: вкладка табло может открыться сразу)

  function render(state) {
    if (!state || !state.ok) return;
    last = state;
    const g = state.game;
    boardCode = g.code;
    if (state.game.serverNow) clockOffset = new Date(state.game.serverNow).getTime() - Date.now();
    const newDeadline = g.deadline ? new Date(g.deadline).getTime() : null;
    if (newDeadline !== deadlineMs) { deadlineMs = newDeadline; firedAtZero = false; paintTimer(); }

    const leagueLine = g.leagueName + (g.practice ? ' · ' + t('common.practice') : '') + ' · ' +
      (g.roundNumber > 0 ? t('common.monthOf', { n: g.roundNumber, total: g.totalRounds }) : t('common.notStarted'));
    if (isHostView) {
      nameEl.textContent = g.title;
      subEl.textContent = leagueLine;
      document.title = g.title + ' · ' + t('host.console');
    } else {
      nameEl.textContent = state.player.restaurant || g.title;
      subEl.textContent = leagueLine;
      const off = state.lifecycle !== 'active';
      replace(moneyEl, h('b', {}, usd(off ? state.player.savings : state.player.cash)),
        h('span', {}, off ? t('header.savings') : t('header.cash')));
      document.title = (state.player.restaurant || g.title) + ' · ' + t('brand');
      if (impersonation) $('#imp-text', impersonation).textContent = t('header.impersonating', { team: state.player.restaurant || '—' });
    }
    // Точка на вкладке: месяц открыт, а решение ещё не отправлено.
    const needs = !isHostView && state.lifecycle === 'active' && g.roundStatus === 'open' && state.decision && !state.decision.submitted;
    const mainTab = tabs.querySelector('.tab--main');
    mainTab.querySelector('.tab__dot')?.remove();
    if (needs) mainTab.append(h('span', { class: 'tab__dot', 'aria-label': 'decision needed' }));

    main.update(state);
    guide.update(state.rules, g);
    const roundKey = g.roundNumber + ':' + g.roundStatus + ':' + g.status;
    if (roundKey !== lastRoundKey) { lastRoundKey = roundKey; refreshBoard(true); }
  }

  async function refreshBoard(force) {
    if (!boardCode) return;
    const visible = window.innerWidth >= 768 ? side === 'board' || window.innerWidth >= 1500 : tab === 'board';
    if (!force && (!visible || Date.now() - boardLoadedAt < CONFIG.pollMs * 2)) return;
    boardLoadedAt = Date.now();
    const data = await read('board', { code: boardCode }, { auth: false });
    if (data.ok) board.update(data, last);
  }

  async function tick(force) {
    if (document.hidden && !force) return;
    if (actionsInFlight() > 0) return;
    const action = isHostView ? 'monitor' : 'dashboard';
    const params = isHostView ? { gameId } : { gameId, asPlayerId };
    const res = await poll(action, params);
    if (!res) return;
    if (!res.ok) {
      if (!last) replace(paneMain.firstChild, h('div', { class: 'banner banner--bad' }, errorText(res)),
        h('a', { class: 'btn', href: '#/' }, t('common.myGames')));
      return;
    }
    render(res);
    refreshBoard(false);
  }

  const pollId = setInterval(() => tick(false), CONFIG.pollMs);
  const onVisible = () => { if (!document.hidden) tick(true); };
  document.addEventListener('visibilitychange', onVisible);
  tick(true);

  stopGame = () => {
    clearInterval(pollId);
    clearInterval(timerId);
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('resize', onResize);
    main.destroy?.();
    board.destroy?.();
  };
}
