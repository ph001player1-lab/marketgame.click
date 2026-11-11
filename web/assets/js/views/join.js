// Заявка на игру по QR-коду (#/join/<код игры>).
//
// Игрок вводит почту и название ресторана — без кода на почту — и ждёт,
// пока ведущий примет заявку. Тогда страница сама открывает игру: браузер
// играет по ключу заявки (auth.js: getJoin). Позже, чтобы посмотреть
// рейтинг или отчёт, — обычный вход по коду: почта уже внесена.

import { t, errorText, setLanguage, pickLanguage } from '../i18n.js';
import { h, replace, field, busy } from '../dom.js';
import { read } from '../api.js';
import { emailTypo } from '../fmt.js';
import { currentEmail, getJoin, setJoin, signOut } from '../auth.js';

const POLL_MS = 3000;

export async function renderJoin(root, code, { onApproved }) {
  const box = h('main', { class: 'login join' });
  replace(root, box);
  replace(box, h('div', { class: 'spinner', role: 'status', 'aria-label': t('common.loading') }));

  const info = await read('joinInfo', { code }, { auth: false });
  if (info.ok) await setLanguage(pickLanguage(info.game.language));
  document.title = t('join.title') + ' · ' + t('brand');
  if (!info.ok) {
    replace(box, brand(), h('div', { class: 'card' },
      h('h1', { class: 'card__title' }, t('join.title')),
      h('p', { class: 'banner banner--bad' }, errorText(info)),
      codeForm()));
    return;
  }
  const game = info.game;
  const signedIn = await currentEmail();

  const mine = getJoin();
  if (mine && mine.gameId === game.id) {
    if (mine.approved) { onApproved(game.id); return; }
    waiting(mine);
  } else if (game.finished) {
    replace(box, brand(), h('div', { class: 'card' }, gameHead(),
      h('p', { class: 'banner banner--warn' }, t('join.finished')),
      h('a', { class: 'btn btn--primary btn--wide', href: '#/' }, t('join.signIn'))));
  } else {
    form({ email: signedIn || '', restaurant: '' });
  }

  function brand() {
    return h('div', { class: 'login__brand' }, t('brand'));
  }

  function gameHead() {
    return h('div', { class: 'join__game' },
      h('div', { class: 'join__title' }, game.title),
      game.organizer ? h('div', { class: 'muted' }, game.organizer) : null);
  }

  function form(values, note = null) {
    // Почту можно исправить всегда: подставленная — только подсказка.
    const email = h('input', { class: 'input', type: 'email', autocomplete: 'email', inputmode: 'email',
      required: true, value: values.email, placeholder: 'you@example.com' });
    // Похоже на опечатку — предупреждаем один раз; нажали ещё раз — отправляем как есть.
    let typoSeen = '';
    const restaurant = h('input', { class: 'input', type: 'text', maxlength: 60, required: true, value: values.restaurant,
      autocomplete: 'organization', placeholder: t('join.restaurantPlaceholder') });
    const msg = h('div', { class: 'field__hint', role: 'alert' });
    const btn = h('button', { class: 'btn btn--primary btn--wide', type: 'submit' }, t('join.submit'));
    const el = h('form', { class: 'card', novalidate: true, onsubmit: (e) => {
      e.preventDefault();
      const value = email.value.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) { showError(msg, errorText('bad_email')); return; }
      if (!restaurant.value.trim()) { showError(msg, errorText('empty')); return; }
      const fix = emailTypo(value);
      if (fix && typoSeen !== value) {
        typoSeen = value;
        replace(msg, t('join.typo', { fix }), ' ', h('button', { class: 'btn btn--ghost btn--small', type: 'button',
          onclick: () => { email.value = fix; replace(msg); msg.classList.remove('is-error'); email.focus(); } }, t('join.typoFix')));
        msg.classList.add('is-error');
        return;
      }
      busy(btn, async () => {
        const res = await read('joinRequest', { code: game.code, email: value, restaurantName: restaurant.value.trim() },
          { auth: false });
        if (res.ok) {
          const j = { code: game.code, gameId: res.gameId, token: res.token, email: value,
            restaurant: restaurant.value.trim(), title: res.title, approved: false };
          setJoin(j);
          waiting(j);
        } else if (res.error === 'already_in_game' && signedIn === value) {
          // Уже в игре и вошёл по коду — просто открываем игру.
          onApproved(game.id);
        } else if (res.error === 'already_in_game') {
          replace(msg, t('join.alreadyIn'), ' ', h('a', { href: '#/' }, t('join.signIn')));
          msg.classList.add('is-error');
        } else {
          showError(msg, errorText(res));
        }
      });
    } },
      h('h1', { class: 'card__title' }, t('join.title')),
      gameHead(),
      note ? h('p', { class: 'banner banner--warn small' }, note) : null,
      h('p', { class: 'muted' }, t('join.lead')),
      field(t('login.email'), email),
      field(t('join.restaurant'), restaurant),
      msg, btn);
    replace(box, brand(), h('div', { style: { height: '18px' } }), el);
    (values.email ? restaurant : email).focus();
  }

  function waiting(j) {
    const status = h('p', { class: 'join__wait', role: 'status' }, h('span', { class: 'spinner spinner--inline' }), t('join.waiting'));
    replace(box, brand(), h('div', { style: { height: '18px' } }), h('div', { class: 'card' },
      h('h1', { class: 'card__title' }, t('join.sentTitle')),
      gameHead(),
      h('p', {}, t('join.sentLead')),
      h('dl', { class: 'join__who' },
        h('dt', {}, t('login.email')), h('dd', {}, j.email),
        h('dt', {}, t('join.restaurant')), h('dd', {}, j.restaurant || '—')),
      status,
      h('button', { class: 'btn btn--ghost btn--small', type: 'button',
        onclick: () => form({ email: j.email, restaurant: j.restaurant || '' }) }, t('join.edit'))));
    const card = box.lastChild;
    // Ждём ведущего: страница открыта — спрашиваем каждые несколько секунд.
    const tick = async () => {
      if (!card.isConnected) return;
      if (!document.hidden) {
        const res = await read('joinStatus', { token: j.token }, { auth: false, attempts: 1 });
        if (!card.isConnected) return;
        if (res.ok && res.status === 'approved') {
          setJoin({ ...j, approved: true });
          onApproved(res.gameId);
          return;
        }
        if (!res.ok && res.error === 'join_gone') {
          setJoin(null);
          form({ email: j.email, restaurant: j.restaurant || '' }, t('join.dropped'));
          return;
        }
      }
      setTimeout(tick, POLL_MS);
    };
    setTimeout(tick, POLL_MS);
  }
}

/**
 * Ссылка для входа команды (#/t/<ключ>): её выдаёт ведущий, если код на
 * почту не приходит. Браузер запоминает ключ и играет за эту команду — в
 * этой игре и пока она идёт. Вошли по коду под другой почтой — сначала выйти.
 */
export async function renderTeamLink(root, token, { onOpen }) {
  const box = h('main', { class: 'login join' });
  replace(root, box);
  replace(box, h('div', { class: 'spinner', role: 'status', 'aria-label': t('common.loading') }));
  const brand = h('div', { class: 'login__brand' }, t('brand'));
  const info = await read('linkInfo', { token }, { auth: false });
  if (info.ok) await setLanguage(pickLanguage(info.language));
  document.title = t('join.linkTitle') + ' · ' + t('brand');
  if (!info.ok || info.finished) {
    replace(box, brand, h('div', { class: 'card' },
      h('h1', { class: 'card__title' }, t('join.linkTitle')),
      h('p', { class: 'banner banner--warn' }, info.ok ? t('join.finished') : errorText(info)),
      h('a', { class: 'btn btn--primary btn--wide', href: '#/' }, t('join.signIn'))));
    return;
  }
  const open = () => {
    setJoin({ code: info.code, gameId: info.gameId, token, email: info.email, restaurant: info.restaurant,
      title: info.title, approved: true, link: true });
    onOpen(info.gameId);
  };
  const signedIn = await currentEmail();
  // Вошли по коду той же почтой — ключ не нужен.
  if (signedIn === info.email) { onOpen(info.gameId); return; }
  if (!signedIn) { open(); return; }
  replace(box, brand, h('div', { class: 'card' },
    h('h1', { class: 'card__title' }, t('join.linkTitle')),
    h('p', {}, t('join.linkOther', { email: signedIn, team: info.restaurant || info.email, title: info.title })),
    h('button', { class: 'btn btn--primary btn--wide', type: 'button',
      onclick: (e) => busy(e.currentTarget, async () => { await signOut(); open(); }) }, t('join.linkSwitch')),
    h('a', { class: 'btn btn--ghost btn--wide', href: '#/', style: { marginTop: '8px' } }, t('join.linkStay'))));
}

/** Поле «Код игры» — для тех, кто пришёл без QR-кода. Ведёт на страницу заявки. */
export function codeForm() {
  const code = h('input', { class: 'input join__code', type: 'text', maxlength: 12, autocomplete: 'off',
    autocapitalize: 'characters', spellcheck: 'false', placeholder: 'ABC123', 'aria-label': t('join.codeLabel') });
  return h('form', { class: 'join__codeform', onsubmit: (e) => {
    e.preventDefault();
    const v = code.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (v) location.hash = '#/join/' + v;
  } },
    h('div', { class: 'field__label' }, t('join.codeTitle')),
    h('div', { class: 'join__coderow' }, code,
      h('button', { class: 'btn', type: 'submit' }, t('join.codeGo'))));
}

function showError(el, text) {
  el.textContent = text;
  el.classList.add('is-error');
}
