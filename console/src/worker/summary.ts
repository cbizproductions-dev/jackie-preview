/**
 * Plain-text "agent view" of the dashboard: the same snapshot rendered as readable text,
 * so Cabinet agents (which fetch pages without running JavaScript) can read it. View only.
 */
import type { Snapshot } from '../shared/schema';
import * as D from '../shared/derive';
import { momentum, weekCash, mixQueue } from '../shared/rules';
import { addDays, labelDay, labelTime, daysBetween } from '../shared/time';

const $ = (n: number | null | undefined) => (n == null ? 'Not on file' : `$${Math.round(n).toLocaleString('en-US')}`);
const pc = (x: number | null | undefined) => (x == null ? 'Not on file' : `${Math.round(x * 100)}%`);

export function summaryText(s: Snapshot): string {
  const L: string[] = [];
  const t = D.goalTargets(s);
  const wk = D.thisWeekMetric(s);
  const yr = D.yearMetrics(s);
  const ops = D.studioOps(s);
  const mo = momentum(s.weeks, s.today) as any;
  const mm = D.monthMetrics(s);
  const stale = s.sources.filter((x) => x.state === 'stale' || x.state === 'failed');

  L.push('C-BIZ OFFICIAL DASHBOARD — agent view (read only)');
  L.push(`Data as of ${labelTime(s.generatedAt)} · state: ${s.state.toUpperCase()}${s.mode === 'seed' ? ' (build-time capture)' : ''}`);
  L.push('Source of truth for every item below is Notion HQ; this page only summarizes it. Revenue, not profit.');
  L.push('');
  L.push('## Headline');
  L.push(`- This week (${wk.period}): ${$(wk.value)} of $${t.goal} goal (stretch $${t.stretch})${wk.status === 'in_progress' ? ' — week in progress' : ''}`);
  L.push(`- ${yr.year} so far (verified music income): ${$(yr.ytd.value)}${yr.best ? ` · best prior year ${$(yr.best.total)} (${yr.best.year})` : ''}`);
  L.push(`- Studio-side this month (${mm.mk}) to date: ${$(mm.studioThis)} · all of ${mm.pk}: ${$(mm.studioPrev)}`);
  L.push(`- Vibe → paid: ${pc(ops.vibe.rate)} (${ops.vibe.paid} of ${ops.vibe.showed} who showed; ${ops.vibe.booked} booked, not paid yet)`);
  const q = mixQueue(s.studio.mixes, s.today);
  L.push(`- Mix queue: ${q.open} open · ${q.overdue} overdue · ${q.dueWithinWeek} due in the next 7 days (overdue not included)`);
  L.push(`- Momentum: ${mo.windowWeeks ? `${mo.change >= 0 ? '+' : ''}${Math.round((mo.change ?? 0) * 100)}% (${mo.label})` : mo.reason}`);
  L.push(`- Last 8 weeks studio-side cash: ${s.weeks.slice(-8).map((w) => `${labelDay(w.start, { month: 'short', day: 'numeric' })} ${$(weekCash(w))}`).join(' · ')}`);
  L.push('');
  L.push("## Today's moves");
  const moves = D.todaysMoves(s);
  if (!moves.length) L.push('- Nothing overdue, owed or due in the next 7 days.');
  for (const m of moves) L.push(`- ${m.what} — ${m.why} (${m.source})`);
  L.push('');
  L.push('## Ten health lights (from the Command Center)');
  for (const h of D.healthLights(s)) L.push(`- ${h.area}: ${h.light === 'none' ? 'NO DATA' : h.light.toUpperCase()} — ${h.today}${h.note ? ` (${h.note})` : ''}`);
  L.push('  Lights are the Command Center refresh\'s own (from its data.json), so both always match.');
  L.push('');
  L.push('## Next 10 days (calendar titles only)');
  const end = addDays(s.today, 9);
  const days = s.calendar.days.filter((d) => d.date >= s.today && d.date <= end && d.items.length);
  if (!days.length) L.push('- Nothing on the calendar.');
  for (const d of days) L.push(`- ${labelDay(d.date)}: ${d.items.map((i) => `${i.time ? `${i.time} ` : ''}${i.title.replace(/\s*\(user-reported.*\)/i, '')}`).join('; ')}`);
  L.push(`  Calendar last verified against Apple Calendar: ${s.calendar.lastVerified ?? 'Not on file'}`);
  L.push('');
  L.push('## Active briefs');
  const active = s.briefs.filter((b) => ['New', 'Committed', 'In progress'].includes(b.status ?? ''));
  if (!active.length) L.push('- None.');
  for (const b of active) L.push(`- ${b.company ?? ''} ${b.brief} (${b.code}) — ${b.status}${b.round2 ? `, round 2 ${b.round2}–${b.round2End}` : b.due ? `, due ${b.due}` : ''}`);
  L.push('');
  L.push('## Contract decisions in the next 12 months');
  const up = s.contracts.map((c) => ({ c, d: c.noticeBy && c.noticeBy >= s.today ? c.noticeBy : c.nextActionDate })).filter((x) => x.d && x.d >= s.today && x.d <= addDays(s.today, 365)).sort((a, b) => a.d!.localeCompare(b.d!));
  if (!up.length) L.push('- None.');
  for (const { c, d } of up) L.push(`- ${d} (${daysBetween(s.today, d!)} days${c.inferred ? ', inferred' : ''}): ${c.agreement} — ${c.nextAction.slice(0, 140)}`);
  L.push('');
  L.push('## Open data issues');
  if (!s.issues.length) L.push('- None.');
  for (const i of s.issues) L.push(`- ${i.title} — ${i.sources.join(' vs ')}`);
  L.push('');
  L.push('## Sources');
  for (const x of s.sources) L.push(`- ${x.name} (${x.owner}): ${x.state}${x.lastEdited ? `, last edited ${x.lastEdited}` : ''}${x.note ? ` — ${x.note}` : ''}`);
  if (stale.length) L.push(`Stale or failed: ${stale.map((x) => x.name).join(', ')}`);
  L.push('');
  L.push('Full visual dashboard: same link without "summary". Nothing here can be changed from this page; act in Notion.');
  return L.join('\n');
}
