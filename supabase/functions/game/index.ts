// ============================================================================
//  Market Game — API игры v5.0
//  Supabase Edge Function `game`: точка входа.
//
//  Здесь только подключение к Supabase: база, проверка токена входа,
//  заведение почт в Auth. Вся логика — в handler.ts и соседних файлах; их
//  же гоняют тесты на локальной базе, подставляя вместо Supabase заглушки.
//
//  Секреты функции (Supabase → Edge Functions → Secrets):
//    ADMIN_EMAILS     администраторы через запятую;
//                     по умолчанию ph001player1@gmail.com
//    ALLOWED_ORIGINS  сайты, с которых можно звать функцию; по умолчанию
//                     marketgame.click, его адрес на github.io и локальная
//                     разработка
//    DB_URL           строка подключения к базе, если встроенная
//                     SUPABASE_DB_URL не подходит
//    SERVICE_KEY      секретный ключ (sb_secret_…), если встроенного
//                     SUPABASE_SERVICE_ROLE_KEY в проекте нет
// ============================================================================

import postgres from 'npm:postgres@3.4.9';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { createHandler } from './handler.ts';

const env = (k: string) => Deno.env.get(k) ?? '';
const list = (v: string) => v.split(',').map((s) => s.trim()).filter(Boolean);

const sql = postgres(env('DB_URL') || env('SUPABASE_DB_URL'), {
  // Через пулер Supabase подготовленные запросы не работают.
  prepare: false,
  max: 3,
  idle_timeout: 20,
  connect_timeout: 10,
  // Деньги в базе — numeric, счётчики — bigint. Отдаём их числами, иначе
  // postgres.js вернёт строки и сложение превратится в склейку.
  types: {
    numeric: { to: 1700, from: [1700], serialize: (x: unknown) => String(x), parse: (x: string) => Number(x) },
    bigint: { to: 20, from: [20], serialize: (x: unknown) => String(x), parse: (x: string) => Number(x) }
  }
});

const verified = new Map<string, { email: string; until: number }>();

const supabase = createClient(env('SUPABASE_URL'), env('SERVICE_KEY') || env('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false }
});

Deno.serve(createHandler({
  sql,
  adminEmails: list(env('ADMIN_EMAILS') || 'ph001player1@gmail.com').map((e) => e.toLowerCase()),
  allowedOrigins: list(env('ALLOWED_ORIGINS') ||
    'https://marketgame.click,https://www.marketgame.click,https://ph001player1-lab.github.io,' +
    'http://localhost:8080,http://127.0.0.1:8080'),

  // Подпись токена проверяется на месте по открытым ключам проекта
  // (getClaims), без похода в Auth; для старых ключей getClaims сам спросит
  // Auth. Проверенный токен помним до пяти минут: опрос каждые восемь
  // секунд не должен каждый раз проверять его заново.
  async verifyToken(token: string) {
    const now = Date.now();
    const hit = verified.get(token);
    if (hit && hit.until > now) return hit.email;
    const { data, error } = await supabase.auth.getClaims(token);
    const email = data?.claims?.email;
    if (error || typeof email !== 'string' || !email) return null;
    const exp = Number(data.claims.exp) * 1000;
    if (verified.size >= 1000) verified.clear();
    verified.set(token, { email, until: Math.min(Number.isFinite(exp) ? exp : now, now + 5 * 60_000) });
    return email;
  },

  // Самостоятельной регистрации нет: код входа высылается только тем, кого
  // завели здесь. Повторное заведение той же почты — не ошибка.
  async ensureAuthUser(email: string) {
    const { error } = await supabase.auth.admin.createUser({ email, email_confirm: true });
    if (error && !/already|registered|exists/i.test(error.message)) throw error;
  }
}));
