// Раздел Console — пульт ведущего: месяцы, команды, город, настройки.
//
// Как и кабинет игрока, пульт строится один раз: фоновый опрос обновляет
// цифры и списки, но не трогает поля, в которых ведущий что-то набирает.

import { t, errorText } from '../i18n.js';
import { h, replace, toast, confirmDialog, busy, field, moneyInput, card } from '../dom.js';
import { usd, int, dec2, pct, pctRaw, parseMoney } from '../fmt.js';
import { act } from '../api.js';
import { locationBadge, statusBadge, copyText, siteBase } from './common.js';
import { OWNER_COLORS } from './scoreboard.js';
import { gameForm } from './create.js';

const SUBTABS = ['run', 'teams', 'city', 'settings'];
const INSTITUTIONS = ['landlord', 'bank', 'insurer', 'utility'];
// Ставки хранятся долей (0.12), ведущему показываем проценты (12).
const PERCENT_KEYS = new Set(['LOAN_RATE_ANNUAL', 'PROFIT_TAX_RATE', 'MARKET_QUALITY_GAIN']);
const MONEY_KEYS = new Set(['RENT', 'INSURANCE', 'UTILITIES', 'PAYROLL_BASE', 'START_CAPITAL',
  'CIVIL_SERVICE_SALARY', 'REOPEN_THRESHOLD', 'P_REF']);
const CONFIG_ORDER = ['ROUND_DURATION_MIN', 'RENT', 'INSURANCE', 'UTILITIES', 'PAYROLL_BASE', 'PROFIT_TAX_RATE',
  'LOAN_RATE_ANNUAL', 'LOAN_TERM_MONTHS', 'P_REF', 'MARKET_SIZE_PER_PLAYER', 'MARKET_QUALITY_GAIN',
  'START_CAPITAL', 'CIVIL_SERVICE_SALARY', 'REOPEN_THRESHOLD'];

const teamName = (p) => p.restaurant || p.email;

export function createConsole(root, ctx) {
  let m = null;
  let tab = sessionStorage.getItem('mg-console-' + ctx.gameId) || 'run';
  if (!SUBTABS.includes(tab)) tab = 'run';
  const base = () => ({ gameId: ctx.gameId });

  async function run(button, action, params, okText) {
    return busy(button, async () => {
      const res = await act(action, { ...base(), ...params });
      if (res.ok) {
        if (okText) toast(typeof okText === 'function' ? okText(res) : okText, 'ok');
        if (res.state) ctx.applyState(res.state);
      } else {
        toast(errorText(res, usd), 'bad', 7000);
      }
      return res;
    });
  }

  // ---- вкладки пульта
  const tabButtons = SUBTABS.map((id) => h('button', { type: 'button', 'aria-pressed': 'false',
    onclick: () => { tab = id; sessionStorage.setItem('mg-console-' + ctx.gameId, id); showTab(); } },
    t('host.' + (id === 'city' ? 'cityTab' : id))));
  const parts = { run: runPart(), teams: teamsPart(), city: cityPart(), settings: settingsPart() };
  replace(root,
    h('div', { class: 'seg seg--tabs', role: 'group', 'aria-label': t('host.console') }, tabButtons),
    SUBTABS.map((id) => parts[id].el));
  showTab();

  function showTab() {
    SUBTABS.forEach((id, i) => {
      tabButtons[i].setAttribute('aria-pressed', id === tab ? 'true' : 'false');
      parts[id].el.hidden = id !== tab;
    });
  }

  function update(state) {
    m = state;
    for (const p of Object.values(parts)) p.update(state);
  }

  // ----------------------------------------------------------------- Run

  function runPart() {
    const codeBox = h('div', {});
    const monthBox = h('div', {});
    const el = h('div', {}, card(null, codeBox), card(null, monthBox));

    function codeBlock(g) {
      const site = siteBase();
      const boardUrl = site + 'board/?code=' + g.code;
      return [
        h('div', { class: 'code-line' },
          h('div', {}, h('div', { class: 'stat__label' }, t('board.code')), h('div', { class: 'code' }, g.code)),
          h('div', { class: 'btn-row', style: { marginTop: 0 } },
            h('a', { class: 'btn btn--small', href: boardUrl, target: '_blank', rel: 'noopener' }, t('host.boardLink')),
            h('button', { class: 'btn btn--ghost btn--small', type: 'button', onclick: () => copyText(boardUrl, t('common.copied')) },
              t('host.copyBoardLink')))),
        h('p', { class: 'muted small', style: { margin: '8px 0 0' } }, t('host.signInHint', { site: site.replace(/^https?:\/\//, '').replace(/\/$/, '') }))
      ];
    }

    function update(s) {
      const g = s.game;
      replace(codeBox, codeBlock(g));
      const active = s.players.filter((p) => p.status === 'active');
      const sent = active.filter((p) => p.submitted);
      const finished = g.status === 'finished';
      const open = g.roundStatus === 'open';
      const n = g.roundNumber;
      const blocks = [];

      blocks.push(h('h3', { class: 'card__title' },
        finished ? t('host.gameOver') : open ? t('host.monthOpen', { n }) : n === 0 ? t('host.notStartedTitle')
          : t('host.monthDone', { n, total: g.totalRounds })));

      if (finished) {
        const rated = !g.practice && n >= g.totalRounds;
        blocks.push(h('p', {}, rated ? t('host.finishedRated') : t('host.finishedUnrated')));
        blocks.push(h('div', { class: 'btn-row' },
          h('a', { class: 'btn btn--primary', href: '#/g/' + ctx.gameId + '/report' }, t('host.openReport')),
          h('button', { class: 'btn', type: 'button', onclick: (e) => playAgain(e.currentTarget) }, t('host.playAgain'))));
      } else if (open) {
        blocks.push(h('p', {}, t('host.submitted', { n: sent.length, total: active.length })));
        blocks.push(h('div', { class: 'chips' }, active.map((p) => h('span', { class: ['chip', p.submitted ? 'chip--ok' : null] },
          (p.submitted ? '✓ ' : '… ') + teamName(p)))));
        blocks.push(h('div', { class: 'btn-row' },
          h('button', { class: 'btn btn--primary', type: 'button', onclick: async (e) => {
            const btn = e.currentTarget;
            const ok = await confirmDialog(t('host.confirmCalc', { n, waiting: active.length - sent.length }),
              { ok: t('host.calcMonth', { n }), cancel: t('common.cancel') });
            if (ok) await run(btn, 'calculateRound', {}, t('host.calculated', { n }));
          } }, t('host.calcMonth', { n }))));
      } else {
        const players = s.players.filter((p) => p.status !== 'left');
        const minutes = s.config?.ROUND_DURATION_MIN ?? s.rules.roundMinutes;
        if (!players.length) blocks.push(h('p', { class: 'banner banner--warn' }, t('host.addTeamsFirst')));
        const notReady = players.filter((p) => !p.profileDone);
        if (players.length && notReady.length && n === 0) {
          blocks.push(h('p', { class: 'muted small' }, t('host.profilesPending', { n: notReady.length })));
        }
        if (n < g.totalRounds) {
          blocks.push(h('div', { class: 'btn-row' },
            h('button', { class: 'btn btn--primary', type: 'button', disabled: !players.length,
              onclick: (e) => run(e.currentTarget, 'openRound', {}, t('host.opened', { n: n + 1 })) },
              t('host.openMonth', { n: n + 1 })),
            h('span', { class: 'muted small', style: { alignSelf: 'center' } }, t('host.monthLength', { minutes }))));
        }
        if (n >= 1) {
          blocks.push(h('div', { class: 'btn-row' },
            h('button', { class: ['btn', n < g.totalRounds ? 'btn--ghost' : 'btn--primary'], type: 'button',
              onclick: (e) => finish(e.currentTarget, n < g.totalRounds, g.totalRounds) }, t('host.finish'))));
        }
      }
      replace(monthBox, blocks);
    }

    async function finish(btn, early, total) {
      const ok = await confirmDialog(early ? t('host.finishEarly', { total }) : t('host.finishConfirm'),
        { ok: t('host.finish'), cancel: t('common.cancel'), danger: early });
      if (!ok) return;
      const res = await run(btn, 'finishGame', {}, (r) => (r.rated ? t('host.finishedRated') : t('host.finishedUnrated')));
      if (res?.ok) ctx.reloadMe();
    }

    async function playAgain(btn) {
      const ok = await confirmDialog(t('host.playAgainConfirm'), { ok: t('host.playAgain'), cancel: t('common.cancel') });
      if (!ok) return;
      const res = await busy(btn, () => act('playAgain', base()));
      if (!res?.ok) { toast(errorText(res), 'bad', 7000); return; }
      toast(t('host.created', { code: res.code }), 'ok');
      await ctx.reloadMe();
      location.hash = '#/g/' + res.gameId;
    }

    return { el, update };
  }

  // ----------------------------------------------------------------- Teams

  function teamsPart() {
    let dirty = false;
    const area = h('textarea', { class: 'input', rows: 7, spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off',
      placeholder: 'team1@example.com\nteam2@example.com', oninput: () => { dirty = true; } });
    const result = h('div', {});
    const tableBox = h('div', {});
    const save = h('button', { class: 'btn btn--primary', type: 'button', onclick: async (e) => {
      const res = await run(e.currentTarget, 'setRoster', { emails: area.value },
        (r) => t('host.rosterResult', { added: r.added.length, removed: r.removed.length }));
      if (!res?.ok) return;
      dirty = false;
      if (res.state) area.value = res.state.players.map((p) => p.email).join('\n');
      const notes = [
        ...Object.entries(res.kept || {}).map(([e, why]) => e + ' — ' + why),
        ...Object.entries(res.skipped || {}).map(([e, why]) => e + ' — ' + why)
      ];
      replace(result, notes.length ? h('div', { class: 'banner banner--warn' },
        h('strong', {}, t('host.rosterNotes')), h('ul', {}, notes.map((x) => h('li', {}, x)))) : null);
    } }, t('host.rosterSave'));

    const el = h('div', {},
      card(t('host.rosterTitle'), h('p', { class: 'muted small' }, t('host.rosterLead')),
        field(t('host.rosterEmails'), area), result, h('div', { class: 'btn-row' }, save)),
      tableBox);

    function update(s) {
      if (!dirty && document.activeElement !== area) area.value = s.players.map((p) => p.email).join('\n');
      const open = s.game.roundStatus === 'open';
      const rows = s.players.map((p) => h('tr', {},
        h('td', {},
          h('div', { class: 'team-cell' },
            h('span', { class: 'team-cell__name' }, p.restaurant || t('host.profilePending')),
            locationBadge(p.location), statusBadge(p.status)),
          p.displayName ? h('div', { class: 'team-cell__who' }, p.displayName) : null,
          h('div', { class: 'team-cell__who' }, p.email)),
        h('td', { class: 'r' }, usd(p.money), p.offBusiness ? h('div', { class: 'muted small' }, t('header.savings')) : null),
        h('td', { class: 'r' }, p.brand === null ? '—' : dec2(p.brand)),
        h('td', { class: 'r' }, p.capacity === null ? '—' : int(p.capacity)),
        h('td', { class: 'r' }, p.loanBalance > 0 ? usd(p.loanBalance) : '—'),
        h('td', { class: 'r' }, open && p.submitted !== null ? (p.submitted ? '✓' : '…') : '—'),
        h('td', {}, p.status !== 'left'
          ? h('a', { class: 'btn btn--small', href: '#/g/' + ctx.gameId + '/as/' + p.id }, t('host.viewAs')) : null)));
      replace(tableBox, card(t('host.teamsTitle', { n: s.players.length }),
        s.players.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
          h('thead', {}, h('tr', {},
            h('th', { scope: 'col' }, t('host.columns.team')),
            h('th', { class: 'r', scope: 'col' }, t('host.columns.money')),
            h('th', { class: 'r', scope: 'col' }, t('host.columns.brand')),
            h('th', { class: 'r', scope: 'col' }, t('host.columns.capacity')),
            h('th', { class: 'r', scope: 'col' }, t('host.columns.loan')),
            h('th', { class: 'r', scope: 'col' }, t('host.columns.sent')),
            h('th', { scope: 'col' }, h('span', { class: 'sr' }, t('host.viewAs'))))),
          h('tbody', {}, rows)))
          : h('p', { class: 'muted' }, t('host.noTeams')),
        h('p', { class: 'muted small' }, t('host.viewAsLead'))));
    }

    return { el, update };
  }

  // ----------------------------------------------------------------- City

  /** Список команд для выбора; выбранное значение сохраняется при обновлении. */
  function teamSelect(label) {
    const sel = h('select', { class: 'input' });
    return {
      el: field(label, sel), sel,
      fill(players, filter = (p) => p.status !== 'left') {
        const keep = sel.value;
        replace(sel, h('option', { value: '' }, '—'),
          players.filter(filter).map((p) => h('option', { value: p.id, selected: p.id === keep }, teamName(p))));
      }
    };
  }

  function cityPart() {
    const budgetBox = h('div', {});

    // Штраф или грант одной команде.
    const adjTeam = teamSelect(t('common.team'));
    const adjAmount = moneyInput({ placeholder: '$' });
    const adjReason = h('input', { class: 'input', maxlength: 200, placeholder: t('host.reasonPlaceholder') });
    async function adjust(btn, sign) {
      const amount = parseMoney(adjAmount.value);
      if (!adjTeam.sel.value) { toast(t('host.pickTeam'), 'bad'); return; }
      if (!(amount > 0)) { toast(t('errors.bad_amount'), 'bad'); return; }
      const res = await run(btn, 'adjust', { playerId: adjTeam.sel.value, amount: sign * amount, reason: adjReason.value.trim() },
        sign < 0 ? t('host.fined') : t('host.granted'));
      if (res?.ok) { adjAmount.value = ''; adjReason.value = ''; }
    }
    const adjustCard = card(t('host.adjustTitle'),
      adjTeam.el, h('div', { class: 'grid-2' }, field(t('host.amount'), adjAmount), field(t('host.reason'), adjReason)),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn btn--danger', type: 'button', onclick: (e) => adjust(e.currentTarget, -1) }, t('host.fine')),
        h('button', { class: 'btn', type: 'button', onclick: (e) => adjust(e.currentTarget, 1) }, t('host.grant'))));

    // Всем сразу.
    const massAmount = moneyInput({ placeholder: '$' });
    const massReason = h('input', { class: 'input', maxlength: 200, placeholder: t('host.reasonPlaceholder') });
    async function mass(btn, kind) {
      const amount = parseMoney(massAmount.value);
      if (!(amount > 0)) { toast(t('errors.bad_amount'), 'bad'); return; }
      const ok = await confirmDialog(t(kind === 'tax_active' ? 'host.confirmTaxAll' : 'host.confirmGrantAll', { amount: usd(amount) }),
        { ok: t('common.yes'), cancel: t('common.cancel') });
      if (!ok) return;
      const res = await run(btn, 'massAdjust', { kind, amount, reason: massReason.value.trim() },
        (r) => t('host.massDone', { n: r.teams, total: usd(r.total) }));
      if (res?.ok) { massAmount.value = ''; massReason.value = ''; }
    }
    const massCard = card(t('host.massTitle'),
      h('div', { class: 'grid-2' }, field(t('host.amount'), massAmount, t('host.massHint')), field(t('host.reason'), massReason)),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn', type: 'button', onclick: (e) => mass(e.currentTarget, 'tax_active') }, t('host.taxAll')),
        h('button', { class: 'btn', type: 'button', onclick: (e) => mass(e.currentTarget, 'grant_off_business') }, t('host.grantAll'))));

    // Доли города в четырёх компаниях.
    const shareRows = {};
    const sharesList = h('div', { class: 'share-list' }, INSTITUTIONS.map((kind) => {
      const input = h('input', { class: 'input input--pct', type: 'number', min: 0, max: 100, step: 0.5, inputmode: 'decimal',
        'aria-label': t('institutions.' + kind) + ' — ' + t('host.cityPct') });
      input.addEventListener('input', () => { input.dataset.dirty = '1'; });
      const bar = h('div', {});
      const btn = h('button', { class: 'btn btn--small', type: 'button', onclick: async () => {
        const v = Number(String(input.value).replace(',', '.'));
        if (!Number.isFinite(v) || v < 0 || v > 100) { toast(t('errors.bad_pct'), 'bad'); return; }
        const res = await run(btn, 'setCityShare', { kind, pct: v }, t('host.cityShareSaved', { name: t('institutions.' + kind), pct: pctRaw(v) }));
        if (res?.ok) delete input.dataset.dirty;
      } }, t('common.save'));
      shareRows[kind] = { input, bar };
      return h('div', { class: 'share-row' },
        h('div', { class: 'share-row__name' }, h('b', {}, t('institutions.' + kind)),
          h('span', { class: 'muted small' }, t('institutions.' + kind + 'What'))),
        bar,
        h('div', { class: 'share-row__edit' }, h('label', { class: 'small' }, t('host.cityPct')), input, btn));
    }));
    const sharesCard = card(t('host.sharesTitle'), h('p', { class: 'muted small' }, t('host.sharesLead')), sharesList);

    // Сделки с долями.
    let op = 'sell';
    const kindSel = h('select', { class: 'input' }, INSTITUTIONS.map((k) => h('option', { value: k }, t('institutions.' + k))));
    const buyer = teamSelect(t('host.buyer'));
    const seller = teamSelect(t('host.seller'));
    const stakePct = h('input', { class: 'input', type: 'number', min: 0.5, max: 100, step: 0.5, inputmode: 'decimal', placeholder: '%' });
    const stakePrice = moneyInput({ placeholder: '$' });
    const hint = h('p', { class: 'muted small' });
    const holdersBox = h('div', {});
    const opButtons = ['sell', 'buyback', 'deal'].map((id) => h('button', { type: 'button', 'aria-pressed': 'false',
      onclick: () => { op = id; paintOp(); } }, t('host.' + id)));
    function paintOp() {
      opButtons.forEach((b, i) => b.setAttribute('aria-pressed', ['sell', 'buyback', 'deal'][i] === op ? 'true' : 'false'));
      buyer.el.hidden = op === 'buyback';
      seller.el.hidden = op === 'sell';
      seller.el.querySelector('label').textContent = op === 'buyback' ? t('host.holder') : t('host.seller');
      paintHint();
    }
    function paintHint() {
      if (!m) return;
      const inst = m.institutions.find((i) => i.kind === kindSel.value);
      if (!inst) return;
      const left = Math.max(0, m.game.totalRounds - m.game.roundNumber);
      const p = Number(stakePct.value) || 0;
      const perMonth = (inst.yearlyPayoutPerPct / 12) * p;
      replace(hint, t('host.stakeHint', {
        perPct: usd(inst.yearlyPayoutPerPct), left,
        pct: p ? pctRaw(p) : '1%', est: usd((p ? perMonth : inst.yearlyPayoutPerPct / 12) * left)
      }), ' ', t('host.cityOwns', { pct: pctRaw(inst.ownership.cityPct) }));
      replace(holdersBox, inst.ownership.holders.length
        ? h('p', { class: 'small' }, h('b', {}, t('board.holders') + ': '),
            inst.ownership.holders.map((x) => x.restaurant + ' ' + pctRaw(x.pct)).join(', '))
        : h('p', { class: 'small muted' }, t('board.noHolders')));
    }
    kindSel.addEventListener('change', paintHint);
    stakePct.addEventListener('input', paintHint);
    const stakeBtn = h('button', { class: 'btn btn--primary', type: 'button', onclick: async () => {
      const pctV = Number(String(stakePct.value).replace(',', '.'));
      const price = parseMoney(stakePrice.value);
      if (!(pctV > 0) || pctV > 100) { toast(t('errors.bad_pct'), 'bad'); return; }
      if (!Number.isFinite(price) || price < 0) { toast(t('errors.bad_amount'), 'bad'); return; }
      const kind = kindSel.value;
      let action;
      let params;
      if (op === 'sell') {
        if (!buyer.sel.value) { toast(t('host.pickTeam'), 'bad'); return; }
        action = 'sellStake'; params = { kind, playerId: buyer.sel.value, pct: pctV, price };
      } else if (op === 'buyback') {
        if (!seller.sel.value) { toast(t('host.pickTeam'), 'bad'); return; }
        action = 'buybackStake'; params = { kind, playerId: seller.sel.value, pct: pctV, price };
      } else {
        if (!seller.sel.value || !buyer.sel.value) { toast(t('host.pickTeam'), 'bad'); return; }
        action = 'transferStake'; params = { kind, fromPlayerId: seller.sel.value, toPlayerId: buyer.sel.value, pct: pctV, price };
      }
      const ok = await confirmDialog(t('host.confirmStake.' + op, {
        pct: pctRaw(pctV), name: t('institutions.' + kind), price: usd(price),
        buyer: buyer.sel.selectedOptions[0]?.textContent || '', seller: seller.sel.selectedOptions[0]?.textContent || ''
      }), { ok: t('common.yes'), cancel: t('common.cancel') });
      if (!ok) return;
      const res = await run(stakeBtn, action, params, t('host.stakeDone'));
      if (res?.ok) { stakePct.value = ''; stakePrice.value = ''; }
    } }, t('host.stakeSubmit'));
    const stakesCard = card(t('host.stakesTitle'),
      h('p', { class: 'muted small' }, t('host.stakesLead')),
      h('div', { class: 'seg', role: 'group' }, opButtons),
      field(t('host.company'), kindSel), holdersBox,
      h('div', { class: 'grid-2' }, seller.el, buyer.el),
      h('div', { class: 'grid-2' }, field(t('host.pct'), stakePct), field(t('host.price'), stakePrice)),
      hint, h('div', { class: 'btn-row' }, stakeBtn));

    const el = h('div', {}, h('p', { class: 'muted small' }, t('host.cityLead')), budgetBox, adjustCard, massCard, sharesCard, stakesCard);

    function update(s) {
      const city = s.city;
      const last = city.months[city.months.length - 1];
      replace(budgetBox, card(null,
        h('div', { class: 'stats stats--2' },
          h('div', { class: 'stat' }, h('div', { class: 'stat__label' }, t('board.cityTitle')),
            h('div', { class: ['stat__value', city.balance < 0 ? 'neg' : null] }, usd(city.balance))),
          h('div', { class: 'stat' }, h('div', { class: 'stat__label' }, t('host.lastMonthNet')),
            h('div', { class: 'stat__value' }, last ? usd(last.total) : '—')))));
      adjTeam.fill(s.players);
      const traders = (p) => p.status !== 'left' && p.status !== 'bankrupt';
      buyer.fill(s.players, traders);
      seller.fill(s.players, (p) => p.status !== 'left');
      for (const inst of s.institutions) {
        const row = shareRows[inst.kind];
        if (!row) continue;
        if (!row.input.dataset.dirty && document.activeElement !== row.input) row.input.value = String(inst.ownership.cityPct);
        const o = inst.ownership;
        replace(row.bar, h('div', { class: 'owners' },
          o.cityPct > 0 ? h('span', { style: { width: o.cityPct + '%', background: OWNER_COLORS.city } }) : null,
          o.playersPct > 0 ? h('span', { style: { width: o.playersPct + '%', background: OWNER_COLORS.players } }) : null,
          o.privatePct > 0 ? h('span', { style: { width: o.privatePct + '%', background: OWNER_COLORS.private } }) : null),
        h('div', { class: 'owner-keys' },
          h('span', {}, t('common.city') + ' ' + pctRaw(o.cityPct)),
          h('span', {}, t('board.teamOwners') + ' ' + pctRaw(o.playersPct)),
          h('span', {}, t('common.private') + ' ' + pctRaw(o.privatePct))));
      }
      paintOp();
    }

    return { el, update };
  }

  // ----------------------------------------------------------------- Settings

  function settingsPart() {
    const detailsBox = h('div', {});
    let form = null;
    let formKey = '';
    const detailsBtn = h('button', { class: 'btn btn--primary', type: 'button', onclick: async () => {
      if (!form) return;
      const p = form.read();
      if (!p.title) { toast(t('errors.empty_title'), 'bad'); return; }
      const params = { title: p.title, organizer: p.organizer, timezone: p.timezone, scheduledAt: p.scheduledAt,
        openBook: p.openBook, sponsorName: p.sponsorName, sponsorLogoUrl: p.sponsorLogoUrl, sponsorUrl: p.sponsorUrl };
      if (m && m.game.roundNumber === 0) params.practice = p.practice;
      const res = await run(detailsBtn, 'updateGame', params, t('host.saved'));
      if (res?.ok) { form.clean(); formKey = ''; }
    } }, t('common.save'));

    const upcomingBox = h('div', {});
    const inputs = {};
    const configGrid = h('div', { class: 'grid-2' });
    const configBtn = h('button', { class: 'btn btn--primary', type: 'button', onclick: async () => {
      if (!m) return;
      const updates = {};
      for (const [key, input] of Object.entries(inputs)) {
        if (!input.dataset.dirty) continue;
        let v = Number(String(input.value).replace(/[$,\s%]/g, ''));
        if (!Number.isFinite(v)) { toast(t('host.badNumber', { name: t('upcoming.keys.' + key) }), 'bad'); return; }
        if (PERCENT_KEYS.has(key)) v = Math.round(v * 100) / 10000;
        updates[key] = v;
      }
      if (!Object.keys(updates).length) { toast(t('host.nothingChanged')); return; }
      const res = await run(configBtn, 'updateConfig', { updates });
      if (!res?.ok) return;
      for (const key of Object.keys(res.applied || {})) delete inputs[key]?.dataset.dirty;
      const rejected = Object.entries(res.rejected || {});
      if (rejected.length) toast(rejected.map(([k, why]) => t('upcoming.keys.' + k) + ': ' + why).join('; '), 'bad', 8000);
      else toast(t('host.configSaved'), 'ok');
      for (const input of Object.values(inputs)) delete input.dataset.dirty;
      paintConfig(res.state || m, true);
    } }, t('host.configSave'));

    const dangerBox = h('div', {});
    const el = h('div', {},
      card(t('host.gameInfo'), detailsBox, h('div', { class: 'btn-row' }, detailsBtn)),
      card(t('host.economy'), h('p', { class: 'muted small' }, t('host.settingsLead')), upcomingBox, configGrid,
        h('div', { class: 'btn-row' }, configBtn)),
      dangerBox);

    function paintConfig(s, force) {
      const cfg = s.config || {};
      const editable = s.editable || {};
      if (!configGrid.childElementCount || force) {
        replace(configGrid);
        for (const key of CONFIG_ORDER) {
          const rule = editable[key];
          if (!rule) continue;
          const isPct = PERCENT_KEYS.has(key);
          const input = h('input', { class: 'input', inputmode: 'decimal', autocomplete: 'off' });
          input.addEventListener('input', () => { input.dataset.dirty = '1'; });
          inputs[key] = input;
          const range = isPct ? pctRaw(rule.min * 100) + ' – ' + pctRaw(rule.max * 100)
            : MONEY_KEYS.has(key) ? usd(rule.min) + ' – ' + usd(rule.max) : int(rule.min) + ' – ' + int(rule.max);
          configGrid.append(field(t('upcoming.keys.' + key) + (isPct ? ', %' : MONEY_KEYS.has(key) ? ', $' : ''), input,
            t('host.allowed', { range })));
        }
      }
      for (const [key, input] of Object.entries(inputs)) {
        if (input.dataset.dirty || document.activeElement === input) continue;
        const v = cfg[key];
        input.value = v === undefined ? '' : PERCENT_KEYS.has(key) ? String(Math.round(v * 10000) / 100) : String(v);
      }
      const list = s.upcomingChanges || [];
      const fmtVal = (k, v) => (PERCENT_KEYS.has(k) ? pct(v) : MONEY_KEYS.has(k) ? usd(v) : int(v));
      replace(upcomingBox, list.length ? h('div', { class: 'banner banner--warn' },
        h('strong', {}, t('upcoming.title')),
        h('ul', {}, list.map((c) => h('li', {}, t('upcoming.keys.' + c.key) + ': ' + fmtVal(c.key, c.from) + ' → ' + fmtVal(c.key, c.to)))))
        : null);
    }

    function update(s) {
      const g = s.game;
      // Форму данных игры пересобираем, только если ведущий её не трогал.
      const key = JSON.stringify([g.title, g.organizer, g.timezone, g.scheduledAt, g.openBook, g.practice, g.sponsor, g.roundNumber > 0]);
      if (!form || (!form.dirty && key !== formKey)) {
        formKey = key;
        form = gameForm(g, { withLeague: false, lockPractice: g.roundNumber > 0 });
        replace(detailsBox, h('p', { class: 'muted small' }, t('host.leagueFixed', { league: g.leagueName, total: g.totalRounds })), form.el);
      }
      paintConfig(s, false);
      const canDelete = g.roundNumber === 0 || (g.roundNumber === 1 && g.roundStatus === 'open');
      replace(dangerBox, canDelete ? card(t('host.dangerTitle'),
        h('p', { class: 'muted small' }, t('host.deleteLead')),
        h('button', { class: 'btn btn--danger', type: 'button', onclick: async (e) => {
          const btn = e.currentTarget;
          const ok = await confirmDialog(t('host.deleteConfirm'), { ok: t('host.delete'), cancel: t('common.cancel'), danger: true });
          if (!ok) return;
          const res = await busy(btn, () => act('deleteGame', base()));
          if (!res?.ok) { toast(errorText(res), 'bad', 7000); return; }
          toast(t('host.deleted'), 'ok');
          await ctx.reloadMe();
          location.hash = '#/';
        } }, t('host.delete'))) : null);
    }

    return { el, update };
  }

  return { update };
}
