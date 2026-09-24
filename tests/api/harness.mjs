// Стенд для проверки функции game на обычном PostgreSQL.
//
// Та же логика, что в Supabase (handler.ts), только вход подменён: токен
// вида "test:почта" считается проверенным. База каждый раз создаётся с нуля
// из supabase/migrations.
//
// Подключение — переменные PGHOST, PGPORT, PGUSER, PGPASSWORD (как у psql).

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import assert from 'node:assert/strict';
import postgres from 'postgres';
import { createHandler } from '../../build/handler.mjs';

const TYPES = {
  numeric: { to: 1700, from: [1700], serialize: (x) => String(x), parse: (x) => Number(x) },
  bigint: { to: 20, from: [20], serialize: (x) => String(x), parse: (x) => Number(x) }
};

const pgOptions = (database) => ({
  host: process.env.PGHOST || '/tmp',
  port: Number(process.env.PGPORT || 55432),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || undefined,
  database,
  prepare: false,
  types: TYPES,
  onnotice: () => {}
});

export async function freshDatabase(name = 'mg_api_test') {
  const admin = postgres(pgOptions('postgres'));
  await admin.unsafe(`drop database if exists ${name} with (force)`);
  await admin.unsafe(`create database ${name}`);
  await admin.end();

  const sql = postgres(pgOptions(name));
  const dir = 'supabase/migrations';
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    await sql.unsafe(readFileSync(join(dir, f), 'utf8'));
  }
  return sql;
}

export function makeApi(sql, { admins = ['admin@test.com'] } = {}) {
  const authUsers = new Set();
  const handler = createHandler({
    sql,
    adminEmails: admins,
    allowedOrigins: [],
    verifyToken: async (token) => (token.startsWith('test:') ? token.slice(5) : null),
    ensureAuthUser: async (email) => { authUsers.add(email); }
  });

  async function call(email, action, params = {}) {
    const headers = { 'content-type': 'application/json' };
    if (email) headers.authorization = 'Bearer test:' + email;
    const res = await handler(new Request('http://local/game', {
      method: 'POST', headers, body: JSON.stringify({ action, ...params })
    }));
    const body = await res.json();
    if (res.status >= 500) throw new Error('server error on ' + action + ': ' + JSON.stringify(body));
    return body;
  }

  return { call, authUsers };
}

/** Деньги сходятся с журналами — главный инвариант учёта. */
export async function moneyInvariants(sql, gameId) {
  const rows = await sql`
    select p.id, p.email, p.cash, p.employment_savings, p.status,
           coalesce(sum(l.amount) filter (where l.target = 'cash'), 0) as ledger_cash,
           coalesce(sum(l.amount) filter (where l.target = 'savings'), 0) as ledger_savings
    from players p left join ledger l on l.player_id = p.id
    where p.game_id = ${gameId} group by p.id`;
  for (const r of rows) {
    assert.ok(Math.abs(r.cash - r.ledger_cash) < 0.011, `касса ${r.email}: ${r.cash} ≠ журнал ${r.ledger_cash}`);
    assert.ok(Math.abs(r.employment_savings - r.ledger_savings) < 0.011,
      `накопления ${r.email}: ${r.employment_savings} ≠ журнал ${r.ledger_savings}`);
  }
  const months = await sql`select * from institution_months where game_id = ${gameId}`;
  for (const m of months) {
    assert.ok(Math.abs(m.to_city + m.to_players + m.to_private - m.payout) < 0.011, 'выплата разошлась с долями');
    assert.ok(m.payout <= Math.max(0, m.profit) + 0.011, 'выплата больше прибыли');
    const [inc] = await sql`
      select coalesce(sum(case ${m.kind}::text when 'landlord' then rent when 'bank' then interest
                                 when 'insurer' then insurance else utilities end), 0) as s
      from results where game_id = ${gameId} and round_number = ${m.round_number}`;
    assert.ok(Math.abs(inc.s - m.income) < 0.05, `доход ${m.kind} за ${m.round_number}: ${m.income} ≠ ${inc.s}`);
  }
  const [taxes] = await sql`
    select (select coalesce(sum(tax), 0) from results where game_id = ${gameId}) as results_tax,
           (select coalesce(sum(amount), 0) from city_ledger where game_id = ${gameId} and kind = 'profit_tax') as city_tax`;
  assert.ok(Math.abs(taxes.results_tax - taxes.city_tax) < 0.05, 'налог в бюджете ≠ налогу в отчётах');
}
