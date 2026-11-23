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
//   /join/<код>        заявка на игру по QR-коду
//   /t/<ключ>          ссылка для входа команды (выдаёт ведущий)

import { CONFIG } from './config.js';
import {
  t, errorText, setLanguage, pickLanguage, preferredLanguage, setPreferredLanguage, LANGUAGES,
  language, languageName, isLanguage
} from './i18n.js';
import { h, $, replace, toast } from './dom.js';
import { usd, clock, setCurrency, currentCurrency } from './fmt.js';
import { read, poll, markFresh, setAuthLostHandler, pollShouldWait } from './api.js';
import { signOut, signedInEmail, getJoin, setJoin } from './auth.js';
import { renderLogin } from './views/login.js';
import { renderJoin, renderTeamLink } from './views/join.js';
import { renderHome } from './views/home.js';
import { createBusiness } from './views/business.js';
import { createConsole } from './views/console.js';
import { createScoreboard } from './views/scoreboard.js';
import { createGuide } from './views/guide.js';
import { renderReport } from './views/history.js';
import { renderHosts } from './views/admin.js';
import { renderCreate } from './views/create.js';
import { renderRatingPage } from './views/rating.js';
import { starsBadge } from './views/common.js';
import { newsCard } from './views/news.js';
import { waitingDecisions } from './views/companies.js';
import { waitingExchange, stakeText } from './views/exchange.js';
import { voteQuestion } from './views/vote.js';

const root = document.getElementById('app');
let me = null;            // кто вошёл: почта, роли, игры
let stopGame = null;      // остановка опроса текущей игры
let prefetched = null;    // первые данные игры, запрошенные вместе с me

// ----------------------------------------------------------------- запуск

setAuthLostHandler(() => {
  // Ключ заявки больше не действует (игра закончилась, ведущий убрал
  // команду) — дальше вход по коду на почту.
  if (getJoin()?.approved) setJoin(null);
  if (me) { me = null; toast(t('errors.auth_required'), 'bad'); route(); }
});

window.addEventListener('hashchange', route);
boot();

async function boot() {
  replace(root, h('div', { class: 'spinner', role: 'status', 'aria-label': t('common.loading') }));
  // Сессия и словарь страницы — разом.
  const [email] = await Promise.all([signedInEmail(), setLanguage(pickLanguage(null))]);
  // Заявка по QR-коду — без входа.
  if (['join', 'link'].includes(parseRoute().name)) { route(); return; }
  if (!email) { showLogin(); return; }
  prefetchGame();
  await loadMe();
  route();
}

/**
 * Открывают игру по ссылке или перезагружают её — не ждём me: табло и
 * кабинет (или пульт, если в прошлый раз здесь был пульт) просим сразу.
 * Каждый круг до сервера из Азии — заметная доля секунды.
 */
function prefetchGame() {
  const r = parseRoute();
  if (r.name !== 'game') return;
  let host = false;
  try { host = !r.asPlayerId && localStorage.getItem('mg-view-' + r.gameId) === 'host'; } catch { /* нет хранилища */ }
  const action = host ? 'monitor' : 'dashboard';
  prefetched = {
    gameId: r.gameId, asPlayerId: r.asPlayerId || null, action,
    main: read(action, host ? { gameId: r.gameId } : { gameId: r.gameId, asPlayerId: r.asPlayerId }),
    board: read('board', { gameId: r.gameId })
  };
}

/** Язык игры из списков me: игры, где человек играет или которые ведёт. */
function knownGameLanguage(gameId) {
  const g = [...(me?.playing || []), ...(me?.hosting || [])].find((x) => x.id === gameId);
  return g?.language ?? null;
}

/** Валюта игры из списков me — чтобы первые же цифры были в ней. */
function knownGameCurrency(gameId) {
  const g = [...(me?.playing || []), ...(me?.hosting || [])].find((x) => x.id === gameId);
  return g?.currency ?? 'USD';
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

async function showLogin() {
  stopCurrentGame();
  await setLanguage(pickLanguage(null));
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
  if (parts[0] === 'join' && parts[1]) return { name: 'join', code: parts[1].toUpperCase() };
  if (parts[0] === 't' && parts[1]) return { name: 'link', token: parts[1].toLowerCase() };
  if (parts[0] === 'new') return { name: 'new' };
  if (parts[0] === 'hosts') return { name: 'hosts' };
  if (parts[0] === 'rating') return { name: 'rating' };
  return { name: 'home' };
}

async function route() {
  stopCurrentGame();
  const r = parseRoute();
  if (r.name === 'join') {
    // Заявку приняли — открываем игру: дальше браузер играет по ключу заявки.
    renderJoin(root, r.code, { onApproved: (gameId) => { me = null; location.hash = '#/g/' + gameId; } });
    return;
  }
  if (r.name === 'link') {
    // Ключ из ссылки запомнен — открываем игру; ключа в адресной строке больше нет.
    renderTeamLink(root, r.token, { onOpen: (gameId) => { me = null; location.replace('#/g/' + gameId); } });
    return;
  }
  if (!me) {
    const email = await signedInEmail();
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
    const known = [...(me.playing || []), ...(me.hosting || [])].some((g) => g.id === r.gameId);
    if (!known && !me.isAdmin) await loadMe().catch(() => {});
    await setLanguage(pickLanguage(knownGameLanguage(r.gameId)));
    setCurrency(knownGameCurrency(r.gameId));
    openGame(r.gameId, r.asPlayerId);
    return;
  }
  if (r.name === 'report') {
    // Отчёт по игре — на языке игры, если человек не выбрал свой. Язык
    // известен из ответа, поэтому страницу рисуем после него.
    replace(root, h('div', { class: 'spinner', role: 'status', 'aria-label': t('common.loading') }));
    const res = await read('gameReport', { gameId: r.gameId });
    await setLanguage(pickLanguage(res.ok ? res.game.language : knownGameLanguage(r.gameId)));
    setCurrency(res.ok ? res.game.currency : knownGameCurrency(r.gameId));
    const page = h('div', { class: 'page' });
    replace(root, topbarSimple(), page);
    document.title = t('history.title') + ' · ' + t('brand');
    if (!res.ok) replace(page, h('div', { class: 'banner banner--bad' }, errorText(res)));
    else {
      const mine = (me.playing || []).find((g) => g.id === r.gameId);
      renderReport(page, res, { reportToken: mine?.reportToken || null });
    }
    return;
  }
  await setLanguage(pickLanguage(null));
  // Вне игры — доллары; суммы чужих игр (списки, рейтинг) — в валюте своей игры.
  setCurrency('USD');

  const page = h('div', { class: 'page' });
  replace(root, topbarSimple(), page);
  if (r.name === 'home') {
    document.title = t('home.title') + ' · ' + t('brand');
    await loadMe().catch(() => {});
    renderHome(page, me);
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

async function showPublicRating() {
  await setLanguage(pickLanguage(null));
  document.title = t('rating.title') + ' · ' + t('brand');
  const page = h('div', { class: 'page' });
  replace(root, h('header', { class: 'topbar' },
    h('div', { class: 'topbar__title' }, h('div', { class: 'topbar__name' }, t('brand'))),
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
      settingsBlock(close),
      h('button', { type: 'button', onclick: async () => { close(); await signOut(); me = null; location.hash = '#/'; showLogin(); } },
        t('common.signOut'))
    ));
  document.body.append(overlay);
  overlay.querySelector('a')?.focus();
}

/**
 * Настройки в меню: язык сайта. «Автоматически» — в игре язык, который
 * выбрал ведущий, в остальном сайте — язык браузера. Выбор хранится в этом
 * браузере и действует во всех играх.
 */
function settingsBlock(close) {
  const pref = preferredLanguage();
  const select = h('select', { class: 'input', id: 'menu-language', onchange: async () => {
    setPreferredLanguage(isLanguage(select.value) ? select.value : null);
    close();
    await route();
  } },
    h('option', { value: 'auto', selected: !pref }, t('settings.auto', { lang: languageName(language()) })),
    LANGUAGES.map((l) => h('option', { value: l.code, selected: pref === l.code, lang: l.code }, l.name)));
  return h('div', { class: 'menu__settings' },
    h('div', { class: 'menu__heading' }, t('settings.title')),
    h('label', { class: 'field__label', for: 'menu-language' }, t('settings.language')),
    select,
    h('p', { class: 'field__hint' }, t('settings.autoHint')));
}

function topbarSimple() {
  return h('header', { class: 'topbar' },
    h('button', { class: 'topbar__menu', type: 'button', 'aria-label': t('common.menu'), onclick: openMenu }, '☰'),
    h('div', { class: 'topbar__title' },
      h('div', { class: 'topbar__name' }, t('brand'))));
}

// ----------------------------------------------------------------- значки вкладок

const ICONS = {
  main: 'M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 2-2 6 0 8v10',
  bank: 'M3 10h18M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18M12 3l9 5H3z',
  invest: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  city: 'M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M3 21h18',
  board: 'M4 5h13v14H6a2 2 0 0 1-2-2zM17 9h3v8a2 2 0 0 1-2 2M8 9h5M8 13h5M8 16h3',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.6v.6M12 17h.01'
};

/** Значок линией: currentColor, 22 px. */
function icon(name) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  for (const [k, v] of Object.entries({ width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', class: 'tab__icon' })) {
    svg.setAttribute(k, String(v));
  }
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', ICONS[name] || '');
  svg.append(path);
  return svg;
}

// ----------------------------------------------------------------- экран игры

function openGame(gameId, asPlayerId) {
  const hosted = me.isAdmin || (me.hosting || []).some((g) => g.id === gameId);
  // Администратор, играющий в чужой игре, видит свой бизнес, а не пульт.
  const playing = (me.playing || []).some((g) => g.id === gameId);
  const isHostView = hosted && !asPlayerId && !playing;
  try { localStorage.setItem('mg-view-' + gameId, isHostView ? 'host' : 'player'); } catch { /* нет хранилища */ }
  const pre = prefetched && prefetched.gameId === gameId && prefetched.asPlayerId === (asPlayerId || null)
    ? prefetched : null;
  prefetched = null;
  const tabKey = 'mg-tab-' + gameId + (isHostView ? '-host' : '');
  // У команды четыре вкладки кабинета и «Новости» (табло); памятка — «?» в
  // шапке. У ведущего — пульт, табло и памятка, как раньше.
  const MAIN_TABS = isHostView ? ['main'] : ['main', 'bank', 'invest', 'city'];
  const ALL_TABS = [...MAIN_TABS, 'board', 'guide'];
  let tab = sessionStorage.getItem(tabKey) || 'main';
  if (!ALL_TABS.includes(tab)) tab = 'main';
  let mainTab = MAIN_TABS.includes(tab) ? tab : (sessionStorage.getItem(tabKey + '-main') || 'main');
  if (!MAIN_TABS.includes(mainTab)) mainTab = 'main';
  let side = tab === 'guide' ? 'guide' : 'board';
  let last = null;
  let lastRoundKey = '';
  let boardData = null;
  let boardLoadedAt = 0;
  let boardBusy = false;
  let boardAgain = false;
  let stopped = false;
  let switching = false;

  // ---- каркас
  const nameEl = h('div', { class: 'topbar__name' }, t('common.loading'));
  const subEl = h('div', { class: 'topbar__sub' }, '');
  const timerEl = h('div', { class: 'timer', hidden: true, 'aria-live': 'off' }, '');
  const moneyEl = h('div', { class: 'topbar__money', hidden: isHostView });
  // Памятка у команды — кнопкой «?» в шапке: внизу место только для пяти вкладок.
  const helpBtn = isHostView ? null : h('button', {
    class: 'topbar__help tab--guide', type: 'button', 'aria-label': t('tabs.guide'), title: t('tabs.guide'),
    dataset: { tab: 'guide' }, onclick: () => setTab(tab === 'guide' ? mainTab : 'guide')
  }, icon('help'));
  const header = h('header', { class: 'topbar' },
    h('button', { class: 'topbar__menu', type: 'button', 'aria-label': t('common.menu'), onclick: openMenu }, '☰'),
    h('div', { class: 'topbar__title' }, nameEl, subEl),
    timerEl, moneyEl, helpBtn);
  // Срочное — голосование, решение акционеров — видно с любой вкладки.
  const stripText = h('span', { class: 'strip__text' });
  const stripClock = h('span', { class: 'strip__clock' });
  const strip = h('button', { class: 'strip', type: 'button', hidden: true, onclick: () => strip.dataset.target && setTab(strip.dataset.target) },
    h('span', { class: 'strip__dot', 'aria-hidden': 'true' }), stripText, stripClock,
    h('span', { class: 'strip__go', 'aria-hidden': 'true' }, '›'));
  let stripDeadline = null;

  const impersonation = asPlayerId
    ? h('div', { class: 'impersonation' }, h('span', { id: 'imp-text' }, ''),
        h('a', { class: 'btn btn--small', href: '#/g/' + gameId }, t('header.backToConsole')))
    : null;

  const mainTabLabel = isHostView ? t('tabs.console') : t('tabs.business');
  const TAB_LABEL = { main: mainTabLabel, bank: t('tabs.bank'), invest: t('tabs.invest'), city: t('tabs.city'),
    board: isHostView ? t('tabs.board') : t('tabs.news'), guide: t('tabs.guide') };
  const tabBtn = (id) => h('button', {
    class: ['tab', 'tab--' + id], type: 'button', role: 'tab', 'aria-selected': 'false', dataset: { tab: id },
    onclick: () => setTab(id)
  }, isHostView ? null : icon(id), h('span', { class: 'tab__label' }, TAB_LABEL[id]));
  const tabs = h('nav', { class: 'tabs', role: 'tablist' },
    isHostView ? ['main', 'board', 'guide'].map(tabBtn) : [...MAIN_TABS, 'board'].map(tabBtn));

  // Вкладки кабинета команды — части левой панели: на широком экране справа
  // остаются «Новости» (и памятка).
  const subs = Object.fromEntries(MAIN_TABS.map((id) => [id,
    h('div', { class: 'sub sub--' + id, role: 'region', 'aria-label': TAB_LABEL[id] })]));
  const paneMain = h('section', { class: 'pane pane--main', 'aria-label': mainTabLabel },
    h('div', { class: 'pane__inner' }, isHostView ? null : Object.values(subs)));
  // «Новости»: лента событий над табло.
  const news = newsCard();
  const boardRoot = h('div', {});
  const paneBoard = h('section', { class: 'pane pane--board', 'aria-label': TAB_LABEL.board },
    h('div', { class: 'pane__inner' }, news.el, boardRoot));
  const paneGuide = h('section', { class: 'pane pane--guide', 'aria-label': t('tabs.guide') }, h('div', { class: 'pane__inner' }));
  const shell = h('div', { class: ['app', 'game', isHostView ? null : 'game--player'], dataset: { tab, side, main: mainTab } },
    header, strip, impersonation, tabs, h('div', { class: 'panes' }, paneMain, paneBoard, paneGuide));
  replace(root, shell);

  const scrollAt = {};
  function setTab(id) {
    const phone = window.innerWidth < 768;
    if (phone && id !== tab) scrollAt[tab] = window.scrollY;
    const changed = id !== tab;
    tab = id;
    if (MAIN_TABS.includes(id)) mainTab = id;
    else side = id;
    shell.dataset.tab = tab;
    shell.dataset.side = side;
    shell.dataset.main = mainTab;
    sessionStorage.setItem(tabKey, id);
    sessionStorage.setItem(tabKey + '-main', mainTab);
    for (const b of tabs.querySelectorAll('.tab')) {
      const x = b.dataset.tab;
      const on = window.innerWidth >= 768 ? (MAIN_TABS.includes(x) ? x === mainTab : x === side) : x === tab;
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    }
    helpBtn?.setAttribute('aria-pressed', side === 'guide' && (window.innerWidth >= 768 || tab === 'guide') ? 'true' : 'false');
    paintStrip();
    if (id === 'board') refreshBoard(true);
    if (phone && changed) window.scrollTo(0, scrollAt[id] || 0);
  }
  window.addEventListener('resize', onResize);
  function onResize() { setTab(tab); }

  // ---- модули разделов
  const ctx = {
    gameId, asPlayerId, isHostView,
    showGuide(section) { setTab('guide'); guide.show(section); },
    showTab: (id) => setTab(id),
    applyState(state) { markFresh(); render(state); },
    reloadMe: () => loadMe(),
    refreshNow: () => tick(true)
  };
  const main = isHostView ? createConsole(paneMain.firstChild, ctx) : createBusiness(subs, ctx);
  const board = createScoreboard(boardRoot, { mode: 'app' });
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
  /** Полоса срочного: часы и видна, только пока её вкладка не открыта. */
  function paintStrip() {
    const target = strip.dataset.target;
    const here = window.innerWidth >= 768 ? mainTab === target : tab === target;
    strip.hidden = !target || here;
    if (strip.hidden || !stripDeadline) { stripClock.textContent = ''; return; }
    const left = Math.max(0, (stripDeadline - (Date.now() + clockOffset)) / 1000);
    stripClock.textContent = clock(left);
  }
  const stripId = setInterval(() => { if (!strip.hidden) paintStrip(); }, 500);
  const timerId = setInterval(paintTimer, 250);

  // ---- состояние (объявлено выше: вкладка табло может открыться сразу)

  function render(state) {
    if (!state || !state.ok || stopped) return;
    const g = state.game;
    // Язык игры стал известен только сейчас (игра не из списков me) или
    // ведущий его сменил — перерисовываем экран на нём, если человек не
    // выбрал свой язык в меню.
    // Валюта игры не та, что в списках (игру открыли по ссылке) — рисуем заново в ней.
    if (g.currency && g.currency !== currentCurrency()) {
      setCurrency(g.currency);
      queueMicrotask(() => { if (!stopped) { stopCurrentGame(); openGame(gameId, asPlayerId); } });
      return;
    }
    if (!preferredLanguage() && isLanguage(g.language) && g.language !== language() && !switching) {
      switching = true;
      setLanguage(g.language).then((changed) => {
        switching = false;
        if (changed && !stopped) { stopCurrentGame(); openGame(gameId, asPlayerId); }
      });
    }
    last = state;
    if (state.game.serverNow) clockOffset = new Date(state.game.serverNow).getTime() - Date.now();
    const newDeadline = g.deadline ? new Date(g.deadline).getTime() : null;
    if (newDeadline !== deadlineMs) { deadlineMs = newDeadline; firedAtZero = false; paintTimer(); }

    const leagueLine = t('leagues.' + g.league) + (g.practice ? ' · ' + t('common.practice') : '') + ' · ' +
      (g.roundNumber > 0 ? t('common.monthOf', { n: g.roundNumber, total: g.totalRounds }) : t('common.notStarted'));
    if (isHostView) {
      nameEl.textContent = g.title;
      subEl.textContent = leagueLine;
      document.title = g.title + ' · ' + t('host.console');
    } else {
      replace(nameEl, state.player.restaurant || g.title, ' ', starsBadge(state.player.stars));
      subEl.textContent = leagueLine;
      const off = state.lifecycle !== 'active';
      replace(moneyEl, h('b', {}, usd(off ? state.player.savings : state.player.cash)),
        h('span', {}, off ? t('header.savings') : t('header.cash')));
      document.title = (state.player.restaurant || g.title) + ' · ' + t('brand');
      if (impersonation) $('#imp-text', impersonation).textContent = t('header.impersonating', { team: state.player.restaurant || '—' });
    }
    // Точка на вкладке: месяц открыт, а решение ещё не отправлено.
    const needs = !isHostView && state.lifecycle === 'active' && g.roundStatus === 'open' && state.decision && !state.decision.submitted;
    badge('main', needs, t('decision.needed'));
    if (!isHostView) {
      // Голосование и решения акционеров, где ждут голоса этой команды.
      const vote = state.vote?.active && !state.vote.active.mine ? state.vote.active : null;
      const waiting = waitingDecisions(state.companies);
      // Биржа: заявки, где ждут ответа этой команды, и аукционы, где можно ставить.
      const ex = waitingExchange(state.exchange);
      badge('city', !!vote, t('strip.vote'));
      badge('invest', (waiting.length + ex.offers.length) || (ex.auctions.length ? true : false), t('strip.company'));
      const stake = (x) => stakeText(x.pct, x.kind);
      const urgent = vote ? { target: 'city', text: t('strip.voteText', { q: voteQuestion(vote) }), at: vote.closesAt }
        : waiting.length ? { target: 'invest', text: t('strip.companyText', { company: t('institutions.' + waiting[0].kind) }),
            at: waiting[0].open.closesAt }
        : ex.offers.length ? { target: 'invest', text: t('strip.offerText', { stake: stake(ex.offers[0]) }), at: null }
        : ex.auctions.length ? { target: 'invest', text: t('strip.auctionText', { stake: stake(ex.auctions[0]) }),
            at: ex.auctions[0].closesAt } : null;
      if (urgent) {
        strip.dataset.target = urgent.target;
        stripText.textContent = urgent.text;
        stripDeadline = urgent.at ? new Date(urgent.at).getTime() : null;
      } else {
        delete strip.dataset.target;
        stripDeadline = null;
      }
      paintStrip();
    }

    main.update(state);
    guide.update(state.rules, g);
    const roundKey = g.roundNumber + ':' + g.roundStatus + ':' + g.status;
    if (roundKey !== lastRoundKey) {
      const first = !lastRoundKey;
      lastRoundKey = roundKey;
      // Первое табло запрошено вместе с кабинетом; пришло раньше — теперь
      // его можно нарисовать с «вы» на своей команде.
      if (!first) refreshBoard(true);
      else if (boardData) board.update(boardData, state);
    }
  }

  function showBoard(data) {
    if (stopped || !data?.ok) return;
    boardData = data;
    board.update(data, last);
    news.update(data.news);
  }

  /** Значок на вкладке: точка (true) или число. */
  function badge(id, value, label) {
    const b = tabs.querySelector('.tab--' + id);
    if (!b) return;
    b.querySelector('.tab__dot')?.remove();
    if (value === false || value === null || value === undefined || value === 0) return;
    b.append(h('span', { class: ['tab__dot', value === true ? null : 'tab__dot--n'], 'aria-label': label },
      value === true ? '' : String(value)));
  }

  async function refreshBoard(force) {
    const visible = window.innerWidth >= 768 ? side === 'board' || window.innerWidth >= 1500 : tab === 'board';
    if (!force && (!visible || Date.now() - boardLoadedAt < CONFIG.pollMs * 2)) return;
    // Запрос уже идёт — повторим, когда он вернётся: месяц мог смениться.
    if (boardBusy) { boardAgain = boardAgain || force; return; }
    boardBusy = true;
    boardLoadedAt = Date.now();
    try {
      showBoard(await read('board', { gameId }));
    } finally {
      boardBusy = false;
    }
    if (boardAgain) { boardAgain = false; refreshBoard(true); }
  }

  let polledAt = 0;
  let retryId = 0;
  async function tick(force, prefetchedMain = null) {
    if (document.hidden && !force) return;
    if (pollShouldWait()) return;
    polledAt = Date.now();
    const action = isHostView ? 'monitor' : 'dashboard';
    const params = isHostView ? { gameId } : { gameId, asPlayerId };
    const res = prefetchedMain ? await prefetchedMain : await poll(action, params);
    if (!res || stopped) return;
    if (!res.ok) {
      if (!last) replace(paneMain.firstChild, h('div', { class: 'banner banner--bad' }, errorText(res)),
        h('a', { class: 'btn', href: '#/' }, t('common.myGames')));
      // Сбой связи — ещё раз через пару секунд, а не через целый круг опроса:
      // иначе перевод или штраф игрок увидел бы только секунд через 15–20.
      else if (!retryId && (res.error === 'network' || res.error === 'server_error')) {
        retryId = setTimeout(() => { retryId = 0; tick(false); }, 2000);
      }
      return;
    }
    render(res);
    refreshBoard(false);
  }

  const pollId = setInterval(() => tick(false), CONFIG.pollMs);
  const onVisible = () => { if (!document.hidden) tick(true); };
  document.addEventListener('visibilitychange', onVisible);
  // Вернулись в окно игры (с другой вкладки или программы) — сразу свежие цифры.
  const onFocus = () => { if (Date.now() - polledAt > 2000) tick(true); };
  window.addEventListener('focus', onFocus);
  // Кабинет (или пульт) и табло — разом, а не друг за другом.
  tick(true, pre && pre.action === (isHostView ? 'monitor' : 'dashboard') ? pre.main : null);
  if (pre) {
    boardBusy = true;
    boardLoadedAt = Date.now();
    pre.board.then(showBoard).finally(() => {
      boardBusy = false;
      if (boardAgain) { boardAgain = false; refreshBoard(true); }
    });
  } else {
    refreshBoard(true);
  }

  stopGame = () => {
    stopped = true;
    clearInterval(pollId);
    clearInterval(timerId);
    clearInterval(stripId);
    clearTimeout(retryId);
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('focus', onFocus);
    window.removeEventListener('resize', onResize);
    main.destroy?.();
    board.destroy?.();
  };
}
