/**
 * C-BIZ Console Worker. View-only: GET/HEAD only, no write routes, no Notion write calls.
 * Everything lives under /c/<ACCESS_KEY>/ ; any other path (or a wrong key) is a plain 404.
 */
import { NotionReader } from './notion';
import { readApple } from './ical';
import { updateChanges } from './changes';
import { nyDate, addDays } from '../shared/time';
import { EMBEDDED } from 'cbiz-assets';
import { summaryText } from './summary';
import { refreshPass, assemble, KEYS, explainError, type State } from './snapshot';

export interface Env {
  SNAP: KVNamespace;
  ASSETS?: Fetcher;
  ACCESS_KEY: string;
  NOTION_TOKEN?: string;
  NOTION_CALL_BUDGET?: string;
  /** iCloud "Public Calendar" link(s), secret. Optional. */
  APPLE_CAL_URL?: string;
}

const FRAME_ANCESTORS = "'self' https://www.notion.so https://notion.so https://*.notion.so https://notion.com https://www.notion.com https://app.notion.com https://*.notion.com https://*.notion.site";
export const SECURITY_HEADERS: Record<string, string> = {
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'Referrer-Policy': 'no-referrer', // the key is in the URL: never leak it to Instagram or anyone else
  'X-Content-Type-Options': 'nosniff',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Content-Security-Policy': [
    "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data:", "font-src 'self'",
    "connect-src 'self'", 'frame-src https://www.instagram.com', `frame-ancestors ${FRAME_ANCESTORS}`, "base-uri 'none'", "form-action 'none'", "object-src 'none'",
  ].join('; '),
};

function notFound() {
  return new Response('Not found', { status: 404, headers: { ...SECURITY_HEADERS, 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' } });
}
function safeEqual(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
function withHeaders(res: Response, extra: Record<string, string> = {}) {
  const h = new Headers(res.headers);
  for (const [k, v] of Object.entries({ ...SECURITY_HEADERS, ...extra })) h.set(k, v);
  h.delete('X-Frame-Options');
  return new Response(res.body, { status: res.status, headers: h });
}

/**
 * GET /api/snapshot          → the saved copy, instantly (first paint).
 * GET /api/snapshot?fresh=1  → reads Notion now (only what changed), saves it, returns it.
 * If Notion can't be read, the saved copy is returned with fallback=true and its time, never a blank screen.
 * The read happens inside the request (no background work), so Cloudflare's 30-second background cutoff can't kill it.
 */
async function getSnapshot(env: Env, url: URL, fresh: boolean): Promise<Response> {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...SECURITY_HEADERS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  const cached = (await env.SNAP.get(KEYS.snapshot, 'json')) as any;
  if (!env.NOTION_TOKEN) {
    const seed = cached ?? (await env.SNAP.get(KEYS.seed, 'json'));
    return seed ? json({ ...seed, servedFrom: 'saved', savedAt: seed.generatedAt }) : json({ error: 'No snapshot yet' }, 503);
  }
  if (!fresh && cached) return json({ ...cached, servedFrom: 'saved', savedAt: cached.generatedAt });

  const t0 = Date.now();
  const reader = new NotionReader(env.NOTION_TOKEN);
  try {
    // First live run starts from the build-time capture, so a source Notion can't serve shows captured data, never a blank screen.
    const prev = ((await env.SNAP.get(KEYS.state, 'json')) as State) ?? { sources: {} };
    const seedState = (await env.SNAP.get(KEYS.seedState, 'json')) as State | null;
    for (const [id, s] of Object.entries(seedState?.sources ?? {})) {
      const cur = prev.sources[id];
      if (!cur?.data && s.data) prev.sources[id] = { ...(cur ?? s), data: s.data, readAt: s.readAt, fromSeed: true, needsRead: true };
    }
    const now = new Date();
    const { state, pending, mode, changed } = await refreshPass(reader, prev, { budget: Number(env.NOTION_CALL_BUDGET ?? 40), now });
    // Apple Calendar: read on every open (at most once a minute), keep the last good copy if iCloud is down.
    let appleMs: number | null = null;
    if (env.APPLE_CAL_URL) {
      const last = prev.apple?.readAt ? Date.parse(prev.apple.readAt) : 0;
      if (now.getTime() - last > 60_000 || prev.apple?.error) {
        const ta = Date.now();
        const today = nyDate(now);
        state.apple = await readApple(env.APPLE_CAL_URL, today, addDays(today, 60), prev.apple);
        appleMs = Date.now() - ta;
      } else state.apple = prev.apple;
    } else delete state.apple;
    const assembled = assemble(state, now, 'live');
    // Since last update: compare this read with the last one (no Notion calls, stored in the same state record).
    state.changes = updateChanges(prev.changes, assembled, now);
    const snap = { ...assembled, changes: { baselineAt: state.changes.baselineAt, events: state.changes.events }, pending };
    await env.SNAP.put(KEYS.state, JSON.stringify(state));
    await env.SNAP.put(KEYS.snapshot, JSON.stringify(snap));
    // No key, token or URL in logs: just the shape of the refresh.
    console.log(JSON.stringify({ evt: 'refresh', mode, notionCalls: reader.calls, changed, pending, failed: snap.failed, appleMs, appleEvents: state.apple?.items.length ?? null, appleReused: state.apple?.reused ?? null, appleError: state.apple?.error ?? null, ms: Date.now() - t0 }));
    return json({ ...snap, servedFrom: 'live', notionCalls: reader.calls });
  } catch (e) {
    const reason = explainError(String((e as Error).message ?? e));
    console.log(JSON.stringify({ evt: 'refresh_failed', notionCalls: reader.calls, reason, ms: Date.now() - t0 }));
    if (cached) return json({ ...cached, servedFrom: 'saved', savedAt: cached.generatedAt, fallback: true, fallbackReason: reason });
    return json({ error: reason }, 503);
  }
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (req.method !== 'GET' && req.method !== 'HEAD') return notFound();
    const url = new URL(req.url);
    const m = /^\/c\/([^/]+)(\/.*)?$/.exec(url.pathname);
    if (!m || !safeEqual(m[1], env.ACCESS_KEY ?? '')) return notFound();
    if (!m[2]) return new Response(null, { status: 308, headers: { ...SECURITY_HEADERS, Location: `${url.pathname}/${url.search}` } });
    const rest = m[2];
    if (rest === '/api/snapshot') return getSnapshot(env, url, url.searchParams.get('fresh') === '1');
    // Plain-text agent view (no JavaScript needed) for Cabinet agents. Same key, same read-only data.
    if (rest === '/summary' || rest === '/summary.txt') {
      const r = await getSnapshot(env, url, true);
      if (!r.ok) return r;
      return new Response(summaryText((await r.json()) as any), { headers: { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
    }
    if (rest.startsWith('/api/')) return notFound();
    // Static app files (built by Vite). Unknown paths fall back to index.html (hash routing).
    const assetPath = rest === '/' || rest === '' ? '/index.html' : rest;
    let res: Response;
    const emb = EMBEDDED[assetPath];
    if (emb) {
      const bin = Uint8Array.from(atob(emb.b), (c) => c.charCodeAt(0));
      res = new Response(req.method === 'HEAD' ? null : bin, { headers: { 'Content-Type': emb.t } });
    } else if (env.ASSETS) {
      res = await env.ASSETS.fetch(new Request(new URL(assetPath, url.origin).toString(), { method: req.method }));
    } else return notFound();
    if (res.status === 404) return notFound();
    const immutable = assetPath.startsWith('/assets/');
    return withHeaders(res, { 'Cache-Control': immutable ? 'private, max-age=31536000, immutable' : 'private, no-cache' });
  },
};
