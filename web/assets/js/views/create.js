// Новая игра и форма её данных — та же форма стоит в настройках пульта.

import { t, tn, errorText, LANGUAGES, language } from '../i18n.js';
import { h, replace, toast, busy, field } from '../dom.js';
import { zonedToIso, isoToZoned, currentLocale } from '../fmt.js';
import { act } from '../api.js';
import { directImageUrl, logoSrc } from './common.js';
import { ONLINE, REGION_KEYS, DEFAULT_PLACE, regionName, countryOptions, hasAreaList, areaOptions, areaZone } from '../geo.js';

const LEAGUES = [['start', 12], ['growth', 24], ['elite', 36]];

// Пояса США и несколько частых для международных игр. Подписи — в словаре
// (tz.<ключ>): города по-русски и по-испански называются по-своему.
export const TIME_ZONES = [
  ['America/New_York', 'eastern'], ['America/Chicago', 'central'], ['America/Denver', 'mountain'],
  ['America/Phoenix', 'arizona'], ['America/Los_Angeles', 'pacific'], ['America/Anchorage', 'alaska'],
  ['Pacific/Honolulu', 'hawaii'], ['America/Puerto_Rico', 'atlantic'], ['America/Toronto', 'toronto'],
  ['America/Mexico_City', 'mexicoCity'], ['America/Sao_Paulo', 'saoPaulo'], ['Europe/London', 'london'],
  ['Europe/Berlin', 'berlin'], ['Europe/Moscow', 'moscow'], ['Asia/Dubai', 'dubai'], ['Asia/Bangkok', 'bangkok'],
  ['Asia/Tokyo', 'tokyo'], ['Australia/Sydney', 'sydney'], ['UTC', 'utc']
];

/** Подпись пояса: из словаря или, для пояса региона, — от браузера с GMT. */
function zoneLabel(zone) {
  const known = TIME_ZONES.find(([z]) => z === zone);
  if (known) return t('tz.' + known[1]);
  try {
    const name = (style) => new Intl.DateTimeFormat(currentLocale(), { timeZone: zone, timeZoneName: style })
      .formatToParts(new Date()).find((p) => p.type === 'timeZoneName')?.value;
    return name('long') + ' (' + name('shortOffset') + ')';
  } catch {
    return zone;
  }
}

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

// ----------------------------------------------------------------- место игры

/**
 * Где проходит игра: регион мира, страна и, по желанию, штат США, регион
 * России или город. Онлайн — команды из разных мест: каждая укажет своё при
 * входе. Выбрали штат или регион — onZone(пояс) подставит часовой пояс.
 */
function placeField(values, lang, mark, onZone, onChange) {
  const fresh = !values?.region;
  const start = fresh ? { ...(DEFAULT_PLACE[lang] || DEFAULT_PLACE.en), area: null } : values;
  let touched = false;
  const change = () => { touched = true; mark(); onChange?.(); };

  const region = h('select', { class: 'input' },
    [...REGION_KEYS, ONLINE].map((r) => h('option', { value: r, selected: r === start.region }, regionName(r))));
  const country = h('select', { class: 'input' });
  const countryBox = field(t('geo.country'), country);
  const areaBox = h('div', {});
  const hint = h('p', { class: 'field__hint' });
  let area = null;

  function fillCountries(keep) {
    replace(country, h('option', { value: '' }, t('geo.pickCountry')),
      countryOptions(region.value).map(([c, name]) => h('option', { value: c, selected: c === keep }, name)));
  }
  function fillArea(keep) {
    const c = country.value;
    if (!c || region.value === ONLINE) { area = null; replace(areaBox); return; }
    if (hasAreaList(c)) {
      area = h('select', { class: 'input', onchange: () => {
        change();
        const zone = areaZone(c, area.value);
        if (zone) onZone(zone);
      } },
        h('option', { value: '' }, t('geo.notSpecified')),
        areaOptions(c).map(([a, name]) => h('option', { value: a, selected: a === keep }, name)));
      replace(areaBox, field(t(c === 'US' ? 'geo.state' : 'geo.region'), area));
    } else {
      area = h('input', { class: 'input', maxlength: 60, value: keep || '', oninput: change });
      replace(areaBox, field(t('geo.city'), area, t('geo.cityHint')));
    }
  }
  function sync() {
    const online = region.value === ONLINE;
    countryBox.hidden = online;
    hint.textContent = t(online ? 'host.placeOnline' : 'host.placeFixed');
  }
  function set(place) {
    region.value = place.region;
    fillCountries(place.country);
    fillArea(place.area);
    sync();
  }
  region.addEventListener('change', () => { change(); fillCountries(null); fillArea(null); sync(); });
  country.addEventListener('change', () => { change(); fillArea(null); });
  set(start);

  return {
    el: h('fieldset', { class: 'field fieldset' },
      h('legend', { class: 'field__label' }, t('host.place')),
      field(t('host.worldRegion'), region), countryBox, areaBox, hint),
    /** Новая игра: сменили язык, а место ещё не трогали — место по языку. */
    languageChanged(code) {
      if (fresh && !touched) { set({ ...(DEFAULT_PLACE[code] || DEFAULT_PLACE.en), area: null }); onChange?.(); }
    },
    read() {
      if (region.value === ONLINE) return { region: ONLINE, country: null, area: null };
      return { region: region.value, country: country.value, area: area ? area.value.trim() : '' };
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
    [...TIME_ZONES.map(([z]) => z), ...(TIME_ZONES.some(([z]) => z === tz) ? [] : [tz])]
      .map((z) => h('option', { value: z, selected: z === tz }, zoneLabel(z))));
  /** Пояс штата или региона: если его нет в списке — добавляем. */
  const setZone = (z) => {
    if (![...zone.options].some((o) => o.value === z)) zone.append(h('option', { value: z }, zoneLabel(z)));
    zone.value = z;
  };
  // Язык игры: по умолчанию — язык, на котором сейчас сайт у ведущего.
  const lang = values.language || language();
  const place = placeField(values.location, lang, mark, setZone, () => syncCurrency());
  const gameLanguage = h('select', { class: 'input', onchange: () => {
    mark(); place.languageChanged(gameLanguage.value); syncCurrency();
  } }, LANGUAGES.map((l) => h('option', { value: l.code, selected: l.code === lang, lang: l.code }, l.name)));
  // Валюта — только при создании игры: от неё зависят все суммы. Рубли — для
  // игры в России и онлайн-игры на русском, пока ведущий не выбрал сам.
  let currencyTouched = false;
  const currency = withLeague ? h('select', { class: 'input', onchange: () => { currencyTouched = true; mark(); } },
    ['USD', 'RUB'].map((c) => h('option', { value: c }, t('currency.' + c)))) : null;
  function syncCurrency() {
    if (!currency || currencyTouched) return;
    const p = place.read();
    currency.value = p.country === 'RU' || (p.region === ONLINE && gameLanguage.value === 'ru') ? 'RUB' : 'USD';
  }
  syncCurrency();
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
      h('span', {}, h('b', {}, t('leagues.' + id) + ' · ' + tn('rating.months', months)),
        h('span', { class: 'muted small', style: { display: 'block' } }, t('leagues.' + id + 'Who'))))))) : null;

  const el = h('div', {},
    field(t('host.title'), title),
    field(t('host.language'), gameLanguage, t('host.languageHint')),
    place.el,
    currency ? field(t('host.currency'), currency, t('host.currencyHint')) : null,
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
        timezone: zone.value, scheduledAt, openBook: openBook.checked, language: gameLanguage.value,
        ...place.read(),
        ...(currency ? { currency: currency.value } : {}),
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
