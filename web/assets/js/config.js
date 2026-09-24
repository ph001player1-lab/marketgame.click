// Адреса сервера игры. Публичный ключ — не секрет: он по замыслу уезжает в
// браузер каждому игроку, а база закрыта RLS — ключ сам по себе не может
// ничего. Всё решает функция game.
//
// Локальные тесты подменяют этот файл целиком (tests/ui/server.mjs).

export const CONFIG = {
  supabaseUrl: 'https://fzchwkwyicnjbtjkqack.supabase.co',
  publishableKey: 'sb_publishable_Q7RQ9We4D2h8qEiW1-ISjg_8P_Fq3_p',
  apiUrl: 'https://fzchwkwyicnjbtjkqack.supabase.co/functions/v1/game',
  // Как часто подтягивать свежее состояние, мс.
  pollMs: 8000,
  // Вход без писем — только для локальных тестов.
  testAuth: false
};
