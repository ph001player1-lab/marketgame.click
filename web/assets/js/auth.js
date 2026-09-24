// Вход по коду на почту через Supabase Auth.
//
// 1. Функция игры проверяет, внесена ли почта (preflightLogin). Код уходит
//    только тем, кого добавил ведущий или администратор.
// 2. Supabase высылает 6 цифр; игрок вводит их на этой же странице — так
//    удобно, даже если письмо открыли на телефоне, а играют с ноутбука.
// 3. Сессия хранится в браузере и продлевается сама.
//
// В локальных тестах (CONFIG.testAuth) писем нет: подходит любой код, а
// токеном служит «test:почта», который понимает тестовый сервер.

import { CONFIG } from './config.js';

const TEST_KEY = 'mg-test-email';

// Клиент входа Supabase лежит в самом сайте (npm run vendor), а не
// грузится с CDN: в сетях, где CDN закрыт, вход не сломается. Он нужен
// только для входа, поэтому модуль грузится лишь тогда, когда нужен.
let clientPromise = null;

function supabase() {
  if (!clientPromise) {
    clientPromise = import('./vendor/supabase-auth.js').then(({ AuthClient }) => ({
      // Те же заголовки, что ставит supabase-js своему клиенту входа.
      auth: new AuthClient({
        url: CONFIG.supabaseUrl + '/auth/v1',
        headers: { Authorization: 'Bearer ' + CONFIG.publishableKey, apikey: CONFIG.publishableKey },
        storageKey: 'mg-auth', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false
      })
    }));
  }
  return clientPromise;
}

function storage() {
  try { return window.localStorage; } catch { return null; }
}

export async function getToken() {
  if (CONFIG.testAuth) {
    const email = storage()?.getItem(TEST_KEY);
    return email ? 'test:' + email : null;
  }
  const sb = await supabase();
  const { data } = await sb.auth.getSession();
  return data?.session?.access_token ?? null;
}

export async function currentEmail() {
  if (CONFIG.testAuth) return storage()?.getItem(TEST_KEY) ?? null;
  const sb = await supabase();
  const { data } = await sb.auth.getSession();
  return data?.session?.user?.email ?? null;
}

/** Шаг 1: проверка почты и отправка кода. Возвращает { ok } или { ok:false, error }. */
export async function requestCode(email, preflight) {
  const pre = await preflight(email);
  if (!pre.ok) return pre;
  if (CONFIG.testAuth) return { ok: true };
  const sb = await supabase();
  const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  if (!error) return { ok: true };
  if (error.status === 429 || /security purposes|rate limit/i.test(error.message)) return { ok: false, error: 'rate_limited' };
  if (/signups not allowed|not found/i.test(error.message)) return { ok: false, error: 'not_registered' };
  return { ok: false, error: 'network' };
}

/** Шаг 2: код из письма. */
export async function verifyCode(email, code) {
  const token = String(code).replace(/\D/g, '');
  if (CONFIG.testAuth) {
    if (token.length !== 6) return { ok: false, error: 'bad_code_otp' };
    storage()?.setItem(TEST_KEY, email);
    return { ok: true };
  }
  const sb = await supabase();
  const { error } = await sb.auth.verifyOtp({ email, token, type: 'email' });
  if (!error) return { ok: true };
  if (error.status === 429) return { ok: false, error: 'rate_limited' };
  return { ok: false, error: 'bad_code_otp' };
}

export async function signOut() {
  if (CONFIG.testAuth) { storage()?.removeItem(TEST_KEY); return; }
  const sb = await supabase();
  await sb.auth.signOut();
}
