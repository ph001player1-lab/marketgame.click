// Проверка списков мест: регионы мира, страны, штаты США, регионы России.
//
//   npm run build && node tests/geo_check.mjs
//
// 1. Сервер (supabase/functions/game/geo.ts) и сайт (web/assets/js/geo.js)
//    знают одни и те же коды: иначе сайт предложит место, которое сервер
//    отвергнет, или наоборот.
// 2. У каждой страны есть название на всех языках сайта, у каждого штата и
//    региона — настоящий часовой пояс.
// 3. Сервер принимает правильное место игры и команды и отвергает неправильное.

import assert from 'node:assert/strict';
import * as server from '../build/geo.mjs';
import * as site from '../web/assets/js/geo.js';
import { setLocale } from '../web/assets/js/fmt.js';

// 1. Одни и те же коды.
assert.deepEqual(Object.keys(server.REGIONS), site.REGION_KEYS, 'регионы мира');
for (const r of site.REGION_KEYS) assert.deepEqual(server.REGIONS[r], site.REGIONS[r], 'страны региона ' + r);
const countries = Object.values(site.REGIONS).flat();
assert.equal(new Set(countries).size, countries.length, 'страна попала в два региона');
assert.deepEqual([...server.US_STATES].sort(), site.US_STATES.map(([c]) => c).sort(), 'штаты США');
assert.deepEqual([...server.RU_REGIONS].sort(), site.RU_REGIONS.map(([c]) => c).sort(), 'регионы России');
assert.equal(site.RU_REGIONS.length, 83, 'регионов России — как на marketgame.quest');
for (const [lang, place] of Object.entries(site.DEFAULT_PLACE)) {
  assert.ok(site.REGIONS[place.region].includes(place.country), 'место по умолчанию для ' + lang);
}

// 2. Названия и пояса.
for (const lang of ['en', 'es', 'pt', 'ru']) {
  setLocale(lang);
  for (const c of countries) {
    const name = site.countryName(c);
    assert.ok(name && name !== c, `${lang}: нет названия страны ${c}`);
  }
}
for (const [code, , zone] of site.US_STATES) {
  assert.doesNotThrow(() => new Intl.DateTimeFormat('en', { timeZone: zone }), 'пояс штата ' + code);
}
for (const [code, ru, en, zone] of site.RU_REGIONS) {
  assert.ok(ru && en && /[А-Яа-яЁё]/.test(ru) && /^[A-Za-z]/.test(en), 'названия региона ' + code);
  assert.doesNotThrow(() => new Intl.DateTimeFormat('en', { timeZone: zone }), 'пояс региона ' + code);
}

// 3. Проверки сервера.
const code = (fn) => { try { fn(); return 'ok'; } catch (e) { return e.code ?? String(e); } };
assert.deepEqual(server.gameLocation({ region: 'cis', country: 'ru', area: 'mow' }), { region: 'cis', country: 'RU', area: 'MOW' });
assert.deepEqual(server.gameLocation({ region: 'cis', country: 'RU', area: '' }), { region: 'cis', country: 'RU', area: null });
assert.deepEqual(server.gameLocation({ region: 'europe', country: 'DE', area: '  Berlin ' }), { region: 'europe', country: 'DE', area: 'Berlin' });
assert.deepEqual(server.gameLocation({ region: 'online', country: 'US', area: 'TX' }), { region: 'online', country: null, area: null });
assert.deepEqual(server.gameLocation({}), { region: 'online', country: null, area: null }, 'без места — онлайн, как раньше');
assert.equal(code(() => server.gameLocation({ region: 'mars' })), 'bad_region');
assert.equal(code(() => server.gameLocation({ region: 'europe', country: 'US' })), 'bad_country', 'США — не Европа');
assert.equal(code(() => server.gameLocation({ region: 'europe', country: '' })), 'bad_country');
assert.equal(code(() => server.gameLocation({ region: 'north_america', country: 'US', area: 'Texas' })), 'bad_state');
assert.equal(code(() => server.gameLocation({ region: 'cis', country: 'RU', area: 'Moscow' })), 'bad_ru_region');
assert.deepEqual(server.playerLocation({ country: 'us', area: 'tx' }), { country: 'US', area: 'TX' });
assert.deepEqual(server.playerLocation({ country: 'DE', area: '' }), { country: 'DE', area: null }, 'город — по желанию');
assert.equal(code(() => server.playerLocation({ country: 'US', area: '' })), 'bad_state', 'в США штат обязателен');
assert.equal(code(() => server.playerLocation({ country: 'RU' })), 'bad_ru_region', 'в России регион обязателен');
assert.equal(code(() => server.playerLocation({ country: 'Canada' })), 'bad_country');
assert.equal(server.teamLocation({ region: 'cis' }, { location_country: 'RU' }), null, 'в игре в одном месте место команды не показываем');
assert.deepEqual(server.teamLocation({ region: 'online' }, { location_country: 'RU', location_area: 'MOW' }), { country: 'RU', area: 'MOW' });

// Как место выглядит на сайте.
setLocale('ru');
assert.equal(site.placeText({ country: 'RU', area: 'MOW' }), 'Москва');
assert.equal(site.placeText({ country: 'US', area: 'TX' }), 'TX');
assert.equal(site.placeText({ country: 'US', area: 'TX' }, true), 'Texas, США');
assert.equal(site.placeText({ country: 'DE', area: 'Берлин' }, true), 'Берлин, Германия');
assert.equal(site.placeText({ country: null, area: 'Canada' }), 'Canada', 'старый ответ текстом');
assert.equal(site.areaZone('RU', 'SVE'), 'Asia/Yekaterinburg');

console.log(`geo: ${site.REGION_KEYS.length} регионов мира, ${countries.length} стран, ` +
  `${site.US_STATES.length} штатов, ${site.RU_REGIONS.length} регионов России — сервер и сайт совпадают`);
