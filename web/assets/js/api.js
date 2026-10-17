// Связь с функцией game.
//
// Все запросы — POST с JSON. Действия с деньгами несут requestId: повтор
// при обрыве связи уходит с тем же id, и сервер не спишет деньги дважды.
// Поэтому действия, в отличие от v4.9, можно спокойно повторять, и при
// сбое сервера сайт сам повторяет их несколько раз, прежде чем показать ошибку.
//
// Защита от устаревших ответов (как в v4.9): фоновый опрос, начавшийся до
// действия игрока, мог прийти после него и нарисовать старое состояние.
// Такие ответы отбрасываются.

import { CONFIG } from './config.js';
import { getToken } from './auth.js';

// Сколько раз пробовать: действие игрока — терпеливо, секунд пятнадцать
// (сбой у сервера обычно проходит за несколько секунд, а повтор действия
// безопасен — у него тот же requestId); чтение — три раза; фоновый опрос —
// один: следующий и так придёт через несколько секунд, а лишние повторы
// всех игроков разом только нагружают сервер.
const ATTEMPTS = { act: 5, read: 3, poll: 1 };
// Пауза перед повтором: растёт с каждой попыткой, плюс случайная добавка,
// чтобы повторы разных игроков не совпадали.
const retryDelay = (attempt) => Math.min(5000, 700 * 2 ** (attempt - 1)) * (0.75 + Math.random() * 0.5);

let generation = 0;        // растёт на каждое действие
let inFlight = 0;          // сколько действий сейчас выполняется
let onAuthLost = () => {};

export function setAuthLostHandler(fn) { onAuthLost = fn; }
export const actionsInFlight = () => inFlight;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Адрес функции game. Supabase запускает функцию в регионе, ближайшем к
 * игроку, а база одна — в Калифорнии. Из Азии каждый запрос функции к базе
 * пересекал бы океан, поэтому просим запускать её рядом с базой
 * (forceFunctionRegion): через океан идёт один запрос браузера, а не десяток.
 */
export function endpoint(params = {}) {
  const url = new URL(CONFIG.apiUrl, location.href);
  if (CONFIG.functionRegion) url.searchParams.set('forceFunctionRegion', CONFIG.functionRegion);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  return url.toString();
}

/**
 * Идентификатор нажатия. crypto.randomUUID есть только на https, а сайт
 * могут открыть и по http, пока домен не получил сертификат, — тогда
 * собираем такой же UUID v4 из crypto.getRandomValues.
 */
function newRequestId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const x = [...b].map((v) => v.toString(16).padStart(2, '0')).join('');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}

async function send(body, withAuth, attempts = ATTEMPTS.read) {
  const headers = { 'content-type': 'application/json', apikey: CONFIG.publishableKey };
  if (withAuth) {
    const token = await getToken();
    if (token) headers.authorization = 'Bearer ' + token;
  }
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(endpoint(), {
        method: 'POST', headers, body: JSON.stringify(body), cache: 'no-store'
      });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { throw new Error('bad_response ' + res.status); }
      if (res.status >= 500) throw new Error('server ' + res.status);
      if (data && data.error === 'auth_required') onAuthLost();
      return data;
    } catch (e) {
      lastError = e;
      if (attempt < attempts) await sleep(retryDelay(attempt));
    }
  }
  return { ok: false, error: /server|bad_response/.test(String(lastError)) ? 'server_error' : 'network' };
}

/** Чтение: табло, кабинет, пульт. */
export function read(action, params = {}, { auth = true, attempts = ATTEMPTS.read } = {}) {
  return send({ action, ...params }, auth, attempts);
}

/** Действие: один requestId на все повторы. */
export async function act(action, params = {}) {
  generation++;
  inFlight++;
  try {
    return await send({ action, requestId: newRequestId(), ...params }, true, ATTEMPTS.act);
  } finally {
    inFlight--;
  }
}

/**
 * Фоновый опрос. Возвращает null, если ответ устарел: пока он шёл, игрок
 * успел что-то сделать, и свежее состояние уже пришло с ответом на действие.
 */
let pollSeq = 0;
let lastShownSeq = 0;
export async function poll(action, params = {}, opts = {}) {
  if (inFlight > 0) return null;
  const seq = ++pollSeq;
  const gen = generation;
  const data = await read(action, params, { ...opts, attempts: ATTEMPTS.poll });
  if (gen !== generation || seq < lastShownSeq) return null;
  lastShownSeq = seq;
  return data;
}

/** Состояние пришло с ответом на действие — оно свежее любого начатого опроса. */
export function markFresh() { lastShownSeq = ++pollSeq; }
