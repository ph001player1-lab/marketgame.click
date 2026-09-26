// Раздел Guide — памятка игрока. Все цифры берутся из правил текущего
// месяца, которые присылает сервер: ведущий поменял аренду — памятка
// показывает новую, как только она вступила в силу.
//
// Тексты — в словаре i18n (guide.s.*). Строка в теле раздела:
//   «- …» — пункт списка, «= …» — формула, «> …» — совет в рамке,
//   **так** — жирный. Остальное — обычный абзац.

import { t, tn, fill } from '../i18n.js';
import { h, replace } from '../dom.js';
import { usd, usdc, int, pct, decimal } from '../fmt.js';

const SECTIONS = ['goal', 'ocean', 'month', 'pnl', 'market', 'choice', 'price', 'capacity', 'quality', 'marketing',
  'brand', 'costs', 'tax', 'bank', 'cash', 'deals', 'owners', 'city', 'board', 'scoring', 'leagues'];
const CHANNELS = ['seo', 'promo', 'maps', 'social', 'outdoor', 'affiliate'];

/** $30 или $32.50 — центы только там, где они есть. */
const money = (v) => (Number.isInteger(Number(v)) ? usd(v) : usdc(v));

/** Текст с **жирным** — без innerHTML: безопасно при любой строке. */
function rich(text) {
  const out = [];
  String(text).split(/(\*\*[^*]+\*\*)/).forEach((part) => {
    if (!part) return;
    if (part.startsWith('**') && part.endsWith('**')) out.push(h('b', {}, part.slice(2, -2)));
    else out.push(part);
  });
  return out;
}

/** Тело раздела из строк словаря: абзацы, списки, формулы, советы. */
function paragraphs(lines, vars) {
  const out = [];
  let list = null;
  for (const raw of Array.isArray(lines) ? lines : [lines]) {
    const line = fill(raw, vars);
    if (line.startsWith('- ')) {
      if (!list) { list = h('ul', {}); out.push(list); }
      list.append(h('li', {}, rich(line.slice(2))));
      continue;
    }
    list = null;
    if (line.startsWith('= ')) out.push(h('div', { class: 'formula' }, line.slice(2)));
    else if (line.startsWith('> ')) out.push(h('p', { class: 'tip' }, rich(line.slice(2))));
    else out.push(h('p', {}, rich(line)));
  }
  return out;
}

function varsFor(rules, game) {
  const r = rules;
  const ch = r.channels || {};
  const total = game?.totalRounds ?? 12;
  const margin = Math.max(0.01, r.pRef - r.cogsPerMeal);
  return {
    startCapital: usd(r.startCapital), league: t('leagues.' + (game?.league || 'start')), total,
    minutes: r.roundMinutes, fixedTotal: usd(r.fixedTotal), pRef: money(r.pRef),
    margin: money(margin), breakEven: int(Math.ceil(r.fixedTotal / margin)),
    // Сколько ресторанов рынок кормит по справедливой цене — как в табло.
    feeds: Math.max(1, Math.floor((r.marketBase * margin) / r.fixedTotal)),
    feedsText: tn('ocean.nRestaurants', Math.max(1, Math.floor((r.marketBase * margin) / r.fixedTotal))),
    floor: money(r.priceFloor), ceiling: money(r.priceCeiling), softCap: money(r.priceSoftCap),
    cogs: money(r.cogsPerMeal), qadd: pct(r.qualityCogsAdd),
    marketBase: int(r.marketBase), gain: pct(r.marketQualityGain), catMin: decimal(r.marketPriceMin), catMax: decimal(r.marketPriceMax),
    capacityBase: int(r.capacityBase), step: int(r.shiftStepCapacity), cost: usd(r.shiftStepCost),
    min: r.shiftsMin, max: r.shiftsMax,
    unit: usd(r.qualityInvestPerUnit), decay: pct(r.qualityDecay), upkeep: usd(r.qualityUpkeep),
    brandDecay: pct(r.brandDecay), taxRate: pct(r.taxRate),
    l1: usd(r.loanLimits?.[0]), l2: usd(r.loanLimits?.[1]), l3: usd(r.loanLimits?.[2]),
    rate: pct(r.loanRate), monthly: pct(r.loanRate / 12, 2), term: r.loanTermMonths,
    civil: usd(r.civilSalary), reopen: usd(r.reopenThreshold),
    rent: usd(r.rent), insurance: usd(r.insurance), utilities: usd(r.utilities), payroll: usd(r.payroll),
    minMonths: Math.ceil(total * 0.75),
    seoRef: usd(ch.seo?.ref), seoRamp: ch.seo?.rampMonths, seoDecay: pct(ch.seo?.decay),
    promoRef: usd(ch.promo?.ref), mapsRef: usd(ch.maps?.ref), mapsDecay: pct(ch.maps?.decay),
    socialRef: usd(ch.social?.ref), socialDecay: pct(ch.social?.decay),
    outdoorRef: usd(ch.outdoor?.ref), outdoorMin: usd(ch.outdoor?.minSpend), outdoorMonths: ch.outdoor?.months,
    affiliateMin: usd(ch.affiliate?.minSpend), affiliateBonus: pct(ch.affiliate?.bonusPct)
  };
}

function costsTable(vars) {
  const row = (name, amount, who) => h('tr', {}, h('td', {}, name), h('td', { class: 'r' }, amount), h('td', { class: 'muted' }, who));
  return h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
    h('thead', {}, h('tr', {}, h('th', {}, t('guide.costs.item')), h('th', { class: 'r' }, t('guide.costs.amount')),
      h('th', {}, t('guide.costs.who')))),
    h('tbody', {},
      row(t('pl.cogs'), fill(t('guide.costs.perMeal'), vars), t('guide.costs.suppliers')),
      row(t('pl.rent'), vars.rent, t('institutions.landlord')),
      row(t('pl.insurance'), vars.insurance, t('institutions.insurer')),
      row(t('pl.utilities'), vars.utilities, t('institutions.utility')),
      row(t('pl.payroll'), vars.payroll, t('guide.costs.staff')),
      h('tr', { class: 'total' }, h('td', {}, t('guide.costs.fixed')), h('td', { class: 'r' }, vars.fixedTotal + t('common.perMonth')), h('td', {}, '')),
      row(t('pl.shifts'), fill(t('guide.costs.perShift'), vars), t('guide.costs.staff')),
      row(t('pl.qualityUpkeep'), fill(t('guide.costs.perPoint'), vars), t('guide.costs.suppliers')),
      row(t('guide.costs.yourCall'), t('guide.costs.decide'), '—'))));
}

export function createGuide(root) {
  let sig = '';
  let pending = null;

  function build(rules, game) {
    const vars = varsFor(rules, game);
    const toc = h('nav', { class: 'guide__toc no-print', 'aria-label': t('guide.contents') },
      SECTIONS.map((id) => h('a', { href: '#', onclick: (e) => { e.preventDefault(); show(id); } }, t('guide.s.' + id + '.title'))));

    const sections = SECTIONS.map((id) => {
      const body = [];
      if (id === 'tax' && !(rules.taxRate > 0)) body.push(...paragraphs(t('guide.s.tax.body0'), vars));
      else body.push(...paragraphs(t('guide.s.' + id + '.body'), vars));
      if (id === 'goal' && game?.practice) body.push(h('p', { class: 'tip' }, t('guide.s.goal.practice')));
      if (id === 'costs') body.splice(0, 0, costsTable(vars));
      if (id === 'marketing') {
        for (const c of CHANNELS) {
          body.push(h('section', { id: 'guide-channel-' + c, class: 'guide__sub' },
            h('h3', {}, t('channels.' + c + '.name')),
            paragraphs(t('guide.channels.' + c), vars)));
        }
      }
      if (id === 'leagues' && game?.league) {
        body.push(h('p', { class: 'muted small' }, fill(t('guide.s.leagues.current'), vars)));
      }
      return h('section', { id: 'guide-' + id }, h('h2', {}, t('guide.s.' + id + '.title')), body);
    });

    return h('article', { class: 'guide' },
      h('div', { class: 'guide__head' },
        h('h2', {}, t('guide.title')),
        h('button', { class: 'btn btn--ghost btn--small no-print', type: 'button', onclick: () => window.print() }, t('guide.print'))),
      h('p', { class: 'muted small' }, fill(t('guide.lead'), vars)),
      toc, sections);
  }

  function update(rules, game) {
    if (!rules) return;
    const next = JSON.stringify([rules, game?.league, game?.practice, game?.totalRounds]);
    if (next === sig) return;
    sig = next;
    replace(root, build(rules, game));
    if (pending) { const id = pending; pending = null; show(id); }
  }

  function show(id) {
    const el = root.querySelector('#guide-' + id);
    if (!el) { pending = id; return; }
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ block: 'start', behavior: smooth ? 'smooth' : 'auto' });
    el.classList.remove('is-flash');
    void el.offsetWidth;
    el.classList.add('is-flash');
  }

  return { update, show };
}
