/**
 * Creative output, from the Brief Board (Maestro) and the Studio Board (Muse). No new tracker.
 * Unit = a brief (one assignment or library intake), dated by its Due date on the Brief Board.
 * Stages are cumulative and use each brief's CURRENT status:
 *   Delivered = Submitted, Passed, Contract or Paid/Placed (the work went out)
 *   Accepted  = Contract or Paid/Placed (agreement signed / taken into the library)
 *   Paid or placed = Paid/Placed
 * Work in progress = Committed / In progress. Expired and Not taking are briefs that weren't done.
 * Tracks made outside a brief aren't logged anywhere in HQ, so "tracks completed" is Not on file.
 */
import type { Snapshot } from './schema';
import { addDays } from './time';

type Brief = Snapshot['briefs'][number];
export type Stage = 'in_progress' | 'delivered' | 'accepted' | 'placed' | 'not_done' | 'other';

export function stageOf(status: string | null | undefined): Stage {
  const s = (status ?? '').toLowerCase();
  if (/paid|placed/.test(s)) return 'placed';
  if (s === 'contract') return 'accepted';
  if (s === 'submitted' || s === 'passed') return 'delivered';
  if (s === 'committed' || s === 'in progress') return 'in_progress';
  if (s === 'expired' || s === 'not taking') return 'not_done';
  return 'other';
}
export const STAGE_LABEL: Record<Stage, string> = { in_progress: 'In progress', delivered: 'Delivered', accepted: 'Accepted', placed: 'Paid or placed', not_done: 'Not done', other: 'Other' };
export const STAGE_COLOR: Record<Stage, string> = { in_progress: 'var(--gold-hi)', delivered: 'var(--lane-studio)', accepted: 'var(--ok)', placed: 'var(--lane-sync)', not_done: 'var(--ink-3)', other: 'var(--ink-3)' };

/** Titles a brief names: "Titles: A, B" in the notes, "(2 cues)" in the name, or the Deliverables count. Null when unknown. */
export function titlesOf(b: Brief): number | null {
  const m = /Titles:\s*([^.\n]+)/i.exec(b.notes ?? '');
  if (m) return m[1].split(',').map((x) => x.trim()).filter(Boolean).length;
  const c = /\((\d+)\s+cues?\)/i.exec(b.brief);
  if (c) return Number(c[1]);
  const d = Number(String(b.deliverables ?? '').trim());
  return Number.isFinite(d) && d > 0 ? d : null;
}

export type Period = 'year' | '12m' | 'all';
export function inPeriod(date: string | null, period: Period, today: string): boolean {
  if (!date || date > addDays(today, 60)) return period === 'all' && !!date;
  if (period === 'all') return true;
  if (period === 'year') return date.slice(0, 4) === today.slice(0, 4);
  return date >= addDays(today, -365);
}

export function pipeline(briefs: Brief[], period: Period, today: string) {
  const rows = briefs.filter((b) => inPeriod(b.due, period, today));
  const st = rows.map((b) => ({ b, s: stageOf(b.status) }));
  const delivered = st.filter((x) => ['delivered', 'accepted', 'placed'].includes(x.s));
  const accepted = st.filter((x) => ['accepted', 'placed'].includes(x.s));
  const placed = st.filter((x) => x.s === 'placed');
  const titles = (xs: typeof st) => {
    const known = xs.map((x) => titlesOf(x.b)).filter((n): n is number => n != null);
    return { named: known.reduce((a, n) => a + n, 0), counted: known.length, of: xs.length };
  };
  return {
    received: rows.length,
    /** Exactly at each stage now (matches the Command Center's Brief Board counts). */
    awaiting: rows.filter((b) => (b.status ?? '').toLowerCase() === 'submitted').length,
    passed: rows.filter((b) => (b.status ?? '').toLowerCase() === 'passed').length,
    acceptedOnly: st.filter((x) => x.s === 'accepted').length,
    inProgress: st.filter((x) => x.s === 'in_progress').length,
    delivered: delivered.length,
    accepted: accepted.length,
    placed: placed.length,
    notDone: st.filter((x) => x.s === 'not_done').length,
    deliveredTitles: titles(delivered),
    acceptedTitles: titles(accepted),
  };
}

/** Briefs worked per month (last 12 months incl. this one), split by current stage. */
export function monthly(briefs: Brief[], today: string) {
  const months: string[] = [];
  const [y, m] = today.split('-').map(Number);
  for (let i = 11; i >= 0; i--) { const d = new Date(Date.UTC(y, m - 1 - i, 1)); months.push(d.toISOString().slice(0, 7)); }
  return months.map((mk) => {
    const xs = briefs.filter((b) => b.due?.slice(0, 7) === mk).map((b) => stageOf(b.status));
    return { month: mk, in_progress: xs.filter((s) => s === 'in_progress').length, delivered: xs.filter((s) => s === 'delivered').length, accepted: xs.filter((s) => s === 'accepted').length, placed: xs.filter((s) => s === 'placed').length, notDone: xs.filter((s) => s === 'not_done').length };
  });
}

/** Styles named in brief titles. Only words that literally appear; nothing is guessed. */
const STYLES: [string, RegExp][] = [
  ['Hip hop', /hip[\s-]?hop|\brap\b/i], ['Trap', /\btrap\b/i], ['Tension', /tension|suspense|thriller/i], ['Sports', /sport|anthem|champion|scoreboard|game day/i],
  ['Pop', /\bpop\b/i], ['Vocal', /vocal|acapella|a cappella/i], ['Lo-fi', /lo-?fi/i], ['Orchestral', /orchestral|epic|cinematic/i],
  ['Driving', /driving/i], ['Comedy', /comedy|comedic/i], ['Rock', /\brock\b/i], ['R&B / Soul', /r&b|rnb|soul/i], ['Latin', /latin|reggaeton/i], ['Electronic', /edm|electronic|house\b|hyper ?pop/i],
];
export function directions(briefs: Brief[], today: string) {
  const recent = briefs.filter((b) => b.due && b.due >= addDays(today, -365) && b.due <= addDays(today, 60) && stageOf(b.status) !== 'not_done' && stageOf(b.status) !== 'other');
  const out = STYLES.map(([label, re]) => ({ label, n: recent.filter((b) => re.test(b.brief)).length })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
  const tagged = recent.filter((b) => STYLES.some(([, re]) => re.test(b.brief))).length;
  return { rows: out, tagged, of: recent.length };
}

export function recentWork(briefs: Brief[], today: string, n = 10) {
  return briefs
    .filter((b) => b.due && b.due <= addDays(today, 60) && !['not_done', 'other'].includes(stageOf(b.status)))
    .sort((a, b) => (b.due ?? '').localeCompare(a.due ?? ''))
    .slice(0, n);
}
