import { describe, it, expect } from 'vitest';
import { assemble } from '../src/worker/snapshot';
import { updateChanges } from '../src/worker/changes';
import { pipeline, monthly, directions, titlesOf, stageOf } from '../src/shared/creative';

// Synthetic data only.
const brief = (brief: string, status: string, due: string, extra: Record<string, unknown> = {}) => ({ brief, company: 'Lib', status, type: 'Custom', code: '', due, round2: null, round2End: null, deliverables: '', notes: '', url: `https://app.notion.com/p/${brief.replace(/\W/g, '')}`, ...extra });

function base(today = '2026-11-22T15:00:00Z') {
  const s = assemble({ sources: {} }, new Date(today)) as any;
  s.sources = s.sources.map((x: any) => ({ ...x, state: 'fresh' }));
  s.briefs = [brief('Tension Hip Hop', 'Committed', '2026-11-20'), brief('Sports Anthem (2 cues)', 'Submitted', '2026-10-02'), brief('Old Pop', 'Contract', '2024-01-05', { notes: 'Titles: A, B, C.' })];
  s.studio.mixes = [{ client: 'Artist A', due: '2026-11-25', count: 2, countApprox: false, note: '' }];
  s.studio.upcoming = [];
  s.studio.beatSales = [];
  s.studio.deliveries = [{ client: 'Artist B', date: '2026-11-19', hours: null, due: null }];
  s.studio.clients = [{ name: 'Artist A', paidSessions: 1, lastSession: null, totalPaid: 150, rate: 75, kind: 'session', note: '' }];
  s.weeks = [{ start: '2026-11-16', label: '', sessions: 300, remote: 0, beats: 0, paidSessions: 2, paidHours: 4, vibeHeld: 0, vibeNoShows: 0, sheetStatus: 'In progress', confidence: 'Verified', goal: 600, notes: '', url: '' }];
  s.ledger = [{ entry: 'x', year: '2026', month: '11', lane: 'Direct sync fees', basis: '', amount: 500, confidence: 'Verified', source: '', url: '' }];
  return s;
}

describe('Creative output', () => {
  it('stages follow the Brief Board status, with nothing guessed', () => {
    expect(stageOf('Paid/Placed')).toBe('placed');
    expect(stageOf('Contract')).toBe('accepted');
    expect(stageOf('Passed')).toBe('delivered');
    expect(stageOf('Expired')).toBe('not_done');
    const p = pipeline(base().briefs, 'all', '2026-11-22');
    expect(p).toMatchObject({ received: 3, inProgress: 1, awaiting: 1, acceptedOnly: 1, placed: 0, delivered: 2 });
    expect(p.deliveredTitles).toEqual({ named: 5, counted: 2, of: 2 }); // 2 cues + 3 titles
  });
  it('counts titles only when the record names them', () => {
    expect(titlesOf(brief('Untitled', 'Submitted', '2026-01-01') as any)).toBeNull();
  });
  it('monthly momentum covers 12 months ending this month', () => {
    const m = monthly(base().briefs, '2026-11-22');
    expect(m).toHaveLength(12);
    expect(m[11]).toMatchObject({ month: '2026-11', in_progress: 1 });
    expect(m[10]).toMatchObject({ month: '2026-10', delivered: 1 });
  });
  it('styles come only from words in brief titles', () => {
    const d = directions(base().briefs, '2026-11-22');
    expect(d.rows.map((r) => r.label).sort()).toEqual(['Hip hop', 'Sports', 'Tension']);
  });
});

describe('Since last update', () => {
  it('first run sets a baseline and lists only records that carry their own recent date', () => {
    const c = updateChanges(undefined, base(), new Date('2026-11-22T15:00:00Z'));
    expect(c.events.map((e) => e.title)).toEqual(['Mix delivered: Artist B']);
    expect(c.events[0].recordDate).toBe('2026-11-19');
  });
  it('finds real changes and ranks money above admin', () => {
    const t0 = new Date('2026-11-22T15:00:00Z');
    const first = updateChanges(undefined, base(), t0);
    const s2 = base();
    s2.weeks[0].sessions = 450; // +$150 cash
    s2.ledger[0].amount = 650; // +$150 sync fee
    s2.briefs[1].status = 'Contract'; // accepted
    s2.studio.upcoming = [{ who: 'Artist C', date: '2026-12-01', note: '' }];
    const next = updateChanges(first, s2, new Date(t0.getTime() + 3600_000));
    const titles = next.events.map((e) => e.title);
    expect(titles).toContain('Studio cash +$150 this week');
    expect(titles).toContain('Direct sync fees +$150');
    expect(titles).toContain('Accepted — agreement signed: Sports Anthem (2 cues)');
    expect(titles).toContain('Session booked: Artist C');
    const sync = next.events.find((e) => e.title.startsWith('Direct sync'))!;
    const book = next.events.find((e) => e.title.startsWith('Session booked'))!;
    expect(sync.priority).toBeGreaterThan(book.priority);
  });
  it('never repeats an event and ignores a refresh with no changes', () => {
    const t0 = new Date('2026-11-22T15:00:00Z');
    const a = updateChanges(undefined, base(), t0);
    const s2 = base(); s2.weeks[0].sessions = 450;
    const b = updateChanges(a, s2, new Date(t0.getTime() + 60_000));
    const c = updateChanges(b, s2, new Date(t0.getTime() + 120_000));
    expect(c.events.length).toBe(b.events.length);
  });
  it('a failed read is never reported as a change', () => {
    const t0 = new Date('2026-11-22T15:00:00Z');
    const a = updateChanges(undefined, base(), t0);
    const s2 = base();
    s2.sources = s2.sources.map((x: any) => (x.id === 'briefs' ? { ...x, state: 'failed' } : x));
    s2.briefs = [];
    const b = updateChanges(a, s2, new Date(t0.getTime() + 60_000));
    expect(b.events.filter((e) => e.source === 'Brief Board')).toHaveLength(0);
    // and when it comes back unchanged, still nothing
    const c = updateChanges(b, base(), new Date(t0.getTime() + 120_000));
    expect(c.events.filter((e) => e.source === 'Brief Board')).toHaveLength(0);
  });
  it('flags a mix that just became overdue, and old back-filled briefs are not news', () => {
    const a = updateChanges(undefined, base('2026-11-24T15:00:00Z'), new Date('2026-11-24T15:00:00Z'));
    const s2 = base('2026-11-26T15:00:00Z');
    s2.briefs.push(brief('Back-filled 2022 work order', 'Contract', '2022-03-01'));
    const b = updateChanges(a, s2, new Date('2026-11-26T15:00:00Z'));
    expect(b.events.map((e) => e.title)).toContain('Mix now overdue: Artist A');
    expect(b.events.some((e) => /Back-filled/.test(e.title))).toBe(false);
  });
  it('keeps the Durango hold', () => {
    const a = updateChanges(undefined, base(), new Date('2026-11-22T15:00:00Z'));
    const s2 = base(); s2.studio.upcoming = [{ who: 'Durango contact', date: '2026-12-02', note: '' }];
    const b = updateChanges(a, s2, new Date('2026-11-22T16:00:00Z'));
    expect(b.events.some((e) => /durango/i.test(e.title))).toBe(false);
  });
  it('two rows for the same client: the overdue one still counts (matches the Mix queue meter)', async () => {
    const { mixQueue } = await import('../src/shared/rules');
    const mk = (today: string) => {
      const s = base(`${today}T15:00:00Z`);
      s.studio.mixes = [
        { client: 'Artist S', due: '2026-11-10', count: 2, countApprox: true, note: '' },
        { client: 'Artist L', due: '2026-11-20', count: 1, countApprox: false, note: '' },
        { client: 'Artist S', due: '2026-11-24', count: 3, countApprox: false, note: '' },
      ];
      return s;
    };
    const a = updateChanges(undefined, mk('2026-11-22'), new Date('2026-11-22T20:00:00Z'));
    expect(a.facts.overdueMixes).toBe(mixQueue(mk('2026-11-22').studio.mixes, '2026-11-22').overdue);
    expect(a.facts.overdueMixes).toBe(3);
    // Artist L delivered: one overdue row remains, so no "No overdue mixes".
    const s2 = mk('2026-11-23');
    s2.studio.mixes = s2.studio.mixes.filter((m: any) => m.client !== 'Artist L');
    const b = updateChanges(a, s2, new Date('2026-11-23T10:56:00Z'));
    expect(b.events.some((e) => e.title === 'No overdue mixes')).toBe(false);
    expect(b.facts.overdueMixes).toBe(2);
    // All overdue delivered: now it fires.
    const s3 = mk('2026-11-23');
    s3.studio.mixes = s3.studio.mixes.filter((m: any) => m.due === '2026-11-24');
    const c = updateChanges(b, s3, new Date('2026-11-23T12:00:00Z'));
    expect(c.events.find((e) => e.title === 'No overdue mixes')?.detail).toBe('Overdue mixes went from 2 to 0.');
  });
  it('one-time cleanup removes the false Nov 23 event and re-baselines without a fake "now overdue"', () => {
    const s = base('2026-11-23T15:00:00Z');
    s.studio.mixes = [{ client: 'Artist S', due: '2026-11-10', count: 2, countApprox: true, note: '' }, { client: 'Artist S', due: '2026-11-24', count: 3, countApprox: false, note: '' }];
    const oldState: any = {
      v: 2, baselineAt: '2026-11-22T20:55:00Z',
      facts: { mixes: { 'Artist S': { due: '2026-11-24', n: 3, od: false } } },
      events: [
        { key: 'overdue-clear:2026-11-23', seenAt: '2026-11-23T10:56:35Z', recordDate: null, kind: 'resolved', title: 'No overdue mixes', detail: '', priority: 84, tone: 'ok', source: 'Studio Board', url: '' },
        { key: 'deliv:Artist L|2026-11-22', seenAt: '2026-11-23T10:56:35Z', recordDate: '2026-11-22', kind: 'delivered', title: 'Mix delivered: Artist L', detail: '', priority: 72, tone: 'ok', source: 'Studio Board', url: '' },
      ],
    };
    const c = updateChanges(oldState, s, new Date('2026-11-23T15:00:00Z'));
    expect(c.events.map((e) => e.key)).not.toContain('overdue-clear:2026-11-23');
    expect(c.events.map((e) => e.key)).toContain('deliv:Artist L|2026-11-22');
    expect(c.events.some((e) => e.kind === 'overdue')).toBe(false);
    expect(c.facts.overdueMixes).toBe(2);
    expect(c.baselineAt).toBe('2026-11-22T20:55:00Z');
  });
});
