// «Кусок Пирога» (Piece of Cake) — главный дашборд игры: две круговые
// диаграммы за выбранный месяц и лента месяцев.
//
//   Доли пирога (Market Share). Диаметр постоянный. Сектор — доля гостей,
//   которых ресторан привлёк за месяц. У сектора — доля рынка, привлечено →
//   обслужено (если мест не хватило, видны обе цифры) и денежный поток
//   месяца. Зелёный сектор — поток в плюсе, красный — в минусе.
//
//   Размер пирога (Total Market). Все деньги гостей за месяц. Площадь
//   пропорциональна выручке: базовый рынок (базовые гости × опорная цена) —
//   пирог размером с первый, вдвое больше денег — вдвое больше площадь.
//   Секторы — куда ушли деньги: те же статьи и цвета, что в «Куда ушли
//   деньги».
//
// Цифры написаны прямо на картинке: наводить и нажимать не нужно — с
// телефона и с проектора их просто читают. На узком экране цифры — списком
// под диаграммой. Внизу — месяцы: на широком экране мини-пары диаграмм
// (нажмите — откроется месяц), на телефоне — выбор месяца со стрелками.
//
// Ничего не пересчитывает: всё берётся из данных табло (итоги месяцев).

import { t } from '../i18n.js';
import { h, replace } from '../dom.js';
import { usd, usdSigned, int, pct, decimal } from '../fmt.js';
import { PALETTE, OTHER, FLOW_COLORS, textWidth } from '../charts.js';
import { swatch } from './common.js';

const NS = 'http://www.w3.org/2000/svg';
const TAU = Math.PI * 2;
const GOOD = PALETTE[2];
const BAD = PALETTE[7];
const LINE = '#9C9B93';
const SURFACE = '#FBFAF6';
// Пирог денег растёт с выручкой, но не больше этого — иначе не поместится.
const MAX_GROWTH = 1.6;
// Рамка и отступы карточки пирога слева и справа (2px + 14px с каждой стороны).
const PANEL = 32;

// Статьи «Куда ушли деньги» в том же порядке и с теми же цветами.
const FLOWS = [
  ['suppliers', 'cost'], ['staff', 'cost'], ['advertising', 'cost'], ['quality', 'cost'],
  ['landlord', 'institution'], ['insurer', 'institution'], ['utility', 'institution'], ['bank', 'institution'],
  ['cityTax', 'city'], ['kept', 'kept']
];
const FLOW_FIELD = { kept: 'keptByRestaurants' };

function s(tag, attrs, ...kids) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v !== null && v !== undefined && v !== false) el.setAttribute(k, String(v));
  for (const c of kids.flat(Infinity)) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}

/** Сектор от угла a0 до a1 (0 — двенадцать часов, по часовой стрелке). */
function slicePath(cx, cy, r, a0, a1) {
  if (a1 - a0 >= TAU - 1e-6) {
    return `M${cx},${cy - r}A${r},${r} 0 1 1 ${cx},${cy + r}A${r},${r} 0 1 1 ${cx},${cy - r}Z`;
  }
  const x0 = cx + r * Math.sin(a0), y0 = cy - r * Math.cos(a0);
  const x1 = cx + r * Math.sin(a1), y1 = cy - r * Math.cos(a1);
  return `M${cx},${cy}L${x0},${y0}A${r},${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1},${y1}Z`;
}

/** Светлый цвет — подпись на нём тёмная, на тёмном — белая. */
function isLight(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 165;
}

const shareText = (v) => pct(v, v < 0.1 ? 1 : 0);

// ----------------------------------------------------------------- данные месяца

function monthsOf(data) {
  const money = new Set((data.moneyMap?.months || []).map((m) => m.round));
  return Object.keys(data.marketTotals || {}).map(Number).filter((r) => money.has(r)).sort((a, b) => a - b);
}

function monthOf(data, round, myId) {
  const teams = [];
  for (const p of data.players || []) {
    const e = (p.series || []).find((x) => x.round === round && x.inBusiness);
    if (!e) continue;
    const demand = Math.max(Number(e.demand ?? e.served) || 0, Number(e.served) || 0);
    if (!(demand > 0)) continue;
    teams.push({ id: p.id, name: p.restaurant, mine: p.id === myId, demand, served: Number(e.served) || 0,
      cashFlow: Number(e.cashFlow) || 0 });
  }
  const attracted = teams.reduce((a, x) => a + x.demand, 0);
  for (const x of teams) x.share = attracted > 0 ? x.demand / attracted : 0;
  const m = (data.moneyMap?.months || []).find((x) => x.round === round);
  const to = m?.restaurantsTo || {};
  const revenue = Number(m?.guestsToRestaurants) || 0;
  const kept = Number(to.keptByRestaurants) || 0;
  const flows = FLOWS.map(([id, group]) => {
    const v = Number(to[FLOW_FIELD[id] || id]) || 0;
    return { id, value: id === 'kept' ? Math.max(0, v) : Math.max(0, v), color: FLOW_COLORS[group] };
  }).filter((f) => f.value > 0);
  return { round, teams, guests: Number(data.marketTotals?.[round]) || attracted, revenue, kept, flows };
}

/** Базовый рынок в деньгах: базовые гости × опорная цена. */
const baseRevenue = (data) => (Number(data.rules?.marketBase) || 0) * (Number(data.rules?.pRef) || 0);

/** Во сколько раз пирог денег больше базового по диаметру (площадь — по выручке). */
function growth(revenue, base) {
  if (!(base > 0) || !(revenue > 0)) return revenue > 0 ? 1 : 0;
  return Math.min(MAX_GROWTH, Math.sqrt(revenue / base));
}

// ----------------------------------------------------------------- круговая диаграмма

/**
 * Пирог в svg: секторы с зазором цвета фона и подписи.
 *   labels: 'outside' — подписи сбоку с выносками; 'inside' — доля внутри
 *   крупных секторов, остальное — в списке под диаграммой.
 * Подписи справа и слева раздвигаются, чтобы не наезжать друг на друга;
 * не помещаются — false (тогда рисуем со списком).
 */
function drawPie(svg, { cx, cy, r, slices, labels, font, top, bottom, gap = 2 }) {
  const total = slices.reduce((a, x) => a + x.value, 0);
  if (!(total > 0) || !(r > 0)) return true;
  const g = s('g', {});
  let a = 0;
  const placed = [];
  for (const sl of slices) {
    const a0 = a;
    a += (sl.value / total) * TAU;
    sl.a0 = a0; sl.a1 = a; sl.mid = (a0 + a) / 2;
    g.append(s('path', {
      d: slicePath(cx, cy, r, a0, a), fill: sl.color, stroke: SURFACE, 'stroke-width': gap, 'stroke-linejoin': 'round',
      class: sl.mine ? 'cake__mine' : null
    }, s('title', {}, sl.title)));
    placed.push(sl);
  }
  svg.append(g);
  if (labels === 'none') return true;

  if (labels === 'inside') {
    for (const sl of placed) {
      if (sl.a1 - sl.a0 < 0.42 || r < 40) continue;
      const rr = r * 0.62;
      svg.append(s('text', {
        x: cx + rr * Math.sin(sl.mid), y: cy - rr * Math.cos(sl.mid) + font * 0.35, 'text-anchor': 'middle',
        class: 'cake__in', fill: isLight(sl.color) ? '#16161A' : '#fff', 'font-size': font
      }, sl.inside));
    }
    return true;
  }

  // Подписи сбоку: справа — секторы правой половины, слева — левой.
  const lh = Math.round(font * 1.22);
  const pad = Math.round(font * 0.45);
  // Выноска: 10–20 px от края пирога, подпись ещё на 14 px дальше.
  const elbow = r + Math.min(20, Math.max(10, r * 0.1));
  const sides = { right: [], left: [] };
  for (const sl of placed) {
    const side = Math.sin(sl.mid) >= 0 ? 'right' : 'left';
    const hgt = sl.wrapped.length * lh;
    sides[side].push({ sl, side, hgt, want: cy - elbow * Math.cos(sl.mid) });
  }
  for (const list of Object.values(sides)) {
    list.sort((x, y) => x.want - y.want);
    // Сверху вниз — раздвигаем, снизу вверх — подтягиваем в рамку.
    let y = top;
    for (const L of list) { L.y = Math.max(L.want - L.hgt / 2, y); y = L.y + L.hgt + pad; }
    let limit = bottom;
    for (let i = list.length - 1; i >= 0; i--) {
      const L = list[i];
      if (L.y + L.hgt > limit) L.y = limit - L.hgt;
      limit = L.y - pad;
    }
    if (list.length && list[0].y < top - 0.5) return false;
  }
  for (const L of [...sides.right, ...sides.left]) {
    const sign = L.side === 'right' ? 1 : -1;
    const ax = cx + (r - 2) * Math.sin(L.sl.mid), ay = cy - (r - 2) * Math.cos(L.sl.mid);
    const ex = cx + elbow * Math.sin(L.sl.mid), ey = cy - elbow * Math.cos(L.sl.mid);
    const ly = L.y + L.hgt / 2;
    const lx = cx + sign * (elbow + 14);
    svg.append(s('polyline', {
      points: `${ax},${ay} ${ex},${ey} ${lx - sign * 4},${ly}`, fill: 'none', stroke: LINE, 'stroke-width': 1
    }));
    svg.append(s('circle', { cx: ax, cy: ay, r: 2, fill: LINE }));
    const text = s('text', { x: lx, y: L.y, 'text-anchor': L.side === 'right' ? 'start' : 'end', 'font-size': font,
      class: 'cake__label' });
    L.sl.wrapped.forEach((line, i) => {
      text.append(s('tspan', { x: lx, dy: i === 0 ? font : lh, class: line.head ? 'cake__label-head' : null }, line.text));
    });
    svg.append(text);
  }
  return true;
}

/**
 * Строки подписи, перенесённые по словам в ширину maxW. Первая строка —
 * название, жирным. Возвращает ширину самой длинной строки.
 */
function wrapLabels(slices, maxW, font) {
  let widest = 0;
  for (const sl of slices) {
    sl.wrapped = [];
    sl.lines.forEach((line, i) => {
      const weight = i === 0 ? 800 : 600;
      // Не влезает — переносим по смыслу: «5 000 привлечено →» / «4 000
      // обслужено», «−15 216 $» / «денежный поток» (внутри суммы пробелы
      // неразрывные, первый обычный пробел — после неё). Название — по словам.
      const str = String(line);
      let parts = [str];
      if (i > 0 && textWidth(str, font, weight) > maxW) {
        if (str.includes(' → ')) parts = str.split(' → ').map((x, j, all) => (j < all.length - 1 ? x + ' →' : x));
        else if (str.indexOf(' ') > 0) parts = [str.slice(0, str.indexOf(' ')), str.slice(str.indexOf(' ') + 1)];
      }
      for (const part of parts) {
      let cur = '';
      for (const word of part.split(' ')) {
        const next = cur ? cur + ' ' + word : word;
        if (cur && textWidth(next, font, weight) > maxW) { sl.wrapped.push({ text: cur, head: i === 0 }); cur = word; }
        else cur = next;
      }
      if (cur) sl.wrapped.push({ text: cur, head: i === 0 });
      }
    });
    sl.labelW = 0;
    for (const w of sl.wrapped) sl.labelW = Math.max(sl.labelW, textWidth(w.text, font, w.head ? 800 : 600));
    widest = Math.max(widest, sl.labelW);
  }
  return Math.ceil(Math.min(widest, maxW));
}

/**
 * Место под подписи слева и справа от пирога: сторона подписи — по середине
 * сектора. Возвращает { left, right } — ширину самых длинных подписей.
 */
function sideWidths(slices) {
  const total = slices.reduce((a, x) => a + x.value, 0);
  let a = 0;
  const out = { left: 0, right: 0 };
  for (const sl of slices) {
    const mid = a + (sl.value / Math.max(total, 1e-9)) * Math.PI;
    a += (sl.value / Math.max(total, 1e-9)) * TAU;
    const side = Math.sin(mid) >= 0 ? 'right' : 'left';
    out[side] = Math.max(out[side], Math.ceil(sl.labelW || 0));
  }
  return out;
}

// ----------------------------------------------------------------- вкладка

/**
 * opts.big — проектор: всё крупно, пироги на весь экран, внизу лента
 * мини-пар. update(data, myId) — новые данные табло.
 */
export function createCake(root, { big = false } = {}) {
  let data = null;
  let myId = null;
  let months = [];
  let selected = null;
  let followLatest = true;

  const titleEl = h('div', { class: 'cake__title' });
  const prev = h('button', { class: 'btn btn--ghost btn--small cake__arrow', type: 'button', 'aria-label': t('cake.prev'),
    onclick: () => pick(months[months.indexOf(selected) - 1]) }, '‹');
  const next = h('button', { class: 'btn btn--ghost btn--small cake__arrow', type: 'button', 'aria-label': t('cake.next'),
    onclick: () => pick(months[months.indexOf(selected) + 1]) }, '›');
  const select = h('select', { class: 'input input--inline cake__select', 'aria-label': t('cake.month'),
    onchange: () => pick(Number(select.value)) });
  const summary = h('div', { class: 'cake__summary' });
  const pies = h('div', { class: 'cake__pies' });
  const strip = h('div', { class: 'cake__strip', role: 'group', 'aria-label': t('cake.months') });
  const el = h('section', { class: ['cake', big ? 'cake--big' : null], 'aria-label': t('board.views.cake') },
    h('div', { class: 'cake__head' }, titleEl,
      h('div', { class: 'cake__nav' }, prev, select, next), summary),
    pies, strip);
  replace(root, el);

  let frame = 0;
  // Перерисовываем, когда меняется ширина (на проекторе — и высота). Высоту
  // в игре задаёт сам пирог: на неё не реагируем, иначе перерисовка
  // зациклилась бы на появлении полосы прокрутки.
  // Если ширина прыгает туда-обратно (полоса прокрутки то есть, то нет),
  // второй раз подряд за секунду на тот же размер не перерисовываем.
  const sizes = [];
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
    const key = pies.clientWidth + (big ? 'x' + pies.clientHeight : '');
    const now = Date.now();
    if (sizes.length && sizes[sizes.length - 1].key === key) return;
    const back = sizes.length >= 2 && sizes[sizes.length - 2].key === key && now - sizes[sizes.length - 2].at < 1000;
    sizes.push({ key, at: now });
    if (sizes.length > 3) sizes.shift();
    if (!back) schedule();
  }) : null;
  ro?.observe(pies);
  function schedule() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(paint);
  }

  // Стрелки клавиатуры листают месяцы — удобно у проектора.
  function onKey(e) {
    if (!el.isConnected || e.target.closest?.('input, select, textarea')) return;
    if (e.key === 'ArrowLeft') pick(months[months.indexOf(selected) - 1]);
    else if (e.key === 'ArrowRight') pick(months[months.indexOf(selected) + 1]);
  }
  if (big) document.addEventListener('keydown', onKey);

  function pick(round) {
    if (round === undefined || round === null || !months.includes(round)) return;
    selected = round;
    followLatest = round === months[months.length - 1];
    paint();
  }

  let sig = '';
  function update(d, mine = null) {
    if (!d?.ok) return;
    // Проектор опрашивает сервер каждые несколько секунд: без изменений не перерисовываем.
    const next = JSON.stringify([d.players, d.marketTotals, d.moneyMap?.months, d.rules?.marketBase, d.rules?.pRef,
      d.game?.totalRounds, mine]);
    if (next === sig) return;
    sig = next;
    data = d;
    myId = mine;
    months = monthsOf(d);
    const latest = months[months.length - 1] ?? null;
    if (selected === null || followLatest || !months.includes(selected)) selected = latest;
    paint();
  }

  function paint() {
    if (!data || !el.isConnected) return;
    const total = data.game?.totalRounds || months.length;
    replace(titleEl, h('b', {}, t('board.views.cake')),
      selected ? h('span', { class: 'muted' }, ' · ' + t('common.monthOf', { n: selected, total })) : null);
    if (!months.length) {
      for (const b of [prev, next, select]) b.hidden = true;
      replace(summary);
      replace(pies, h('p', { class: 'muted cake__empty' }, t('cake.empty')));
      replace(strip);
      return;
    }
    for (const b of [prev, next, select]) b.hidden = false;
    replace(select, months.map((m) => h('option', { value: m, selected: m === selected }, t('common.monthOf', { n: m, total }))));
    prev.disabled = months.indexOf(selected) <= 0;
    next.disabled = months.indexOf(selected) >= months.length - 1;

    const m = monthOf(data, selected, myId);
    const base = baseRevenue(data);
    replace(summary, t('cake.summary', { guests: int(m.guests), revenue: usd(m.revenue) }),
      base > 0 && m.revenue > 0 ? h('span', { class: 'muted' }, ' · ' + t('cake.vsBase', { x: decimal(m.revenue / base, 2), base: usd(base) })) : null);
    paintPies(m, base);
    paintStrip(total, base);
  }

  // ----------------------------------------------------------------- два пирога

  function paintPies(m, base) {
    const W = pies.clientWidth;
    if (!(W > 0)) return;
    const side = big || W >= 860;
    const narrow = !side && W < 520;
    const font = big ? Math.round(Math.max(15, Math.min(21, W / 88))) : narrow ? 12 : 13;

    // Подписи секторов: команда — доля, гости, денежный поток; статья — сумма и доля.
    const teamSlices = m.teams.map((x) => ({
      value: x.demand,
      color: x.cashFlow > 0 ? GOOD : x.cashFlow < 0 ? BAD : OTHER,
      mine: x.mine,
      lines: [
        x.name + (x.mine ? ' ' + t('board.you') : ''),
        t('cake.share', { pct: shareText(x.share) }),
        x.served < x.demand ? t('cake.guestsLost', { attracted: int(x.demand), served: int(x.served) })
          : t('cake.guests', { served: int(x.served) }),
        t('cake.cashFlow', { amount: usdSigned(x.cashFlow) })
      ],
      inside: shareText(x.share)
    }));
    const flowSlices = m.flows.map((f) => ({
      value: f.value, color: f.color,
      lines: [t('money.' + f.id), usd(f.value) + ' · ' + shareText(m.revenue > 0 ? f.value / m.revenue : 0)],
      inside: shareText(m.revenue > 0 ? f.value / m.revenue : 0)
    }));
    for (const sl of [...teamSlices, ...flowSlices]) sl.title = sl.lines.join(' · ');

    // Карточки с местом под диаграмму: сначала в страницу, потом меряем место.
    const plot1 = h('div', { class: 'cake__plot' });
    const plot2 = h('div', { class: 'cake__plot' });
    const keys1 = h('div', { class: 'owner-keys cake__keys' },
      h('span', {}, swatch(GOOD), t('cake.plus')), h('span', {}, swatch(BAD), t('cake.minus')),
      m.teams.some((x) => x.served < x.demand) ? h('span', { class: 'muted' }, t('cake.lostNote')) : null);
    const keys2 = h('div', { class: 'owner-keys cake__keys' },
      h('span', {}, swatch(FLOW_COLORS.cost), t('money.groupCost')),
      h('span', {}, swatch(FLOW_COLORS.institution), t('money.groupInstitutions')),
      h('span', {}, swatch(FLOW_COLORS.city), t('money.groupCity')),
      h('span', {}, swatch(FLOW_COLORS.kept), t('money.groupKept')));
    const loss = m.kept < 0 ? h('p', { class: 'cake__loss' }, swatch(FLOW_COLORS.losses), t('cake.losses', { amount: usd(-m.kept) })) : null;
    const head = (title, caption) => h('div', { class: 'cake__ph' }, h('h3', { class: 'cake__h' }, title),
      h('span', { class: 'cake__cap muted' }, caption));
    const p1 = h('div', { class: 'cake__panel cake__panel--share' },
      head(t('cake.shareTitle'), t('cake.shareCaption')), plot1, keys1);
    const p2 = h('div', { class: 'cake__panel cake__panel--money' },
      head(t('cake.moneyTitle'), t('cake.moneyCaption', { revenue: usd(m.revenue) })), plot2, keys2, loss);
    replace(pies, h('div', { class: ['cake__row', side ? 'cake__row--side' : null] }, p1, p2));

    const k = growth(m.revenue, base);
    // Подпись не шире этого: длинные строки переносятся, пирог остаётся крупным.
    const maxLabel = big ? Math.round(font * 9.5) : side ? 165 : Math.max(110, Math.round(W * 0.26));
    wrapLabels(teamSlices, maxLabel, font);
    wrapLabels(flowSlices, maxLabel, font);
    const sw1 = sideWidths(teamSlices);
    const sw2 = sideWidths(flowSlices);
    // Место под подписи слева и справа от пирога (с выносками).
    const room = (sw) => (sw.left ? sw.left + 34 : 4) + (sw.right ? sw.right + 34 : 4) + 8;
    // Центр пирога — так, чтобы подписи слева и справа поместились в ширину w.
    const centerX = (w, r, sw) => {
      const left = sw.left ? sw.left + 34 : 4;
      const used = left + 2 * r + (sw.right ? sw.right + 34 : 4);
      return Math.max(0, (w - used) / 2) + left + r;
    };
    const column = (list) => Math.ceil(list.reduce((a, sl) => a + sl.wrapped.length * font * 1.22 + font * 0.45, 0) / 2);

    let r1, r2, w1, w2, h1, h2;
    let labels1 = narrow ? 'inside' : 'outside';
    let labels2 = labels1;
    if (side) {
      // Рядом. Высота общая; ширину делим так, чтобы пирогу денег хватило
      // места вырасти в полтора раза, а первому — быть как можно крупнее.
      const H = big ? Math.max(220, Math.min(plot1.clientHeight, plot2.clientHeight))
        : Math.min(560, Math.round(W * 0.42));
      const inner = W - 2 * PANEL - 14;
      // По ширине запас на рост пирога денег — 1,3 раза (выручка в 1,7 раза
      // больше базовой), по высоте — 1,5 раза.
      const byWidth = (inner - room(sw1) - room(sw2)) / (2 + 2 * 1.3);
      const byHeight = (H - 24) / 2 / 1.5;
      r1 = Math.max(40, Math.min(byWidth, byHeight));
      w1 = Math.round(Math.min(inner * 0.5, 2 * r1 + room(sw1)));
      w2 = inner - w1;
      r2 = Math.max(0, Math.min((H - 24) / 2, (w2 - room(sw2)) / 2, r1 * k));
      h1 = h2 = H;
      p1.style.flex = '0 0 ' + (w1 + PANEL) + 'px';
    } else {
      w1 = w2 = W - PANEL;
      if (narrow) {
        r1 = Math.max(46, Math.min(150, (w1 - 16) / 2 * 0.86));
        r2 = Math.max(0, Math.min((w2 - 16) / 2, r1 * k));
      } else {
        r1 = Math.max(46, Math.min(190, (w1 - room(sw1)) / 2));
        r2 = Math.max(0, Math.min((w2 - room(sw2)) / 2, r1 * k));
      }
      // Высота — по пирогу и по столбику подписей самой длинной стороны.
      h1 = Math.round(Math.max(2 * r1 + 30, narrow ? 0 : column(teamSlices) + 24));
      h2 = Math.round(Math.max(2 * Math.max(r2, r1) + 30, narrow ? 0 : column(flowSlices) + 24));
    }

    const svg1 = s('svg', { class: 'cake__svg', width: w1, height: h1, viewBox: `0 0 ${w1} ${h1}`, role: 'img',
      'aria-label': t('cake.shareTitle') + ': ' + teamSlices.map((x) => x.title).join('; ') });
    if (!drawPie(svg1, { cx: narrow ? w1 / 2 : centerX(w1, r1, sw1), cy: h1 / 2, r: r1, slices: teamSlices, labels: labels1, font, top: 4, bottom: h1 - 4 })) {
      // Команд много — подписи не помещаются: доли внутри, цифры списком.
      replace(svg1);
      labels1 = 'inside';
      drawPie(svg1, { cx: w1 / 2, cy: h1 / 2, r: r1, slices: teamSlices, labels: 'inside', font, top: 4, bottom: h1 - 4 });
    }
    plot1.append(svg1);
    if (labels1 === 'inside') plot1.append(list(teamSlices, false));

    const svg2 = s('svg', { class: 'cake__svg', width: w2, height: h2, viewBox: `0 0 ${w2} ${h2}`, role: 'img',
      'aria-label': t('cake.moneyTitle') + ': ' + usd(m.revenue) + '. ' + flowSlices.map((x) => x.title).join('; ') });
    const cx2 = narrow ? w2 / 2 : centerX(w2, Math.max(r2, r1), sw2);
    if (m.revenue > 0 && !drawPie(svg2, { cx: cx2, cy: h2 / 2, r: r2, slices: flowSlices, labels: labels2, font, top: 4, bottom: h2 - 4 })) {
      replace(svg2);
      labels2 = 'inside';
      drawPie(svg2, { cx: w2 / 2, cy: h2 / 2, r: r2, slices: flowSlices, labels: 'inside', font, top: 4, bottom: h2 - 4 });
    }
    if (base > 0) {
      // Базовый рынок — пунктирный круг размером с первый пирог: сразу видно,
      // вырос пирог денег или сжался. Пирог больше — пунктир поверх него.
      const outside = r2 < r1;
      const ring = s('circle', { cx: cx2, cy: h2 / 2, r: r1, fill: 'none', 'stroke-width': 1.5, 'stroke-dasharray': '5 5',
        stroke: outside ? LINE : 'rgba(255,255,255,.9)', class: 'cake__base' });
      if (outside) svg2.prepend(ring); else svg2.append(ring);
    }
    plot2.append(svg2);
    if (labels2 === 'inside') plot2.append(list(flowSlices, true));
  }

  /** Те же цифры списком — под диаграммой на узком экране. compact — в одну строку. */
  function list(slices, compact) {
    return h('ul', { class: ['cake__list', compact ? 'cake__list--compact' : null] },
      slices.map((sl) => h('li', { class: sl.mine ? 'is-mine' : null },
        swatch(sl.color), h('b', {}, sl.lines[0]), h('span', {}, sl.lines.slice(1).join(' · ')))));
  }

  // ----------------------------------------------------------------- лента месяцев

  function paintStrip(total, base) {
    const W = strip.clientWidth || pies.clientWidth;
    // На узком экране мини-пары не нужны: месяц выбирают списком со стрелками.
    if (!big && W < 520) { replace(strip); strip.hidden = true; return; }
    strip.hidden = false;
    const n = Math.max(total, months.length);
    const cellW = Math.max(big ? 44 : 46, Math.floor((W - 4) / n));
    const d1 = Math.max(12, Math.min(big ? 54 : 40, (cellW - 8) / (1 + MAX_GROWTH * 0.85)));
    const cellH = Math.round(d1 * MAX_GROWTH + 22);
    const cells = [];
    for (let r = 1; r <= n; r++) {
      const played = months.includes(r);
      const w = cellW - 4;
      const svg = s('svg', { width: w, height: cellH - 18, viewBox: `0 0 ${w} ${cellH - 18}`, 'aria-hidden': 'true' });
      const cy = (cellH - 18) / 2;
      const c1 = d1 / 2 + 2;
      if (played) {
        const m = monthOf(data, r, myId);
        drawPie(svg, { cx: c1, cy, r: d1 / 2, labels: 'none', gap: 1,
          slices: m.teams.map((x) => ({ value: x.demand, color: x.cashFlow > 0 ? GOOD : x.cashFlow < 0 ? BAD : OTHER, title: x.name })) });
        const r2 = (d1 / 2) * growth(m.revenue, base);
        const c2 = d1 + 4 + Math.max(r2, d1 / 2);
        if (m.revenue > 0) {
          drawPie(svg, { cx: Math.min(c2, w - r2 - 1), cy, r: r2, labels: 'none', gap: 1,
            slices: m.flows.map((f) => ({ value: f.value, color: f.color, title: t('money.' + f.id) })) });
        }
      } else {
        for (const cx of [c1, d1 + 4 + d1 / 2]) {
          svg.append(s('circle', { cx, cy, r: d1 / 2 - 1, fill: 'none', stroke: '#D3D2CA', 'stroke-dasharray': '3 3' }));
        }
      }
      const cell = h(played ? 'button' : 'div', {
        class: ['cake__cell', r === selected ? 'is-on' : null, played ? null : 'is-future'],
        type: played ? 'button' : null, style: { width: cellW + 'px' },
        'aria-pressed': played ? String(r === selected) : null,
        'aria-label': t('common.monthOf', { n: r, total: n }),
        onclick: played ? () => pick(r) : null
      }, svg, h('span', { class: 'cake__num' }, String(r)));
      cells.push(cell);
    }
    replace(strip, cells);
    // Выбранный месяц — в поле зрения ленты (саму страницу не трогаем).
    const on = strip.querySelector('.is-on');
    if (on && strip.scrollWidth > strip.clientWidth) {
      strip.scrollLeft = Math.max(0, on.offsetLeft - strip.offsetLeft - (strip.clientWidth - on.offsetWidth) / 2);
    }
  }

  return {
    el,
    update,
    pick,
    destroy() {
      ro?.disconnect();
      cancelAnimationFrame(frame);
      if (big) document.removeEventListener('keydown', onKey);
    }
  };
}
