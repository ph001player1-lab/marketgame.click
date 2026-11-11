// QR-код ссылки — svg из квадратиков, без картинок и сторонних сервисов.

import qrcode from '../vendor/qrcode.js';

const NS = 'http://www.w3.org/2000/svg';

/** QR-код текста: svg со стороной size px (с белой рамкой в 2 модуля). */
export function qrSvg(text, size = 220, label = '') {
  const qr = qrcode(0, 'M');
  qr.addData(String(text));
  qr.make();
  const n = qr.getModuleCount();
  const box = n + 4;
  let d = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + 2},${r + 2}h1v1h-1z`;
  }
  const svg = document.createElementNS(NS, 'svg');
  for (const [k, v] of Object.entries({ viewBox: `0 0 ${box} ${box}`, width: size, height: size, role: 'img',
    'aria-label': label || text, 'shape-rendering': 'crispEdges', class: 'qr' })) svg.setAttribute(k, String(v));
  const bg = document.createElementNS(NS, 'rect');
  bg.setAttribute('width', String(box)); bg.setAttribute('height', String(box)); bg.setAttribute('fill', '#fff');
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', d); path.setAttribute('fill', '#000');
  svg.append(bg, path);
  return svg;
}
