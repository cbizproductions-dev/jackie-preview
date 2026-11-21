import { describe, it, expect, vi, afterEach } from 'vitest';
import worker from '../src/worker/index';
import { explainError } from '../src/worker/snapshot';

const mkEnv = () => {
  const kv = new Map<string, string>();
  return {
    kv,
    env: {
      ACCESS_KEY: 'k3y-abcdefghijklmnopqrstuvwxyz012345',
      NOTION_TOKEN: 'test-token',
      NOTION_CALL_BUDGET: '200',
      SNAP: { get: async (k: string, t?: string) => (kv.has(k) ? (t === 'json' ? JSON.parse(kv.get(k)!) : kv.get(k)) : null), put: async (k: string, v: string) => void kv.set(k, v), delete: async (k: string) => void kv.delete(k) },
      ASSETS: { fetch: async () => new Response('nf', { status: 404 }) },
    } as any,
  };
};

afterEach(() => vi.unstubAllGlobals());

describe('First live run when Notion reads fail', () => {
  it('shows the build-time capture, marks Partial, and explains the error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ code: 'object_not_found' }), { status: 404 })));
    const { env, kv } = mkEnv();
    const seedMix = { client: 'Captured client', due: '2026-11-30', count: 1, countApprox: false, note: '' };
    kv.set('seed-state:v1', JSON.stringify({ sources: { studio: { lastEdited: '2026-11-21T00:00:00Z', checkedAt: null, readAt: '2026-11-21T16:00:00Z', data: { studio: { synced: null, mixes: [seedMix], clients: [], vibe: [], deposits: [], upcoming: [], syncChecks: [], beatSales: [] } } } } }));
    const res = await worker.fetch(new Request(`https://x.dev/c/${env.ACCESS_KEY}/api/snapshot`), env, { waitUntil: () => {} } as any);
    const s = (await res.json()) as any;
    expect(s.mode).toBe('live');
    expect(s.state).toBe('partial');
    expect(s.studio.mixes[0].client).toBe('Captured client'); // never blank
    const studio = s.sources.find((x: any) => x.id === 'studio');
    expect(studio.state).toBe('failed');
    expect(studio.note).toMatch(/Connections/);
  }, 30000);
  it('explains common Notion errors without echoing secrets', () => {
    expect(explainError('Notion 401 on /pages/x: unauthorized')).toMatch(/token/);
    expect(explainError('Notion 404 on /pages/x: object_not_found')).toMatch(/Connections/);
  });
});
