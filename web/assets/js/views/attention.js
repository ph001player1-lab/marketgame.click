// Что ждёт ведущего: инициативы команд и принятое голосованием (вкладка
// «Игра»), заявки к городу на покупку долей и решения акционеров, где нужен
// голос города (вкладка «Город»). Отсюда — значки на вкладках пульта и
// полоса под шапкой на любом экране ведущего.

import { t } from '../i18n.js';
import { teamName } from './common.js';
import { stakeText } from './exchange.js';
import { voteQuestion } from './vote.js';

/** [{ tab: 'run' | 'city', text }] — по порядку важности. */
export function hostWaiting(s) {
  if (!s || s.game?.status === 'finished') return [];
  const out = [];
  if (s.vote?.last?.decision === 'pending') {
    out.push({ tab: 'run', text: t('attention.sign', { q: voteQuestion(s.vote.last) }) });
  }
  for (const o of s.exchange?.offers || []) {
    if (o.status === 'open' && o.seller?.city && o.turn === 'seller') {
      out.push({ tab: 'city', text: t('attention.offer', { team: teamName(o.buyer.label || '—'), stake: stakeText(o.pct, o.kind) }) });
    }
  }
  for (const c of s.companies || []) {
    if (c.canVote && !c.mine) out.push({ tab: 'city', text: t('attention.company', { company: t('institutions.' + c.kind) }) });
  }
  for (const i of s.initiatives || []) {
    out.push({ tab: 'run', text: t('attention.initiative', { team: teamName(i.team) }) });
  }
  return out;
}
