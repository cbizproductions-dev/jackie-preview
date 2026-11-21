// All dates are America/New_York. Weeks run Monday–Sunday.
export const TZ = 'America/New_York';

/** YYYY-MM-DD for an instant, in New York time. */
export function nyDate(d: Date = new Date()): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)!.value;
  return `${g('year')}-${g('month')}-${g('day')}`;
}

/** Parse YYYY-MM-DD as a calendar date (UTC midnight, used only for date math). */
export function toDay(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
export function fmtDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}
export function addDays(s: string, n: number): string {
  const d = toDay(s);
  d.setUTCDate(d.getUTCDate() + n);
  return fmtDay(d);
}
export function daysBetween(a: string, b: string): number {
  return Math.round((toDay(b).getTime() - toDay(a).getTime()) / 86400000);
}
/** Monday of the week containing the date. */
export function weekStart(s: string): string {
  const dow = toDay(s).getUTCDay(); // 0 Sun..6 Sat
  return addDays(s, dow === 0 ? -6 : 1 - dow);
}
export function weekEnd(s: string): string {
  return addDays(weekStart(s), 6);
}
/** A week is in progress until its Sunday has ended (New York time). */
export function weekIsComplete(weekStartDate: string, today: string): boolean {
  return today > weekEnd(weekStartDate);
}
export function monthKey(s: string): string {
  return s.slice(0, 7);
}
export function prevMonthKey(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
/** Parse dates written like "Tue Nov 10, 2026", "Nov 13, 2026", "Fri Nov 13". Year defaults to fallbackYear. */
export function parseLooseDate(text: string, fallbackYear?: number): string | null {
  const m = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?/i.exec(text);
  if (!m) return null;
  const mon = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1;
  const year = m[3] ? Number(m[3]) : fallbackYear;
  if (!year) return null;
  return `${year}-${String(mon).padStart(2, '0')}-${String(Number(m[2])).padStart(2, '0')}`;
}

export function labelDay(s: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }): string {
  return new Intl.DateTimeFormat('en-US', { ...opts, timeZone: 'UTC' }).format(toDay(s));
}
export function labelTime(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso)) + ' ET';
}
