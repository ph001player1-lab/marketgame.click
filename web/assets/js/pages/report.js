// Отчёт команды по ссылке: report/?t=TOKEN. Для напарников по команде —
// без входа и только для чтения.

import { t, errorText } from '../i18n.js';
import { h, replace } from '../dom.js';
import { read } from '../api.js';
import { renderReport } from '../views/history.js';

const root = document.getElementById('app');
const token = new URLSearchParams(location.search).get('t') || '';
const page = h('div', { class: 'page' });
replace(root, topbar(), page);
page.append(h('div', { class: 'spinner', role: 'status', 'aria-label': t('common.loading') }));

read('report', { token }, { auth: false }).then((res) => {
  if (!res.ok) {
    replace(page, h('div', { class: 'banner banner--bad' }, errorText(res)),
      h('a', { class: 'btn', href: '../' }, t('login.title')));
    return;
  }
  document.title = (res.teamName || res.game.title) + ' · ' + t('history.title');
  renderReport(page, res, { isPublic: true });
});

function topbar() {
  return h('header', { class: 'topbar' },
    h('div', { class: 'topbar__title' }, h('a', { class: 'topbar__name topbar__home', href: '../' }, t('brand'))),
    h('a', { class: 'btn btn--small topbar__btn', href: '../' }, t('login.title')));
}
