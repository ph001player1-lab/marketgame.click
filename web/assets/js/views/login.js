// Вход: почта → код из письма. Регистрации нет: код приходит только на
// почты, которые внёс ведущий или администратор.

import { CONFIG } from '../config.js';
import { t, errorText } from '../i18n.js';
import { h, replace, field, busy } from '../dom.js';
import { read } from '../api.js';
import { requestCode, verifyCode } from '../auth.js';

export function renderLogin(root, { onSignedIn }) {
  const box = h('main', { class: 'login' });
  replace(root, box);
  stepEmail('');

  function brand() {
    return h('div', { class: 'login__brand', 'aria-label': t('brand') + ': ' + t('gameName') },
      t('brand'), h('span', {}, t('gameName')));
  }

  function stepEmail(prefill) {
    const email = h('input', { class: 'input', type: 'email', autocomplete: 'email', inputmode: 'email',
      required: true, value: prefill, placeholder: 'you@example.com' });
    const msg = h('div', { class: 'field__hint', role: 'alert' });
    const btn = h('button', { class: 'btn btn--primary btn--wide', type: 'submit' }, t('login.sendCode'));
    const form = h('form', { class: 'card', novalidate: true, onsubmit: (e) => {
      e.preventDefault();
      const value = email.value.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) { showError(msg, errorText('bad_email')); return; }
      busy(btn, async () => {
        const res = await requestCode(value, (e2) => read('preflightLogin', { email: e2 }, { auth: false }));
        if (res.ok) stepCode(value);
        else showError(msg, errorText(res));
      });
    } },
      h('h1', { class: 'card__title' }, t('login.title')),
      h('p', { class: 'muted' }, t('login.lead')),
      field(t('login.email'), email),
      msg, btn);
    replace(box, brand(), h('div', { style: { height: '18px' } }), form);
    email.focus();
  }

  function stepCode(email) {
    const code = h('input', { class: 'input', type: 'text', inputmode: 'numeric', autocomplete: 'one-time-code',
      maxlength: 10, required: true, placeholder: '123456', style: { fontSize: '24px', letterSpacing: '6px' } });
    const msg = h('div', { class: 'field__hint', role: 'alert' });
    const btn = h('button', { class: 'btn btn--primary btn--wide', type: 'submit' }, t('login.verify'));
    const form = h('form', { class: 'card', novalidate: true, onsubmit: (e) => {
      e.preventDefault();
      busy(btn, async () => {
        const res = await verifyCode(email, code.value);
        if (res.ok) await onSignedIn();
        else showError(msg, errorText(res));
      });
    } },
      h('h1', { class: 'card__title' }, t('login.title')),
      h('p', {}, t('login.codeSent', { email })),
      CONFIG.testAuth ? h('p', { class: 'banner banner--warn small' }, t('login.testMode')) : null,
      field(t('login.code'), code),
      msg, btn,
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn btn--ghost btn--small', type: 'button', onclick: () => stepEmail(email) }, t('login.otherEmail')),
        h('button', { class: 'btn btn--ghost btn--small', type: 'button', onclick: (ev) => busy(ev.currentTarget, async () => {
          const res = await requestCode(email, (e2) => read('preflightLogin', { email: e2 }, { auth: false }));
          showError(msg, res.ok ? t('login.codeSent', { email }) : errorText(res), res.ok);
        }) }, t('login.resend'))
      ),
      h('p', { class: 'muted small', style: { marginTop: '12px' } }, t('login.noEmail')));
    replace(box, brand(), h('div', { style: { height: '18px' } }), form);
    code.focus();
    // Код из шести цифр — входим сразу, без лишнего нажатия.
    code.addEventListener('input', () => {
      if (code.value.replace(/\D/g, '').length === 6) form.requestSubmit();
    });
  }
}

function showError(el, text, ok = false) {
  el.textContent = text;
  el.classList.toggle('is-error', !ok);
  el.classList.toggle('is-ok', ok);
}
