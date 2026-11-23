// Голосования: баннер у команды, карточка у ведущего, крупно на проекторе и
// список в отчёте. Сервер — supabase/functions/game/votes.ts.
//
// Пока голосование идёт, видно только, сколько команд проголосовало (и свой
// голос); итог — «за», «против», «воздержались», «не голосовали» с
// процентами от всех команд — после конца. Принятое голосованием ведущий
// подписывает или отклоняет (вето) — само оно не применяется.

import { t } from '../i18n.js';
import { h, replace, field } from '../dom.js';
import { usd, pctRaw, clock, parseMoney, currencySign } from '../fmt.js';

/** Шаблоны в том же порядке, что на сервере; unit — в чём вводится число. */
export const VOTE_TEMPLATES = [
  ['profit_tax', 'pct', 'PROFIT_TAX_RATE'], ['rent', 'money', 'RENT'], ['loan_rate', 'pct', 'LOAN_RATE_ANNUAL'],
  ['civil_salary', 'money', 'CIVIL_SERVICE_SALARY'], ['city_fee', 'money', null], ['grant_off', 'money', null],
  ['custom', null, null]
];
const UNIT = Object.fromEntries(VOTE_TEMPLATES.map(([id, unit]) => [id, unit]));
const SECONDS = [60, 120, 180, 300];
// Итог видно ещё столько после конца: у команды — пока не нажали «Понятно».
const RESULT_MS = { team: 30 * 60_000, projector: 3 * 60_000 };

/** Текст вопроса: шаблон с числом или свой вопрос. */
export function voteQuestion(v) {
  if (v.template === 'custom') return v.question || '';
  const value = UNIT[v.template] === 'pct' ? pctRaw(v.value) : usd(v.value);
  return t('vote.templates.' + v.template, { value });
}

const pctOf = (n, total) => pctRaw(total > 0 ? Math.round((n / total) * 1000) / 10 : 0);

/** «За — 8 (62%) · Против — 3 (23%) · …» — проценты от всех команд. */
export function resultLine(r) {
  return t('vote.result', {
    yes: r.yes, no: r.no, abstain: r.abstain, notVoted: r.notVoted,
    yesPct: pctOf(r.yes, r.total), noPct: pctOf(r.no, r.total),
    abstainPct: pctOf(r.abstain, r.total), notVotedPct: pctOf(r.notVoted, r.total)
  });
}

/** Решение и что из него вышло: не принято, ждёт ведущего, подписано или вето. */
export function verdict(v) {
  const r = v.result || {};
  if (!r.passed) return t('vote.failed');
  if (v.decision === 'pending') return t('vote.pending');
  if (v.decision === 'vetoed') return t('vote.vetoed');
  if (v.template === 'custom') return t('vote.signed');
  return t('vote.signed') + ' ' + (v.template === 'city_fee' || v.template === 'grant_off'
    ? t('vote.appliedNow') : t('vote.appliedNext'));
}

const verdictClass = (v) => (!v.result?.passed || v.decision === 'vetoed' ? 'is-bad'
  : v.decision === 'pending' ? 'is-wait' : 'is-ok');

/** Когда итог последний раз менялся: конец голосования или решение ведущего. */
const changedAt = (v) => Math.max(new Date(v.closedAt).getTime() || 0, new Date(v.decidedAt).getTime() || 0);

/** Полоса итога: за, против, воздержались, не голосовали. */
function resultBar(r) {
  const part = (n, cls) => (n > 0 ? h('span', { class: 'vote-bar__' + cls, style: { flexGrow: String(n) } }) : null);
  return h('div', { class: 'vote-bar', 'aria-hidden': 'true' },
    part(r.yes, 'yes'), part(r.no, 'no'), part(r.abstain, 'abstain'), part(r.notVoted, 'none'));
}

/** Итог одного голосования — у команды, у ведущего, в отчёте. */
export function resultBlock(v, { big = false } = {}) {
  const r = v.result || {};
  return h('div', { class: ['vote-result', big ? 'vote-result--big' : null] },
    h('div', { class: 'vote-result__q' }, voteQuestion(v)),
    resultBar(r),
    h('div', { class: 'vote-result__line' }, resultLine(r)),
    h('div', { class: ['vote-result__verdict', verdictClass(v)] }, verdict(v)));
}

// Голосования, итог которых команда уже видела, — чтобы не показывать снова.
const SEEN_KEY = 'mg-votes-seen';
function seen(id) {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]').includes(id); } catch { return false; }
}
function markSeen(id) {
  try {
    const list = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]').filter((x) => x !== id);
    localStorage.setItem(SEEN_KEY, JSON.stringify([...list, id].slice(-30)));
  } catch { /* нет хранилища — покажем ещё раз */ }
}

/** Секунд до конца голосования по часам сервера. */
const secondsLeft = (v, offset) => (new Date(v.closesAt).getTime() - (Date.now() + offset)) / 1000;

function clockEl() {
  return h('span', { class: 'vote__clock', role: 'timer' });
}

/**
 * Часы голосования: тикают раз в секунду, пока элемент на странице. Время
 * вышло — «Подсчёт голосов…»: итог придёт со следующим обновлением.
 */
function runClock(el, v, offsetRef) {
  const paint = () => {
    if (!el.isConnected) { clearInterval(id); return; }
    const left = secondsLeft(v, offsetRef.value);
    el.textContent = left > 0 ? t('vote.left', { time: clock(left) }) : t('vote.counting');
    el.classList.toggle('is-urgent', left <= 15);
  };
  const id = setInterval(paint, 1000);
  paint();
}

// ----------------------------------------------------------------- команда

/** Баннер голосования у команды: вопрос, часы, кнопки, потом итог. */
export function teamVotePart(onVote) {
  const el = h('div', {});
  const offset = { value: 0 };
  let sig = '';
  return {
    el,
    update(s) {
      const v = s.vote || {};
      if (v.serverNow) offset.value = new Date(v.serverNow).getTime() - Date.now();
      const a = v.active;
      // Итог показываем снова, когда ведущий подписал решение или наложил вето.
      const seenKey = v.last ? v.last.id + ':' + (v.last.decision || '') : '';
      const last = !a && v.last && !seen(seenKey)
        && Date.now() + offset.value - changedAt(v.last) < RESULT_MS.team ? v.last : null;
      const next = JSON.stringify([a && [a.id, a.mine, a.voted, a.total, a.closesAt], last && seenKey]);
      if (next === sig) return;
      sig = next;
      if (a) {
        const clockBox = clockEl();
        replace(el, h('section', { class: 'banner vote', role: 'region', 'aria-label': t('vote.title') },
          h('div', { class: 'vote__head' }, h('b', {}, t('vote.title')), clockBox),
          h('p', { class: 'vote__q' }, voteQuestion(a)),
          h('p', { class: 'muted small' }, t('vote.ruleLabel') + ' ' + t('vote.rules.' + a.rule)),
          h('div', { class: 'btn-row vote__choices' }, ['yes', 'no', 'abstain'].map((c) =>
            h('button', { class: ['btn', 'vote__choice', 'vote__choice--' + c], type: 'button', 'aria-pressed': a.mine === c ? 'true' : 'false',
              onclick: (e) => onVote(e.currentTarget, a.id, c) }, t('vote.' + c)))),
          h('p', { class: 'small', style: { margin: '8px 0 0' } }, t('vote.voted', { voted: a.voted, total: a.total }),
            a.mine ? ' · ' + t('vote.mine', { choice: t('vote.choices.' + a.mine) }) : '')));
        runClock(clockBox, a, offset);
      } else if (last) {
        replace(el, h('section', { class: 'banner vote vote--done', role: 'status' },
          h('div', { class: 'vote__head' }, h('b', {}, t('vote.resultTitle'))),
          resultBlock(last),
          h('div', { class: 'btn-row' }, h('button', { class: 'btn btn--small', type: 'button',
            onclick: () => { markSeen(seenKey); sig = ''; this.update(s); } }, t('vote.gotIt')))));
      } else {
        replace(el);
      }
    }
  };
}

// ----------------------------------------------------------------- ведущий

/**
 * Карточка ведущего: вопрос по шаблону или свой, время, правило — и
 * «Начать голосование». Идёт голосование — часы, сколько проголосовало,
 * «Завершить сейчас» и «Отменить». Ниже — последний итог.
 * run(button, action, params, okText) — действие ведущего, как в пульте.
 */
export function hostVotePart(run) {
  const offset = { value: 0 };
  let state = null;
  let valueTouched = false;
  const tpl = h('select', { class: 'input', onchange: () => { valueTouched = false; sync(); } },
    VOTE_TEMPLATES.map(([id]) => h('option', { value: id }, t('vote.names.' + id))));
  const value = h('input', { class: 'input', inputmode: 'decimal', autocomplete: 'off',
    oninput: () => { valueTouched = true; preview(); } });
  const valueLabel = h('span', {});
  const valueField = field(valueLabel, value);
  const question = h('textarea', { class: 'input', rows: 2, maxlength: 200, placeholder: t('vote.questionPlaceholder'),
    oninput: () => preview() });
  const questionField = field(t('vote.question'), question);
  const seconds = h('select', { class: 'input' },
    SECONDS.map((s) => h('option', { value: s, selected: s === 120 }, t('vote.minutes', { n: s / 60 }))));
  const rule = h('select', { class: 'input' },
    ['all', 'voted'].map((r) => h('option', { value: r }, t('vote.rules.' + r))));
  const previewEl = h('p', { class: 'vote__preview' });
  const startBtn = h('button', { class: 'btn btn--primary', type: 'button', onclick: (e) => start(e.currentTarget) },
    t('vote.start'));
  const form = h('div', { class: 'vote-form' },
    field(t('vote.topic'), tpl), valueField, questionField,
    h('div', { class: 'grid-2' }, field(t('vote.duration'), seconds), field(t('vote.ruleLabel'), rule)),
    previewEl, h('div', { class: 'btn-row' }, startBtn));
  const activeBox = h('div', {});
  const lastBox = h('div', {});
  const el = h('div', {}, h('p', { class: 'muted small' }, t('vote.lead')), activeBox, lastBox, form);

  /** Число шаблона по умолчанию — нынешнее значение настройки. */
  function sync() {
    const [, unit, key] = VOTE_TEMPLATES.find(([id]) => id === tpl.value);
    valueField.hidden = !unit;
    questionField.hidden = !!unit;
    valueLabel.textContent = t('vote.value') + (unit === 'pct' ? ', %' : unit === 'money' ? ', ' + currencySign() : '');
    if (!valueTouched) {
      const cur = key && state?.config ? Number(state.config[key]) : NaN;
      value.value = Number.isFinite(cur) ? String(unit === 'pct' ? Math.round(cur * 10000) / 100 : cur) : '';
    }
    preview();
  }
  function read() {
    const unit = UNIT[tpl.value];
    const v = unit ? parseMoney(String(value.value).replace('%', '')) : null;
    return { template: tpl.value, value: v, question: question.value.trim(), seconds: Number(seconds.value), rule: rule.value };
  }
  function preview() {
    const p = read();
    const ready = UNIT[p.template] ? Number.isFinite(p.value) : !!p.question;
    previewEl.textContent = ready ? t('vote.preview', { text: voteQuestion(p) }) : '';
    startBtn.disabled = !ready;
  }
  async function start(btn) {
    const p = read();
    const res = await run(btn, 'startVote', { template: p.template, value: p.value, question: p.question,
      seconds: p.seconds, rule: p.rule }, t('vote.started'));
    if (res?.ok) { valueTouched = false; question.value = ''; }
  }

  function update(s) {
    state = s;
    const v = s.vote || {};
    if (v.serverNow) offset.value = new Date(v.serverNow).getTime() - Date.now();
    const a = v.active;
    const finished = s.game.status === 'finished';
    // Пока принятое решение ждёт подписи или вето, нового голосования нет.
    const pending = v.last?.decision === 'pending';
    form.hidden = !!a || finished || pending;
    if (!form.hidden && document.activeElement !== value) sync();
    const key = JSON.stringify(a && [a.id, a.voted, a.total, a.closesAt]);
    if (activeBox.dataset.key !== key) {
      activeBox.dataset.key = key;
      if (a) {
        const clockBox = clockEl();
        replace(activeBox, h('div', { class: 'banner vote' },
          h('div', { class: 'vote__head' }, h('b', {}, t('vote.title')), clockBox),
          h('p', { class: 'vote__q' }, voteQuestion(a)),
          h('p', { class: 'muted small' }, t('vote.ruleLabel') + ' ' + t('vote.rules.' + a.rule)),
          h('p', {}, t('vote.voted', { voted: a.voted, total: a.total })),
          h('div', { class: 'btn-row' },
            h('button', { class: 'btn btn--primary', type: 'button',
              onclick: (e) => run(e.currentTarget, 'closeVote', { voteId: a.id }, t('vote.closed')) }, t('vote.finishNow')),
            h('button', { class: 'btn btn--ghost', type: 'button',
              onclick: (e) => run(e.currentTarget, 'cancelVote', { voteId: a.id }, t('vote.cancelled')) }, t('vote.cancel')))));
        runClock(clockBox, a, offset);
      } else {
        replace(activeBox);
      }
    }
    const lastKey = v.last ? v.last.id + ':' + (v.last.decision || '') : '';
    if (lastBox.dataset.key !== lastKey) {
      lastBox.dataset.key = lastKey;
      const l = v.last;
      replace(lastBox, l ? h('div', { class: ['vote-last', pending ? 'banner banner--warn' : null] },
        h('div', { class: 'stat__label' }, t('vote.resultTitle')), resultBlock(l),
        pending && !finished ? h('div', {},
          h('p', { class: 'small', style: { margin: '8px 0 0' } }, t('vote.decideLead')),
          h('div', { class: 'btn-row' },
            h('button', { class: 'btn btn--primary', type: 'button',
              onclick: (e) => run(e.currentTarget, 'decideVote', { voteId: l.id, decision: 'sign' }, t('vote.signedToast')) },
              t('vote.sign')),
            h('button', { class: 'btn btn--danger', type: 'button',
              onclick: (e) => run(e.currentTarget, 'decideVote', { voteId: l.id, decision: 'veto' }, t('vote.vetoedToast')) },
              t('vote.veto')))) : null) : null);
    }
  }

  return { el, update };
}

// ----------------------------------------------------------------- проектор

/** Крупно на проекторе: идёт голосование — вопрос и часы; потом — итог 3 минуты. */
export function projectorVote(box) {
  const offset = { value: 0 };
  let sig = '';
  return function paint(vote) {
    const v = vote || {};
    if (v.serverNow) offset.value = new Date(v.serverNow).getTime() - Date.now();
    const a = v.active;
    const last = !a && v.last && Date.now() + offset.value - changedAt(v.last) < RESULT_MS.projector ? v.last : null;
    const next = JSON.stringify([a && [a.id, a.voted, a.total, a.closesAt], last && [last.id, last.decision]]);
    if (next === sig) return;
    sig = next;
    box.hidden = !a && !last;
    if (a) {
      const clockBox = clockEl();
      replace(box, h('div', { class: 'vote-projector' },
        h('div', { class: 'vote__head' }, h('b', {}, t('vote.title')), clockBox),
        h('div', { class: 'vote-projector__q' }, voteQuestion(a)),
        h('div', { class: 'vote-projector__count' }, t('vote.voted', { voted: a.voted, total: a.total })),
        h('div', { class: 'muted' }, t('vote.ruleLabel') + ' ' + t('vote.rules.' + a.rule))));
      runClock(clockBox, a, offset);
    } else if (last) {
      replace(box, h('div', { class: 'vote-projector' },
        h('div', { class: 'vote__head' }, h('b', {}, t('vote.resultTitle'))),
        resultBlock(last, { big: true })));
    } else {
      replace(box);
    }
  };
}

// ----------------------------------------------------------------- отчёт

/** Все голосования игры — в отчёте. */
export function voteHistoryCard(votes) {
  if (!votes?.length) return null;
  return h('section', { class: 'card' },
    h('h2', { class: 'card__title' }, t('vote.history')),
    votes.map((v) => h('div', { class: 'vote-history__item' },
      h('div', { class: 'muted small' }, t('common.month') + ' ' + v.roundNumber), resultBlock(v))));
}
