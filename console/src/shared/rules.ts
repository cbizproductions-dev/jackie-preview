/**
 * Counting rules and metric-dictionary formulas.
 * Copied from "⚙️ System, Sources & Maintenance" (Command Center). Each rule has unit tests in tests/rules.test.ts.
 * Pure functions only: no I/O, no Date.now(). "today" is always passed in (YYYY-MM-DD, America/New_York).
 */
import { addDays, daysBetween, weekIsComplete, weekStart } from './time';
import type { Week, Mix, Client, VibeArtist, LedgerRow, BmiStatement } from './schema';

export const NOT_ON_FILE = 'Not on file';
/** Studio income before this month is not on file (not $0). */
export const STUDIO_DATA_STARTS = '2026-10';
export const STUDIO_WEEKS_START = '2026-09-28';
export const MIX_DUE_DAYS = 7;
export const DEFAULT_WEEKLY_GOAL = 600;
/** Used only if Goals & Milestones has no $1,000 weekly row (reported in BUILD_NOTES). */
export const DEFAULT_STRETCH_GOAL = 1000;

// ---------- Rule 1: studio revenue = cash received ----------
export type StudioTxn =
  | { kind: 'payment'; date: string; amount: number; lane: 'session' | 'remote' | 'beats' }
  | { kind: 'prepayment'; date: string; amount: number; coversSessions: string[] }
  | { kind: 'deposit'; date: string; amount: number; appliedToSessionOn?: string | null; sessionHappened?: boolean }
  | { kind: 'scheduled'; date: string; amount: number }
  | { kind: 'sync_check'; date: string; amount: number }
  | { kind: 'bmi_statement'; date: string; amount: number };

/**
 * Studio-side cash dated inside [from, to] (inclusive).
 * - Scheduled sessions are not revenue.
 * - Deposits are held until the session happens; then they count on the session date.
 * - A prepayment covering several sessions counts once, on its receipt date.
 * - BMI statements and sync checks never count toward studio cash or the weekly goal.
 */
export function studioCash(txns: StudioTxn[], from: string, to: string): number {
  let sum = 0;
  for (const t of txns) {
    let date: string | null = null;
    switch (t.kind) {
      case 'payment':
      case 'prepayment':
        date = t.date;
        break;
      case 'deposit':
        date = t.sessionHappened && t.appliedToSessionOn ? t.appliedToSessionOn : null;
        break;
      default:
        date = null; // scheduled, sync_check, bmi_statement: never studio cash
    }
    if (date && date >= from && date <= to) sum += t.amount;
  }
  return round2(sum);
}

// ---------- Rule 4: a beat bundle is one transaction ----------
export type BeatSale = { buyer: string; date: string; bundleId?: string; amount: number };
export function beatTransactions(sales: BeatSale[]): { count: number; total: number; average: number | null } {
  const keys = new Set(sales.map((s) => s.bundleId ?? `${s.buyer}|${s.date}`));
  const total = round2(sales.reduce((a, s) => a + s.amount, 0));
  return { count: keys.size, total, average: keys.size ? round2(total / keys.size) : null };
}

// ---------- Rule 2: BMI by statement year ----------
export function statementYear(statement: string): string {
  const m = /(\d{4})/.exec(statement);
  return m ? m[1] : '';
}
export function bmiByYear(rows: { statement: string; royalties: number | null }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    if (r.royalties == null) continue;
    const y = statementYear(r.statement);
    out[y] = round2((out[y] ?? 0) + r.royalties);
  }
  return out;
}

// ---------- Rule 3: direct sync fees only when Confirmed paid; never re-add Studio Board sync checks ----------
export type SyncPayment = { id: string; amount: number; status: string; date: string };
export function confirmedSyncFees(dashboard: SyncPayment[], _studioBoardSyncChecks: { amount: number }[] = []): number {
  // The Studio Board's "Sync checks" log records the same payments as the dashboard: it is deliberately ignored.
  return round2(dashboard.filter((p) => /^confirmed paid$/i.test(p.status.trim())).reduce((a, p) => a + p.amount, 0));
}

// ---------- Rule 5: TuneSat detections are pipeline, not income ----------
export type IncomeItem = { lane: string; amount: number; source: 'bmi_statement' | 'direct_sync' | 'studio' | 'tunesat' };
export function verifiedIncome(items: IncomeItem[]): number {
  return round2(items.filter((i) => i.source !== 'tunesat').reduce((a, i) => a + i.amount, 0));
}
export function tunesatPipeline(items: IncomeItem[]): number {
  return round2(items.filter((i) => i.source === 'tunesat').reduce((a, i) => a + i.amount, 0));
}

// ---------- Rule 6: an incomplete week is "in progress" ----------
export function weekStatus(start: string, today: string): 'complete' | 'in_progress' | 'future' {
  if (start > today) return 'future';
  return weekIsComplete(start, today) ? 'complete' : 'in_progress';
}

// ---------- Rule 7: missing data is missing, never zero ----------
export function studioMonthStatus(month: string): 'missing' | 'ok' {
  return month < STUDIO_DATA_STARTS ? 'missing' : 'ok';
}
export function sumOrNull(xs: (number | null | undefined)[]): number | null {
  const v = xs.filter((x): x is number => typeof x === 'number');
  return v.length ? round2(v.reduce((a, b) => a + b, 0)) : null;
}

// ---------- Rule 8: expected money is never income ----------
export const EXPECTED_LABELS = ['Booked', 'Likely', 'Pending', 'Estimate'] as const;
export type Expected = { label: string; amount: number | null };
export function incomeExcludingExpected(paid: number, _expected: Expected[]): number {
  return paid; // expected items are listed, never added
}

// ---------- Metric dictionary ----------
export function weekCash(w: Pick<Week, 'sessions' | 'remote' | 'beats'>): number | null {
  return sumOrNull([w.sessions, w.remote, w.beats]);
}
/** Weekly goal progress = studio-side revenue ÷ weekly goal. */
export function goalProgress(cash: number | null, goal: number | null): number | null {
  if (cash == null || !goal) return null;
  return cash / goal;
}
/** Realized hourly rate = paid-session revenue ÷ paid session hours. */
export function realizedHourly(sessionRevenue: number | null, hours: number | null): number | null {
  if (sessionRevenue == null || !hours) return null;
  return round2(sessionRevenue / hours);
}
/** Vibe → paid = unique vibe artists with ≥1 paid session ÷ unique vibe artists who showed. Booked shown separately. */
export function vibeConversion(vibe: VibeArtist[]): { paid: number; showed: number; booked: number; rate: number | null } {
  const uniq = new Map<string, VibeArtist>();
  for (const v of vibe) {
    const k = v.artist.trim().toLowerCase();
    const prev = uniq.get(k);
    if (!prev || rankOutcome(v) > rankOutcome(prev)) uniq.set(k, v);
  }
  const all = [...uniq.values()];
  const showed = all.filter((v) => v.showed).length;
  const paid = all.filter((v) => v.showed && v.outcome === 'converted').length;
  const booked = all.filter((v) => v.showed && v.outcome === 'booked').length;
  return { paid, showed, booked, rate: showed ? paid / showed : null };
}
function rankOutcome(v: VibeArtist) {
  return { converted: 4, booked: 3, open: 2, closed: 1, no_show: 0 }[v.outcome] + (v.showed ? 0.5 : 0);
}
/** Days to conversion = first paid session date − vibe session date, median. */
export function medianDaysToConversion(vibe: VibeArtist[]): number | null {
  const d = vibe.filter((v) => v.outcome === 'converted' && v.date && v.firstPaid).map((v) => daysBetween(v.date!, v.firstPaid!)).filter((n) => n >= 0);
  return median(d);
}
/** Repeat rate = session clients with ≥2 paid sessions ÷ all session clients. */
export function repeatRate(clients: Client[]): { repeat: number; total: number; rate: number | null } {
  const s = clients.filter((c) => c.kind === 'session' && (c.paidSessions ?? 0) >= 1 && (c.totalPaid ?? 0) > 0);
  const repeat = s.filter((c) => (c.paidSessions ?? 0) >= 2).length;
  return { repeat, total: s.length, rate: s.length ? repeat / s.length : null };
}
/** Client concentration = top-2 clients' paid-session revenue ÷ all paid-session revenue. */
export function concentration(clients: Client[]): { top2: number; total: number; share: number | null; names: string[] } {
  const s = clients.filter((c) => c.kind === 'session' && (c.totalPaid ?? 0) > 0).sort((a, b) => (b.totalPaid ?? 0) - (a.totalPaid ?? 0));
  const total = s.reduce((a, c) => a + (c.totalPaid ?? 0), 0);
  const top = s.slice(0, 2);
  const top2 = top.reduce((a, c) => a + (c.totalPaid ?? 0), 0);
  return { top2, total, share: total ? top2 / total : null, names: top.map((c) => c.name) };
}
/** Overdue = past session date + 7 days; the due date itself still counts as on time. */
export function mixDueFromSession(sessionDate: string): string {
  return addDays(sessionDate, MIX_DUE_DAYS);
}
export function isOverdue(due: string | null, today: string): boolean {
  return !!due && today > due;
}
export function mixQueue(mixes: Mix[], today: string) {
  const open = mixes.reduce((a, m) => a + m.count, 0);
  const overdue = mixes.filter((m) => isOverdue(m.due, today)).reduce((a, m) => a + m.count, 0);
  const weekOut = addDays(today, 7);
  const dueWithinWeek = mixes.filter((m) => m.due && !isOverdue(m.due, today) && m.due <= weekOut).reduce((a, m) => a + m.count, 0);
  return { open, overdue, dueWithinWeek, approx: mixes.some((m) => m.countApprox) };
}
/** Catalog earning % = registered works that appear on a statement ÷ registered works. */
export function catalogEarning(earned: number | null, registered: number | null): number | null {
  return earned == null || !registered ? null : earned / registered;
}
/** Sync reply rate = Replied ÷ (Contacted + Replied). "Contacted" = reached, no reply yet. */
export function syncReplyRate(replied: number | null, contactedNoReply: number | null): number | null {
  if (replied == null || contactedNoReply == null || replied + contactedNoReply === 0) return null;
  return replied / (replied + contactedNoReply);
}
/** Brief conversion by company = briefs with Status Contract or Paid/Placed ÷ all briefs for that company. */
export function briefConversion(briefs: { company: string | null; status: string | null }[]) {
  const by = new Map<string, { total: number; won: number }>();
  for (const b of briefs) {
    const k = b.company ?? 'Other';
    const e = by.get(k) ?? { total: 0, won: 0 };
    e.total++;
    if (b.status === 'Contract' || b.status === 'Paid/Placed') e.won++;
    by.set(k, e);
  }
  return [...by.entries()].map(([company, e]) => ({ company, ...e, rate: e.total ? e.won / e.total : null }));
}
/** Scouting reply/sale rate = replied (or paid) ÷ contacted, per lane. */
export function scoutRate(hits: number | null, contacted: number | null): number | null {
  return hits == null || !contacted ? null : hits / contacted;
}
/** Rolling 30-day revenue: studio cash dated in the last 30 days, today inclusive. */
export function rolling30(txns: StudioTxn[], today: string): number {
  return studioCash(txns, addDays(today, -29), today);
}

// ---------- Momentum: equal windows of complete weeks, never before data starts ----------
export type MomentumResult = {
  windowWeeks: number;
  recent: { from: string; to: string; total: number };
  prior: { from: string; to: string; total: number };
  change: number | null; // fraction
  label: string;
  spark: { start: string; total: number; inProgress: boolean }[];
} | { windowWeeks: 0; reason: string; spark: { start: string; total: number; inProgress: boolean }[] };

export function momentum(weeks: Week[], today: string, dataStart = STUDIO_WEEKS_START): MomentumResult {
  const sorted = [...weeks].filter((w) => w.start >= dataStart).sort((a, b) => a.start.localeCompare(b.start));
  const complete = sorted.filter((w) => weekStatus(w.start, today) === 'complete' && weekCash(w) != null);
  const spark = sorted.slice(-8).map((w) => ({ start: w.start, total: weekCash(w) ?? 0, inProgress: weekStatus(w.start, today) !== 'complete' }));
  const n = Math.min(4, Math.floor(complete.length / 2));
  if (n < 2) return { windowWeeks: 0, reason: `Only ${complete.length} complete week(s) on file — need at least 4 for a 2 vs 2 read.`, spark };
  const recentW = complete.slice(-n);
  const priorW = complete.slice(-2 * n, -n);
  const tot = (ws: Week[]) => round2(ws.reduce((a, w) => a + (weekCash(w) ?? 0), 0));
  const recent = { from: recentW[0].start, to: addDays(recentW[n - 1].start, 6), total: tot(recentW) };
  const prior = { from: priorW[0].start, to: addDays(priorW[n - 1].start, 6), total: tot(priorW) };
  return {
    windowWeeks: n,
    recent,
    prior,
    change: prior.total > 0 ? (recent.total - prior.total) / prior.total : null,
    label: n === 4 ? 'Last 4 complete weeks vs the 4 before' : `Last ${n} complete weeks vs the ${n} before (fewer than 8 complete weeks on file)`,
    spark,
  };
}

/** Pace scenarios (Revenue & Trajectory definitions). Arithmetic is returned so the UI can show it. */
export function pace(weeks: Week[], today: string) {
  const sorted = [...weeks].sort((a, b) => a.start.localeCompare(b.start));
  const firstPaid = sorted.findIndex((w) => (weekCash(w) ?? 0) > 0);
  const since = firstPaid >= 0 ? sorted.slice(firstPaid) : [];
  const last3 = sorted.slice(-3);
  const avg = (ws: Week[]) => (ws.length ? ws.reduce((a, w) => a + (weekCash(w) ?? 0), 0) / ws.length : null);
  const includesInProgress = sorted.length > 0 && weekStatus(sorted[sorted.length - 1].start, today) !== 'complete';
  return {
    conservative: { weekly: avg(since), basis: since.map((w) => weekCash(w) ?? 0), from: since[0]?.start ?? null },
    present: { weekly: avg(last3), basis: last3.map((w) => weekCash(w) ?? 0) },
    includesInProgress,
  };
}

// ---------- helpers ----------
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
export function ledgerTotal(rows: LedgerRow[], pred: (r: LedgerRow) => boolean): number | null {
  return sumOrNull(rows.filter(pred).map((r) => r.amount));
}
export function quarterKey(statement: string): { year: number; q: number } | null {
  const m = /(\d{4})\s*Q([1-4])/i.exec(statement);
  return m ? { year: Number(m[1]), q: Number(m[2]) } : null;
}
export function bmiChange(bmi: BmiStatement[]) {
  const s = bmi.map((b) => ({ ...b, k: quarterKey(b.statement) })).filter((b) => b.k && b.royalties != null).sort((a, b) => a.k!.year - b.k!.year || a.k!.q - b.k!.q);
  const latest = s[s.length - 1];
  if (!latest) return null;
  const prevQ = s[s.length - 2] ?? null;
  const yoy = s.find((b) => b.k!.year === latest.k!.year - 1 && b.k!.q === latest.k!.q) ?? null;
  const pct = (a: number, b: number | null | undefined) => (b ? (a - b) / b : null);
  return {
    latest,
    qoq: prevQ ? pct(latest.royalties!, prevQ.royalties) : null,
    prevQ,
    yoy: yoy ? pct(latest.royalties!, yoy.royalties) : null,
    yoyRow: yoy,
  };
}
export { weekStart };
