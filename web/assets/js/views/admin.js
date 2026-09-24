// Администратор назначает ведущих по почте. Самих администраторов задаёт
// настройка проекта ADMIN_EMAILS — здесь они только показаны.

import { t, errorText } from '../i18n.js';
import { h, replace, toast, confirmDialog, busy, field } from '../dom.js';
import { dateOnly } from '../fmt.js';
import { read, act } from '../api.js';

export async function renderHosts(page) {
  replace(page, h('div', { class: 'spinner', role: 'status' }));
  const res = await read('listHosts');
  if (!res.ok) { replace(page, h('div', { class: 'banner banner--bad' }, errorText(res))); return; }
  paint(res);

  function paint(data) {
    const email = h('input', { class: 'input', type: 'email', autocomplete: 'off', inputmode: 'email', placeholder: 'host@example.com' });
    const addBtn = h('button', { class: 'btn btn--primary', type: 'submit' }, t('admin.add'));
    const rows = data.hosts.map((x) => h('tr', {},
      h('td', {}, x.email),
      h('td', { class: 'muted small' }, (x.addedBy || '—') + ' · ' + dateOnly(x.addedAt)),
      h('td', { class: 'r' }, h('button', { class: 'btn btn--danger btn--small', type: 'button', onclick: async (e) => {
        const btn = e.currentTarget;
        const ok = await confirmDialog(t('admin.removeConfirm', { email: x.email }), { ok: t('admin.remove'), cancel: t('common.cancel'), danger: true });
        if (!ok) return;
        const r = await busy(btn, () => act('removeHost', { email: x.email }));
        if (r?.ok) { toast(t('admin.removed', { email: x.email }), 'ok'); paint(r.state); }
        else toast(errorText(r), 'bad');
      } }, t('admin.remove')))));

    replace(page,
      h('div', { class: 'page__head' }, h('h1', {}, t('admin.title'))),
      h('p', { class: 'muted' }, t('admin.lead')),
      h('form', { class: 'card', novalidate: true, onsubmit: (e) => {
        e.preventDefault();
        const value = email.value.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) { toast(t('errors.bad_email'), 'bad'); return; }
        busy(addBtn, async () => {
          const r = await act('addHost', { email: value });
          if (r.ok) { toast(t('admin.added', { email: value }), 'ok'); paint(r.state); }
          else toast(errorText(r), 'bad');
        });
      } },
        h('h3', { class: 'card__title' }, t('admin.add')),
        field(t('admin.email'), email, t('admin.addHint')),
        addBtn),
      h('section', { class: 'card' },
        h('h3', { class: 'card__title' }, t('admin.hosts')),
        data.hosts.length
          ? h('div', { class: 'table-wrap' }, h('table', { class: 'table' }, h('tbody', {}, rows)))
          : h('p', { class: 'muted' }, t('admin.none'))),
      h('section', { class: 'card card--soft' },
        h('h3', { class: 'card__title' }, t('admin.admins')),
        h('ul', {}, data.admins.map((a) => h('li', {}, a))),
        h('p', { class: 'muted small' }, t('admin.adminsNote'))));
  }
}
