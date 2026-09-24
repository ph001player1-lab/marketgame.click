// Новая игра и форма её данных — та же форма стоит в настройках пульта.

import { t, errorText } from '../i18n.js';
import { h, replace, toast, busy, field } from '../dom.js';
import { zonedToIso, isoToZoned } from '../fmt.js';
import { act } from '../api.js';
import { directImageUrl, logoSrc } from './common.js';

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

// ----------------------------------------------------------------- логотип

const LOGO_MAX_W = 600;
const LOGO_MAX_H = 240;

function loadImage(src, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
    img.onload = () => { clearTimeout(timer); resolve(img); };
    img.onerror = () => { clearTimeout(timer); reject(new Error('load')); };
    img.referrerPolicy = 'no-referrer';
    img.src = src;
  });
}

/** Границы непрозрачной части картинки: пустые поля по краям обрезаем. */
function opaqueBox(ctx, w, hh) {
  const d = ctx.getImageData(0, 0, w, hh).data;
  let x0 = w;
  let y0 = hh;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < hh; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/**
 * Файл логотипа → небольшая картинка data:image/png: без пустых прозрачных
 * полей, не больше 600×240. Любой размер и формат, который понимает
 * браузер (PNG, JPG, WebP, SVG, GIF); SVG превращается в PNG.
 */
export async function prepareLogo(file) {
  if (!file || !/^image\//.test(file.type)) throw new Error('type');
  if (file.size > 20 * 1024 * 1024) throw new Error('size');
  const src = URL.createObjectURL(file);
  try {
    const img = await loadImage(src);
    // У SVG без размеров naturalWidth бывает 0 — рисуем его в 600 px.
    let w = img.naturalWidth || 600;
    let hh = img.naturalHeight || 200;
    // Огромные картинки сначала уменьшаем: телефон не потянет холст 8000×8000.
    const pre = Math.min(1, Math.sqrt(16e6 / (w * hh)));
    w = Math.max(1, Math.round(w * pre));
    hh = Math.max(1, Math.round(hh * pre));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = hh;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, w, hh);
    const box = opaqueBox(g, w, hh) || { x: 0, y: 0, w, h: hh };
    const k = Math.min(1, LOGO_MAX_W / box.w, LOGO_MAX_H / box.h);
    const out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(box.w * k));
    out.height = Math.max(1, Math.round(box.h * k));
    const o = out.getContext('2d');
    o.imageSmoothingQuality = 'high';
    o.drawImage(c, box.x, box.y, box.w, box.h, 0, 0, out.width, out.height);
    let data = out.toDataURL('image/png');
    if (data.length > 600000) data = out.toDataURL('image/webp', 0.9);
    if (data.length > 600000) throw new Error('size');
    return data;
  } finally {
    URL.revokeObjectURL(src);
  }
}

/**
 * Поле логотипа: загрузить файл или вставить ссылку, с предпросмотром.
 * change() — есть ли изменения для сохранения: { sponsorLogoData | sponsorLogoUrl }.
 */
function logoField(values, onChange) {
  let state = { mode: 'keep' };
  const preview = h('div', { class: 'logo-preview' });
  const status = h('div', { class: 'field__hint', role: 'status' });
  const fileInput = h('input', { class: 'sr', type: 'file', accept: 'image/png,image/jpeg,image/webp,image/svg+xml,image/gif',
    'aria-label': t('host.logoUpload'), onchange: onFile });
  const link = h('input', { class: 'input', type: 'url', maxlength: 500, placeholder: 'https://…',
    value: values.sponsor?.logoRev ? '' : (values.sponsor?.logoUrl || ''), onchange: onLink });
  const upload = h('button', { class: 'btn btn--small', type: 'button', onclick: () => fileInput.click() }, t('host.logoUpload'));
  const remove = h('button', { class: 'btn btn--ghost btn--small', type: 'button', onclick: () => {
    state = { mode: 'none' };
    link.value = '';
    show(null);
    say('');
    onChange();
  } }, t('host.logoRemove'));

  function say(text, kind) {
    status.textContent = text;
    status.classList.toggle('is-ok', kind === 'ok');
    status.classList.toggle('is-error', kind === 'bad');
  }
  function show(src) {
    replace(preview, src
      ? h('img', { src, alt: t('host.logoPreviewAlt'), referrerpolicy: 'no-referrer',
          onerror: () => { replace(preview, h('span', { class: 'muted small' }, t('host.logoNone'))); } })
      : h('span', { class: 'muted small' }, t('host.logoNone')));
    remove.hidden = !src;
  }
  async function onFile() {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    say(t('host.logoWorking'));
    try {
      const data = await prepareLogo(file);
      state = { mode: 'file', data };
      link.value = '';
      show(data);
      say(t('host.logoReady'), 'ok');
      onChange();
    } catch {
      say(t('host.logoFileBad'), 'bad');
    }
  }
  async function onLink() {
    const raw = link.value.trim();
    onChange();
    if (!raw) { state = { mode: 'none' }; show(null); say(''); return; }
    state = { mode: 'link', url: raw };
    if (!/^https:\/\//i.test(raw)) { say(t('errors.bad_url'), 'bad'); return; }
    const direct = directImageUrl(raw);
    say(t('host.logoChecking'));
    try {
      await loadImage(direct);
      show(direct);
      say(t('host.logoOk'), 'ok');
    } catch {
      show(null);
      say(t('host.logoBad'), 'bad');
    }
  }

  show(logoSrc(values.sponsor, values.id));
  return {
    el: h('div', { class: 'field' },
      h('div', { class: 'field__label' }, t('host.logo')),
      h('div', { class: 'logo-field' }, preview, h('div', { class: 'logo-field__actions' }, upload, remove), fileInput),
      field(t('host.logoLink'), link),
      status,
      h('p', { class: 'field__hint' }, t('host.logoHint'))),
    change() {
      if (state.mode === 'file') return { sponsorLogoData: state.data, sponsorLogoUrl: '' };
      if (state.mode === 'link') return { sponsorLogoUrl: state.url, sponsorLogoData: '' };
      if (state.mode === 'none') return { sponsorLogoUrl: '', sponsorLogoData: '' };
      return {};
    }
  };
}

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
  const logo = logoField(values, mark);
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
      logo.el,
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
        sponsorName: sponsorName.value.trim(), sponsorUrl: sponsorUrl.value.trim(),
        ...logo.change()
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
