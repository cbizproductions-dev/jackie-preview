/** Everything the screens show that is computed (not read) lives here, so it's unit-testable. */
import type { Snapshot, Metric, Week, DataIssue } from './schema';
import {
  DEFAULT_STRETCH_GOAL, DEFAULT_WEEKLY_GOAL, bmiChange, concentration, isOverdue, ledgerTotal, mixQueue, momentum,
  realizedHourly, repeatRate, medianDaysToConversion, vibeConversion, weekCash, weekStatus, sumOrNull, round2,
} from './rules';
import { addDays, daysBetween, monthKey, prevMonthKey, weekStart, labelDay } from './time';
import * as H from './health';

export const ROOMS = {
  home: 'https://app.notion.com/p/41e8b67fa84e81bba5dcf0cfd59f4830',
  cash: 'https://app.notion.com/p/41e8b67fa84e818283ffdb9b4b8af4e4',
  revenue: 'https://app.notion.com/p/41e8b67fa84e818da1a0f714aebb7077',
  studio: 'https://app.notion.com/p/41e8b67fa84e81898e52d4863e6ef675',
  beats: 'https://app.notion.com/p/41e8b67fa84e8165855ad8a0016c3bed',
  sync: 'https://app.notion.com/p/41e8b67fa84e81fe8e6ec5d00fbd3232',
  contracts: 'https://app.notion.com/p/41e8b67fa84e8146bdb4c7510c69bfc0',
  strategy: 'https://app.notion.com/p/41e8b67fa84e8128a28aced006840039',
  career: 'https://app.notion.com/p/41e8b67fa84e8109bbc9f7bbb64101d2',
  system: 'https://app.notion.com/p/41e8b67fa84e812b805de57f67067498',
  studioBoard: 'https://app.notion.com/p/4118b67fa84e815d87f9da794bb520d8',
  calendar: 'https://app.notion.com/p/4178b67fa84e81d5a551c62aa4d62c46',
  briefBoard: 'https://app.notion.com/p/41b8b67fa84e81cebdcecf359661e777',
  royalty: 'https://app.notion.com/p/4178b67fa84e815db947ef2baf0e563a',
  vault: 'https://app.notion.com/p/ee36a866c6f74c14ab243f5377cff8bc',
  syncTracker: 'https://app.notion.com/p/40a8b67fa84e817789e6e7e10e23edd1',
  scout: 'https://app.notion.com/p/4088b67fa84e81b4af51c5e44d03c171',
  leases: 'https://app.notion.com/p/058a6cd1bf004ec88c9b3204f9050837',
  goals: 'https://app.notion.com/p/41e8b67fa84e818b8766d7638ea3be2d',
  intel: 'https://app.notion.com/p/41e8b67fa84e812cbfbbd875db88e23e',
  ledger: 'https://app.notion.com/p/41e8b67fa84e8129b391da63aeaa8972',
  scorecard: 'https://app.notion.com/p/41e8b67fa84e81989b1fe343221cde6a',
  bmi: 'https://app.notion.com/p/41e8b67fa84e8145b9eec92c5c4c6f3c',
  maint: 'https://app.notion.com/p/41e8b67fa84e81a4aa3ade6a1840e3db',
  hq: 'https://app.notion.com/p/1488b67fa84e80f69ff0c33b8ecc1b94',
} as const;

/** Durango hold: nobody from the Durango sync conference is ever an action or outreach target. */
export const isDurango = (s: string) => /durango/i.test(s);

export function goalTargets(s: Snapshot): { goal: number; stretch: number; stretchFromConfig: boolean; goalUrl: string | null; stretchUrl: string | null } {
  const weekly = s.goals.filter((g) => /weekly/i.test(g.period) && g.unit === '$' && g.target);
  const sorted = [...weekly].sort((a, b) => a.target! - b.target!);
  const goalRow = sorted[0];
  const stretchRow = sorted.length > 1 ? sorted[sorted.length - 1] : undefined;
  return {
    goal: goalRow?.target ?? DEFAULT_WEEKLY_GOAL,
    stretch: stretchRow?.target ?? DEFAULT_STRETCH_GOAL,
    stretchFromConfig: !stretchRow,
    goalUrl: goalRow?.url ?? null,
    stretchUrl: stretchRow?.url ?? null,
  };
}

export function currentWeek(s: Snapshot): Week | null {
  const ws = weekStart(s.today);
  return s.weeks.find((w) => w.start === ws) ?? null;
}

const m = (value: number | null, unit: Metric['unit'], period: string, source: string, asOf: string, status: Metric['status'], note = ''): Metric => ({
  value, unit, period, source, asOf, status: value == null && status === 'ok' ? 'missing' : status, note,
});

export function thisWeekMetric(s: Snapshot): Metric {
  const w = currentWeek(s);
  const ws = weekStart(s.today);
  const period = `${labelDay(ws, { month: 'short', day: 'numeric' })}–${labelDay(addDays(ws, 6), { month: 'short', day: 'numeric' })}`;
  if (!w) return m(null, '$', period, 'Weekly Scorecard', s.generatedAt, 'missing', 'No row for this week yet — the daily refresh creates it on Mondays');
  return m(weekCash(w), '$', period, 'Weekly Scorecard (from Studio Board)', s.generatedAt, weekStatus(w.start, s.today) === 'complete' ? 'ok' : 'in_progress', w.notes);
}

export function yearMetrics(s: Snapshot) {
  const year = s.today.slice(0, 4);
  const byYear = new Map<string, number>();
  for (const r of s.ledger) if (r.amount != null) byYear.set(r.year, round2((byYear.get(r.year) ?? 0) + r.amount));
  const ytd = byYear.get(year) ?? null;
  const prior = [...byYear.entries()].filter(([y]) => y < year).sort((a, b) => b[1] - a[1]);
  const best = prior[0] ? { year: prior[0][0], total: prior[0][1] } : null;
  const lastYear = byYear.get(String(Number(year) - 1)) ?? null;
  return {
    ytd: m(ytd, '$', `${year} to date`, 'Income Ledger', s.generatedAt, ytd == null ? 'missing' : 'ok', 'Verified music income: BMI by statement year + confirmed direct sync fees + studio-side cash'),
    best, lastYear, byYear: [...byYear.entries()].sort((a, b) => a[0].localeCompare(b[0])), year,
  };
}

export function monthMetrics(s: Snapshot) {
  const mk = monthKey(s.today);
  const pk = prevMonthKey(mk);
  const studioLanes = ['Studio sessions', 'Remote mix/master', 'Beat leases'];
  const studio = (k: string) => ledgerTotal(s.ledger, (r) => r.month === k && studioLanes.includes(r.lane));
  const all = (k: string) => ledgerTotal(s.ledger, (r) => r.month === k);
  return { mk, pk, studioThis: studio(mk), studioPrev: studio(pk), allThis: all(mk), allPrev: all(pk) };
}

/** Same calendar span last month (1st through today's day-of-month), from weekly rows isn't possible, so month-to-date vs full last month is labeled as such. */
export function laneTotals(s: Snapshot, year: string) {
  const lanes = [
    { key: 'Studio sessions', label: 'Studio sessions', color: 'var(--lane-studio)' },
    { key: 'Direct sync fees', label: 'Sync upfront fees', color: 'var(--lane-sync)' },
    { key: 'BMI royalties', label: 'BMI royalties', color: 'var(--lane-bmi)' },
    { key: 'Remote mix/master', label: 'Remote mix/master', color: 'var(--lane-remote)' },
    { key: 'Beat leases', label: 'Beat leases', color: 'var(--lane-beats)' },
  ];
  const rows = lanes.map((l) => ({ ...l, total: ledgerTotal(s.ledger, (r) => r.year === year && r.lane === l.key), basis: s.ledger.find((r) => r.lane === l.key)?.basis ?? '' }));
  const sum = rows.reduce((a, r) => a + (r.total ?? 0), 0);
  return { rows: rows.map((r) => ({ ...r, share: sum && r.total != null ? r.total / sum : null })), sum: round2(sum) };
}

export type Move = { what: string; why: string; source: string; url: string; cat: 'overdue' | 'money' | 'deadline' | 'now'; sort: number };

export function todaysMoves(s: Snapshot, limit = 6): Move[] {
  const out: Move[] = [];
  const t = s.today;
  for (const mx of s.studio.mixes) {
    if (isOverdue(mx.due, t)) {
      const d = daysBetween(mx.due!, t);
      out.push({ what: `Deliver ${mx.client}’s ${mx.countApprox ? '~' : ''}${mx.count} mix${mx.count > 1 ? 'es' : ''}`, why: `Overdue ${d} day${d === 1 ? '' : 's'} (due ${labelDay(mx.due!)})`, source: 'Studio Board — Muse', url: ROOMS.studioBoard, cat: 'overdue', sort: -d });
    }
  }
  for (const td of s.cashMoves) {
    if (td.checked || isDurango(td.text)) continue;
    const money = /\$|deposit|owed|chase|pay|lease/i.test(td.text);
    out.push({ what: td.text, why: money ? 'Money owed or in reach' : 'Money move this week', source: 'Cash Flow Radar', url: ROOMS.cash, cat: money ? 'money' : 'deadline', sort: 0 });
  }
  const week = addDays(t, 7);
  for (const b of s.briefs) {
    const due = b.round2 && b.round2End && b.round2End >= t ? b.round2 : b.due;
    const end = b.round2End ?? due;
    if (due && end && end >= t && due <= week && !/submitted|paid|passed|expired|not taking|contract/i.test(b.status ?? ''))
      out.push({ what: `${b.company ?? ''} ${b.brief}${b.round2 ? ' — round 2' : ''}`.trim(), why: `Due ${labelDay(due)}${b.round2End && b.round2End !== due ? `–${labelDay(b.round2End, { month: 'short', day: 'numeric' })}` : ''}`, source: 'Brief Board — Maestro', url: b.url, cat: 'deadline', sort: daysBetween(t, due) });
  }
  for (const c of s.contracts) {
    const d = c.noticeBy ?? c.nextActionDate;
    if (d && d >= t && d <= week) out.push({ what: c.nextAction || c.agreement, why: `Contract decision ${labelDay(d)}`, source: 'Contract Vault — Maestro', url: c.url, cat: 'deadline', sort: daysBetween(t, d) });
  }
  for (const day of s.calendar.days) {
    if (day.date < t || day.date > week) continue;
    for (const it of day.items) if (it.tags.includes('mix') && !/mix\b.*finish/i.test(it.title) && day.date > t) {
      out.push({ what: it.title.replace(/\s*\(user-reported.*\)/i, ''), why: `Due ${labelDay(day.date)}`, source: 'Rolling 60-Day Calendar — Muse', url: ROOMS.calendar, cat: 'deadline', sort: daysBetween(t, day.date) });
    }
  }
  for (const i of s.insights) {
    if (i.urgency === 'Now' && i.status === 'Active' && i.kind !== 'Data issue' && !isDurango(i.title + i.action))
      out.push({ what: i.action || i.title, why: i.title, source: `Intelligence Feed · ${i.evidence ?? ''}`.trim(), url: i.url, cat: 'now', sort: i.rank ?? 99 });
  }
  const order = { overdue: 0, money: 1, deadline: 2, now: 3 };
  const seen = new Set<string>();
  return out
    .sort((a, b) => order[a.cat] - order[b.cat] || a.sort - b.sort)
    .filter((x) => (seen.has(x.what) ? false : (seen.add(x.what), true)))
    .slice(0, limit);
}

export function catalogNumbers(s: Snapshot): { earned: number | null; registered: number | null; source: string } {
  const texts = [...s.insights.map((i) => i.observation), JSON.stringify(s.cc?.room_strips ?? '')];
  for (const tx of texts) {
    const r = /(\d[\d,]*)\s+of\s+([\d,]+)\s+registered/i.exec(tx);
    if (r) return { earned: Number(r[1].replace(/,/g, '')), registered: Number(r[2].replace(/,/g, '')), source: 'Royalty / Placement Dashboard (via Intelligence Feed)' };
  }
  return { earned: null, registered: null, source: '' };
}

export function knownGaps(s: Snapshot): string[] {
  const gaps: string[] = [];
  if (s.leases.rows === 0 && s.studio.beatSales.length) gaps.push('Beat lease log empty');
  return gaps;
}

export function healthLights(s: Snapshot): H.HealthLight[] {
  const { goal } = goalTargets(s);
  const cat = catalogNumbers(s);
  return [
    H.studioRevenueLight(s.weeks, goal, s.today),
    H.deliveryLight(s.studio.mixes, s.today),
    H.concentrationLight(s.studio.clients),
    H.vibeLight(s.studio.vibe),
    H.beatLight(s.weeks, s.studio.beatSales, s.today),
    H.syncLight(s.briefs),
    H.royaltiesLight(s.bmi),
    H.catalogLight(cat.earned, cat.registered),
    H.contractsLight(s.contracts, s.today),
    H.freshnessLight(s.sources.filter((x) => TRACKED_FOR_FRESHNESS.includes(x.id)), knownGaps(s)),
  ];
}
/** Sources the daily refresh depends on; slow-moving reference databases are shown with their age but don't trip the light. */
export const TRACKED_FOR_FRESHNESS = ['studio', 'calendar', 'refresh'];

export function studioOps(s: Snapshot) {
  // Sessions with an unknown amount (before the Studio Board existed) are left out of $ averages, not counted as $0.
  const sessionClients = s.studio.clients.filter((c) => c.kind === 'session' && c.totalPaid != null);
  const sessionRevenue = sumOrNull(sessionClients.map((c) => c.totalPaid));
  const paidSessions = sumOrNull(sessionClients.map((c) => c.paidSessions));
  const hours = sumOrNull(s.weeks.map((w) => w.paidHours));
  return {
    sessionRevenue,
    paidSessions,
    avgSession: sessionRevenue != null && paidSessions ? round2(sessionRevenue / paidSessions) : null,
    hours,
    hourly: realizedHourly(sessionRevenue, hours),
    repeat: repeatRate(s.studio.clients),
    medianDays: medianDaysToConversion(s.studio.vibe),
    conc: concentration(s.studio.clients),
    vibe: vibeConversion(s.studio.vibe),
    queue: mixQueue(s.studio.mixes, s.today),
  };
}

/** Rebook candidates: one-time session clients whose last session was 14+ days ago. */
export function rebookCandidates(s: Snapshot) {
  return s.studio.clients.filter((c) => c.kind === 'session' && c.paidSessions === 1 && c.lastSession && daysBetween(c.lastSession, s.today) >= 14 && (c.totalPaid ?? 0) > 0);
}

/**
 * Cross-source checks the Console runs itself. Each names both sources. Never picks a winner.
 */
export function consoleConflicts(s: Snapshot, studioBoardWeekLine: { amount: number; start: string } | null, studioBoardOpenLine: { open: number; overdue: number } | null): DataIssue[] {
  const issues: DataIssue[] = [];
  const w = currentWeek(s);
  if (studioBoardWeekLine && w && studioBoardWeekLine.start === w.start) {
    const sc = weekCash(w);
    if (sc != null && Math.abs(sc - studioBoardWeekLine.amount) > 0.5)
      issues.push({ title: 'This week’s studio cash disagrees', sources: ['Weekly Scorecard', 'Studio Board — Muse mirror'], detail: `Scorecard $${sc} vs Studio Board $${studioBoardWeekLine.amount} for the week of ${labelDay(w.start)}. Usually timing: the scorecard updates at the 6:47 AM refresh.`, url: ROOMS.studioBoard, origin: 'console' });
  }
  if (studioBoardOpenLine) {
    const q = mixQueue(s.studio.mixes, s.today);
    if (q.open !== studioBoardOpenLine.open)
      issues.push({ title: 'Open-mix count disagrees', sources: ['Studio Board “Money” line', 'Studio Board “Mixes due” list'], detail: `The board’s summary says ${studioBoardOpenLine.open} open; its itemised list adds up to ${q.open}${q.approx ? ' (some counts are approximate, e.g. “~2”)' : ''}.`, url: ROOMS.studioBoard, origin: 'console' });
  }
  const g = s.goals.find((x) => /weekly/i.test(x.period) && x.unit === '$');
  if (g && w && g.current != null) {
    const sc = weekCash(w);
    if (sc != null && Math.abs(sc - g.current) > 0.5)
      issues.push({ title: 'Weekly goal “Current” lags the scorecard', sources: ['Goals & Milestones', 'Weekly Scorecard'], detail: `Goals shows $${g.current}; the scorecard row shows $${sc}. Usually timing between refreshes.`, url: ROOMS.goals, origin: 'console' });
  }
  for (const b of s.briefs) {
    if (b.status === 'In progress' && b.due && b.due < s.today)
      issues.push({ title: `Brief past due but still “In progress”: ${b.brief}`, sources: ['Brief Board — Maestro', 'Calendar / email records'], detail: `Due ${labelDay(b.due)}. Either delivered and the board is stale, or it slipped.`, url: b.url, origin: 'console' });
  }
  return issues;
}

export function bmiSummary(s: Snapshot) {
  return bmiChange(s.bmi);
}

export function freshnessOf(lastEdited: string | null, nowIso: string): 'fresh' | 'stale' {
  if (!lastEdited) return 'stale';
  return (Date.parse(nowIso) - Date.parse(lastEdited)) / 86400000 <= 2 ? 'fresh' : 'stale';
}

export { momentum };
