// Графики на SVG без сторонних библиотек: линии, столбцы и схема
// «Куда ушли деньги». Сайт открывают с телефона в зале с плохой связью —
// лишние 200 КБ библиотеки ни к чему.
//
// Правила взяты из навыка dataviz, палитра проверена его валидатором на фоне
// карточки #FBFAF6:
//   • цвета серий идут в постоянном порядке и закреплены за командой, а не
//     за её местом: команда не перекрашивается, когда другие уходят;
//   • девятая серия и дальше не получает нового цвета — она серая, «Other»;
//   • одна ось Y; величины разного масштаба — на разных графиках;
//   • линии 2px, своя команда 3px и поверх остальных; точки при наведении
//     8px с кольцом цвета фона; между сегментами столбцов зазор 2px, концы
//     столбцов скруглены на 4px;
//   • подписи и значения — цветом текста; цвет несёт только метка рядом;
//   • легенда при двух сериях и больше; подписи у концов линий, если серий
//     не больше четырёх; подсказка с перекрестьем мышью, пальцем и
//     стрелками клавиатуры.
// Жёлтый, зелёный и розовый слабо контрастны с фоном (2–2.7:1), поэтому у
// каждого графика табло есть таблица с теми же числами.

import { h, replace } from './dom.js';

export const PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];
export const OTHER = '#A9A8A0';
export const INK = '#16161A';
const GRID = '#E4E3DC';
const AXIS = '#9C9B93';
const SURFACE = '#FBFAF6';

const NS = 'http://www.w3.org/2000/svg';

function s(tag, attrs, ...kids) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    el.setAttribute(k, String(v));
  }
  for (const c of kids.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

let measureCtx = null;
/** Ширина текста в пикселях — чтобы подписи оси не наезжали на график. */
export function textWidth(text, size = 12, weight = 600) {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  measureCtx.font = `${weight} ${size}px Manrope, system-ui, sans-serif`;
  return measureCtx.measureText(String(text)).width;
}

function shorten(text, max) {
  const t = String(text ?? '');
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}

/** Круглые деления оси: 0, 5k, 10k… */
export function niceScale(min, max, count) {
  if (!(max > min)) {
    if (min === 0) max = 1;
    else { const pad = Math.abs(min) * 0.2; min -= pad; max += pad; }
  }
  const raw = (max - min) / Math.max(1, count);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const r = raw / mag;
  const step = (r > 5 ? 10 : r > 2 ? 5 : r > 1 ? 2 : 1) * mag;
  const fix = (v) => Number((Math.round(v / step) * step).toFixed(10));
  const lo = fix(Math.floor(min / step + 1e-9) * step);
  let hi = fix(Math.ceil(max / step - 1e-9) * step);
  if (hi <= lo) hi = fix(lo + step);
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(fix(v));
  return { lo, hi, ticks, step };
}

/** Цвет команды по её постоянному номеру в игре. */
export function seriesColor(index) {
  return index < PALETTE.length ? PALETTE[index] : OTHER;
}

// ----------------------------------------------------------------- каркас графика

/**
 * Общее для всех графиков: легенда, область рисования, подсказка, реакция
 * на изменение ширины, мышь, палец и клавиатура.
 */
function frame(box, cfg, series, hooks) {
  let focus = null;
  const big = !!cfg.big;

  // Легенда: у серых серий один общий пункт.
  let legendEl = null;
  const legendButtons = [];
  if (series.length >= 2 && cfg.legend !== false) {
    const colored = series.filter((se) => se.color !== OTHER);
    const gray = series.filter((se) => se.color === OTHER);
    legendEl = h('div', { class: 'legend', role: 'group', 'aria-label': cfg.legendLabel || 'Legend' },
      colored.map((se) => {
        const b = h('button', {
          class: ['legend__item', se.emphasis ? 'is-mine' : null], type: 'button', 'aria-pressed': 'false',
          title: 'Highlight ' + se.name,
          onclick: () => { focus = focus === se.key ? null : se.key; sync(); hooks.redraw(); }
        }, h('i', { class: 'legend__swatch', style: { background: se.color } }), se.name);
        b.dataset.key = se.key;
        legendButtons.push(b);
        return b;
      }),
      gray.length ? h('span', { class: 'legend__item legend__item--static' },
        h('i', { class: 'legend__swatch', style: { background: OTHER } }),
        (cfg.otherLabel || 'Other') + ' (' + gray.length + ')') : null);
  }
  function sync() {
    for (const b of legendButtons) {
      b.setAttribute('aria-pressed', b.dataset.key === focus ? 'true' : 'false');
      b.classList.toggle('is-dim', !!focus && b.dataset.key !== focus);
    }
  }

  const plot = h('div', {
    class: 'chart__plot', tabindex: '0', role: 'img', 'aria-label': cfg.label || '',
    style: { height: cfg.height || (big ? 'min(56vh, 560px)' : '260px') }
  });
  const tip = h('div', { class: 'chart__tip', hidden: true });
  plot.append(tip);
  const root = h('div', { class: ['chart', big ? 'chart--big' : null] }, legendEl, plot);
  box.append(root);

  let svg = null;
  let width = 0;
  let height = 0;

  function setSvg(el) {
    if (svg) svg.remove();
    svg = el;
    if (el) plot.insertBefore(el, tip);
  }

  function showTip(nodes, x, y) {
    replace(tip, nodes);
    tip.hidden = false;
    const pw = plot.clientWidth;
    const ph = plot.clientHeight;
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    let left = x + 14;
    if (left + tw > pw - 2) left = x - 14 - tw;
    if (left < 2) left = clamp(pw - tw - 2, 2, pw);
    tip.style.left = Math.round(left) + 'px';
    tip.style.top = Math.round(clamp(y - th / 2, 2, Math.max(2, ph - th - 2))) + 'px';
  }
  function hideTip() { tip.hidden = true; hooks.clearHover?.(); }

  const ro = new ResizeObserver(() => {
    const w = plot.clientWidth;
    const hh = plot.clientHeight;
    if (Math.abs(w - width) < 1 && Math.abs(hh - height) < 1) return;
    width = w;
    height = hh;
    hooks.redraw();
  });
  ro.observe(plot);

  const pos = (e) => {
    const r = plot.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  plot.addEventListener('pointermove', (e) => hooks.hover?.(pos(e), e));
  plot.addEventListener('pointerdown', (e) => hooks.hover?.(pos(e), e));
  plot.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hideTip(); });
  plot.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { hideTip(); return; }
    if (hooks.key && hooks.key(e.key)) e.preventDefault();
  });
  plot.addEventListener('blur', () => hideTip());
  // Палец: подсказка держится, пока не коснёшься другого места.
  const outside = (e) => { if (!plot.contains(e.target)) hideTip(); };
  document.addEventListener('pointerdown', outside);

  return {
    root, plot, tip, big,
    get focus() { return focus; },
    setSvg, showTip, hideTip,
    size: () => ({ W: plot.clientWidth, H: plot.clientHeight }),
    destroy() { ro.disconnect(); document.removeEventListener('pointerdown', outside); root.remove(); }
  };
}

function tipHeader(text) { return h('div', { class: 'chart__tip-head' }, text); }
function tipRow(color, name, value, strong) {
  return h('div', { class: ['chart__tip-row', strong ? 'is-strong' : null] },
    color ? h('i', { style: { background: color } }) : h('i', { class: 'is-blank' }),
    h('span', {}, name), h('b', {}, value));
}

/** Сколько месяцев пропускать между подписями оси X, чтобы они не слиплись. */
function xEvery(n, pw, fs) {
  if (n <= 1) return 1;
  const need = textWidth('36', fs) + 12;
  const per = pw / (n - 1);
  for (const k of [1, 2, 3, 4, 6, 12]) if (per * k >= need) return k;
  return 12;
}

// ----------------------------------------------------------------- линии

/**
 * lineChart(box, {
 *   x: [1, 2, 3],                                   месяцы
 *   series: [{ key, name, color, values, emphasis }], values[i] — число или null (разрыв)
 *   fmt, tick, zero, label, height, big, xLabel, otherLabel
 * }) → { destroy }
 */
export function lineChart(box, cfg) {
  const xs = cfg.x;
  const n = xs.length;
  const series = cfg.series;
  const fmt = cfg.fmt || String;
  const tick = cfg.tick || fmt;
  const xLabel = cfg.xLabel || ((x) => 'Month ' + x);
  let geo = null;
  let idx = null;
  let cross = null;

  const f = frame(box, cfg, series, {
    redraw: draw,
    hover(p) {
      if (!geo) return;
      const i = n <= 1 ? 0 : Math.round(((p.x - geo.left) / geo.pw) * (n - 1));
      setIdx(clamp(i, 0, n - 1));
    },
    key(k) {
      if (!n) return false;
      if (k === 'ArrowRight') setIdx(idx === null ? n - 1 : Math.min(n - 1, idx + 1));
      else if (k === 'ArrowLeft') setIdx(idx === null ? n - 1 : Math.max(0, idx - 1));
      else if (k === 'Home') setIdx(0);
      else if (k === 'End') setIdx(n - 1);
      else return false;
      return true;
    },
    clearHover() { idx = null; if (cross) replace(cross); }
  });
  const fs = f.big ? 15 : 12;

  function draw() {
    const { W, H } = f.size();
    if (W < 60 || H < 60) return;
    const all = series.flatMap((se) => se.values).filter(isNum);
    if (!all.length || !n) {
      f.setSvg(null);
      geo = null;
      return;
    }
    let min = Math.min(...all);
    let max = Math.max(...all);
    if (cfg.zero !== false) { min = Math.min(0, min); max = Math.max(0, max); }
    const sc = niceScale(min, max, clamp(Math.round((H - 40) / 55), 2, 6));
    const tickText = sc.ticks.map((v) => tick(v));
    const left = Math.ceil(Math.max(...tickText.map((t) => textWidth(t, fs)))) + 12;

    const showEnds = cfg.endLabels !== false && series.length >= 2 && series.length <= 4 && W >= 320;
    const endNames = series.map((se) => shorten(se.name, f.big ? 22 : 16));
    const right = showEnds ? Math.ceil(Math.max(...endNames.map((t) => textWidth(t, fs, 700)))) + 22 : 14;
    const top = 12;
    const bottom = fs + 16;
    const pw = Math.max(40, W - left - right);
    const ph = Math.max(40, H - top - bottom);
    const X = (i) => left + (n <= 1 ? pw / 2 : (i * pw) / (n - 1));
    const Y = (v) => top + ph - ((v - sc.lo) / (sc.hi - sc.lo)) * ph;
    geo = { left, top, pw, ph, X, Y };

    const svg = s('svg', { class: 'chart__svg', width: W, height: H, viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true' });

    // Сетка и подписи оси Y. Нулевая линия темнее: ниже — убыток.
    sc.ticks.forEach((v, k) => {
      const y = Math.round(Y(v)) + 0.5;
      svg.append(s('line', { x1: left, x2: left + pw, y1: y, y2: y, stroke: v === 0 ? AXIS : GRID, 'stroke-width': 1 }));
      svg.append(s('text', { class: 'chart__tick', x: left - 8, y: y + fs * 0.35, 'text-anchor': 'end' }, tickText[k]));
    });
    // Ось X — номера месяцев.
    const every = xEvery(n, pw, fs);
    const baseY = top + ph + fs + 6;
    for (let i = 0; i < n; i++) {
      if (i % every !== 0) continue;
      svg.append(s('text', { class: 'chart__tick', x: X(i), y: baseY, 'text-anchor': 'middle' }, xs[i]));
    }
    svg.append(s('text', { class: 'chart__tick chart__axis-name', x: left - 8, y: baseY, 'text-anchor': 'end' }, cfg.xName || 'Mo'));

    // Серые — под цветными, своя команда и выделенная — поверх всех.
    const rank = (se) => (se.key === f.focus ? 3 : se.emphasis ? 2 : se.color === OTHER ? 0 : 1);
    const ordered = [...series].sort((a, b) => rank(a) - rank(b));
    for (const se of ordered) {
      const dim = f.focus && f.focus !== se.key;
      const w = se.emphasis || se.key === f.focus ? 3 : 2;
      let d = '';
      let run = 0;
      let lastI = -1;
      const singles = [];
      se.values.forEach((v, i) => {
        if (!isNum(v)) {
          if (run === 1) singles.push(lastI);
          run = 0;
          return;
        }
        d += (run === 0 ? 'M' : 'L') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1) + ' ';
        run++;
        lastI = i;
      });
      if (run === 1) singles.push(lastI);
      const g = s('g', { opacity: dim ? 0.16 : 1 });
      if (d) g.append(s('path', { d, fill: 'none', stroke: se.color, 'stroke-width': w, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
      for (const i of singles) g.append(s('circle', { cx: X(i), cy: Y(se.values[i]), r: w, fill: se.color }));
      svg.append(g);
    }

    // Подписи у концов линий, раздвинутые, чтобы не наезжали друг на друга.
    if (showEnds) {
      const items = series.map((se, k) => {
        let i = se.values.length - 1;
        while (i >= 0 && !isNum(se.values[i])) i--;
        return i < 0 ? null : { se, name: endNames[k], y: Y(se.values[i]) };
      }).filter(Boolean).sort((a, b) => a.y - b.y);
      const gap = fs + 4;
      items.forEach((it, k) => { it.ly = k ? Math.max(it.y, items[k - 1].ly + gap) : Math.max(it.y, top + fs / 2); });
      for (let k = items.length - 1; k >= 0; k--) {
        const limit = k === items.length - 1 ? top + ph : items[k + 1].ly - gap;
        items[k].ly = Math.min(items[k].ly, limit);
      }
      for (const it of items) {
        const dim = f.focus && f.focus !== it.se.key;
        const x = left + pw + 8;
        svg.append(s('g', { opacity: dim ? 0.3 : 1 },
          s('circle', { cx: x + 3, cy: it.ly, r: 3.5, fill: it.se.color }),
          s('text', { class: 'chart__end', x: x + 11, y: it.ly + fs * 0.35 }, it.name)));
      }
    }

    cross = s('g', { class: 'chart__cross' });
    svg.append(cross);
    f.setSvg(svg);
    if (idx !== null) setIdx(Math.min(idx, n - 1));
  }

  function setIdx(i) {
    idx = i;
    if (!geo || !cross) return;
    const { X, Y, top, ph } = geo;
    const x = X(i);
    replace(cross);
    cross.append(s('line', { x1: x, x2: x, y1: top, y2: top + ph, stroke: INK, 'stroke-opacity': 0.35, 'stroke-width': 1 }));
    const rows = [];
    for (const se of series) {
      const v = se.values[i];
      const dim = f.focus && f.focus !== se.key;
      if (isNum(v) && !dim) {
        cross.append(s('circle', { cx: x, cy: Y(v), r: 4, fill: se.color, stroke: SURFACE, 'stroke-width': 2 }));
      }
      rows.push({ se, v });
    }
    rows.sort((a, b) => (isNum(b.v) ? b.v : -Infinity) - (isNum(a.v) ? a.v : -Infinity));
    const limit = 9;
    let shown = rows.slice(0, limit);
    const mine = rows.find((r) => r.se.emphasis);
    if (mine && !shown.includes(mine)) shown = [...shown.slice(0, limit - 1), mine];
    const nodes = [tipHeader(xLabel(xs[i]))];
    for (const r of shown) {
      nodes.push(tipRow(r.se.color, shorten(r.se.name, 24), isNum(r.v) ? fmt(r.v) : (cfg.nullText || '—'), r.se.emphasis));
    }
    if (rows.length > shown.length) nodes.push(h('div', { class: 'chart__tip-more' }, '+' + (rows.length - shown.length) + ' more'));
    const ys = rows.filter((r) => isNum(r.v)).map((r) => Y(r.v));
    f.showTip(nodes, x, ys.length ? (Math.min(...ys) + Math.max(...ys)) / 2 : top + ph / 2);
  }

  draw();
  return { destroy: f.destroy, root: f.root };
}

// ----------------------------------------------------------------- столбцы

function barPath(x, y, w, hgt, rt, rb) {
  rt = Math.max(0, Math.min(rt, w / 2, hgt));
  rb = Math.max(0, Math.min(rb, w / 2, hgt - rt));
  return `M${x},${y + rt}` +
    (rt ? `a${rt},${rt} 0 0 1 ${rt},${-rt}` : '') + `h${w - 2 * rt}` +
    (rt ? `a${rt},${rt} 0 0 1 ${rt},${rt}` : '') + `v${hgt - rt - rb}` +
    (rb ? `a${rb},${rb} 0 0 1 ${-rb},${rb}` : '') + `h${-(w - 2 * rb)}` +
    (rb ? `a${rb},${rb} 0 0 1 ${-rb},${-rb}` : '') + 'z';
}

/**
 * barChart(box, { x, series: [{ key, name, color, values }], fmt, tick, label,
 *                 height, big, totalLabel }) → { destroy }
 * Серии складываются: плюс — вверх от нуля, минус — вниз.
 */
export function barChart(box, cfg) {
  const xs = cfg.x;
  const n = xs.length;
  const series = cfg.series;
  const fmt = cfg.fmt || String;
  const tick = cfg.tick || fmt;
  const xLabel = cfg.xLabel || ((x) => 'Month ' + x);
  let geo = null;
  let idx = null;
  let cross = null;

  const f = frame(box, cfg, series, {
    redraw: draw,
    hover(p) {
      if (!geo) return;
      setIdx(clamp(Math.floor((p.x - geo.left) / geo.band), 0, n - 1));
    },
    key(k) {
      if (!n) return false;
      if (k === 'ArrowRight') setIdx(idx === null ? n - 1 : Math.min(n - 1, idx + 1));
      else if (k === 'ArrowLeft') setIdx(idx === null ? n - 1 : Math.max(0, idx - 1));
      else if (k === 'Home') setIdx(0);
      else if (k === 'End') setIdx(n - 1);
      else return false;
      return true;
    },
    clearHover() { idx = null; if (cross) replace(cross); }
  });
  const fs = f.big ? 15 : 12;

  function stackAt(i) {
    let pos = 0;
    let neg = 0;
    const segs = [];
    for (const se of series) {
      const v = Number(se.values[i]) || 0;
      if (!v) continue;
      if (v > 0) { segs.push({ se, v, a: pos, b: pos + v }); pos += v; }
      else { segs.push({ se, v, a: neg, b: neg + v }); neg += v; }
    }
    return { segs, pos, neg };
  }

  function draw() {
    const { W, H } = f.size();
    if (W < 60 || H < 60) return;
    if (!n) { f.setSvg(null); geo = null; return; }
    const stacks = xs.map((_, i) => stackAt(i));
    const min = Math.min(0, ...stacks.map((st) => st.neg));
    const max = Math.max(0, ...stacks.map((st) => st.pos));
    const sc = niceScale(min, max, clamp(Math.round((H - 40) / 55), 2, 6));
    const tickText = sc.ticks.map((v) => tick(v));
    const left = Math.ceil(Math.max(...tickText.map((t) => textWidth(t, fs)))) + 12;
    const right = 10;
    const top = 12;
    const bottom = fs + 16;
    const pw = Math.max(40, W - left - right);
    const ph = Math.max(40, H - top - bottom);
    const band = pw / n;
    const bw = Math.max(2, Math.min(band * 0.7, f.big ? 56 : 36));
    const Y = (v) => top + ph - ((v - sc.lo) / (sc.hi - sc.lo)) * ph;
    geo = { left, top, pw, ph, band, Y };

    const svg = s('svg', { class: 'chart__svg', width: W, height: H, viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true' });
    sc.ticks.forEach((v, k) => {
      const y = Math.round(Y(v)) + 0.5;
      svg.append(s('line', { x1: left, x2: left + pw, y1: y, y2: y, stroke: v === 0 ? AXIS : GRID, 'stroke-width': 1 }));
      svg.append(s('text', { class: 'chart__tick', x: left - 8, y: y + fs * 0.35, 'text-anchor': 'end' }, tickText[k]));
    });
    const every = n <= 1 ? 1 : (() => { const need = textWidth('36', fs) + 10; for (const k of [1, 2, 3, 4, 6, 12]) if (band * k >= need) return k; return 12; })();
    const baseY = top + ph + fs + 6;
    for (let i = 0; i < n; i++) {
      if (i % every !== 0) continue;
      svg.append(s('text', { class: 'chart__tick', x: left + band * (i + 0.5), y: baseY, 'text-anchor': 'middle' }, xs[i]));
    }
    svg.append(s('text', { class: 'chart__tick chart__axis-name', x: left - 8, y: baseY, 'text-anchor': 'end' }, cfg.xName || 'Mo'));

    stacks.forEach((st, i) => {
      const x = left + band * i + (band - bw) / 2;
      const pos = st.segs.filter((g) => g.v > 0);
      const neg = st.segs.filter((g) => g.v < 0);
      for (const [list, up] of [[pos, true], [neg, false]]) {
        list.forEach((g, k) => {
          const dim = f.focus && f.focus !== g.se.key;
          let y1 = Y(up ? g.b : g.a);
          let y2 = Y(up ? g.a : g.b);
          // Зазор 2px между сегментами: по 1px с каждой стороны стыка.
          if (y2 - y1 > 3) {
            if (k > 0) { if (up) y2 -= 1; else y1 += 1; }
            if (k < list.length - 1) { if (up) y1 += 1; else y2 -= 1; }
          }
          const hgt = Math.max(1, y2 - y1);
          const outer = k === list.length - 1;
          svg.append(s('path', {
            d: barPath(x, y1, bw, hgt, up && outer ? 4 : 0, !up && outer ? 4 : 0),
            fill: g.se.color, opacity: dim ? 0.2 : 1
          }));
        });
      }
    });

    cross = s('g', { class: 'chart__cross' });
    svg.append(cross);
    f.setSvg(svg);
    if (idx !== null) setIdx(Math.min(idx, n - 1));
  }

  function setIdx(i) {
    idx = i;
    if (!geo || !cross) return;
    const { left, top, ph, band, Y } = geo;
    replace(cross);
    cross.append(s('rect', { x: left + band * i, y: top, width: band, height: ph, fill: INK, 'fill-opacity': 0.06 }));
    const st = stackAt(i);
    const nodes = [tipHeader(xLabel(xs[i]))];
    const rows = series.map((se) => ({ se, v: Number(se.values[i]) || 0 })).filter((r) => r.v !== 0);
    if (!rows.length) nodes.push(h('div', { class: 'chart__tip-more' }, cfg.emptyText || 'Nothing this month'));
    for (const r of rows) nodes.push(tipRow(r.se.color, r.se.name, fmt(r.v)));
    if (series.length > 1 && rows.length > 1) nodes.push(tipRow(null, cfg.totalLabel || 'Total', fmt(st.pos + st.neg), true));
    f.showTip(nodes, left + band * (i + 0.5), (Y(st.pos) + Y(st.neg)) / 2);
  }

  draw();
  return { destroy: f.destroy, root: f.root };
}

// ----------------------------------------------------------------- «Куда ушли деньги»

/**
 * Схема потоков в три колонки: откуда деньги пришли → кто их собрал →
 * куда они ушли. sankey(box, {
 *   nodes: [{ id, name, col, color }], links: [{ source, target, value }],
 *   fmt, label, height, big, share(value) → строка «12%»
 * }) → { destroy }
 */
export function sankey(box, cfg) {
  const fmt = cfg.fmt || String;
  const nodes = cfg.nodes.map((nd) => ({ ...nd, inV: 0, outV: 0 }));
  const byId = new Map(nodes.map((nd) => [nd.id, nd]));
  const links = cfg.links.filter((l) => l.value > 0 && byId.has(l.source) && byId.has(l.target))
    .map((l) => ({ ...l, s: byId.get(l.source), t: byId.get(l.target) }));
  for (const l of links) { l.s.outV += l.value; l.t.inV += l.value; }
  const live = nodes.filter((nd) => nd.inV > 0 || nd.outV > 0);
  const cols = Math.max(...live.map((nd) => nd.col)) + 1;

  const f = frame(box, { ...cfg, legend: false }, [], {
    redraw: draw,
    hover(p, e) {
      const el = e.target.closest?.('[data-link],[data-node]');
      if (!el) { f.tip.hidden = true; return; }
      const nodesOut = [];
      if (el.dataset.link !== undefined) {
        const l = links[Number(el.dataset.link)];
        nodesOut.push(tipHeader(l.s.name + ' → ' + l.t.name), tipRow(l.t.color, fmt(l.value), cfg.share ? cfg.share(l.value) : ''));
      } else {
        const nd = live[Number(el.dataset.node)];
        nodesOut.push(tipHeader(nd.name), tipRow(nd.color, fmt(Math.max(nd.inV, nd.outV)), cfg.share ? cfg.share(Math.max(nd.inV, nd.outV)) : ''));
      }
      f.showTip(nodesOut, p.x, p.y);
    }
  });
  const fs = f.big ? 15 : 12;

  function draw() {
    const { W, H } = f.size();
    if (W < 120 || H < 120 || !links.length) { f.setSvg(null); return; }
    const value = (nd) => Math.max(nd.inV, nd.outV);
    const last = live.filter((nd) => nd.col === cols - 1);
    const labelOf = (nd) => nd.name + '  ' + fmt(value(nd));
    const right = Math.min(W * 0.46, Math.ceil(Math.max(...last.map((nd) => textWidth(labelOf(nd), fs, 700)))) + 18);
    const top = fs * 2 + 10;
    const bottom = 6;
    const nodeW = f.big ? 16 : 12;
    const ph = H - top - bottom;
    const pw = W - right - 6;
    const colX = (c) => 6 + (cols === 1 ? 0 : (c * (pw - nodeW)) / (cols - 1));

    const gap = f.big ? 10 : 7;
    let k = Infinity;
    for (let c = 0; c < cols; c++) {
      const list = live.filter((nd) => nd.col === c);
      const total = list.reduce((a, nd) => a + value(nd), 0);
      if (total > 0) k = Math.min(k, (ph - gap * (list.length - 1)) / total);
    }
    // Колонки выравниваем по центру самой высокой — как у реки с притоками.
    for (let c = 0; c < cols; c++) {
      const list = live.filter((nd) => nd.col === c);
      const used = list.reduce((a, nd) => a + Math.max(1, value(nd) * k), 0) + gap * (list.length - 1);
      let y = top + (ph - used) / 2;
      for (const nd of list) {
        nd.x = colX(c);
        nd.y = y;
        nd.h = Math.max(1, value(nd) * k);
        y += nd.h + gap;
        nd.outOff = 0;
        nd.inOff = 0;
      }
    }

    const svg = s('svg', { class: 'chart__svg sankey', width: W, height: H, viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true' });
    links.forEach((l, i) => {
      const w = Math.max(1, l.value * k);
      const y0 = l.s.y + l.s.outOff + w / 2;
      const y1 = l.t.y + l.t.inOff + w / 2;
      l.s.outOff += w;
      l.t.inOff += w;
      const x0 = l.s.x + nodeW;
      const x1 = l.t.x;
      const xm = (x0 + x1) / 2;
      const path = s('path', {
        d: `M${x0},${y0} C${xm},${y0} ${xm},${y1} ${x1},${y1}`,
        fill: 'none', stroke: l.t.color, 'stroke-opacity': 0.34, 'stroke-width': w, class: 'sankey__link'
      });
      path.dataset.link = String(i);
      svg.append(path);
    });
    live.forEach((nd, i) => {
      const r = s('rect', { x: nd.x, y: nd.y, width: nodeW, height: nd.h, rx: 2, fill: nd.color, class: 'sankey__node' });
      r.dataset.node = String(i);
      svg.append(r);
    });

    // Подписи: у первых колонок — над узлом, у последней — справа, раздвинутые.
    for (const nd of live.filter((x) => x.col < cols - 1)) {
      const anchorMid = nd.col > 0;
      const x = anchorMid ? nd.x + nodeW / 2 : nd.x;
      svg.append(s('text', { x, y: nd.y - fs - 4, 'text-anchor': anchorMid ? 'middle' : 'start', class: 'sankey__name' }, nd.name));
      svg.append(s('text', { x, y: nd.y - 5, 'text-anchor': anchorMid ? 'middle' : 'start', class: 'sankey__val' }, fmt(value(nd))));
    }
    const items = last.map((nd) => ({ nd, y: nd.y + nd.h / 2 })).sort((a, b) => a.y - b.y);
    const lg = fs + 3;
    items.forEach((it, i) => { it.ly = i ? Math.max(it.y, items[i - 1].ly + lg) : Math.max(it.y, fs / 2 + 2); });
    for (let i = items.length - 1; i >= 0; i--) {
      const limit = i === items.length - 1 ? H - 4 : items[i + 1].ly - lg;
      items[i].ly = Math.min(items[i].ly, limit);
    }
    for (const it of items) {
      const x = it.nd.x + nodeW + 6;
      if (Math.abs(it.ly - it.y) > 2) {
        svg.append(s('path', { d: `M${x - 4},${it.y} L${x + 2},${it.ly}`, stroke: AXIS, 'stroke-width': 1, fill: 'none' }));
      }
      svg.append(s('text', { x: x + 4, y: it.ly + fs * 0.35, class: 'sankey__name' },
        it.nd.name, s('tspan', { class: 'sankey__val', dx: 6 }, fmt(value(it.nd)))));
    }
    f.setSvg(svg);
  }

  draw();
  return { destroy: f.destroy, root: f.root };
}
