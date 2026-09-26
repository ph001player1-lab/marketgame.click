// Табло для проектора: board/?code=ABC123. Крупный шрифт, таймер месяца по
// часам сервера, код игры и адрес сайта для входа команд.
//
// Табло видят только участники игры, её ведущий и администраторы, поэтому
// на проекторе тоже нужно войти — обычно почтой ведущего. Язык табло —
// язык игры: его читает зал.

import { CONFIG } from '../config.js';
import { t, errorText, setLanguage, pickLanguage } from '../i18n.js';
import { h, replace } from '../dom.js';
import { clock } from '../fmt.js';
import { read } from '../api.js';
import { currentEmail, signOut } from '../auth.js';
import { renderLogin } from '../views/login.js';
import { createScoreboard } from '../views/scoreboard.js';
import { siteBase } from '../views/common.js';

const root = document.getElementById('app');
const params = new URLSearchParams(location.search);
const code = (params.get('code') || location.hash.replace(/^#\/?/, '') || '').trim().toUpperCase();

init();

async function init() {
  replace(root, h('div', { class: 'spinner', role: 'status', 'aria-label': t('common.loading') }));
  const [email] = await Promise.all([currentEmail(), setLanguage(pickLanguage(null))]);
  if (!code) askCode();
  else if (!email) signIn();
  else start(code);
}

function signIn() {
  document.title = t('board.title') + ' · ' + t('brand');
  renderLogin(root, { note: t('board.signInLead'), onSignedIn: () => start(code) });
}

/** Вошли не той почтой: табло этой игры ей не видно. */
function refused(res) {
  replace(root, h('main', { class: 'login' },
    h('div', { class: 'login__brand' }, t('brand')),
    h('div', { class: 'card' },
      h('h1', { class: 'card__title' }, t('board.title')),
      h('div', { class: 'banner banner--bad' }, errorText(res)),
      h('p', { class: 'muted' }, t('board.signInLead')),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn btn--primary', type: 'button', onclick: async () => { await signOut(); signIn(); } },
          t('login.otherEmail'))))));
}

function askCode() {
  const input = h('input', { class: 'input', autocapitalize: 'characters', autocomplete: 'off', maxlength: 8,
    placeholder: 'ABC123', style: { fontSize: '28px', letterSpacing: '4px', textTransform: 'uppercase' } });
  replace(root, h('main', { class: 'login' },
    h('div', { class: 'login__brand' }, t('brand')),
    h('p', { class: 'login__tagline' }, t('tagline')),
    h('div', { style: { height: '18px' } }),
    h('form', { class: 'card', onsubmit: (e) => {
      e.preventDefault();
      const v = input.value.trim().toUpperCase();
      if (v) location.search = '?code=' + encodeURIComponent(v);
    } },
      h('h1', { class: 'card__title' }, t('board.title')),
      h('label', { class: 'field__label', for: 'code' }, t('board.code')),
      Object.assign(input, { id: 'code' }),
      h('div', { class: 'btn-row' }, h('button', { class: 'btn btn--primary', type: 'submit' }, t('board.open'))))));
  input.focus();
}

async function start(gameCode) {
  replace(root, h('div', { class: 'spinner', role: 'status', 'aria-label': t('common.loading') }));
  const first = await read('board', { code: gameCode });
  if (!first.ok) {
    if (first.error === 'auth_required') signIn();
    else refused(first);
    return;
  }
  await setLanguage(first.game.language);

  const titleEl = h('h1', {}, t('common.loading'));
  const subEl = h('div', { class: 'projector__sub' }, '');
  const timerEl = h('div', { class: 'timer', hidden: true });
  const joinEl = h('div', { class: 'projector__join' },
    h('div', {}, t('board.joinAt'), ' ', h('b', {}, siteBase().replace(/^https?:\/\//, '').replace(/\/$/, ''))),
    h('div', {}, t('board.code'), ' ', h('b', { class: 'code code--inline' }, gameCode)));
  const fullBtn = h('button', { class: 'btn btn--ghost btn--small no-print', type: 'button', onclick: toggleFull }, t('board.fullscreen'));
  const rotate = h('input', { type: 'checkbox' });
  const errorEl = h('div', {});
  const boardBox = h('div', {});
  replace(root, h('div', { class: 'projector' },
    h('header', { class: 'projector__head' },
      h('div', { class: 'projector__title' }, titleEl, subEl),
      timerEl, joinEl),
    errorEl, boardBox,
    h('footer', { class: 'projector__foot no-print' },
      h('label', { class: 'check' }, rotate, h('span', {}, t('board.rotate'))), fullBtn)));

  const board = createScoreboard(boardBox, { mode: 'projector' });

  let clockOffset = 0;
  let deadline = null;
  let firedFor = null;
  setInterval(() => {
    if (!deadline) { timerEl.hidden = true; return; }
    const left = (deadline - (Date.now() + clockOffset)) / 1000;
    timerEl.hidden = false;
    timerEl.textContent = clock(left);
    timerEl.classList.toggle('is-urgent', left <= 30);
    // Время вышло — один внеочередной запрос, дальше обычный опрос.
    if (left <= 0 && firedFor !== deadline) { firedFor = deadline; load(); }
  }, 250);

  async function load(ready = null) {
    const data = ready || await read('board', { code: gameCode });
    if (!data.ok) {
      if (data.error === 'auth_required') { location.reload(); return; }
      replace(errorEl, h('div', { class: 'banner banner--bad' }, errorText(data)));
      return;
    }
    replace(errorEl);
    const g = data.game;
    titleEl.textContent = g.title;
    subEl.textContent = [t('leagues.' + g.league) + (g.practice ? ' · ' + t('common.practice') : ''), g.organizer,
      g.finished ? t('common.finished') : g.roundNumber > 0 ? t('common.monthOf', { n: g.roundNumber, total: g.totalRounds }) : t('common.notStarted'),
      g.roundStatus === 'open' ? t('board.decisionsOpen') : null].filter(Boolean).join(' · ');
    document.title = g.title + ' · ' + t('board.title');
    if (g.serverNow) clockOffset = new Date(g.serverNow).getTime() - Date.now();
    deadline = g.deadline ? new Date(g.deadline).getTime() : null;
    board.update(data, null);
  }

  // Смена разделов по кругу — для перерыва, когда табло висит само по себе.
  const views = ['teams', 'economy', 'money', 'rating'];
  let viewIdx = 0;
  setInterval(() => {
    if (!rotate.checked) return;
    viewIdx = (viewIdx + 1) % views.length;
    board.showView(views[viewIdx]);
  }, 20000);

  load(first);
  setInterval(() => { if (!document.hidden) load(); }, CONFIG.pollMs);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
}

function toggleFull() {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.();
}
