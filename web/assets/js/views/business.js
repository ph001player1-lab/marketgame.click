// Раздел Business — кабинет команды.
//
// Формы строятся один раз: фоновый опрос обновляет цифры, но не стирает то,
// что игрок начал вводить. Форма решения пересобирается только при смене
// месяца или статуса и заполняется прошлым решением — так проще поправить
// одну цифру, чем вводить всё заново.

import { t, errorText } from '../i18n.js';
import { h, $, replace, toast, confirmDialog, busy, field, moneyInput, card } from '../dom.js';
import { usd, usdSigned, int, dec2, pct, pctRaw, parseMoney, dateTime } from '../fmt.js';
import { act } from '../api.js';
import { US_STATES } from './common.js';

export { US_STATES };

const CHANNELS = ['seo', 'promo', 'maps', 'social', 'outdoor', 'affiliate'];
const CHANNEL_FIELD = {
  seo: 'seoSpend', promo: 'promoSpend', maps: 'mapsSpend',
  social: 'socialSpend', outdoor: 'outdoorSpend', affiliate: 'affiliateSpend'
};
const OFF = ['civil_service', 'freelance', 'custom_employed'];

export function createBusiness(root, ctx) {
  let state = null;
  let shapeKey = '';       // при смене — полная пересборка раздела
  let formKey = '';        // при смене — пересборка формы решения
  const parts = {};

  const base = () => ({ gameId: ctx.gameId, ...(ctx.asPlayerId ? { asPlayerId: ctx.asPlayerId } : {}) });

  async function run(button, action, params, okText) {
    return busy(button, async () => {
      const res = await act(action, { ...base(), ...params });
      if (res.ok) {
        if (okText) toast(typeof okText === 'function' ? okText(res) : okText, 'ok');
        if (res.state) ctx.applyState(res.state);
      } else {
        toast(errorText(res, usd), 'bad', 6000);
      }
      return res;
    });
  }

  function info(section) {
    return h('button', { class: 'info', type: 'button', 'aria-label': t('tabs.guide') + ': ' + section,
      onclick: () => ctx.showGuide(section) }, 'i');
  }

  // ----------------------------------------------------------------- обновление

  function update(s) {
    state = s;
    const shape = [s.lifecycle, s.needsProfile ? 'profile' : 'ok'].join(':');
    if (shape !== shapeKey) { shapeKey = shape; formKey = ''; build(); }
    for (const p of Object.values(parts)) p.update?.(s);
  }

  function build() {
    for (const k of Object.keys(parts)) delete parts[k];
    const s = state;
    const blocks = [];
    parts.notices = noticesPart(); blocks.push(parts.notices.el);
    parts.upcoming = upcomingPart(); blocks.push(parts.upcoming.el);

    if (s.needsProfile) {
      parts.profile = profilePart(); blocks.push(parts.profile.el);
      replace(root, blocks);
      return;
    }

    if (s.lifecycle === 'active') {
      parts.stats = statsPart(); blocks.push(parts.stats.el);
      parts.decision = decisionPart(); blocks.push(parts.decision.el);
      parts.result = resultPart(); blocks.push(parts.result.el);
      parts.bank = bankPart(); blocks.push(parts.bank.el);
      parts.employees = employeesPart(); blocks.push(parts.employees.el);
      parts.transfer = transferPart(); blocks.push(parts.transfer.el);
      parts.stakes = stakesPart(); blocks.push(parts.stakes.el);
      parts.career = careerPart(true); blocks.push(parts.career.el);
    } else if (s.lifecycle === 'bankrupt') {
      parts.bankrupt = bankruptPart(); blocks.push(parts.bankrupt.el);
      parts.result = resultPart(); blocks.push(parts.result.el);
      parts.stakes = stakesPart(); blocks.push(parts.stakes.el);
    } else if (OFF.includes(s.lifecycle)) {
      parts.off = offBusinessPart(); blocks.push(parts.off.el);
      parts.transfer = transferPart(); blocks.push(parts.transfer.el);
      parts.stakes = stakesPart(); blocks.push(parts.stakes.el);
      parts.career = careerPart(false); blocks.push(parts.career.el);
      parts.result = resultPart(); blocks.push(parts.result.el);
    } else {
      blocks.push(card(t('life.leftTitle'), h('p', {}, t('life.leftLead'))));
      parts.result = resultPart(); blocks.push(parts.result.el);
    }
    parts.profileEdit = profileEditPart(); blocks.push(parts.profileEdit.el);
    replace(root, blocks);
  }

  // ----------------------------------------------------------------- уведомления

  function noticesPart() {
    const el = h('div', {});
    return {
      el,
      update(s) {
        if (!s.notices.length) { replace(el); return; }
        const btn = h('button', { class: 'btn btn--small', type: 'button',
          onclick: (e) => run(e.currentTarget, 'markNoticesRead', {}) }, t('notices.gotIt'));
        replace(el, h('div', { class: 'banner banner--info', role: 'status' },
          h('strong', {}, t('notices.title')),
          h('ul', {}, s.notices.map((n) => h('li', {}, n.message))), btn));
      }
    };
  }

  function upcomingPart() {
    const el = h('div', {});
    return {
      el,
      update(s) {
        const list = s.upcomingChanges || [];
        if (!list.length) { replace(el); return; }
        const fmtVal = (k, v) => /RATE|GAIN/.test(k) ? pct(v) : /MIN$|MONTHS|MARKET_SIZE/.test(k) ? int(v) : usd(v);
        replace(el, h('div', { class: 'banner banner--warn' },
          h('strong', {}, t('upcoming.title')),
          h('ul', {}, list.map((c) => h('li', {},
            t('upcoming.keys.' + c.key) + ': ' + fmtVal(c.key, c.from) + ' → ' + fmtVal(c.key, c.to))))));
      }
    };
  }

  // ----------------------------------------------------------------- профиль

  function locationFields(s) {
    const loc = s.player.location || {};
    const kind = loc.kind || 'state';
    const radios = [
      ['state', t('profile.inState')], ['multistate', t('profile.multistate')], ['international', t('profile.international')]
    ].map(([v, label]) => h('label', { class: 'radio' },
      h('input', { type: 'radio', name: 'loc-kind', value: v, checked: v === kind }), label));
    const stateSel = h('select', { class: 'input' },
      h('option', { value: '' }, '—'),
      US_STATES.map(([code, name]) => h('option', { value: code, selected: loc.state === code }, name)));
    const country = h('input', { class: 'input', type: 'text', autocomplete: 'country-name', value: loc.country || '', maxlength: 60 });
    const stateField = field(t('profile.state'), stateSel);
    const countryField = field(t('profile.country'), country);
    const group = h('div', {},
      h('div', { class: 'field__label' }, t('profile.where')),
      h('div', { class: 'radio-list' }, radios), stateField, countryField);
    const sync = () => {
      const k = group.querySelector('input[name="loc-kind"]:checked')?.value;
      stateField.hidden = k !== 'state';
      countryField.hidden = k !== 'international';
    };
    group.addEventListener('change', sync);
    sync();
    return {
      el: group,
      value: () => ({
        locationKind: group.querySelector('input[name="loc-kind"]:checked')?.value,
        locationState: stateSel.value, locationCountry: country.value.trim()
      })
    };
  }

  function profileForm(s, submitLabel, onDone) {
    const name = h('input', { class: 'input', type: 'text', autocomplete: 'name', maxlength: 60, value: s.player.displayName || '' });
    const rest = h('input', { class: 'input', type: 'text', maxlength: 60, value: s.player.restaurant || '' });
    const loc = locationFields(s);
    const btn = h('button', { class: 'btn btn--primary', type: 'submit' }, submitLabel);
    return h('form', { onsubmit: (e) => {
      e.preventDefault();
      run(btn, 'setProfile', { displayName: name.value.trim(), restaurantName: rest.value.trim(), ...loc.value() })
        .then((res) => { if (res?.ok) onDone?.(); });
    } }, field(t('profile.name'), name), field(t('profile.restaurant'), rest), loc.el, btn);
  }

  function profilePart() {
    const el = card(t('profile.title'), h('p', { class: 'muted' }, t('profile.lead')), profileForm(state, t('profile.start')));
    el.classList.add('card--accent');
    return { el };
  }

  function profileEditPart() {
    const body = h('div', {});
    const el = h('details', { class: 'card card--soft' },
      h('summary', { style: { cursor: 'pointer', fontWeight: 800 } }, t('profile.edit')), body);
    el.addEventListener('toggle', () => {
      if (el.open) replace(body, h('div', { style: { height: '10px' } }), profileForm(state, t('common.save'), () => { el.open = false; }));
    });
    return { el };
  }

  // ----------------------------------------------------------------- показатели

  function statsPart() {
    const cell = (label) => {
      const v = h('div', { class: 'stat__value' }, '—');
      return { el: h('div', { class: 'stat' }, h('div', { class: 'stat__label' }, label), v), v };
    };
    const brand = cell(t('stats.brand')), rep = cell(t('stats.reputation')),
      quality = cell(t('stats.quality')), cap = cell(t('stats.capacity'));
    const lossNote = h('p', { class: 'muted small', hidden: true });
    const el = h('div', {}, h('div', { class: 'stats' }, brand.el, rep.el, quality.el, cap.el), lossNote);
    return {
      el,
      update(s) {
        const b = s.business || {};
        brand.v.textContent = dec2(b.brand);
        rep.v.textContent = dec2(b.reputation);
        quality.v.textContent = dec2(b.quality);
        cap.v.textContent = int(b.capacity);
        lossNote.hidden = !(b.taxLossCarryforward > 0 && s.rules.taxRate > 0);
        lossNote.textContent = t('stats.lossCf') + ': ' + usd(b.taxLossCarryforward);
      }
    };
  }

  // ----------------------------------------------------------------- решение месяца

  function decisionPart() {
    const el = h('section', { class: 'card card--accent', id: 'decision' });
    return {
      el,
      update(s) {
        const g = s.game;
        const key = [g.roundNumber, g.roundStatus, g.status, s.decision?.submittedAt || ''].join(':');
        if (key === formKey) { refreshTotals(); return; }
        const dirty = el.dataset.dirty === '1' && formKey.split(':').slice(0, 3).join(':') === key.split(':').slice(0, 3).join(':');
        formKey = key;
        if (dirty) { refreshSent(); return; }   // игрок вводит — его цифры не трогаем
        buildDecision(el, s);
      }
    };
  }

  let refreshTotals = () => {};
  let refreshSent = () => {};

  function buildDecision(el, s) {
    const g = s.game;
    el.dataset.dirty = '0';
    if (g.status === 'finished') { replace(el, h('p', {}, t('decision.over'))); return; }
    if (g.roundStatus !== 'open') {
      replace(el, h('h3', { class: 'card__title' }, t('decision.title', { n: g.roundNumber + 1 })),
        h('p', { class: 'muted' }, g.roundNumber === 0 ? t('decision.notStarted') : t('decision.closed')));
      return;
    }
    const r = s.rules;
    const d = s.decision?.submitted ? s.decision : null;
    const last = s.lastResult;
    const prev = (k, lastVal) => (d ? d[k] : lastVal ?? 0);

    const inputs = {};
    const hints = {};
    const price = moneyInput({ value: String(d ? d.price : last?.price || r.pRef), 'aria-describedby': 'hint-price' });
    inputs.price = price;
    hints.price = h('div', { class: 'field__hint', id: 'hint-price' });

    const channelCards = CHANNELS.map((ch) => {
      const input = moneyInput({ value: String(prev(CHANNEL_FIELD[ch], last?.marketingByChannel?.[ch]) || 0),
        placeholder: t('decision.perMonthPlaceholder'), 'aria-label': t('channels.' + ch + '.name') });
      inputs[ch] = input;
      hints[ch] = h('div', { class: 'field__hint' });
      const blurb = t('channels.' + ch + '.blurb', {
        min: usd(ch === 'outdoor' ? r.channels.outdoor.minSpend : r.channels.affiliate.minSpend),
        months: r.channels.outdoor.months, bonus: pct(r.channels.affiliate.bonusPct)
      });
      return h('div', { class: 'channel' },
        h('div', { class: 'channel__head' },
          h('span', { class: 'channel__name' }, t('channels.' + ch + '.name'), info('channel-' + ch)),
          channelBadge(ch, s)),
        h('p', { class: 'channel__blurb' }, blurb),
        input, hints[ch]);
    });

    const shifts = h('select', { class: 'input' },
      h('option', { value: '-1', disabled: s.business.capacityShifts <= r.shiftsMin }, t('decision.shiftsMinus')),
      h('option', { value: '0', selected: true }, t('decision.shiftsSame')),
      h('option', { value: '1', disabled: s.business.capacityShifts >= r.shiftsMax }, t('decision.shiftsPlus')));
    if (d) shifts.value = String(d.shiftsDelta);
    const quality = moneyInput({ value: String(d ? d.qualityInvest : 0) });
    inputs.quality = quality;
    hints.quality = h('div', { class: 'field__hint' });

    const total = h('div', { class: 'spend-total', role: 'status' });
    const sent = h('div', {});
    const submit = h('button', { class: 'btn btn--primary btn--wide', type: 'submit' },
      d ? t('decision.resubmit') : t('decision.submit'));

    function values() {
      return {
        price: parseMoney(price.value),
        seoSpend: parseMoney(inputs.seo.value), promoSpend: parseMoney(inputs.promo.value),
        mapsSpend: parseMoney(inputs.maps.value), socialSpend: parseMoney(inputs.social.value),
        outdoorSpend: parseMoney(inputs.outdoor.value), affiliateSpend: parseMoney(inputs.affiliate.value),
        shiftsDelta: Number(shifts.value), qualityInvest: parseMoney(quality.value)
      };
    }

    function setHint(key, text, kind) {
      hints[key].textContent = text || '';
      hints[key].classList.toggle('is-error', kind === 'error');
      hints[key].classList.toggle('is-ok', kind === 'ok');
      inputs[key].classList.toggle('is-error', kind === 'error');
    }

    // Проверка на лету: игрок видит ошибку до отправки, а не после.
    function validate() {
      const v = values();
      let ok = true;
      if (!Number.isFinite(v.price) || v.price < r.priceFloor || v.price > r.priceCeiling) {
        setHint('price', t('errors.price_too_low', { min: usd(r.priceFloor), max: usd(r.priceCeiling) }), 'error'); ok = false;
      } else {
        setHint('price', t('decision.priceHint', { min: usd(r.priceFloor), max: usd(r.priceCeiling), soft: usd(r.priceSoftCap) }),
          v.price > r.priceSoftCap ? 'error' : null);
      }
      for (const ch of CHANNELS) {
        const val = v[CHANNEL_FIELD[ch]];
        if (!Number.isFinite(val) || val < 0) { setHint(ch, t('errors.negative_spend'), 'error'); ok = false; continue; }
        if (ch === 'outdoor' && val > 0 && val < r.channels.outdoor.minSpend) {
          setHint(ch, t('channels.outdoor.blurb', { min: usd(r.channels.outdoor.minSpend), months: r.channels.outdoor.months }), 'error');
        } else if (ch === 'affiliate' && val > 0 && val < r.channels.affiliate.minSpend) {
          setHint(ch, t('channels.affiliate.blurb', { min: usd(r.channels.affiliate.minSpend), bonus: pct(r.channels.affiliate.bonusPct) }), 'error');
        } else setHint(ch, '');
      }
      if (!Number.isFinite(v.qualityInvest) || v.qualityInvest < 0) { setHint('quality', t('errors.negative_spend'), 'error'); ok = false; }
      else setHint('quality', t('decision.qualityHint', { unit: usd(r.qualityInvestPerUnit), upkeep: usd(r.qualityUpkeep) }));
      const spend = CHANNELS.reduce((a, ch) => a + (v[CHANNEL_FIELD[ch]] || 0), 0) + (v.qualityInvest || 0);
      const cash = state.player.cash;
      total.textContent = t('decision.totalSpend', { total: usd(spend), cash: usd(cash) }) + (spend > cash ? ' — ' + t('decision.overCash') : '');
      total.classList.toggle('neg', spend > cash);
      if (spend > cash) ok = false;
      submit.disabled = !ok;
      return ok;
    }
    refreshTotals = validate;
    refreshSent = () => {
      const dd = state.decision;
      replace(sent, dd?.submitted ? h('div', { class: 'banner banner--ok small' },
        t('decision.sent') + ' ' + t('decision.sentAt', { time: dateTime(dd.submittedAt) })) : null);
    };

    const shiftHint = h('div', { class: 'field__hint' }, t('decision.shiftsHint', {
      cap: int(r.shiftStepCapacity), cost: usd(r.shiftStepCost), shifts: s.business.capacityShifts, capacity: int(s.business.capacity)
    }));

    const form = h('form', { novalidate: true, onsubmit: (e) => {
      e.preventDefault();
      if (!validate()) return;
      run(submit, 'submitDecision', values(), t('decision.sent')).then((res) => {
        if (res?.ok) { el.dataset.dirty = '0'; formKey = ''; }
      });
    }, oninput: () => { el.dataset.dirty = '1'; validate(); }, onchange: () => { el.dataset.dirty = '1'; validate(); } },
      h('h3', { class: 'card__title' }, t('decision.title', { n: g.roundNumber })),
      sent,
      field(h('span', {}, t('decision.price') + ' ', info('price')), price), hints.price,
      h('h3', { style: { margin: '14px 0 8px' } }, t('decision.marketing'), ' ', info('marketing')),
      channelCards,
      field(h('span', {}, t('decision.shifts') + ' ', info('capacity')), shifts), shiftHint,
      field(h('span', {}, t('decision.quality') + ' ', info('quality')), quality), hints.quality,
      total, submit);
    replace(el, form);
    refreshSent();
    validate();
  }

  function channelBadge(ch, s) {
    const m = s.marketing || {};
    const b = (text, kind) => h('span', { class: ['badge', kind ? 'badge--' + kind : null] }, text);
    const r = s.rules;
    if (ch === 'seo') return m.seoUnlocked ? b(t('channels.badges.seoOn'), 'ok')
      : b(t('channels.badges.seoRamp', { n: m.seoStreak || 0, total: r.channels.seo.rampMonths }), m.seoStreak ? 'warn' : null);
    if (ch === 'maps') return m.mapsLevel > 0 ? b(t('channels.badges.mapsOn'), 'ok') : b(t('channels.badges.off'));
    if (ch === 'social') return m.socialAdstock > 0 ? b(t('channels.badges.socialOn'), 'ok') : b(t('channels.badges.off'));
    if (ch === 'outdoor') return m.outdoorActive ? b(t('channels.badges.outdoorUntil', { n: m.outdoorActiveUntil }), 'ok') : b(t('channels.badges.off'));
    if (ch === 'affiliate') return m.affiliateActive ? b(t('channels.badges.affiliateOn'), 'ok') : b(t('channels.badges.off'));
    return null;
  }

  // ----------------------------------------------------------------- итоги месяца

  function resultPart() {
    const el = h('section', { class: 'card' });
    let key = '';
    return {
      el,
      update(s) {
        const r = s.lastResult;
        const k = r ? r.roundNumber + ':' + r.cashAfter : 'none';
        if (k === key) return;
        key = k;
        if (!r) { replace(el, h('h3', { class: 'card__title' }, t('pl.title', { n: '—' })), h('p', { class: 'muted' }, t('pl.none'))); return; }
        replace(el, plTable(r));
      }
    };
  }

  // ----------------------------------------------------------------- банк

  function bankPart() {
    const table = h('tbody', {});
    const note = h('p', { class: 'muted small' });
    const borrowAmt = moneyInput({ placeholder: t('bank.amount'), 'aria-label': t('bank.borrow') });
    const repayAmt = moneyInput({ placeholder: t('bank.amount'), 'aria-label': t('bank.repay') });
    const borrowRow = h('div', { class: 'btn-row' }, h('div', { style: { flex: '1 1 160px' } }, borrowAmt),
      h('button', { class: 'btn', type: 'button', onclick: (e) => run(e.currentTarget, 'requestLoan', { amount: parseMoney(borrowAmt.value) },
          (r) => t('bank.received', { amount: usd(r.received) }))
        .then((res) => { if (res?.ok) borrowAmt.value = ''; }) }, t('bank.borrow')));
    const repayRow = h('div', { class: 'btn-row' }, h('div', { style: { flex: '1 1 160px' } }, repayAmt),
      h('button', { class: 'btn', type: 'button', onclick: (e) => run(e.currentTarget, 'repayLoan', { amount: parseMoney(repayAmt.value) },
          (r) => t('bank.repaid', { amount: usd(r.paid) }))
        .then((res) => { if (res?.ok) repayAmt.value = ''; }) }, t('bank.repay')));
    const el = card(h('span', {}, t('bank.title') + ' ', info('bank')),
      h('div', { class: 'table-wrap' }, h('table', { class: 'table' }, table)), note, borrowRow, repayRow,
      h('p', { class: 'muted small', style: { marginTop: '8px' } }, t('bank.note')));
    return {
      el,
      update(s) {
        const l = s.loan;
        const row = (label, v) => h('tr', {}, h('td', {}, label), h('td', { class: 'r' }, v));
        replace(table,
          row(t('bank.capital'), usd(s.player.cash - l.balance)),
          row(t('bank.balance'), usd(l.balance)),
          row(t('bank.rate'), pct(l.rateAnnual)),
          l.balance > 0 ? row(t('bank.nextPayment'), usd(l.nextPayment)) : null,
          l.balance > 0 ? row(t('bank.termLeft'), int(l.termLeft)) : null,
          row(t('bank.limit'), usd(l.limit)),
          row(t('bank.available'), usd(l.available)));
        note.textContent = l.tier < 1 ? t('bank.noCredit') : '';
        note.hidden = l.tier >= 1;
        borrowRow.hidden = l.tier < 1 || l.available <= 0;
        repayRow.hidden = l.balance <= 0;
      }
    };
  }

  // ----------------------------------------------------------------- переводы

  function transferPart() {
    const select = h('select', { class: 'input', 'aria-label': t('transfer.to') });
    const amount = moneyInput({ placeholder: t('transfer.amount'), 'aria-label': t('transfer.amount') });
    const empty = h('p', { class: 'muted' }, t('transfer.nobody'));
    const form = h('div', {}, field(t('transfer.to'), select),
      h('div', { class: 'btn-row' }, h('div', { style: { flex: '1 1 160px' } }, amount),
        h('button', { class: 'btn', type: 'button', onclick: (e) =>
          run(e.currentTarget, 'transferMoney', { toPlayerId: select.value, amount: parseMoney(amount.value) }, null)
            .then((res) => { if (res?.ok) { toast(t('transfer.sent', { amount: usd(res.sent), team: res.to }), 'ok'); amount.value = ''; } }) },
          t('transfer.send'))));
    const el = card(t('transfer.title'), h('p', { class: 'muted small' }, t('transfer.lead')), empty, form);
    let sig = '';
    return {
      el,
      update(s) {
        const others = s.others || [];
        const next = others.map((o) => o.id + o.restaurant).join('|');
        empty.hidden = others.length > 0;
        form.hidden = others.length === 0;
        if (next === sig) return;
        sig = next;
        const keep = select.value;
        replace(select, others.map((o) => h('option', { value: o.id, selected: o.id === keep },
          o.restaurant + (o.status !== 'active' ? ' (' + t('statuses.' + o.status) + ')' : ''))));
      }
    };
  }

  // ----------------------------------------------------------------- доли

  function stakesPart() {
    const body = h('div', {});
    const el = card(h('span', {}, t('stakes.title') + ' ', info('owners')), body);
    return {
      el,
      update(s) {
        if (!s.stakes.length) { replace(body, h('p', { class: 'muted small' }, t('stakes.none'))); return; }
        replace(body, h('p', { class: 'muted small' }, t('stakes.lead')),
          h('table', { class: 'table' }, h('tbody', {}, s.stakes.map((st) => h('tr', {},
            h('td', {}, t('institutions.' + st.kind)),
            h('td', { class: 'r' }, dec2(st.pct) + '%'),
            h('td', { class: 'r muted' }, t('stakes.lastMonth', { amount: usd(st.lastMonthIncome) })))))));
      }
    };
  }

  // ----------------------------------------------------------------- сотрудники

  function employeesPart() {
    const body = h('div', {});
    const el = card(t('employees.title'), body);
    return {
      el,
      update(s) {
        const list = s.employees || [];
        el.hidden = list.length === 0;
        replace(body, list.map((e) => h('div', { class: 'banner' },
          h('div', {}, t('employees.wants', { name: e.displayName || '—', job: e.profession || '—', salary: usd(e.salary) })),
          e.approved
            ? h('div', { class: 'btn-row' }, h('span', { class: 'badge badge--ok' }, t('employees.approved')),
                e.paidThisRound ? h('span', { class: 'badge' }, t('employees.paid'))
                  : h('button', { class: 'btn btn--small', type: 'button', onclick: (ev) => run(ev.currentTarget, 'paySalary', { employeeId: e.id }, t('employees.paid')) },
                    t('employees.pay', { salary: usd(e.salary) })))
            : h('div', { class: 'btn-row' },
                h('button', { class: 'btn btn--small btn--primary', type: 'button', onclick: (ev) => run(ev.currentTarget, 'respondToEmployment', { employeeId: e.id, approve: true }) }, t('employees.approve')),
                h('button', { class: 'btn btn--small', type: 'button', onclick: (ev) => run(ev.currentTarget, 'respondToEmployment', { employeeId: e.id, approve: false }) }, t('employees.reject'))))));
      }
    };
  }

  // ----------------------------------------------------------------- смена деятельности

  function pathButtons(fromActive) {
    const prof = h('input', { class: 'input', type: 'text', maxlength: 60, placeholder: t('career.profession') });
    const profRow = h('div', { class: 'btn-row', hidden: true }, h('div', { style: { flex: '1 1 200px' } }, prof),
      h('button', { class: 'btn btn--primary', type: 'button', onclick: (e) => choose(e.currentTarget, 'custom', t('career.custom')) }, t('career.confirm')));
    async function choose(btn, path, label) {
      const text = path === 'end' ? t('career.confirmEnd')
        : fromActive ? t('career.confirmClose', { path: label }) : null;
      if (text && !(await confirmDialog(text, { ok: t('common.yes'), cancel: t('common.cancel'), danger: true }))) return;
      run(btn, 'chooseCareerPath', { path, professionName: prof.value.trim() });
    }
    const opt = (path, label, what) => h('div', { class: 'channel' },
      h('div', { class: 'channel__head' }, h('span', { class: 'channel__name' }, label)),
      h('p', { class: 'channel__blurb' }, what),
      h('button', { class: ['btn', 'btn--small', path === 'end' ? 'btn--danger' : null], type: 'button',
        onclick: (e) => path === 'custom' ? (profRow.hidden = false, prof.focus()) : choose(e.currentTarget, path, label) }, label));
    const salary = usd(state.careerOptions.civilServiceSalary);
    return h('div', {},
      opt('civil_service', t('career.civil'), t('career.civilWhat', { salary })),
      opt('freelance', t('career.freelance'), t('career.freelanceWhat')),
      opt('custom', t('career.custom'), t('career.customWhat')), profRow,
      opt('end', t('career.end'), t('career.endWhat')));
  }

  function careerPart(fromActive) {
    const body = h('div', {});
    const el = h('details', { class: 'card card--soft' },
      h('summary', { style: { cursor: 'pointer', fontWeight: 800 } }, fromActive ? t('career.title') : t('life.switchPath')), body);
    el.addEventListener('toggle', () => {
      if (el.open) replace(body, fromActive ? h('p', { class: 'muted small', style: { marginTop: '10px' } }, t('career.lead')) : null,
        pathButtons(fromActive));
    });
    return { el };
  }

  function bankruptPart() {
    const el = h('section', { class: 'card card--accent' });
    replace(el, h('h3', { class: 'card__title' }, t('life.bankruptTitle')),
      h('p', {}, t('life.bankruptLead', { threshold: usd(state.careerOptions.reopenThreshold) })),
      pathButtons(false));
    return { el };
  }

  // ----------------------------------------------------------------- вне бизнеса

  function offBusinessPart() {
    const title = h('h3', { class: 'card__title' });
    const money = h('div', {});
    const job = h('div', {});
    const reopen = h('div', {});
    const el = h('section', { class: 'card card--accent' }, title, money, job, reopen);
    let offerSig = '';
    return {
      el,
      update(s) {
        const e = s.employment || {};
        title.textContent = s.lifecycle === 'civil_service' ? t('life.civilTitle')
          : s.lifecycle === 'freelance' ? t('life.freelanceTitle') : t('life.customTitle', { job: e.professionName || '—' });
        replace(money, h('div', { class: 'stats', style: { gridTemplateColumns: '1fr 1fr' } },
          h('div', { class: 'stat' }, h('div', { class: 'stat__label' }, t('life.savings')), h('div', { class: 'stat__value' }, usd(s.player.savings))),
          h('div', { class: 'stat' }, h('div', { class: 'stat__label' }, t('life.threshold')),
            h('div', { class: 'stat__value' }, usd(e.threshold)))));
        if (s.lifecycle === 'civil_service') replace(job, h('p', {}, t('life.salary', { salary: usd(e.salary) })));
        else if (s.lifecycle === 'custom_employed') {
          const sig = [e.employer?.id, e.approved, e.paidThisRound, (s.others || []).length].join(':');
          if (sig !== offerSig) { offerSig = sig; replace(job, employmentBlock(s)); }
        } else replace(job, h('p', { class: 'muted' }, t('career.freelanceWhat')));
        replace(reopen, e.canReopen
          ? h('div', { class: 'banner banner--ok' }, h('p', {}, t('life.reopenWhat')),
              h('button', { class: 'btn btn--primary', type: 'button', onclick: (ev) => run(ev.currentTarget, 'reopenBusiness', {}) }, t('life.reopen')))
          : null);
      }
    };
  }

  function employmentBlock(s) {
    const e = s.employment;
    if (e.employer && e.approved) {
      return h('p', {}, t('life.offerApproved', { team: e.employer.restaurant, salary: usd(e.proposedSalary) }) +
        (e.paidThisRound ? ' ' + t('life.paidThisMonth') : ''));
    }
    const active = (s.others || []).filter((o) => o.status === 'active');
    const who = h('select', { class: 'input' }, active.map((o) => h('option', { value: o.id }, o.restaurant)));
    const salary = moneyInput({ placeholder: t('life.salaryAsk') });
    return h('div', {},
      e.employer ? h('p', { class: 'banner banner--warn small' }, t('life.offerPending', { team: e.employer.restaurant })) : null,
      h('h4', {}, t('life.offer')),
      field(t('life.employer'), who), field(t('life.salaryAsk'), salary),
      h('button', { class: 'btn', type: 'button', onclick: (ev) =>
        run(ev.currentTarget, 'proposeEmployment', { employerId: who.value, salary: parseMoney(salary.value) }, t('life.offerSend')) },
        t('life.offerSend')));
  }

  return { update };
}

/** Отчёт о прибылях и убытках за месяц — в кабинете и в истории игр. */
export function plTable(r) {
  const line = (label, v, cls) => h('tr', { class: cls }, h('td', {}, label), h('td', { class: ['r', v < 0 ? 'neg' : null] }, usd(v)));
  const minus = (label, v) => line('− ' + label, -Math.abs(v));
  const served = r.served, lost = r.lost, sum = Math.max(1, served + lost);
  return [
    h('h3', { class: 'card__title' }, t('pl.title', { n: r.roundNumber })),
    h('div', { class: 'capacity-bar', role: 'img', 'aria-label': int(served) + ' ' + t('pl.served') + ', ' + int(lost) + ' ' + t('pl.lost') },
      h('div', { class: 'capacity-bar__served', style: { width: (100 * served / sum) + '%' } }),
      h('div', { class: 'capacity-bar__lost', style: { width: (100 * lost / sum) + '%' } })),
    h('p', { class: 'small' }, int(served) + ' ' + t('pl.served') + ' · ' + int(lost) + ' ' + t('pl.lost') +
      ' · ' + t('pl.share') + ' ' + pctRaw(r.marketSharePct)),
    h('div', { class: 'table-wrap' }, h('table', { class: 'table' }, h('tbody', {},
      line(t('pl.revenue'), r.revenue),
      minus(t('pl.cogs'), r.cogs),
      line('= ' + t('pl.gross'), r.grossProfit, 'sub'),
      minus(t('pl.rent'), r.opex.rent),
      minus(t('pl.insurance'), r.opex.insurance),
      minus(t('pl.utilities'), r.opex.utilities),
      minus(t('pl.payroll'), r.opex.payroll),
      r.opex.shiftCost ? minus(t('pl.shifts'), r.opex.shiftCost) : null,
      r.opex.qualityUpkeep ? minus(t('pl.qualityUpkeep'), r.opex.qualityUpkeep) : null,
      r.opex.qualityInvest ? minus(t('pl.qualityInvest'), r.opex.qualityInvest) : null,
      minus(t('pl.marketing'), r.opex.marketing),
      line('= ' + t('pl.ebit'), r.ebit, 'sub'),
      r.interest ? minus(t('pl.interest'), r.interest) : null,
      line('= ' + t('pl.pbt'), r.profitBeforeTax, 'sub'),
      minus(t('pl.tax'), r.tax),
      line('= ' + t('pl.profit'), r.profit, 'total'),
      r.principalPaid ? minus(t('pl.principal'), r.principalPaid) : null,
      line('= ' + t('pl.cashFlow'), r.cashFlow, 'sub'),
      r.dividends ? line('+ ' + t('pl.dividends'), r.dividends) : null,
      line(t('pl.cashAfter'), r.cashAfter, 'total')))),
    h('details', {},
      h('summary', { style: { cursor: 'pointer', fontWeight: 700 } }, t('pl.byChannel')),
      h('table', { class: 'table' }, h('tbody', {}, CHANNELS.map((ch) =>
        h('tr', {}, h('td', {}, t('channels.' + ch + '.name')), h('td', { class: 'r' }, usd(r.marketingByChannel[ch])))))))
  ];
}
