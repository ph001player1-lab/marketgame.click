// Маленькие помощники для разметки. Текст всегда вставляется как текст, а
// не как HTML: название ресторана придумывает игрок, и оно не должно
// превратиться в кусок страницы.

/**
 * h('button', { class: 'btn', onclick: fn }, 'Send') → элемент.
 * Дети: строки, числа, элементы, массивы; null и false пропускаются.
 */
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = Array.isArray(v) ? v.filter(Boolean).join(' ') : v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'hidden') el[k] = !!v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function clear(el) { while (el && el.firstChild) el.removeChild(el.firstChild); return el; }

export function replace(el, ...children) { clear(el); append(el, children); return el; }

// ----------------------------------------------------------------- уведомления

let toastBox = null;

/** Короткое сообщение внизу экрана. Для экранных читалок — live-регион. */
export function toast(message, kind = 'info', ms = 4200) {
  if (!toastBox) {
    toastBox = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
    document.body.append(toastBox);
  }
  const item = h('div', { class: ['toast', 'toast--' + kind] }, message);
  toastBox.append(item);
  setTimeout(() => { item.classList.add('toast--out'); setTimeout(() => item.remove(), 300); }, ms);
}

/** Подтверждение своим окном: системное confirm() в мобильных браузерах выглядит чужим. */
export function confirmDialog(message, { ok = 'OK', cancel = 'Cancel', danger = false } = {}) {
  return new Promise((resolve) => {
    const dlg = h('dialog', { class: 'dialog' },
      h('p', { class: 'dialog__text' }, message),
      h('div', { class: 'dialog__actions' },
        h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => close(false) }, cancel),
        h('button', { class: ['btn', danger ? 'btn--danger' : 'btn--primary'], type: 'button', onclick: () => close(true) }, ok)
      )
    );
    function close(v) { dlg.close(); dlg.remove(); resolve(v); }
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(false); });
    document.body.append(dlg);
    dlg.showModal();
  });
}

/**
 * Кнопка на время действия: заблокирована, с текстом «…». Возвращает
 * результат действия. Двойное нажатие ничего не отправит второй раз.
 */
export async function busy(button, fn, text = '…') {
  if (!button || button.disabled) return undefined;
  const label = button.textContent;
  button.disabled = true;
  button.classList.add('is-busy');
  button.textContent = text;
  try {
    return await fn();
  } finally {
    button.disabled = false;
    button.classList.remove('is-busy');
    button.textContent = label;
  }
}

/** Поле с подписью. */
export function field(label, input, hint) {
  const id = input.id || ('f' + Math.random().toString(36).slice(2, 9));
  input.id = id;
  return h('div', { class: 'field' },
    h('label', { class: 'field__label', for: id }, label),
    input,
    hint ? h('div', { class: 'field__hint' }, hint) : null
  );
}

/** Поле для суммы в долларах: цифровая клавиатура на телефоне. */
export function moneyInput(attrs = {}) {
  return h('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', class: 'input', ...attrs });
}

export function card(title, ...body) {
  return h('section', { class: 'card' }, title ? h('h3', { class: 'card__title' }, title) : null, ...body);
}
