// «Кусок Пирога» (Piece of Cake) — главный дашборд игры: две круговые
// диаграммы за выбранный месяц и лента месяцев.
//
//   Доли пирога (Market Share). Сектор — доля гостей, которых ресторан
//   привлёк за месяц. У сектора — доля рынка, привлечено → обслужено (если
//   мест не хватило, видны обе цифры), розничная цена (видно, кто сбивал
//   цену, а кто ставил выше рынка) и денежный поток месяца. Зелёный сектор —
//   поток в плюсе, красный — в минусе.
//
//   Размер пирога (Total Market). Все деньги гостей за месяц. Диаметр
//   пропорционален выручке: базовый рынок (базовые гости × опорная цена) —
//   пунктир размером с первый пирог, втрое больше денег — втрое больше
//   диаметр. Масштаб один на всю игру: самый денежный месяц помещается
//   целиком, первый пирог и пунктир от месяца к месяцу не меняются, и месяцы
//   сравнимы между собой. Секторы — куда ушли деньги: те же статьи и цвета,
//   что в «Куда ушли деньги».
//
// Цифры написаны прямо на картинке: наводить и нажимать не нужно — с
// телефона и с проектора их просто читают. На узком экране цифры — списком
// под диаграммой. Внизу — месяцы: на широком экране мини-пары диаграмм
// (нажмите — откроется месяц), на телефоне — выбор месяца со стрелками.
//
// Ничего не пересчитывает: всё берётся из данных табло (итоги месяцев).

import { t } from '../i18n.js';
import { h, replace } from '../dom.js';
import { usd, usdc, usdSigned, int, pct, decimal } from '../fmt.js';
import { PALETTE, OTHER, FLOW_COLORS, textWidth } from '../charts.js';
import { swatch } from './common.js';

const NS = 'http://www.w3.org/2000/svg';
const TAU = Math.PI * 2;
const GOOD = PALETTE[2];
const BAD = PALETTE[7];
const LINE = '#9C9B93';
const SURFACE = '#FBFAF6';
// Рамка и отступы карточки пирога слева и справа (2px + 14px с каждой стороны).
const PANEL = 32;
// Радиус первого пирога: не мельче MIN_R1 (если рынок вырос так, что база
// мельче, пунктир рисуется по масштабу, а первый пирог остаётся читаемым) и
// в игре не крупнее MAX_R1.
const MIN_R1 = 36;
const MAX_R1 = 190;
// В игре пирог денег не крупнее этого радиуса — иначе страница уйдёт вниз.
const MAX_R2 = 240;
// В игре на широком экране пироги стоят рядом, если база выходит не мельче
// этого радиуса, иначе — друг под другом, и пирог денег крупнее.
const SIDE_MIN_R = 32;

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
// Цена — с центами, только если они есть: 54 $, 29,50 $.
const priceText = (v) => (Math.abs(v - Math.round(v)) < 0.005 ? usd(v) : usdc(v));

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
      price: Number(e.price) || 0, cashFlow: Number(e.cashFlow) || 0 });
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

/**
 * Во сколько раз пирог денег больше базового по диаметру — во столько же,
 * во сколько выручка больше базового рынка. Без базы — того же размера.
 */
function growth(revenue, base) {
  if (!(revenue > 0)) return 0;
  return base > 0 ? revenue / base : 1;
}

/** Самый крупный пирог денег за игру (не меньше базы): по нему масштаб. */
function maxGrowth(data, months, base) {
  let most = 1;
  for (const m of data.moneyMap?.months || []) {
    if (months.includes(m.round)) most = Math.max(most, growth(Number(m.guestsToRestaurants) || 0, base));
  }
  return most;
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
function wrapLabels(slices, width, font) {
  let widest = 0;
  for (const sl of slices) {
    const maxW = typeof width === 'function' ? width(sl) : width;
    sl.wrapped = [];
    sl.lines.forEach((line, i) => {
      const weight = i === 0 ? 800 : 600;
      // Не влезает — переносим по смыслу: «5 000 привлечено →» / «4 000
      // обслужено», «−15 216 $» / «денежный поток», «розничная цена» /
      // «54 $»: сумма не рвётся. Название — по словам.
      const str = lineText(line);
      let parts = [str];
      if (i > 0 && textWidth(str, font, weight) > maxW) {
        const at = line.amount ? str.indexOf(line.amount) : -1;
        if (str.includes(' → ')) parts = str.split(' → ').map((x, j, all) => (j < all.length - 1 ? x + '\u00a0→' : x));
        else if (at >= 0) {
          const before = str.slice(0, at).trim();
          const after = str.slice(at + line.amount.length).trim();
          parts = before ? [before, line.amount + (after ? ' ' + after : '')] : [line.amount, after].filter(Boolean);
        } else if (str.indexOf(' ') > 0) parts = [str.slice(0, str.indexOf(' ')), str.slice(str.indexOf(' ') + 1)];
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
    widest = Math.max(widest, Math.min(sl.labelW, maxW));
  }
  return Math.ceil(widest);
}

/**
 * Место под подписи слева и справа от пирога: сторона подписи — по середине
 * сектора. Возвращает { left, right } — ширину самых длинных подписей — и
 * height — высоту столбика подписей на более длинной стороне.
 */
function sideWidths(slices, font) {
  const total = slices.reduce((a, x) => a + x.value, 0);
  const lh = Math.round(font * 1.22);
  const pad = Math.round(font * 0.45);
  let a = 0;
  const out = { left: 0, right: 0, height: 0 };
  const tall = { left: -pad, right: -pad };
  for (const sl of slices) {
    const mid = a + (sl.value / Math.max(total, 1e-9)) * Math.PI;
    a += (sl.value / Math.max(total, 1e-9)) * TAU;
    const side = Math.sin(mid) >= 0 ? 'right' : 'left';
    sl.side = side;
    out[side] = Math.max(out[side], Math.ceil(sl.labelW || 0));
    tall[side] += (sl.wrapped?.length || 0) * lh + pad;
  }
  out.height = Math.max(0, tall.left, tall.right);
  return out;
}

/** Строка подписи: текст или { text, amount } — сумма, которую не переносим. */
const lineText = (line) => (typeof line === 'string' ? line : line.text);

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
  // Подписи меряем шрифтом сайта: догрузился после первой отрисовки —
  // перерисовываем, иначе место под подписи было бы посчитано другим шрифтом.
  document.fonts?.addEventListener?.('loadingdone', schedule);
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
    const most = maxGrowth(data, months, base);
    paintPies(m, base, most);
    paintStrip(total, base, most);
  }

  // ----------------------------------------------------------------- два пирога

  /**
   * Секторы месяца с подписями: команда — доля, гости, розничная цена,
   * денежный поток; статья — сумма и доля. Сумма в строке не переносится.
   */
  function slicesOf(m) {
    const money = (key, amount) => ({ text: t(key, { amount }), amount });
    const teamSlices = m.teams.map((x) => ({
      value: x.demand,
      color: x.cashFlow > 0 ? GOOD : x.cashFlow < 0 ? BAD : OTHER,
      mine: x.mine,
      lines: [
        x.name + (x.mine ? ' ' + t('board.you') : ''),
        t('cake.share', { pct: shareText(x.share) }),
        x.served < x.demand ? t('cake.guestsLost', { attracted: int(x.demand), served: int(x.served) })
          : t('cake.guests', { served: int(x.served) }),
        x.price > 0 ? money('cake.price', priceText(x.price)) : null,
        money('cake.cashFlow', usdSigned(x.cashFlow))
      ].filter(Boolean),
      inside: shareText(x.share)
    }));
    const flowSlices = m.flows.map((f) => ({
      value: f.value, color: f.color,
      lines: [t('money.' + f.id), usd(f.value) + ' · ' + shareText(m.revenue > 0 ? f.value / m.revenue : 0)],
      inside: shareText(m.revenue > 0 ? f.value / m.revenue : 0)
    }));
    for (const sl of [...teamSlices, ...flowSlices]) sl.title = sl.lines.map(lineText).join(' · ');
    return [teamSlices, flowSlices];
  }

  function paintPies(m, base, most) {
    const W = pies.clientWidth;
    if (!(W > 0)) return;
    const narrow = !big && W < 520;
    const font = big ? Math.round(Math.max(15, Math.min(21, W / 88))) : narrow ? 12 : 13;
    const k = growth(m.revenue, base);
    const [teamSlices, flowSlices] = slicesOf(m);
    const rest = months.filter((r) => r !== m.round).map((r) => monthOf(data, r, myId));
    const others = rest.map(slicesOf);

    // Подписи переносим по ширине и меряем место под них слева и справа от
    // пирога (с выносками) — сразу по всем месяцам игры: размер и место
    // пирогов при листании месяцев не меняются. Подпись не шире maxLabel —
    // пирог остаётся крупным.
    const inner = W - 2 * PANEL - 14;
    const room = (sw) => (sw.left ? sw.left + 34 : 4) + (sw.right ? sw.right + 34 : 4) + 8;
    const widest = (a, b) => ({ left: Math.max(a.left, b.left), right: Math.max(a.right, b.right), height: Math.max(a.height, b.height) });
    let maxLabel = 0;
    const measure = (width) => {
      maxLabel = width;
      let all = null;
      for (const pair of [...others, [teamSlices, flowSlices]]) {
        const sides = pair.map((list) => { wrapLabels(list, width, font); return sideWidths(list, font); });
        all = all ? all.map((x, i) => widest(x, sides[i])) : sides;
      }
      return all;
    };
    let [sw1, sw2] = measure(big ? Math.round(font * 9.5) : 165);
    // Проектор — всегда рядом. В игре — рядом, если самый крупный пирог денег
    // игры помещается рядом с первым и база выходит не мельче SIDE_MIN_R.
    const side = big || (!narrow && W >= 860 && (inner - room(sw1) - room(sw2)) / (2 + 2 * most) >= SIDE_MIN_R);
    if (!side) [sw1, sw2] = measure(Math.max(110, Math.round(W * 0.26)));
    // Центр пирога — так, чтобы подписи слева и справа поместились в ширину w.
    const centerX = (w, r, sw) => {
      const left = sw.left ? sw.left + 34 : 4;
      const used = left + 2 * r + (sw.right ? sw.right + 34 : 4);
      return Math.max(0, (w - used) / 2) + left + r;
    };

    // Карточки с местом под диаграмму: сначала в страницу, потом меряем место.
    const plot1 = h('div', { class: 'cake__plot' });
    const plot2 = h('div', { class: 'cake__plot' });
    // На проекторе пояснения под пирогами занимают место всегда, если они
    // бывают в этой игре: высота пирогов от месяца к месяцу не меняется.
    const lost = (x) => x.teams.some((tm) => tm.served < tm.demand);
    const shown = (here, ever) => (here ? {} : big && ever ? { style: { visibility: 'hidden' } } : null);
    const lostKey = shown(lost(m), rest.some(lost));
    const keys1 = h('div', { class: 'owner-keys cake__keys' },
      h('span', {}, swatch(GOOD), t('cake.plus')), h('span', {}, swatch(BAD), t('cake.minus')),
      lostKey ? h('span', { class: 'muted', ...lostKey }, t('cake.lostNote')) : null);
    const keys2 = h('div', { class: 'owner-keys cake__keys' },
      h('span', {}, swatch(FLOW_COLORS.cost), t('money.groupCost')),
      h('span', {}, swatch(FLOW_COLORS.institution), t('money.groupInstitutions')),
      h('span', {}, swatch(FLOW_COLORS.city), t('money.groupCity')),
      h('span', {}, swatch(FLOW_COLORS.kept), t('money.groupKept')));
    const worst = Math.min(m.kept, ...rest.map((x) => x.kept));
    const lossKey = shown(m.kept < 0, worst < 0);
    const loss = lossKey ? h('p', { class: 'cake__loss', ...lossKey }, swatch(FLOW_COLORS.losses),
      t('cake.losses', { amount: usd(-(m.kept < 0 ? m.kept : worst)) })) : null;
    const head = (title, caption) => h('div', { class: 'cake__ph' }, h('h3', { class: 'cake__h' }, title),
      h('span', { class: 'cake__cap muted' }, caption));
    const p1 = h('div', { class: 'cake__panel cake__panel--share' },
      head(t('cake.shareTitle'), t('cake.shareCaption')), plot1, keys1);
    const p2 = h('div', { class: 'cake__panel cake__panel--money' },
      head(t('cake.moneyTitle'), t('cake.moneyCaption', { revenue: usd(m.revenue) })), plot2, keys2, loss);
    replace(pies, h('div', { class: ['cake__row', side ? 'cake__row--side' : null] }, p1, p2));

    // rb — радиус базового рынка (пунктир). Первый пирог — того же размера,
    // пока он не мельче MIN_R1. Пирог денег — rb × k, самый крупный за игру —
    // rb × most: он помещается целиком.
    let r1, rb, w1, w2, h1, h2;
    let labels1 = narrow ? 'inside' : 'outside';
    let labels2 = labels1;
    if (side) {
      // Рядом. Высота общая; ширину делим по размеру пирогов и подписей.
      const layout = (maxPie) => {
        rb = Math.min((inner - room(sw1) - room(sw2)) / (2 + 2 * most), maxPie / 2 / most,
          big ? Infinity : Math.min(MAX_R1, MAX_R2 / most));
        r1 = Math.min(Math.max(rb, MIN_R1), maxPie / 2);
        const c1 = 2 * r1 + room(sw1);
        rb = Math.max(0, Math.min(rb, (inner - c1 - room(sw2)) / (2 * most)));
        const spare = Math.max(0, inner - c1 - 2 * rb * most - room(sw2));
        w1 = Math.round(c1 + spare / 2);
        w2 = inner - w1;
        p1.style.flex = '0 0 ' + (w1 + PANEL) + 'px';
      };
      let H;
      if (big) {
        const plotH = () => Math.max(220, Math.min(plot1.clientHeight, plot2.clientHeight));
        H = plotH();
        layout(H - 24);
        // Карточки стали другой ширины — подписи под пирогами могли перенестись.
        const again = plotH();
        if (again < H - 1) { H = again; layout(H - 24); }
      } else {
        layout(Infinity);
        H = Math.round(Math.max(2 * rb * most, 2 * r1, sw1.height, sw2.height) + 24);
      }
      h1 = h2 = H;
    } else if (!narrow) {
      // Друг под другом, во всю ширину.
      w1 = w2 = W - PANEL;
      rb = Math.max(0, Math.min(MAX_R1, (w1 - room(sw1)) / 2, (w2 - room(sw2)) / 2 / most, MAX_R2 / most));
      r1 = Math.max(rb, Math.min(MIN_R1, (w1 - room(sw1)) / 2));
      // Высота — по пирогу и по столбику подписей самой длинной стороны.
      h1 = Math.round(Math.max(2 * r1, sw1.height) + 30);
      h2 = Math.round(Math.max(2 * rb * most, sw2.height) + 30);
    } else {
      // Телефон: доли внутри секторов (им нужен радиус от 40), цифры — списком.
      w1 = w2 = W - PANEL;
      rb = Math.max(0, Math.min(150, (w1 - 16) / 2 * 0.86, (w2 - 16) / 2 / most));
      r1 = Math.max(rb, 40);
      h1 = Math.round(2 * r1 + 30);
      h2 = Math.round(2 * rb * most + 30);
    }
    const r2 = rb * k;

    // Подписи сбоку. Не помещаются по высоте — шрифт мельче, а строки длиннее
    // (в ту же ширину, что отведена этой стороне: строк меньше); всё равно
    // нет — доли внутри секторов, цифры списком. Возвращает, как нарисовали.
    const minFont = big ? 13 : 11;
    const drawLabeled = (svg, opts, sw) => {
      if (opts.labels === 'outside') {
        for (let f = font; f >= minFont; f -= big ? 2 : 1) {
          if (f !== font) wrapLabels(opts.slices, (sl) => sw[sl.side] || maxLabel, f);
          if (drawPie(svg, { ...opts, font: f })) return opts;
          replace(svg);
        }
      }
      // Подписи внутри — svg по размеру пирога, чтобы рядом поместился список.
      const w = Math.min(opts.w, Math.ceil(2 * Math.max(opts.r, opts.keep || 0) + 16));
      svg.setAttribute('width', w);
      svg.setAttribute('viewBox', `0 0 ${w} ${opts.h}`);
      const inside = { ...opts, cx: w / 2, labels: 'inside' };
      drawPie(svg, inside);
      return inside;
    };
    // Список рядом с пирогом на проекторе — во всю высоту карточки: не
    // помещается — шрифт мельче, потом две колонки.
    const fitList = (box) => {
      if (!big) return;
      const over = () => box.scrollHeight > box.clientHeight + 1;
      for (let f = 15; f >= 12 && over(); f--) box.style.fontSize = f + 'px';
      if (over()) box.classList.add('cake__list--two');
      for (let f = 14; f >= 11 && over(); f--) box.style.fontSize = f + 'px';
    };

    const svg1 = s('svg', { class: 'cake__svg', width: w1, height: h1, viewBox: `0 0 ${w1} ${h1}`, role: 'img',
      'aria-label': t('cake.shareTitle') + ': ' + teamSlices.map((x) => x.title).join('; ') });
    labels1 = drawLabeled(svg1, { w: w1, h: h1, cx: narrow ? w1 / 2 : centerX(w1, r1, sw1), cy: h1 / 2, r: r1,
      slices: teamSlices, labels: labels1, font, top: 4, bottom: h1 - 4 }, sw1).labels;
    plot1.append(svg1);
    if (labels1 === 'inside') fitList(plot1.appendChild(list(teamSlices, false)));

    const svg2 = s('svg', { class: 'cake__svg', width: w2, height: h2, viewBox: `0 0 ${w2} ${h2}`, role: 'img',
      'aria-label': t('cake.moneyTitle') + ': ' + usd(m.revenue) + '. ' + flowSlices.map((x) => x.title).join('; ') });
    // Центр — по самому крупному пирогу игры: от месяца к месяцу он на месте.
    let cx2 = narrow ? w2 / 2 : centerX(w2, Math.max(rb * most, r2), sw2);
    if (m.revenue > 0) {
      const drawn = drawLabeled(svg2, { w: w2, h: h2, cx: cx2, cy: h2 / 2, r: r2, keep: rb, slices: flowSlices,
        labels: labels2, font, top: 4, bottom: h2 - 4 }, sw2);
      labels2 = drawn.labels;
      cx2 = drawn.cx;
    }
    if (base > 0 && rb > 0) {
      // Базовый рынок — пунктирный круг в том же масштабе: сразу видно, во
      // сколько раз пирог денег вырос или сжался. Пирог больше — пунктир поверх.
      const outside = r2 < rb;
      const ring = s('circle', { cx: cx2, cy: h2 / 2, r: rb, fill: 'none', 'stroke-width': 1.5, 'stroke-dasharray': '5 5',
        stroke: outside ? LINE : 'rgba(255,255,255,.9)', class: 'cake__base' });
      if (outside) svg2.prepend(ring); else svg2.append(ring);
    }
    plot2.append(svg2);
    if (labels2 === 'inside') fitList(plot2.appendChild(list(flowSlices, true)));
  }

  /** Те же цифры списком — под диаграммой на узком экране. compact — в одну строку. */
  function list(slices, compact) {
    return h('ul', { class: ['cake__list', compact ? 'cake__list--compact' : null] },
      slices.map((sl) => h('li', { class: sl.mine ? 'is-mine' : null },
        swatch(sl.color), h('b', {}, lineText(sl.lines[0])), h('span', {}, sl.lines.slice(1).map(lineText).join(' · ')))));
  }

  // ----------------------------------------------------------------- лента месяцев

  function paintStrip(total, base, most) {
    const W = strip.clientWidth || pies.clientWidth;
    // На узком экране мини-пары не нужны: месяц выбирают списком со стрелками.
    if (!big && W < 520) { replace(strip); strip.hidden = true; return; }
    strip.hidden = false;
    const n = Math.max(total, months.length);
    // Мини-пара в том же масштабе, что и большие пироги: слева доли размером
    // с базовый рынок, справа деньги — во столько раз больше по диаметру, во
    // сколько выручка больше базы. Самый крупный месяц — во всю высоту ленты.
    let cellW = Math.max(big ? 44 : 46, Math.floor((W - 4) / n));
    const d1 = Math.max(8, Math.min(big ? 54 : 40, (cellW - 12) / (1 + most), (big ? 96 : 64) / most));
    cellW = Math.max(cellW, Math.ceil(d1 * (1 + most) + 12));
    const w = cellW - 4;
    const hgt = Math.ceil(d1 * most) + 4;
    const x0 = Math.max(2, (w - d1 - 4 - d1 * most) / 2);
    const c1 = x0 + d1 / 2;
    const c2 = x0 + d1 + 4 + (d1 * most) / 2;
    const cy = hgt / 2;
    const cells = [];
    for (let r = 1; r <= n; r++) {
      const played = months.includes(r);
      const svg = s('svg', { width: w, height: hgt, viewBox: `0 0 ${w} ${hgt}`, 'aria-hidden': 'true' });
      if (played) {
        const m = monthOf(data, r, myId);
        drawPie(svg, { cx: c1, cy, r: d1 / 2, labels: 'none', gap: 1,
          slices: m.teams.map((x) => ({ value: x.demand, color: x.cashFlow > 0 ? GOOD : x.cashFlow < 0 ? BAD : OTHER, title: x.name })) });
        if (m.revenue > 0) {
          drawPie(svg, { cx: c2, cy, r: (d1 / 2) * growth(m.revenue, base), labels: 'none', gap: 1,
            slices: m.flows.map((f) => ({ value: f.value, color: f.color, title: t('money.' + f.id) })) });
        }
      } else {
        for (const cx of [c1, c2]) {
          svg.append(s('circle', { cx, cy, r: Math.max(1, d1 / 2 - 1), fill: 'none', stroke: '#D3D2CA', 'stroke-dasharray': '3 3' }));
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
      document.fonts?.removeEventListener?.('loadingdone', schedule);
      cancelAnimationFrame(frame);
      if (big) document.removeEventListener('keydown', onKey);
    }
  };
}
