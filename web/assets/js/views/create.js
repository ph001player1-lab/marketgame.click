// Новая игра и форма её данных — та же форма стоит в настройках пульта.

import { t, errorText } from '../i18n.js';
import { h, replace, toast, busy, field } from '../dom.js';
import { zonedToIso, isoToZoned } from '../fmt.js';
import { act } from '../api.js';

const LEAGUES = [['start', 12], ['growth', 24], ['elite', 36]];

// Пояса США и несколько частых для международных игр.
export const TIME_ZONES = [
  ['America/New_York', 'Eastern (New York)'], ['America/Chicago', 'Central (Chicago)'],
  ['America/Denver', 'Mountain (Denver)'], ['America/Phoenix', 'Arizona (Phoenix)'],
  ['America/Los_Angeles', 'Pacific (Los Angeles)'], ['America/Anchorage', 'Alaska (Anchorage)'],
  ['Pacific/Honolulu', 'Hawaii (Honolulu)'], ['America/Puerto_Rico', 'Atlantic (Puerto Rico)'],
  ['America/Toronto', 'Toronto'], ['America/Mexico_City', 'Mexico City'], ['America/Sao_Paulo', 'São Paulo'],
  ['Europe/London', 'London'], ['Europe/Berlin', 'Berlin'], ['Asia/Dubai', 'Dubai'],
  ['Asia/Bangkok', 'Bangkok'], ['Asia/Tokyo', 'Tokyo'], ['Australia/Sydney', 'Sydney'], ['UTC', 'UTC']
];

function guessZone() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return TIME_ZONES.some(([z]) => z === tz) ? tz : 'America/New_York';
  } catch {
    return 'America/New_York';
  }
}

/**
 * Поля игры. values — как в gameMeta сервера. read() возвращает параметры
 * для createGame или updateGame; dirty — ведущий что-то менял.
 */
export function gameForm(values = {}, { withLeague = true, lockPractice = false } = {}) {
  let dirty = false;
  const mark = () => { dirty = true; };
  const tz = values.timezone || guessZone();

  const title = h('input', { class: 'input', maxlength: 80, required: true, value: values.title || '', oninput: mark,
    placeholder: t('host.titlePlaceholder') });
  const organizer = h('input', { class: 'input', maxlength: 120, value: values.organizer || '', oninput: mark,
    placeholder: t('host.organizerPlaceholder') });
  const zone = h('select', { class: 'input', onchange: mark },
    [...TIME_ZONES, ...(TIME_ZONES.some(([z]) => z === tz) ? [] : [[tz, tz]])]
      .map(([z, label]) => h('option', { value: z, selected: z === tz }, label)));
  const when = h('input', { class: 'input', type: 'datetime-local', value: isoToZoned(values.scheduledAt, tz), oninput: mark });
  const openBook = h('input', { type: 'checkbox', checked: values.openBook !== false, onchange: mark });
  const practice = h('input', { type: 'checkbox', checked: !!values.practice, disabled: lockPractice, onchange: mark });
  const sponsorName = h('input', { class: 'input', maxlength: 120, value: values.sponsor?.name || '', oninput: mark });
  const sponsorLogo = h('input', { class: 'input', type: 'url', maxlength: 500, value: values.sponsor?.logoUrl || '', oninput: mark,
    placeholder: 'https://' });
  const sponsorUrl = h('input', { class: 'input', type: 'url', maxlength: 500, value: values.sponsor?.url || '', oninput: mark,
    placeholder: 'https://' });

  let league = values.league || 'start';
  const leagueBox = withLeague ? h('fieldset', { class: 'field fieldset' },
    h('legend', { class: 'field__label' }, t('host.league')),
    h('div', { class: 'radio-list' }, LEAGUES.map(([id, months]) => h('label', { class: 'radio' },
      h('input', { type: 'radio', name: 'league', value: id, checked: id === league,
        onchange: () => { league = id; mark(); } }),
      h('span', {}, h('b', {}, t('leagues.' + id) + ' · ' + t('rating.months', { n: months })),
        h('span', { class: 'muted small', style: { display: 'block' } }, t('leagues.' + id + 'Who'))))))) : null;

  const el = h('div', {},
    field(t('host.title'), title),
    leagueBox,
    h('label', { class: 'check' }, practice, h('span', {}, t('host.practiceLabel'),
      lockPractice ? h('span', { class: 'muted small', style: { display: 'block' } }, t('host.practiceLocked')) : null)),
    field(t('host.organizer'), organizer),
    h('div', { class: 'grid-2' }, field(t('host.scheduled'), when, t('host.scheduledHint')), field(t('host.timezone'), zone)),
    h('label', { class: 'check' }, openBook, h('span', {}, t('host.openBook'))),
    h('details', { class: 'details', open: !!values.sponsor?.name },
      h('summary', {}, t('host.sponsorTitle')),
      h('p', { class: 'muted small' }, t('host.sponsorLead')),
      field(t('host.sponsorName'), sponsorName),
      field(t('host.sponsorLogo'), sponsorLogo),
      field(t('host.sponsorUrl'), sponsorUrl)));

  return {
    el,
    get dirty() { return dirty; },
    clean() { dirty = false; },
    read() {
      const scheduledAt = when.value ? zonedToIso(when.value, zone.value) : null;
      return {
        title: title.value.trim(), league, practice: practice.checked, organizer: organizer.value.trim(),
        timezone: zone.value, scheduledAt, openBook: openBook.checked,
        sponsorName: sponsorName.value.trim(), sponsorLogoUrl: sponsorLogo.value.trim(), sponsorUrl: sponsorUrl.value.trim()
      };
    }
  };
}

export function renderCreate(page, onCreated) {
  const form = gameForm({});
  const msg = h('div', { class: 'field__hint', role: 'alert' });
  const btn = h('button', { class: 'btn btn--primary', type: 'submit' }, t('host.create'));
  replace(page,
    h('div', { class: 'page__head' }, h('h1', {}, t('host.createTitle'))),
    h('form', { class: 'card', novalidate: true, onsubmit: (e) => {
      e.preventDefault();
      const params = form.read();
      if (!params.title) { msg.textContent = t('errors.empty_title'); msg.classList.add('is-error'); return; }
      busy(btn, async () => {
        const res = await act('createGame', params);
        if (res.ok) { toast(t('host.created', { code: res.code }), 'ok'); await onCreated(res.gameId); }
        else { msg.textContent = errorText(res); msg.classList.add('is-error'); }
      });
    } },
      h('p', { class: 'muted' }, t('host.createLead')),
      form.el, msg, h('div', { class: 'btn-row' }, btn, h('a', { class: 'btn btn--ghost', href: '#/' }, t('common.cancel')))));
}
