import { describe, it, expect, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as H from '../src/shared/health';
import { NotionReader, renderBlocks } from '../src/worker/notion';
import { refreshPass, assemble, type State } from '../src/worker/snapshot';
import { SOURCES } from '../src/worker/sources';
import worker, { SECURITY_HEADERS } from '../src/worker/index';
import { todaysMoves, isDurango } from '../src/shared/derive';

describe('Health lights (Strategy Room thresholds)', () => {
  const c = (name: string, totalPaid: number) => ({ name, paidSessions: 1, lastSession: null, totalPaid, rate: null, kind: 'session' as const, note: '' });
  it('concentration: <40 green, 40–65 amber, >65 red', () => {
    expect(H.concentrationLight([c('a', 30), c('b', 9), c('c', 61)]).light).toBe('red'); // 91/100
    expect(H.concentrationLight([c('a', 20), c('b', 19), c('c', 20), c('d', 20), c('e', 21)]).light).toBe('amber'); // 41%
    expect(H.concentrationLight([c('a', 10), c('b', 10), c('c', 10), c('d', 10), c('e', 10), c('f', 10)]).light).toBe('green'); // 33%
  });
  it('delivery: red needs 2+ overdue AND 6+ due within a week', () => {
    const m = (due: string, count: number) => ({ client: 'x', due, count, countApprox: false, note: '' });
    expect(H.deliveryLight([m('2026-11-10', 2), m('2026-11-20', 1), m('2026-11-23', 2), m('2026-11-24', 3)], '2026-11-21').light).toBe('red');
    expect(H.deliveryLight([m('2026-11-20', 1)], '2026-11-21').light).toBe('amber');
    expect(H.deliveryLight([m('2026-11-30', 6)], '2026-11-21').light).toBe('amber'); // 6+ open
    expect(H.deliveryLight([], '2026-11-21').light).toBe('green');
  });
  it('vibe: ≥30 green, 15–30 amber, <15 red', () => {
    const v = (outcome: any) => ({ artist: Math.random().toString(), date: null, showed: true, outcome, firstPaid: null, note: '' });
    expect(H.vibeLight([v('converted'), v('open'), v('open')]).light).toBe('green');
    expect(H.vibeLight([v('converted'), v('open'), v('open'), v('open'), v('open')]).light).toBe('amber');
    expect(H.vibeLight([v('converted'), ...Array(9).fill(0).map(() => v('open'))]).light).toBe('red');
  });
  it('catalog: 10% amber', () => expect(H.catalogLight(50, 500).light).toBe('amber'));
  it('missing data is grey, not red', () => {
    expect(H.catalogLight(null, null).light).toBe('none');
    expect(H.royaltiesLight([]).light).toBe('none');
  });
  it('contracts: ≤30 days red, ≤90 amber', () => {
    const k = (d: string) => ({ agreement: 'A', counterparty: 'X', type: null, signed: null, exclusivity: null, exit: null, flags: [], nextAction: '', nextActionDate: d, noticeBy: null, periodEnds: null, inferred: false, url: '' });
    expect(H.contractsLight([k('2027-01-24')], '2026-11-21').light).toBe('amber'); // 64 days
    expect(H.contractsLight([k('2026-12-10')], '2026-11-21').light).toBe('red');
    expect(H.contractsLight([k('2027-06-01')], '2026-11-21').light).toBe('green');
  });
  it('studio revenue counts this week only once it has passed the goal', () => {
    const w = (start: string, sessions: number) => ({ start, label: '', sessions, remote: 0, beats: 0, paidSessions: null, paidHours: null, vibeHeld: null, vibeNoShows: null, sheetStatus: '', confidence: '', goal: 600, notes: '', url: '' });
    const weeks = [w('2026-10-26', 0), w('2026-11-02', 300), w('2026-11-09', 600), w('2026-11-16', 700)];
    expect(H.studioRevenueLight(weeks, 600, '2026-11-21').light).toBe('green'); // 300, 600, 700 → 2 of 3
    weeks[3] = w('2026-11-16', 100);
    expect(H.studioRevenueLight(weeks, 600, '2026-11-21').light).toBe('amber'); // 0, 300, 600 → 1 of 3
  });
});

describe('Read-only guarantees', () => {
  const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : [join(dir, f)]));
  const runtime = files('src').map((f) => readFileSync(f, 'utf8')).join('\n');
  it('no Notion write calls anywhere in runtime code', () => {
    for (const bad of [/pages\.create/, /pages\.update/, /blocks\.children\.append/, /databases\.update/, /dataSources\.update/, /comments\.create/, /'PATCH'/, /"PATCH"/, /'DELETE'/, /'PUT'/, /\/comments/]) expect(runtime).not.toMatch(bad);
  });
  it('the client refuses any POST that is not a data source query', async () => {
    const r = new NotionReader('t', { fetchImpl: vi.fn() as any, sleep: async () => {} });
    await expect((r as any).req('POST', '/pages', {})).rejects.toThrow(/Read-only/);
  });
});

const env = () => {
  const kv = new Map<string, string>();
  return {
    ACCESS_KEY: 'k3y-abcdefghijklmnopqrstuvwxyz012345',
    SNAP: { get: async (k: string, t?: string) => (kv.has(k) ? (t === 'json' ? JSON.parse(kv.get(k)!) : kv.get(k)) : null), put: async (k: string, v: string) => void kv.set(k, v), delete: async (k: string) => void kv.delete(k) },
    ASSETS: { fetch: async (r: Request) => (new URL(r.url).pathname === '/index.html' ? new Response('<html>', { headers: { 'X-Frame-Options': 'DENY' } }) : new Response('nf', { status: 404 })) },
    kv,
  } as any;
};
const ctx = { waitUntil: () => {} } as any;

describe('Access model', () => {
  it('every path without the key is 404, including the API', async () => {
    const e = env();
    for (const p of ['/', '/index.html', '/api/snapshot', '/c/wrong/api/snapshot', '/c/', '/c/k3y-abcdefghijklmnopqrstuvwxyz01234/']) {
      expect((await worker.fetch(new Request('https://x.dev' + p), e, ctx)).status).toBe(404);
    }
  });
  it('no write methods: POST/PUT/PATCH/DELETE are 404 even with the key', async () => {
    const e = env();
    for (const m of ['POST', 'PUT', 'PATCH', 'DELETE']) expect((await worker.fetch(new Request(`https://x.dev/c/${e.ACCESS_KEY}/api/snapshot`, { method: m }), e, ctx)).status).toBe(404);
  });
  it('with the key: app served, noindex + CSP frame-ancestors, no X-Frame-Options', async () => {
    const e = env();
    const res = await worker.fetch(new Request(`https://x.dev/c/${e.ACCESS_KEY}/`), e, ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Robots-Tag')).toMatch(/noindex/);
    expect(res.headers.get('X-Frame-Options')).toBeNull();
    expect(res.headers.get('Content-Security-Policy')).toMatch(/frame-ancestors 'self' https:\/\/www\.notion\.so/);
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer');
  });
  it('without a Notion token the seed snapshot is served', async () => {
    const e = env();
    e.kv.set('seed:v1', JSON.stringify({ generatedAt: '2026-11-21T16:00:00Z', mode: 'seed' }));
    const res = await worker.fetch(new Request(`https://x.dev/c/${e.ACCESS_KEY}/api/snapshot`), e, ctx);
    expect(((await res.json()) as any).mode).toBe('seed');
    expect(SECURITY_HEADERS['X-Robots-Tag']).toBeTruthy();
  });
});

describe('Resilience', () => {
  const page = (edited: string) => ({ last_edited_time: edited });
  function fakeNotion(opts: { failPage?: string; rateLimitOnce?: boolean; edited?: string }) {
    let limited = false;
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (u: string, init: any) => {
      const path = u.replace('https://api.notion.com/v1', '');
      calls.push(`${init.method} ${path}`);
      if (opts.rateLimitOnce && !limited) { limited = true; return new Response('slow down', { status: 429, headers: { 'Retry-After': '1' } }); }
      if (opts.failPage && path.includes(opts.failPage)) return new Response('boom', { status: 500 });
      if (path.startsWith('/databases/')) return Response.json({ data_sources: [{ id: 'ds1' }], last_edited_time: opts.edited ?? '2026-11-20T00:00:00Z' });
      if (path.startsWith('/data_sources/')) return Response.json({ results: [], has_more: false });
      if (path.startsWith('/pages/')) return Response.json(page(opts.edited ?? '2026-11-20T00:00:00Z'));
      if (path.startsWith('/blocks/')) return Response.json({ results: [], has_more: false });
      return new Response('?', { status: 404 });
    });
    return { fetchImpl, calls };
  }
  const now = new Date('2026-11-21T16:00:00Z');

  it('a 429 is retried after Retry-After', async () => {
    const f = fakeNotion({ rateLimitOnce: true });
    const sleeps: number[] = [];
    const r = new NotionReader('t', { fetchImpl: f.fetchImpl as any, sleep: async (ms) => void sleeps.push(ms), requestsPerSecond: 1000 });
    await r.page('abc');
    expect(sleeps).toContain(1000);
    expect(f.calls.length).toBe(2);
  });

  it('a failed source keeps its last good data, marks Partial and names the source', async () => {
    const studio = SOURCES.find((s) => s.id === 'studio')!;
    const prev: State = { sources: { studio: { lastEdited: '2026-11-19T00:00:00Z', checkedAt: null, readAt: '2026-11-19T00:00:00Z', data: { studio: { synced: '2026-11-19', mixes: [{ client: 'Last good', due: '2026-11-30', count: 1, countApprox: false, note: '' }], clients: [], vibe: [], deposits: [], upcoming: [], syncChecks: [], beatSales: [] } } } } };
    const f = fakeNotion({ failPage: studio.notionId, edited: '2026-11-21T10:00:00Z' });
    const r = new NotionReader('t', { fetchImpl: f.fetchImpl as any, sleep: async () => {}, requestsPerSecond: 1000 });
    const { state } = await refreshPass(r, prev, { budget: 500, now });
    const snap = assemble(state, now);
    expect(snap.state).toBe('partial');
    expect(snap.failed).toContain('Studio Board — Muse mirror');
    expect(snap.studio.mixes[0].client).toBe('Last good');
  });

  it('unchanged sources are probed but not re-read', async () => {
    const f1 = fakeNotion({});
    const r1 = new NotionReader('t', { fetchImpl: f1.fetchImpl as any, sleep: async () => {}, requestsPerSecond: 1000 });
    const first = await refreshPass(r1, { sources: {} }, { budget: 1000, now });
    const f2 = fakeNotion({});
    const r2 = new NotionReader('t', { fetchImpl: f2.fetchImpl as any, sleep: async () => {}, requestsPerSecond: 1000 });
    await refreshPass(r2, first.state, { budget: 1000, now: new Date(now.getTime() + 20 * 60 * 1000) });
    expect(f2.calls.some((c) => c.startsWith('GET /blocks/'))).toBe(false); // no page bodies re-read
    expect(f2.calls.filter((c) => /query$/.test(c)).length).toBe(SOURCES.filter((s) => s.kind === 'database').length); // one probe each
  });

  it('respects the per-visit call budget and reports pending sources', async () => {
    const f = fakeNotion({});
    const r = new NotionReader('t', { fetchImpl: f.fetchImpl as any, sleep: async () => {}, requestsPerSecond: 1000 });
    const { pending } = await refreshPass(r, { sources: {} }, { budget: 12, now });
    expect(r.calls).toBeLessThanOrEqual(12);
    expect(pending.length).toBeGreaterThan(0);
  });
});

describe('Durango hold', () => {
  it('Durango items never become moves', () => {
    expect(isDurango('Follow up with Durango supervisors')).toBe(true);
    const snap: any = { today: '2026-11-21', studio: { mixes: [] }, cashMoves: [{ text: 'Email the Durango sync conference contacts', checked: false }], briefs: [], contracts: [], calendar: { days: [] }, insights: [{ urgency: 'Now', status: 'Active', kind: 'Recommendation', title: 'Pitch Durango supervisor', action: 'DM them', rank: 1, url: '', evidence: 'Likely' }] };
    expect(todaysMoves(snap)).toEqual([]);
  });
});

describe('renderBlocks', () => {
  it('renders headings, bullets, todos, code and tables', () => {
    const t = (s: string) => [{ plain_text: s }];
    const md = renderBlocks([
      { id: '1', type: 'heading_2', has_children: false, heading_2: { rich_text: t('Money') } },
      { id: '2', type: 'bulleted_list_item', has_children: false, bulleted_list_item: { rich_text: t('Open mixes: 8 (3 overdue)') } },
      { id: '3', type: 'to_do', has_children: false, to_do: { rich_text: t('Chase'), checked: true } },
      { id: '4', type: 'code', has_children: false, code: { rich_text: t('{"a":1}'), language: 'json' } },
      { id: '5', type: 'table', has_children: true, table: {}, children: [{ id: 'r', type: 'table_row', has_children: false, table_row: { cells: [t('A'), t('B')] } }] },
    ] as any);
    expect(md).toBe('## Money\n- Open mixes: 8 (3 overdue)\n- [x] Chase\n```json\n{"a":1}\n```\n| A | B |');
  });
});
