/**
 * "Since last update": meaningful business changes, found by comparing each fresh read of HQ with the last one.
 * - Only compares a category when its source was read successfully both times (a failed read never looks like a change).
 * - The first run sets a baseline and invents nothing; the only items shown then are ones whose source record carries its own date.
 * - Refresh timestamps, page edits and routine notes are never events.
 * Stored inside the existing state:v1 KV record. No new database, no schedule.
 */
import type { Snapshot } from '../shared/schema';
import { isDurango } from '../shared/derive';
import { weekCash } from '../shared/rules';
import { addDays, weekStart, labelDay } from '../shared/time';
const dd = (d: string | null | undefined) => (d ? labelDay(d, { month: 'short', day: 'numeric' }) : '');

export type ChangeEvent = {
  key: string;
  /** When the dashboard first saw it (ISO). */
  seenAt: string;
  /** The date the source record gives, if any (YYYY-MM-DD). */
  recordDate: string | null;
  kind: 'money' | 'placement' | 'accepted' | 'submitted' | 'brief' | 'booking' | 'client' | 'delivered' | 'overdue' | 'goal' | 'resolved' | 'light' | 'royalty';
  title: string;
  detail: string;
  priority: number;
  tone: 'ok' | 'warn' | 'bad' | 'info';
  source: string;
  url: string;
};
type Facts = {
  briefs?: Record<string, { s: string; t: string; c: string; d: string | null }>;
  mixes?: Record<string, { due: string | null; n: number; od: boolean }>;
  syncChecks?: string[];
  deliveries?: string[];
  beatSales?: string[];
  upcoming?: string[];
  clients?: string[];
  week?: { start: string; cash: number };
  lanes?: { year: string; totals: Record<string, number> };
  bmi?: string[];
  goals?: string[];
  issues?: string[];
  lights?: Record<string, string>;
};
export type ChangeState = { v?: number; facts: Facts; events: ChangeEvent[]; baselineAt: string };
const VERSION = 2;

const KEEP_DAYS = 30;
const MAX_EVENTS = 60;
const money = (n: number) => `$${(Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
const ROOM = {
  briefs: 'https://app.notion.com/p/41b8b67fa84e81cebdcecf359661e777',
  studio: 'https://app.notion.com/p/4118b67fa84e815d87f9da794bb520d8',
  scorecard: 'https://app.notion.com/p/41e8b67fa84e81989b1fe343221cde6a',
  ledger: 'https://app.notion.com/p/41e8b67fa84e8129b391da63aeaa8972',
  bmi: 'https://app.notion.com/p/41e8b67fa84e8145b9eec92c5c4c6f3c',
  goals: 'https://app.notion.com/p/41e8b67fa84e818b8766d7638ea3be2d',
  intel: 'https://app.notion.com/p/41e8b67fa84e812cbfbbd875db88e23e',
  cc: 'https://app.notion.com/p/41e8b67fa84e81bba5dcf0cfd59f4830',
};

/** What the dashboard knows right now, per category, only for sources that were read successfully. */
export function factsOf(s: Snapshot): Facts {
  const ok = (id: string) => { const x = s.sources.find((y) => y.id === id); return !!x && (x.state === 'fresh' || x.state === 'stale'); };
  const f: Facts = {};
  if (ok('briefs') && s.briefs.length) f.briefs = Object.fromEntries(s.briefs.filter((b) => b.url).map((b) => [b.url, { s: b.status ?? '', t: b.brief, c: b.company ?? '', d: b.due ?? null }]));
  if (ok('studio')) {
    f.mixes = Object.fromEntries(s.studio.mixes.map((m) => [m.client, { due: m.due, n: m.count, od: !!m.due && m.due < s.today }]));
    f.syncChecks = s.studio.syncChecks.map((c) => `${c.company}|${c.date ?? ''}|${c.amount}`);
    f.deliveries = (s.studio.deliveries ?? []).map((d) => `${d.client}|${d.date}`);
    f.beatSales = s.studio.beatSales.map((b) => `${b.buyer}|${b.date}|${b.amount}`);
    f.upcoming = s.studio.upcoming.map((u) => `${u.who}|${u.date}`);
    f.clients = s.studio.clients.filter((c) => (c.totalPaid ?? 0) > 0).map((c) => c.name);
  }
  if (ok('scorecard')) {
    const ws = weekStart(s.today);
    const w = s.weeks.find((x) => x.start === ws);
    if (w) f.week = { start: ws, cash: weekCash(w) ?? 0 };
  }
  if (ok('ledger')) {
    const year = s.today.slice(0, 4);
    const totals: Record<string, number> = {};
    for (const r of s.ledger) if (r.year === year && r.amount != null) totals[r.lane] = Math.round(((totals[r.lane] ?? 0) + r.amount) * 100) / 100;
    f.lanes = { year, totals };
  }
  if (ok('bmi')) f.bmi = s.bmi.map((b) => b.statement);
  if (ok('goals')) f.goals = s.goals.filter((g) => g.target != null && g.current != null && !/zero|overdue/i.test(g.goal) && g.current >= g.target).map((g) => g.goal);
  if (ok('intel')) f.issues = s.insights.filter((i) => i.kind === 'Data issue' && i.status === 'Active').map((i) => i.title);
  const h = (s.cc as any)?.health;
  if (ok('runbook') && Array.isArray(h)) f.lights = Object.fromEntries(h.map((x: any) => [String(x.area), String(x.state)]));
  return f;
}

const STATUS_EVENT: Record<string, { kind: ChangeEvent['kind']; verb: string; priority: number; tone: ChangeEvent['tone'] }> = {
  'Paid/Placed': { kind: 'placement', verb: 'Paid or placed', priority: 95, tone: 'ok' },
  Paid: { kind: 'placement', verb: 'Paid', priority: 95, tone: 'ok' },
  Placed: { kind: 'placement', verb: 'Placed', priority: 95, tone: 'ok' },
  Contract: { kind: 'accepted', verb: 'Accepted — agreement signed', priority: 85, tone: 'ok' },
  Submitted: { kind: 'submitted', verb: 'Submitted', priority: 70, tone: 'info' },
  'In progress': { kind: 'brief', verb: 'Now in progress', priority: 50, tone: 'info' },
  Committed: { kind: 'brief', verb: 'Taking it on', priority: 50, tone: 'info' },
  Passed: { kind: 'brief', verb: 'Client passed', priority: 40, tone: 'warn' },
};

/** Compare two fact sets and describe what changed. */
export function diff(prev: Facts, cur: Facts, s: Snapshot, nowIso: string): ChangeEvent[] {
  const ev: ChangeEvent[] = [];
  const add = (e: Omit<ChangeEvent, 'seenAt'>) => { if (!isDurango(`${e.title} ${e.detail}`)) ev.push({ ...e, seenAt: nowIso }); };
  const today = s.today;

  // Money: this week's studio-side cash went up (same week only; a new week is not an event).
  if (prev.week && cur.week && prev.week.start === cur.week.start && cur.week.cash > prev.week.cash + 0.005) {
    const d = cur.week.cash - prev.week.cash;
    add({ key: `week:${cur.week.start}:${cur.week.cash}`, recordDate: null, kind: 'money', title: `Studio cash +${money(d)} this week`, detail: `This week is now ${money(cur.week.cash)} (was ${money(prev.week.cash)}).`, priority: 90, tone: 'ok', source: 'Weekly Scorecard', url: ROOM.scorecard });
  }
  // Money: verified income by lane for this year (sync fees, royalties, etc.).
  if (prev.lanes && cur.lanes && prev.lanes.year === cur.lanes.year) {
    for (const [lane, v] of Object.entries(cur.lanes.totals)) {
      const was = prev.lanes.totals[lane] ?? 0;
      if (v > was + 0.005 && !/studio|remote|beat/i.test(lane)) // studio-side lanes are covered by the weekly line
        add({ key: `lane:${cur.lanes.year}:${lane}:${v}`, recordDate: null, kind: /bmi|royalt/i.test(lane) ? 'royalty' : 'money', title: `${lane} +${money(v - was)}`, detail: `${cur.lanes.year} ${lane.toLowerCase()} now ${money(v)} in the Income Ledger.`, priority: /sync/i.test(lane) ? 96 : 88, tone: 'ok', source: 'Income Ledger', url: ROOM.ledger });
    }
  }
  // Sync checks recorded on the Studio Board.
  for (const k of cur.syncChecks ?? []) if (prev.syncChecks && !prev.syncChecks.includes(k)) {
    const [company, date, amt] = k.split('|');
    add({ key: `synccheck:${k}`, recordDate: date || null, kind: 'money', title: `Sync check: ${money(Number(amt))}`, detail: `${company}`, priority: 96, tone: 'ok', source: 'Studio Board', url: ROOM.studio });
  }
  // Beat sales.
  for (const k of cur.beatSales ?? []) if (prev.beatSales && !prev.beatSales.includes(k)) {
    const [buyer, date, amt] = k.split('|');
    add({ key: `beat:${k}`, recordDate: date || null, kind: 'money', title: `Beat sale: ${money(Number(amt))}`, detail: `${buyer}`, priority: 89, tone: 'ok', source: 'Studio Board', url: ROOM.studio });
  }
  // New BMI statement.
  for (const st of cur.bmi ?? []) if (prev.bmi && !prev.bmi.includes(st)) {
    const row = s.bmi.find((b) => b.statement === st);
    add({ key: `bmi:${st}`, recordDate: null, kind: 'royalty', title: `New BMI statement: ${st}`, detail: row?.royalties != null ? `${money(row.royalties)} in royalties${row.newPlacements != null ? ` · ${row.newPlacements} new placements` : ''}.` : 'Added to BMI Statements.', priority: 92, tone: 'ok', source: 'BMI Statements', url: row?.url || ROOM.bmi });
  }
  // Brief Board: new briefs and status moves.
  if (prev.briefs && cur.briefs) {
    for (const [url, b] of Object.entries(cur.briefs)) {
      const was = prev.briefs[url];
      const label = `${b.c ? `${b.c} — ` : ''}${b.t}`;
      const old = !!b.d && b.d < addDays(today, -365);
      if (!was) {
        // Back-filled history (old rows added from email or the Contract Vault) is housekeeping, not news.
        if (['Expired', 'Not taking'].includes(b.s) || (b.d && b.d < addDays(today, -30))) continue;
        add({ key: `brief-new:${url}`, recordDate: b.d, kind: 'brief', title: `New brief: ${b.t}`, detail: `${b.c || 'Brief Board'} · status ${b.s}${b.d ? ` · due ${dd(b.d)}` : ''}`, priority: 60, tone: 'info', source: 'Brief Board', url });
      } else if (was.s !== b.s && STATUS_EVENT[b.s]) {
        const m = STATUS_EVENT[b.s];
        add({ key: `brief:${url}:${b.s}`, recordDate: null, kind: m.kind, title: `${m.verb}: ${b.t}`, detail: `${label} · was ${was.s}${old ? ` · brief dated ${dd(b.d)}` : ''}`, priority: old ? 40 : m.priority, tone: m.tone, source: 'Brief Board', url });
      }
    }
  }
  // Studio: bookings, new paying clients, deliveries, newly overdue mixes.
  for (const k of cur.upcoming ?? []) if (prev.upcoming && !prev.upcoming.includes(k)) {
    const [who, date] = k.split('|');
    add({ key: `book:${k}`, recordDate: date, kind: 'booking', title: `Session booked: ${who}`, detail: `On the Studio Board for ${dd(date)}.`, priority: 75, tone: 'ok', source: 'Studio Board', url: ROOM.studio });
  }
  for (const c of cur.clients ?? []) if (prev.clients && !prev.clients.includes(c))
    add({ key: `client:${c}`, recordDate: null, kind: 'client', title: `New paying client: ${c}`, detail: 'First paid session on the Studio Board.', priority: 80, tone: 'ok', source: 'Studio Board', url: ROOM.studio });
  for (const k of cur.deliveries ?? []) if (prev.deliveries && !prev.deliveries.includes(k)) {
    const [client, date] = k.split('|');
    add({ key: `deliv:${k}`, recordDate: date, kind: 'delivered', title: `Mix delivered: ${client}`, detail: 'Delivery recorded on the Studio Board.', priority: 72, tone: 'ok', source: 'Studio Board', url: ROOM.studio });
  }
  if (prev.mixes && cur.mixes) {
    for (const [client, m] of Object.entries(cur.mixes)) {
      const was = prev.mixes[client];
      if (m.od && !(was && was.od && was.due === m.due))
        add({ key: `overdue:${client}:${m.due}`, recordDate: m.due, kind: 'overdue', title: `Mix now overdue: ${client}`, detail: `${m.n} owed, was due ${dd(m.due) || 'n/a'}.`, priority: 86, tone: 'bad', source: 'Studio Board', url: ROOM.studio });
    }
    const before = Object.values(prev.mixes).filter((m) => m.od).length;
    const after = Object.values(cur.mixes).filter((m) => m.od).length;
    if (before > 0 && after === 0) add({ key: `overdue-clear:${today}`, recordDate: null, kind: 'resolved', title: 'No overdue mixes', detail: `Overdue clients went from ${before} to 0.`, priority: 84, tone: 'ok', source: 'Studio Board', url: ROOM.studio });
  }
  // Goals reached.
  for (const g of cur.goals ?? []) if (prev.goals && !prev.goals.includes(g)) {
    const row = s.goals.find((x) => x.goal === g);
    add({ key: `goal:${g}`, recordDate: row?.asOf ?? null, kind: 'goal', title: `Goal reached: ${g}`, detail: row ? `${row.current} of ${row.target}` : '', priority: 87, tone: 'ok', source: 'Goals & Milestones', url: row?.url || ROOM.goals });
  }
  // Data issues closed.
  for (const t of prev.issues ?? []) if (cur.issues && !cur.issues.includes(t))
    add({ key: `issue:${t}`, recordDate: null, kind: 'resolved', title: 'Data issue resolved', detail: t, priority: 45, tone: 'ok', source: 'Intelligence Feed', url: ROOM.intel });
  // Health lights that changed colour in the Command Center refresh.
  if (prev.lights && cur.lights) {
    const rank: Record<string, number> = { green: 0, amber: 1, red: 2 };
    for (const [area, st] of Object.entries(cur.lights)) {
      const was = prev.lights[area];
      if (was && was !== st && rank[st] != null && rank[was] != null) {
        const better = rank[st] < rank[was];
        add({ key: `light:${area}:${was}>${st}:${today}`, recordDate: null, kind: 'light', title: `${area}: ${was} → ${st}`, detail: better ? 'Improved in the Command Center’s refresh.' : 'Got worse in the Command Center’s refresh.', priority: better ? 55 : 78, tone: better ? 'ok' : st === 'red' ? 'bad' : 'warn', source: 'Command Center', url: ROOM.cc });
      }
    }
  }
  return ev;
}

/** First run: nothing is invented. Only records that carry their own date from the last 7 days are listed. */
function datedRecords(s: Snapshot, nowIso: string): ChangeEvent[] {
  const from = addDays(s.today, -6);
  const out: ChangeEvent[] = [];
  for (const d of s.studio.deliveries ?? []) if (d.date && d.date >= from && d.date <= s.today && !isDurango(d.client))
    out.push({ key: `deliv:${d.client}|${d.date}`, seenAt: nowIso, recordDate: d.date, kind: 'delivered', title: `Mix delivered: ${d.client}`, detail: `Delivery recorded on the Studio Board${d.due ? ` (was due ${dd(d.due)})` : ''}.`, priority: 72, tone: 'ok', source: 'Studio Board', url: ROOM.studio });
  for (const b of s.studio.beatSales) if (b.date && b.date >= from && b.date <= s.today && !isDurango(b.buyer))
    out.push({ key: `beat:${b.buyer}|${b.date}|${b.amount}`, seenAt: nowIso, recordDate: b.date, kind: 'money', title: `Beat sale: ${money(b.amount ?? 0)}`, detail: `${b.buyer}${b.items > 1 ? ` · ${b.items} leases` : ''}`, priority: 89, tone: 'ok', source: 'Studio Board', url: ROOM.studio });
  return out;
}

/** Merge new events into the saved list: no repeats, newest kept, 30 days max. */
export function updateChanges(prev: ChangeState | undefined, s: Snapshot, now: Date): ChangeState {
  const nowIso = now.toISOString();
  const cur = factsOf(s);
  if (!prev || prev.v !== VERSION) return { v: VERSION, facts: cur, events: datedRecords(s, nowIso), baselineAt: prev?.baselineAt ?? nowIso };
  // Keep the last known facts for any category that couldn't be read this time.
  const facts: Facts = { ...prev.facts, ...Object.fromEntries(Object.entries(cur).filter(([, v]) => v !== undefined)) };
  const fresh = diff(prev.facts, cur, s, nowIso);
  const seen = new Set(prev.events.map((e) => e.key));
  const cutoff = now.getTime() - KEEP_DAYS * 86400000;
  const events = [...fresh.filter((e) => !seen.has(e.key)), ...prev.events].filter((e) => Date.parse(e.seenAt) >= cutoff).slice(0, MAX_EVENTS);
  return { v: VERSION, facts, events, baselineAt: prev.baselineAt };
}
