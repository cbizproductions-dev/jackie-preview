// Counting rules + metric dictionary. All examples are synthetic (not real business figures) and hand-checked.
import { describe, it, expect } from 'vitest';
import * as R from '../src/shared/rules';
import { weekStart, weekIsComplete, addDays, parseLooseDate, nyDate } from '../src/shared/time';
import type { Week, VibeArtist, Client, Mix } from '../src/shared/schema';

const wk = (start: string, sessions: number | null, remote = 0, beats = 0): Week => ({
  start, label: start, sessions, remote, beats, paidSessions: null, paidHours: null, vibeHeld: null, vibeNoShows: null, sheetStatus: '', confidence: '', goal: 600, notes: '', url: '',
});

describe('time: America/New_York, Monday–Sunday', () => {
  it('weeks start Monday', () => {
    expect(weekStart('2026-11-21')).toBe('2026-11-16'); // Sat → Mon
    expect(weekStart('2026-11-22')).toBe('2026-11-16'); // Sun belongs to the same week
    expect(weekStart('2026-11-23')).toBe('2026-11-23'); // Mon
  });
  it('NY date differs from UTC late at night', () => {
    expect(nyDate(new Date('2026-11-22T03:30:00Z'))).toBe('2026-11-21'); // 10:30 PM EST Saturday
  });
  it('parses loose dates', () => {
    expect(parseLooseDate('Tue Nov 10, 2026 (overdue)')).toBe('2026-11-10');
    expect(parseLooseDate('Fri Nov 13', 2026)).toBe('2026-11-13');
  });
});

describe('Rule 1 · studio revenue = cash received', () => {
  const txns: R.StudioTxn[] = [
    { kind: 'payment', date: '2026-11-02', amount: 150, lane: 'session' },
    { kind: 'scheduled', date: '2026-11-04', amount: 150 }, // scheduled session: not revenue
    { kind: 'deposit', date: '2026-11-03', amount: 50, appliedToSessionOn: null, sessionHappened: false }, // held
    { kind: 'sync_check', date: '2026-11-05', amount: 100 }, // never studio cash
    { kind: 'bmi_statement', date: '2026-11-05', amount: 500 }, // never studio cash
  ];
  it('counts only cash received: 150', () => expect(R.studioCash(txns, '2026-11-02', '2026-11-08')).toBe(150));
  it('deposits are held until the session happens, then count on the session date', () => {
    const held: R.StudioTxn = { kind: 'deposit', date: '2026-10-20', amount: 50, appliedToSessionOn: '2026-11-04', sessionHappened: true };
    expect(R.studioCash([held], '2026-10-19', '2026-10-25')).toBe(0); // receipt week: 0
    expect(R.studioCash([held], '2026-11-02', '2026-11-08')).toBe(50); // session week: 50
  });
  it('a prepayment covering two sessions counts once, on the receipt date', () => {
    const pre: R.StudioTxn = { kind: 'prepayment', date: '2026-10-22', amount: 300, coversSessions: ['2026-10-22', '2026-10-27'] };
    expect(R.studioCash([pre], '2026-10-19', '2026-10-25')).toBe(300);
    expect(R.studioCash([pre], '2026-10-26', '2026-11-01')).toBe(0); // second session week: not counted again
    expect(R.studioCash([pre], '2026-10-01', '2026-10-31')).toBe(300); // month: once
  });
  it('rolling 30 days includes today and 29 days back', () => {
    const t: R.StudioTxn[] = [
      { kind: 'payment', date: '2026-10-23', amount: 180, lane: 'session' }, // day -29 → in
      { kind: 'payment', date: '2026-10-22', amount: 300, lane: 'session' }, // day -30 → out
    ];
    expect(R.rolling30(t, '2026-11-21')).toBe(180);
  });
});

describe('Rule 2 · BMI is royalties by statement year, never in the weekly goal', () => {
  it('groups by statement year', () => {
    expect(R.bmiByYear([{ statement: '2025 Q4', royalties: 100 }, { statement: '2026 Q1', royalties: 200.5 }, { statement: '2026 Q2', royalties: 50.25 }])).toEqual({ '2025': 100, '2026': 250.75 });
  });
  it('weekly cash ignores BMI and sync checks (only sessions + remote + beats)', () => {
    expect(R.weekCash(wk('2026-11-16', 300, 0, 120))).toBe(420);
  });
});

describe('Rule 3 · direct sync fees only when Confirmed paid; Studio Board sync checks never added again', () => {
  const dash: R.SyncPayment[] = [
    { id: 'a', amount: 100, status: 'Confirmed paid', date: '2026-11-09' },
    { id: 'b', amount: 100, status: 'Pending', date: '2026-04-27' },
    { id: 'c', amount: 300, status: 'Invoiced', date: '2026-10-01' },
    { id: 'd', amount: 50, status: 'unclear', date: '2026-10-01' },
  ];
  it('pending, invoiced and unclear are excluded: 100', () => expect(R.confirmedSyncFees(dash)).toBe(100));
  it('the board’s sync-check log of the same $100 is not double counted', () => expect(R.confirmedSyncFees(dash, [{ amount: 100 }])).toBe(100));
});

describe('Rule 4 · a beat bundle is one transaction', () => {
  it('2 leases bought together = 1 purchase', () => {
    const r = R.beatTransactions([{ buyer: 'Buyer A', date: '2026-11-19', amount: 100 }, { buyer: 'Buyer A', date: '2026-11-19', amount: 60 }]);
    expect(r).toEqual({ count: 1, total: 160, average: 160 });
  });
  it('two separate buyers = 2 transactions', () => {
    expect(R.beatTransactions([{ buyer: 'A', date: '2026-11-19', amount: 100 }, { buyer: 'B', date: '2026-11-19', amount: 100 }]).count).toBe(2);
  });
});

describe('Rule 5 · TuneSat detections are pipeline, not income', () => {
  const items: R.IncomeItem[] = [{ lane: 'BMI', amount: 500, source: 'bmi_statement' }, { lane: 'TuneSat', amount: 400, source: 'tunesat' }];
  it('income excludes TuneSat', () => expect(R.verifiedIncome(items)).toBe(500));
  it('pipeline is shown separately', () => expect(R.tunesatPipeline(items)).toBe(400));
});

describe('Rule 6 · an incomplete week is in progress', () => {
  it('in progress through Sunday, complete from Monday', () => {
    expect(R.weekStatus('2026-11-16', '2026-11-22')).toBe('in_progress');
    expect(R.weekStatus('2026-11-16', '2026-11-23')).toBe('complete');
    expect(weekIsComplete('2026-11-16', '2026-11-21')).toBe(false);
  });
});

describe('Rule 7 · missing ≠ 0', () => {
  it('studio months before Oct 2026 are missing', () => {
    expect(R.studioMonthStatus('2026-09')).toBe('missing');
    expect(R.studioMonthStatus('2026-10')).toBe('ok');
  });
  it('sum of nothing is null, not 0', () => {
    expect(R.sumOrNull([null, undefined])).toBeNull();
    expect(R.weekCash(wk('2026-11-16', null, null as any, null as any))).toBeNull();
  });
});

describe('Rule 8 · expected money is never income', () => {
  it('expected items are listed, not added', () => expect(R.incomeExcludingExpected(1000, [{ label: 'Booked', amount: 75 }, { label: 'Pending', amount: 450 }])).toBe(1000));
});

describe('Metric dictionary', () => {
  it('weekly goal progress = cash ÷ goal: 420/600 = 0.7', () => expect(R.goalProgress(420, 600)).toBeCloseTo(0.7, 5));
  it('realized hourly = 1000 ÷ 16 hrs = 62.50', () => expect(R.realizedHourly(1000, 16)).toBe(62.5));
  it('vibe → paid per unique artist who showed; booked separate', () => {
    const v = (artist: string, outcome: VibeArtist['outcome'], showed = true): VibeArtist => ({ artist, date: '2026-11-01', showed, outcome, firstPaid: outcome === 'converted' ? '2026-11-11' : null, note: '' });
    const r = R.vibeConversion([v('A', 'converted'), v('a', 'open'), v('B', 'booked'), v('C', 'open'), v('D', 'no_show', false)]);
    expect(r).toEqual({ paid: 1, showed: 3, booked: 1, rate: 1 / 3 }); // A (deduped) paid; A,B,C showed; D excluded
  });
  it('median days to conversion: 0, 6, 12, 20 → 9', () => {
    const mk = (d: number): VibeArtist => ({ artist: String(d), date: '2026-11-01', firstPaid: addDays('2026-11-01', d), showed: true, outcome: 'converted', note: '' });
    expect(R.medianDaysToConversion([mk(0), mk(6), mk(12), mk(20)])).toBe(9);
  });
  const c = (name: string, n: number, paid: number): Client => ({ name, paidSessions: n, lastSession: '2026-11-01', totalPaid: paid, rate: null, kind: 'session', note: '' });
  const clients = [c('A', 4, 500), c('B', 3, 300), c('C', 1, 100), c('D', 1, 50), c('E', 1, 50)];
  it('repeat rate = 2 of 5 = 40%', () => expect(R.repeatRate(clients)).toEqual({ repeat: 2, total: 5, rate: 0.4 }));
  it('client concentration = (500+300)/1000 = 80%', () => {
    const r = R.concentration(clients);
    expect(r.top2).toBe(800);
    expect(r.total).toBe(1000);
    expect(r.share).toBe(0.8);
  });
  it('mix due = session + 7; the due date itself is on time', () => {
    expect(R.mixDueFromSession('2026-11-13')).toBe('2026-11-20');
    expect(R.isOverdue('2026-11-20', '2026-11-20')).toBe(false);
    expect(R.isOverdue('2026-11-20', '2026-11-21')).toBe(true);
  });
  it('mix queue counts mixes, not rows', () => {
    const mixes: Mix[] = [
      { client: 'A', due: '2026-11-10', count: 2, countApprox: true, note: '' },
      { client: 'B', due: '2026-11-20', count: 1, countApprox: false, note: '' },
      { client: 'C', due: '2026-11-23', count: 2, countApprox: false, note: '' },
      { client: 'A', due: '2026-11-24', count: 3, countApprox: false, note: '' },
    ];
    expect(R.mixQueue(mixes, '2026-11-21')).toEqual({ open: 8, overdue: 3, dueWithinWeek: 5, approx: true });
  });
  it('catalog earning = 50 / 500 = 10%', () => expect(R.catalogEarning(50, 500)).toBe(0.1));
  it('sync reply rate = 30 / (90 + 30) = 25%', () => expect(R.syncReplyRate(30, 90)).toBe(0.25));
  it('brief conversion by company: Contract or Paid/Placed ÷ all', () => {
    const r = R.briefConversion([{ company: 'X', status: 'Contract' }, { company: 'X', status: 'Paid/Placed' }, { company: 'X', status: 'Expired' }, { company: 'X', status: 'Submitted' }]);
    expect(r[0]).toEqual({ company: 'X', total: 4, won: 2, rate: 0.5 });
  });
  it('scouting sale rate = 2 / 400 = 0.5% per lane', () => expect(R.scoutRate(2, 400)).toBe(0.005));
  it('BMI QoQ and YoY', () => {
    const b = (statement: string, royalties: number) => ({ statement, royalties, usTv: null, streaming: null, international: null, radio: null, newPlacements: null, plays: null, titlesEarning: null, countries: null, shows: null, networks: null, url: '' });
    const r = R.bmiChange([b('2025 Q2', 400), b('2026 Q1', 600), b('2026 Q2', 500)])!;
    expect(r.yoy).toBe(0.25); // (500-400)/400
    expect(r.qoq).toBeCloseTo(-0.1667, 3); // (500-600)/600
  });
});

describe('Momentum · equal windows of complete weeks, never before the data starts', () => {
  const weeks = [
    wk('2026-09-21', 999), // before data start → ignored
    wk('2026-09-28', 0), wk('2026-10-05', 200), wk('2026-10-12', 0), wk('2026-10-19', 500),
    wk('2026-10-26', 0), wk('2026-11-02', 300), wk('2026-11-09', 600), wk('2026-11-16', 700), // last is in progress on Nov 21
  ];
  it('7 complete weeks → 3 vs 3, labelled', () => {
    const r = R.momentum(weeks, '2026-11-21') as Extract<R.MomentumResult, { windowWeeks: number; recent: unknown }>;
    expect(r.windowWeeks).toBe(3);
    expect(r.recent.total).toBe(900); // 0 + 300 + 600
    expect(r.prior.total).toBe(700); // 200 + 0 + 500
    expect(r.change).toBeCloseTo(0.2857, 3); // 200/700
    expect(r.prior.from).toBe('2026-10-05'); // never reaches Sep 21
    expect(r.label).toMatch(/3 complete weeks/);
  });
  it('8+ complete weeks → 4 vs 4', () => {
    const r = R.momentum([...weeks, wk('2026-11-23', 100)], '2026-11-30') as any;
    expect(r.windowWeeks).toBe(4);
    expect(r.label).toBe('Last 4 complete weeks vs the 4 before');
  });
  it('fewer than 4 complete weeks → no comparison', () => {
    expect(R.momentum(weeks.slice(1, 4), '2026-11-21').windowWeeks).toBe(0);
  });
});

describe('Pace (estimates)', () => {
  it('present pace = avg of last 3 weeks: (300+600+700)/3 = 533.33', () => {
    const p = R.pace([wk('2026-11-02', 300), wk('2026-11-09', 600), wk('2026-11-16', 700)], '2026-11-21');
    expect(p.present.weekly).toBeCloseTo(533.33, 2);
    expect(p.includesInProgress).toBe(true);
  });
});
