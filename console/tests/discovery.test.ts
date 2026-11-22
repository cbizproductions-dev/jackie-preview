import { describe, it, expect, vi } from 'vitest';
import { delivery } from '../src/worker/parsers';
import { NotionReader } from '../src/worker/notion';
import { refreshPass, assemble } from '../src/worker/snapshot';

describe('Mix delivery lines (Muse format)', () => {
  it('reads date, hours and due date', () => {
    expect(delivery('Artist A — mix from Nov 11 paid session DELIVERED Thu Nov 19, 2026 · ~2h (was due Wed Nov 18, 2026)', 2026)).toEqual({ client: 'Artist A', date: '2026-11-19', hours: 2, due: '2026-11-18' });
  });
  it('keeps the date alone when no hours were given', () => {
    expect(delivery('Artist B — DELIVERED Nov 22', 2026)).toMatchObject({ date: '2026-11-22', hours: null });
  });
});

describe('Discovered databases (Brand Presence, Speaking & Funding Leads)', () => {
  it('search is the only extra read-only POST', async () => {
    const r = new NotionReader('t', { fetchImpl: vi.fn() as any, sleep: async () => {} });
    await expect((r as any).req('POST', '/pages', {})).rejects.toThrow(/Read-only/);
    await expect((r as any).req('POST', '/blocks/x/children', {})).rejects.toThrow(/Read-only/);
  });
  it('a tracker that does not exist yet is "not in HQ yet", not a failure', async () => {
    const fetchImpl = vi.fn(async (u: string) => {
      const path = u.replace('https://api.notion.com/v1', '');
      if (path === '/search') return Response.json({ results: [] });
      if (path.startsWith('/databases/')) return Response.json({ data_sources: [{ id: 'ds' }] });
      if (path.startsWith('/data_sources/')) return Response.json({ results: [], has_more: false });
      if (path.startsWith('/pages/')) return Response.json({ last_edited_time: '2026-11-21T00:00:00Z' });
      return Response.json({ results: [], has_more: false });
    });
    const r = new NotionReader('t', { fetchImpl: fetchImpl as any, sleep: async () => {}, requestsPerSecond: 1000 });
    const now = new Date('2026-11-21T20:00:00Z');
    const { state } = await refreshPass(r, { sources: {} }, { budget: 1000, now });
    const snap = assemble(state, now);
    expect(snap.brand.found).toBe(false);
    expect(snap.failed).not.toContain('Brand Presence (Brandon)');
    expect(snap.sources.find((x) => x.id === 'brand')!.note).toMatch(/Not in HQ yet/);
  });
  it('a tracker that exists is read and mapped', async () => {
    const fetchImpl = vi.fn(async (u: string) => {
      const path = u.replace('https://api.notion.com/v1', '');
      if (path === '/search') return Response.json({ results: [{ id: 'bp', title: [{ plain_text: 'Brand Presence' }], url: 'https://notion.so/bp', last_edited_time: '2026-11-21T00:00:00Z' }] });
      if (path === '/data_sources/bp/query') return Response.json({ results: [{ id: 'row1', properties: { Item: { title: [{ plain_text: 'Instagram' }] }, Status: { select: { name: 'Active' } }, 'Key number': { rich_text: [{ plain_text: '12.4K followers' }] } } }], has_more: false });
      if (path.startsWith('/databases/')) return Response.json({ data_sources: [{ id: 'ds' }] });
      if (path.startsWith('/pages/')) return Response.json({ last_edited_time: '2026-11-21T00:00:00Z' });
      return Response.json({ results: [], has_more: false });
    });
    const r = new NotionReader('t', { fetchImpl: fetchImpl as any, sleep: async () => {}, requestsPerSecond: 1000 });
    const now = new Date('2026-11-21T20:00:00Z');
    const snap = assemble((await refreshPass(r, { sources: {} }, { budget: 1000, now })).state, now);
    expect(snap.brand.found).toBe(true);
    expect(snap.brand.rows[0]).toMatchObject({ item: 'Instagram', status: 'Active', key: '12.4K followers' });
  });
});

import { summaryText } from '../src/worker/summary';
describe('Agent view (plain text)', () => {
  it('renders from an empty snapshot without throwing, and marks missing as missing', () => {
    const snap = assemble({ sources: {} }, new Date('2026-11-22T15:00:00Z'));
    const t = summaryText(snap);
    expect(t).toMatch(/agent view \(read only\)/);
    expect(t).toMatch(/This week .*Not on file/);
  });
});
