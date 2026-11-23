import { describe, it, expect } from 'vitest';
import { assemble, refreshPass, looksIncomplete } from '../src/worker/snapshot';
import { NotionReader } from '../src/worker/notion';
import { briefNextDate, workingBriefs, mixBriefQueue, hoursFrom, bookedAhead } from '../src/shared/work';
import { followUps, waitingOnKris } from '../src/shared/followups';
import { statementMonth, syncMonthly } from '../src/shared/synctraj';
import { artistProfiles } from '../src/worker/parsers';
import { thisWeekMetric } from '../src/shared/derive';

// Synthetic data only.
const brief = (brief: string, status: string, due: string | null, round2: string | null = null, round2End: string | null = null) => ({ brief, company: 'Lib', status, type: 'WFH', code: '', due, round2, round2End, deliverables: '', notes: '', url: `https://app.notion.com/p/${brief.replace(/\W/g, '')}` });
function base(today = '2026-11-23T15:00:00Z') {
  const s = assemble({ sources: {} }, new Date(today)) as any;
  s.sources = s.sources.map((x: any) => ({ ...x, state: 'fresh' }));
  s.studio.mixes = [
    { client: 'Artist S', due: '2026-11-10', count: 2, countApprox: true, note: '' },
    { client: 'Artist Z', due: '2026-11-23', count: 2, countApprox: false, note: '' },
    { client: 'Artist S', due: '2026-11-24', count: 3, countApprox: false, note: '' },
  ];
  s.briefs = [
    brief('Tension', 'Committed', '2026-11-20', '2026-11-23', '2026-11-25'),
    brief('Comedy', 'Committed', '2026-11-20'),
    brief('Old signed', 'Contract', '2024-01-05'),
    brief('New signed', 'Contract', '2026-11-30'),
    brief('Sent', 'Submitted', '2026-11-18'),
  ];
  s.studio.clients = [
    { name: 'Artist L', paidSessions: 1, lastSession: '2026-11-13', totalPaid: 150, rate: null, kind: 'session', note: '' },
    { name: 'Artist Y', paidSessions: 1, lastSession: '2026-11-02', totalPaid: 150, rate: null, kind: 'session', note: '' },
  ];
  s.studio.upcoming = [
    { who: 'Artist L', date: '2026-11-29', note: 'Sun Nov 29, 2026, 6:30–8:30 PM, paid, scheduled; 2 hours at $75/hr' },
    { who: 'Artist Q', date: '2026-12-01', note: 'Tue Dec 1, 2026, 7:00–8:00 PM, paid, scheduled; booked during his Nov 10 vibe; amount not stated' },
    { who: 'Artist W', date: '2026-11-26', note: 'Thu Nov 26, 2026, 7:00–9:00 PM, vibe, scheduled' },
    { who: 'Artist F', date: '2026-12-20', note: 'far away' },
  ];
  s.studio.vibe = [
    { artist: 'Artist V', date: '2026-11-14', showed: true, outcome: 'open', firstPaid: null, note: '' },
    { artist: 'Artist O', date: '2026-09-29', showed: true, outcome: 'open', firstPaid: null, note: '' },
    { artist: 'Artist N', date: '2026-10-01', showed: false, outcome: 'no_show', firstPaid: null, note: '' },
  ];
  return s;
}

describe('Mix & Brief Queue', () => {
  it('next brief date is Due or Round 2, whichever is next', () => {
    expect(briefNextDate(brief('x', 'Committed', '2026-11-20', '2026-11-23') as any, '2026-11-23')).toBe('2026-11-23');
    expect(briefNextDate(brief('x', 'Committed', '2026-11-20') as any, '2026-11-23')).toBe('2026-11-20');
  });
  it('counts working briefs (signed past deals are not work) and flags past-due ones', () => {
    const s = base();
    expect(workingBriefs(s).map((b) => b.brief)).toEqual(['Comedy', 'Tension', 'New signed']);
    const q = mixBriefQueue(s);
    expect(q).toMatchObject({ mixes: 7, briefs: 3, overdueMixes: 2, overdueBriefs: 1, anyOverdue: true });
    expect(q.nextBrief?.brief).toBe('Tension');
  });
});

describe('Booked Ahead', () => {
  it('hours from a time range or "N hours"', () => {
    expect(hoursFrom('6:30–8:30 PM')).toBe(2);
    expect(hoursFrom('11:00–1:00 PM')).toBe(2);
    expect(hoursFrom('3 hours')).toBe(3);
    expect(hoursFrom('no time')).toBeNull();
  });
  it('next 14 days only, expected $ at the rate on file, "rate not set" otherwise', () => {
    const b = bookedAhead(base());
    expect(b.count).toBe(2);
    expect(b.next).toMatchObject({ who: 'Artist L', expected: 150, rate: 75 });
    expect(b.rows[1]).toMatchObject({ who: 'Artist Q', rate: null, expected: null, hours: 1 });
    expect(b.rateMissing).toBe(1);
    expect(b.week).toEqual({ count: 1, expected: 150 });
  });
});

describe('This week on a Monday', () => {
  it('no row yet = $0 so far, in progress, never "complete"', () => {
    const s = base('2026-11-23T11:00:00Z');
    s.weeks = [{ start: '2026-11-16', label: '', sessions: 600, remote: 0, beats: 0, paidSessions: 0, paidHours: 0, vibeHeld: 0, vibeNoShows: 0, sheetStatus: '', confidence: '', goal: 600, notes: '', url: '' }];
    const w = thisWeekMetric(s);
    expect(w).toMatchObject({ value: 0, status: 'in_progress', note: 'week just started' });
  });
});

describe('Mid-refresh guard', () => {
  it('an empty or halved read looks incomplete', () => {
    expect(looksIncomplete({ ledger: [1, 2, 3, 4, 5, 6] }, { ledger: [] })).toBe(true);
    expect(looksIncomplete({ ledger: [1, 2, 3, 4, 5, 6] }, { ledger: [1, 2] })).toBe(true);
    expect(looksIncomplete({ ledger: [1, 2, 3, 4, 5, 6] }, { ledger: [1, 2, 3, 4, 5] })).toBe(false);
    expect(looksIncomplete(null, { ledger: [] })).toBe(false);
  });
  it('keeps the last good copy marked updating, then accepts after 30 minutes', async () => {
    let rows: any[] = [];
    const fetchImpl = (async (u: string, init: any) => {
      const path = u.replace('https://api.notion.com/v1', '');
      if (path === '/search') return Response.json({ results: [], has_more: false });
      if (path.startsWith('/databases/')) return Response.json({ data_sources: [{ id: 'ds' }] });
      if (path.startsWith('/data_sources/')) return Response.json({ results: rows, has_more: false });
      if (path.startsWith('/pages/')) return Response.json({ last_edited_time: '2026-11-23T11:00:00Z' });
      if (path.startsWith('/blocks/')) return Response.json({ results: [], has_more: false });
      return new Response('?', { status: 404 });
    }) as any;
    const reader = () => new NotionReader('t', { fetchImpl, sleep: async () => {}, requestsPerSecond: 1000 });
    const good = { ledger: Array.from({ length: 6 }, (_, i) => ({ entry: `e${i}`, year: '2026', month: '2026-11', lane: 'Studio sessions', basis: '', amount: 100, confidence: 'Verified', source: '', url: '' })) };
    const prev: any = { sources: { ledger: { lastEdited: 'old', checkedAt: null, readAt: '2026-11-23T10:00:00Z', data: good, needsRead: true } } };
    rows = []; // mid-refresh: the ledger reads empty
    const t1 = new Date('2026-11-23T11:42:00Z');
    const a = await refreshPass(reader(), prev, { budget: 1000, now: t1 });
    expect(a.state.sources.ledger.updating).toBe(true);
    expect(a.state.sources.ledger.data).toBe(good);
    const snap = assemble(a.state, t1);
    expect(snap.updating).toContain('ledger');
    expect(snap.ledger).toHaveLength(6);
    const b = await refreshPass(reader(), a.state, { budget: 1000, now: new Date(t1.getTime() + 31 * 60_000) });
    expect(b.state.sources.ledger.updating).toBe(false);
    expect((b.state.sources.ledger.data as any).ledger).toEqual([]);
  });
});

describe('Follow-ups', () => {
  it('one list, oldest first, with hot vibe artists and 14-day rebooks', () => {
    const s = base();
    s.cc = { cash: { calendar: [['NOW', 'Studio X — $100 owed', 'Work order Apr 27', 'CHASE', '#f00']] } };
    s.syncContacts = [{ name: 'A', company: 'Lib A', type: 'Library', list: 'Scouted', status: 'Contacted', lastContacted: '2026-11-01', lastContactedText: '', followUp: '2026-11-15', followUpText: '', url: 'u1' },
      { name: 'B', company: 'Durango Co', type: 'Supervisor', list: 'Durango contacts', status: 'Contacted', lastContacted: '2026-11-01', lastContactedText: '', followUp: '2026-11-10', followUpText: '', url: 'u2' }];
    const f = followUps(s);
    const groups = new Set(f.map((x) => x.group));
    expect([...groups].sort()).toEqual(['brief', 'mix', 'owed', 'rebook', 'sync', 'vibe']);
    expect(f.map((x) => x.age)).toEqual([...f.map((x) => x.age)].sort((a, b) => b - a));
    expect(f.find((x) => x.who === 'Artist V')?.hot).toBe(true);
    expect(f.find((x) => x.who === 'Artist O')?.hot).toBe(false);
    expect(f.some((x) => x.who === 'Artist N')).toBe(false); // no-show
    expect(f.some((x) => x.who === 'Artist L')).toBe(false); // booked
    expect(f.some((x) => x.who === 'Artist Y' && x.group === 'rebook')).toBe(true);
    expect(f.some((x) => /durango/i.test(x.who))).toBe(false);
  });
});

describe('Sync trajectory', () => {
  it('places a BMI statement about 5 months after its quarter ends', () => {
    expect(statementMonth('2026 Q2')).toBe('2026-11');
    expect(statementMonth('2026 Q3')).toBe('2027-02');
  });
  it('months without monthly ledger data are gaps, not $0', () => {
    const s = base();
    s.ledger = [{ entry: 'x', year: '2026', month: '2026-03', lane: 'Direct sync fees', basis: '', amount: 300, confidence: '', source: '', url: '' }];
    s.bmi = [{ statement: '2026 Q2', royalties: 500 } as any];
    const m = syncMonthly(s);
    expect(m.find((x) => x.key === '2025-12')?.fees).toBeNull();
    expect(m.find((x) => x.key === '2026-03')?.fees).toBe(300);
    expect(m.find((x) => x.key === '2026-04')?.fees).toBe(0);
    expect(m.find((x) => x.key === '2026-11')?.bmi).toBe(500);
  });
});

describe('All artists', () => {
  it('groups like the Command Center and skips the merge note', () => {
    const md = ['## Artist profiles', '', '- A — paid client; 1 paid session', '- B — remote mix client', '- C — beat buyer client', '- D — rapper and consistent sync vocalist', '- E — vibe artist (Nov 5)', '- F — vibe no-show twice; passed', '- A is the same artist formerly listed as "X" — merged'].join('\n');
    expect(artistProfiles(md).map((a) => `${a.name}:${a.group}`)).toEqual(['A:paid', 'B:remote', 'C:beat', 'D:sync', 'E:pipeline', 'F:closed']);
  });
});

describe('Scout replies waiting on Kris', () => {
  it('skips rows marked handled, passed, pending on their side, or already answered by Kris', () => {
    expect(waitingOnKris({ reply: 'asked lease price', nextAction: 'HANDLED — Kris responded and quoted' })).toBe(false);
    expect(waitingOnKris({ reply: 'asked a question — ball with Kris.', nextAction: 'Kris PASSED on the fit' })).toBe(false);
    expect(waitingOnKris({ reply: 'agreed (pending)', nextAction: 'Pending on his side; do not re-contact' })).toBe(false);
    expect(waitingOnKris({ reply: "Replied on Threads; Kris-approved follow-up email sent Oct 28", nextAction: 'Kris handles from here' })).toBe(false);
    expect(waitingOnKris({ reply: 'Asked for the price list', nextAction: '' })).toBe(true);
  });
});
