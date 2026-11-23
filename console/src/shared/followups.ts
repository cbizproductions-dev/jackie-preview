/**
 * Follow-ups (Kris, Nov 23): one list of everything waiting on a next step, oldest first. View only.
 */
import type { Snapshot } from './schema';
import { addDays, daysBetween, parseLooseDate, labelDay } from './time';
import { isDurango, ROOMS } from './derive';
import { workingBriefs } from './work';

export type FollowGroup = 'mix' | 'owed' | 'rebook' | 'vibe' | 'sync' | 'scout' | 'brief';
export const FOLLOW_GROUPS: [FollowGroup, string][] = [
  ['mix', 'Owed mixes'], ['owed', 'Money owed to you'], ['rebook', 'Rebook candidates'], ['vibe', 'Vibe artists not paid yet'],
  ['sync', 'Sync follow-ups due'], ['scout', 'Scout leads waiting on you'], ['brief', 'Briefs due in 7 days'],
];
export type FollowUp = { group: FollowGroup; who: string; why: string; age: number; ageLabel: string; source: string; url: string; hot?: boolean };

const d = (x: string) => labelDay(x, { month: 'short', day: 'numeric' });
const since = (n: number) => (n === 0 ? 'today' : n === 1 ? '1 day' : `${n} days`);

/**
 * A scout lead at Status "Replied" is waiting on Kris only if the row doesn't say it was handled, passed, or is waiting on the
 * other side, and Kris hasn't already answered (Nov 22 lesson: a lead's row can stay "Replied" after Kris has answered).
 */
export function waitingOnKris(l: { reply: string; nextAction: string }): boolean {
  const next = l.nextAction ?? '';
  if (/handled|passed|pending on (his|her|their) side|do not (re-?)?contact|closed|no follow-?up from scout|left as-is|done\b/i.test(next)) return false;
  const answered = /(kris(-approved)?[^.;]*\b(sent|replied|responded|quoted)\b)|follow-?up email sent/i.test(l.reply ?? '');
  const ballWithKris = /ball (is )?with kris|waiting on kris|kris to (reply|respond|answer)/i.test(`${l.reply} ${next}`);
  return ballWithKris || !answered;
}

export function followUps(s: Snapshot): FollowUp[] {
  const out: FollowUp[] = [];
  const t = s.today;
  const push = (f: FollowUp) => { if (!isDurango(`${f.who} ${f.why}`)) out.push(f); };

  // 1. Owed mixes (Studio Board).
  for (const m of s.studio.mixes) {
    if (!m.due) continue;
    const age = daysBetween(m.due, t);
    push({ group: 'mix', who: m.client, why: `${m.countApprox ? '~' : ''}${m.count} mix${m.count === 1 ? '' : 'es'} owed · due ${d(m.due)}`, age, ageLabel: age > 0 ? `${since(age)} overdue` : age === 0 ? 'due today' : `due in ${since(-age)}`, source: 'Studio Board', url: ROOMS.studioBoard });
  }
  // 2. Money owed to Kris (Cash Flow Radar receivables).
  for (const c of ((s.cc as any)?.cash?.calendar ?? []) as string[][]) {
    if (c[3] !== 'CHASE') continue;
    let when = parseLooseDate(c[2] ?? '', Number(t.slice(0, 4)));
    if (when && when > t) when = parseLooseDate(c[2] ?? '', Number(t.slice(0, 4)) - 1);
    const age = when ? daysBetween(when, t) : 0;
    push({ group: 'owed', who: c[1], why: c[2] ?? '', age, ageLabel: when ? `${since(age)} outstanding` : 'date not on file', source: 'Cash Flow Radar', url: ROOMS.cash });
  }
  // 3. Rebook candidates: paid studio clients, nothing booked, 14+ days since their last session.
  const booked = new Set(s.studio.upcoming.filter((u) => u.date >= t).map((u) => u.who.toLowerCase()));
  for (const c of s.studio.clients) {
    if (c.kind !== 'session' || !(c.paidSessions ?? 0) || !c.lastSession || booked.has(c.name.toLowerCase())) continue;
    const age = daysBetween(c.lastSession, t);
    if (age < 14) continue;
    push({ group: 'rebook', who: c.name, why: `${c.paidSessions} paid session${c.paidSessions === 1 ? '' : 's'}${c.totalPaid ? ` · $${c.totalPaid.toLocaleString('en-US')}` : ''} · last ${d(c.lastSession)} · nothing booked`, age, ageLabel: `${since(age)} since last session`, source: 'Studio Board', url: ROOMS.studioBoard });
  }
  // 4. Vibe artists who showed but haven't paid yet; still inside 14 days = hot.
  for (const v of s.studio.vibe) {
    if (!v.showed || !v.date || !['open', 'booked'].includes(v.outcome)) continue;
    const age = daysBetween(v.date, t);
    push({ group: 'vibe', who: v.artist, why: `${v.outcome === 'booked' ? 'Paid session booked, not paid yet' : 'Not converted yet'}${v.note ? ` · ${v.note}` : ''}`, age, ageLabel: `${since(age)} since vibe`, source: 'Studio Board', url: ROOMS.studioBoard, hot: age <= 14 });
  }
  // 5. Sync contacts past their Follow-up date with no reply (Durango contacts are on hold).
  for (const c of s.syncContacts ?? []) {
    if (!/^contacted$/i.test(c.status) || !c.followUp || c.followUp >= t || /durango/i.test(c.list)) continue;
    const age = daysBetween(c.followUp, t);
    push({ group: 'sync', who: c.company || c.name, why: `Follow-up was due ${d(c.followUp)}${c.lastContacted ? ` · contacted ${d(c.lastContacted)}` : ''} · no reply${c.type ? ` · ${c.type}` : ''}`, age, ageLabel: `${since(age)} past follow-up`, source: 'Shared Sync Contacts', url: c.url });
  }
  // 6. Scout leads that replied and are waiting on Kris.
  for (const l of (s.scoutLeads?.rows ?? []).filter(waitingOnKris)) {
    const from = l.edited?.slice(0, 10) ?? l.contacted ?? null;
    const age = from ? Math.max(0, daysBetween(from, t)) : 0;
    push({ group: 'scout', who: l.name, why: `${l.tracker.replace(/ Leads$/, '')} · ${l.reply ? `replied: “${l.reply.slice(0, 120)}${l.reply.length > 120 ? '…' : ''}”` : 'replied'}${l.nextAction ? ` · next: ${l.nextAction.slice(0, 100)}` : ''}`, age, ageLabel: from ? `${since(age)} waiting` : 'date not on file', source: l.tracker, url: l.url });
  }
  // 7. Briefs due in the next 7 days (Due or Round 2 due, whichever is next).
  for (const b of workingBriefs(s)) {
    if (!b.next || b.next < t || b.next > addDays(t, 7)) continue;
    const age = -daysBetween(t, b.next);
    push({ group: 'brief', who: `${b.company ? `${b.company} — ` : ''}${b.brief}`, why: `${b.round2 && b.next === b.round2 ? 'Round 2 due' : 'Due'} ${d(b.next)}${b.round2End && b.next === b.round2 ? `–${d(b.round2End)}` : ''} · ${b.status}`, age, ageLabel: age === 0 ? 'due today' : `due in ${since(-age)}`, source: 'Brief Board', url: b.url || ROOMS.briefBoard });
  }
  return out.sort((a, b) => b.age - a.age);
}
