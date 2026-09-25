// Рейтинг лиг: marketgame.click/rating/. Открыт без входа.

import { t } from '../i18n.js';
import { h, replace } from '../dom.js';
import { renderRatingPage } from '../views/rating.js';

const root = document.getElementById('app');
const page = h('div', { class: 'page' });
replace(root,
  h('header', { class: 'topbar' },
    h('div', { class: 'topbar__title' }, h('a', { class: 'topbar__name topbar__home', href: '../' }, t('brand'))),
    h('a', { class: 'btn btn--small topbar__btn', href: '../' }, t('login.title'))),
  page);
renderRatingPage(page);
