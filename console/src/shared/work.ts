/**
 * Home meters added Nov 23 (Kris): Mix & Brief Queue and Booked Ahead. View only, from the same sources.
 */
import type { Snapshot } from './schema';
import { mixQueue } from './rules';
import { addDays, daysBetween } from './time';
import { isDurango } from './derive';

type Brief = Snapshot['briefs'][number];
const WORKING = ['committed', 'in progress', 'contract'];

/** The brief's next date: Due or Round 2 due, whichever is next (today counts). If both have passed, the latest one. */
export function briefNextDate(b: Brief, today: string): string | null {
  const dates = [b.due, b.round2].filter((d): d is string => !!d).sort();
  if (!dates.length) return null;
  return dates.find((d) => d >= today) ?? dates[dates.length - 1];
}

/** Briefs Kris is working on: Committed or In progress; Contract only while it still has a date ahead (signed past deals aren't work). */
export function workingBriefs(s: Snapshot): (Brief & { next: string | null; overdue: boolean })[] {
  return s.briefs
    .filter((b) => WORKING.includes((b.status ?? '').toLowerCase()) && !isDurango(`${b.brief} ${b.company ?? ''}`))
    .map((b) => {
      const next = briefNextDate(b, s.today);
      // Overdue = its date has passed and it isn't Submitted.
      return { ...b, next, overdue: !!next && next < s.today && (b.status ?? '').toLowerCase() !== 'submitted' };
    })
    .filter((b) => (b.status ?? '').toLowerCase() !== 'contract' || (!!b.next && b.next >= s.today))
    .sort((a, b) => (a.next ?? '9999').localeCompare(b.next ?? '9999'));
}

export function mixBriefQueue(s: Snapshot) {
  const q = mixQueue(s.studio.mixes, s.today);
  const briefs = workingBriefs(s);
  const overdueBriefs = briefs.filter((b) => b.overdue);
  const nextBrief = briefs.find((b) => b.next && b.next >= s.today) ?? null;
  return { mixes: q.open, overdueMixes: q.overdue, approx: q.approx, briefs: briefs.length, overdueBriefs: overdueBriefs.length, nextBrief, anyOverdue: q.overdue > 0 || overdueBriefs.length > 0 };
}

/** Hours from a note like "6:30–8:30 PM" or "2 hours". */
export function hoursFrom(note: string): number | null {
  const h = /(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\b/i.exec(note);
  if (h) return Number(h[1]);
  const t = /(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?\s*[–-]\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i.exec(note);
  if (!t) return null;
  const to24 = (hh: number, mm: number, ap: string) => ((hh % 12) + (/pm/i.test(ap) ? 12 : 0)) * 60 + mm;
  const endAp = t[6];
  const startAp = t[3] ?? endAp;
  let a = to24(Number(t[1]), Number(t[2] ?? 0), startAp);
  const b = to24(Number(t[4]), Number(t[5] ?? 0), endAp);
  if (!t[3] && a > b) a -= 12 * 60; // "11:00–1:00 PM" starts in the morning
  const mins = b - a;
  return mins > 0 ? Math.round((mins / 60) * 100) / 100 : null;
}

/** Paid sessions booked in the next 14 days (Studio Board), with expected $ at each client's rate. Expected, not income. */
export function bookedAhead(s: Snapshot) {
  const end14 = addDays(s.today, 13);
  const end7 = addDays(s.today, 6);
  const rows = s.studio.upcoming
    .filter((u) => u.date >= s.today && u.date <= end14 && !(/^[^;]*,\s*vibe\b/i.test(u.note) && !/\bpaid\b/i.test(u.note)) && !isDurango(u.who))
    .map((u) => {
      const hours = hoursFrom(u.note);
      const noteRate = /\$(\d+(?:\.\d+)?)\s*\/\s*hr/i.exec(u.note);
      const client = s.studio.clients.find((c) => c.name.toLowerCase() === u.who.toLowerCase());
      const rate = noteRate ? Number(noteRate[1]) : client?.rate ?? null;
      const time = /(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?\s*[–-]\s*\d{1,2}(?::\d{2})?\s*(?:AM|PM))/i.exec(u.note)?.[1] ?? null;
      return { who: u.who, date: u.date, time, hours, rate, expected: hours != null && rate != null ? hours * rate : null, inDays: daysBetween(s.today, u.date) };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  const week = rows.filter((r) => r.date <= end7);
  const sum = (xs: typeof rows) => xs.reduce((a, r) => a + (r.expected ?? 0), 0);
  return {
    rows,
    count: rows.length,
    hours: rows.reduce((a, r) => a + (r.hours ?? 0), 0),
    hoursKnown: rows.every((r) => r.hours != null),
    expected: sum(rows),
    rateMissing: rows.filter((r) => r.rate == null).length,
    week: { count: week.length, expected: sum(week) },
    next: rows[0] ?? null,
  };
}
