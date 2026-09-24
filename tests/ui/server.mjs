// Локальный стенд сайта: папка web/ и функция game на обычном PostgreSQL.
//
//   npm run build && node tests/ui/server.mjs      → http://localhost:8080
//
// Вход тестовый: писем нет, подходит любой код из шести цифр, а почта
// администратора — ph001player1@gmail.com (как в настоящем проекте).
// Файл config.js подменяется на лету — настоящий в репозитории не трогаем.

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { freshDatabase } from '../api/harness.mjs';
import { createHandler } from '../../build/handler.mjs';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.json': 'application/json'
};

export const ADMIN = 'ph001player1@gmail.com';

export async function startServer({ port = 8080, db = 'mg_ui_test', admins = [ADMIN], pollMs = 3000 } = {}) {
  const sql = await freshDatabase(db);
  const handler = createHandler({
    sql, adminEmails: admins, allowedOrigins: [],
    verifyToken: async (token) => (token.startsWith('test:') ? token.slice(5) : null),
    ensureAuthUser: async () => {}
  });
  const webRoot = new URL('../../web/', import.meta.url).pathname;
  const config = (realAuth) => `export const CONFIG = ${JSON.stringify({
    // С cookie realauth=1 сайт входит через настоящий клиент Supabase Auth,
    // а проверка подставляет ответы сервера входа (tests/ui/screens.mjs).
    supabaseUrl: realAuth ? 'https://auth.test' : '', publishableKey: 'test', apiUrl: '/api', pollMs,
    testAuth: !realAuth
  })};\n`;

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/api') {
        const chunks = [];
        for await (const c of req) chunks.push(c);
        const r = await handler(new Request('http://localhost/api', {
          method: req.method,
          headers: { 'content-type': 'application/json', authorization: req.headers.authorization || '' },
          body: req.method === 'POST' ? Buffer.concat(chunks) : undefined
        }));
        res.writeHead(r.status, Object.fromEntries(r.headers));
        res.end(await r.text());
        return;
      }
      let path = decodeURIComponent(url.pathname);
      if (path === '/assets/js/config.js') {
        res.writeHead(200, { 'content-type': MIME['.js'], 'cache-control': 'no-store' });
        res.end(config(/(^|;\s*)realauth=1/.test(req.headers.cookie || '')));
        return;
      }
      if (path.endsWith('/')) path += 'index.html';
      const file = normalize(join(webRoot, path));
      if (!file.startsWith(webRoot)) { res.writeHead(403); res.end(); return; }
      const data = await readFile(file);
      res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(data);
    } catch (e) {
      if (e.code === 'ENOENT' || e.code === 'EISDIR') { res.writeHead(404); res.end('not found'); return; }
      console.error(e);
      res.writeHead(500);
      res.end('server error');
    }
  });
  await new Promise((resolve) => server.listen(port, resolve));
  return {
    sql, url: `http://localhost:${port}/`,
    async close() {
      server.closeAllConnections?.();
      await new Promise((r) => server.close(r));
      await sql.end();
    }
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT || 8080);
  const s = await startServer({ port });
  if (process.argv.includes('--seed')) {
    const { seedGame } = await import('./seed.mjs');
    const info = await seedGame(s.sql, { months: Number(process.env.MONTHS || 4) });
    console.log('Seeded game', info.code, info.gameId);
  }
  console.log('Market Game test site: ' + s.url + '  (admin: ' + ADMIN + ', any 6-digit code)');
}
