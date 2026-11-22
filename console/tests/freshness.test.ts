import { describe, it, expect, vi } from 'vitest';
import { NotionReader } from '../src/worker/notion';
import { refreshPass, assemble } from '../src/worker/snapshot';
import { SOURCES } from '../src/worker/sources';
import { healthLights } from '../src/shared/derive';
import { deliveryLight } from '../src/shared/health';

function fake(editedStudio: string | null) {
  const calls: string[] = [];
  const fetchImpl = vi.fn(async (u: string, init: any) => {
    const path = u.replace('https://api.notion.com/v1', '');
    calls.push(`${init.method} ${path}`);
    if (path === '/search') {
      const body = JSON.parse(init.body);
      if (body.sort) return Response.json({ results: editedStudio ? [{ id: '4118b67f-a84e-815d-87f9-da794bb520d8', last_edited_time: editedStudio, parent: { type: 'page_id' } }] : [], has_more: false });
      return Response.json({ results: [] });
    }
    if (path.startsWith('/databases/')) return Response.json({ data_sources: [{ id: 'ds' }] });
    if (path.startsWith('/data_sources/')) return Response.json({ results: [], has_more: false });
    if (path.startsWith('/pages/')) return Response.json({ last_edited_time: '2026-11-20T00:00:00Z' });
    if (path.startsWith('/blocks/')) return Response.json({ results: [], has_more: false });
    return new Response('?', { status: 404 });
  });
  return { calls, reader: new NotionReader('t', { fetchImpl: fetchImpl as any, sleep: async () => {}, requestsPerSecond: 1000 }) };
}

describe('Fresh on every open', () => {
  it('after the first full check, an open with no edits costs ONE Notion call', async () => {
    const t0 = new Date('2026-11-22T15:00:00Z');
    const first = await refreshPass(fake(null).reader, { sources: {} }, { budget: 1000, now: t0 });
    expect(first.mode).toBe('full');
    const f = fake(null);
    const second = await refreshPass(f.reader, first.state, { budget: 1000, now: new Date(t0.getTime() + 60_000) });
    expect(second.mode).toBe('sweep');
    expect(f.calls).toEqual(['POST /search']);
  });
  it('re-reads only the source that changed', async () => {
    const t0 = new Date('2026-11-22T15:00:00Z');
    const first = await refreshPass(fake(null).reader, { sources: {} }, { budget: 1000, now: t0 });
    const f = fake('2026-11-22T15:00:30Z');
    const second = await refreshPass(f.reader, first.state, { budget: 1000, now: new Date(t0.getTime() + 60_000) });
    expect(second.changed).toEqual(['studio']);
    expect(f.calls.filter((c) => c.includes('4118b67fa84e815d87f9da794bb520d8') || c.includes('4118b67f-a84e-815d-87f9-da794bb520d8')).length).toBeGreaterThan(0);
    expect(f.calls.some((c) => c.includes('/data_sources/') && c.endsWith('/query'))).toBe(false); // no database re-reads
  });
  it('a full check runs again after 6 hours', async () => {
    const t0 = new Date('2026-11-22T08:00:00Z');
    const first = await refreshPass(fake(null).reader, { sources: {} }, { budget: 1000, now: t0 });
    const later = await refreshPass(fake(null).reader, first.state, { budget: 1000, now: new Date(t0.getTime() + 7 * 3600_000) });
    expect(later.mode).toBe('full');
  });
  it('stays within the call budget', async () => {
    const f = fake(null);
    await refreshPass(f.reader, { sources: {} }, { budget: 40, now: new Date('2026-11-22T15:00:00Z') });
    expect(f.reader.calls).toBeLessThanOrEqual(40);
  });
});

describe('Health lights match the Command Center', () => {
  it('uses data.json health states and notes when present', () => {
    const snap = assemble({ sources: {} }, new Date('2026-11-22T15:00:00Z'));
    (snap as any).cc = { as_of: 'Sun Nov 22, 2026 · 6:47 AM ET', health: [{ area: 'Delivery capacity', state: 'red', note: '8 mixes open · 3 overdue' }, { area: 'Data freshness', state: 'amber', note: 'lease log empty' }] };
    const L = healthLights(snap);
    const d = L.find((l) => l.area === 'Delivery capacity')!;
    expect(d).toMatchObject({ light: 'red', today: '8 mixes open · 3 overdue', source: 'command_center' });
    expect(L.find((l) => l.area === 'Data freshness')!.light).toBe('amber');
    expect(L.find((l) => l.area === 'Royalties')!.source).toBe('dashboard'); // no CC entry → computed fallback
  });
});

describe('One mix count everywhere', () => {
  it('"due in the next 7 days" never includes overdue mixes', () => {
    const m = (due: string, count: number) => ({ client: 'x', due, count, countApprox: false, note: '' });
    const l = deliveryLight([m('2026-11-10', 2), m('2026-11-20', 1), m('2026-11-23', 2), m('2026-11-24', 3)], '2026-11-21');
    expect(l.today).toBe('8 open · 3 overdue · 5 due in the next 7 days');
    expect(l.light).toBe('red'); // 3 overdue + 5 due this week = 8 to deliver ≥ 6
  });
});
