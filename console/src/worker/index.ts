/**
 * C-BIZ Console Worker. View-only: GET/HEAD only, no write routes, no Notion write calls.
 * Everything lives under /c/<ACCESS_KEY>/ ; any other path (or a wrong key) is a plain 404.
 */
import { NotionReader } from './notion';
import { refreshPass, assemble, KEYS, STALE_AFTER_MS, type State } from './snapshot';

export interface Env {
  SNAP: KVNamespace;
  ASSETS: Fetcher;
  ACCESS_KEY: string;
  NOTION_TOKEN?: string;
  NOTION_CALL_BUDGET?: string;
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

async function getSnapshot(env: Env, ctx: ExecutionContext, url: URL): Promise<Response> {
  const cached = await env.SNAP.get(KEYS.snapshot, 'json') as any;
  const now = new Date();
  let body = cached;
  let refreshing = false;
  if (!env.NOTION_TOKEN) {
    // Not connected to Notion yet: serve the build-time capture, clearly labelled as such.
    body = cached ?? (await env.SNAP.get(KEYS.seed, 'json'));
  } else {
    const age = cached ? now.getTime() - Date.parse(cached.generatedAt) : Infinity;
    const pendingKey = await env.SNAP.get('pending:v1');
    const wantsMore = url.searchParams.get('continue') === '1' && !!pendingKey;
    if (age > STALE_AFTER_MS || wantsMore) {
      const locked = await env.SNAP.get(KEYS.lock);
      if (!locked) {
        refreshing = true;
        const work = (async () => {
          await env.SNAP.put(KEYS.lock, '1', { expirationTtl: 60 });
          try {
            const prev = ((await env.SNAP.get(KEYS.state, 'json')) as State) ?? { sources: {} };
            const reader = new NotionReader(env.NOTION_TOKEN!);
            const { state, pending } = await refreshPass(reader, prev, { budget: Number(env.NOTION_CALL_BUDGET ?? 40), now: new Date() });
            await env.SNAP.put(KEYS.state, JSON.stringify(state));
            const snap = assemble(state, new Date(), 'live');
            await env.SNAP.put(KEYS.snapshot, JSON.stringify({ ...snap, pending }));
            if (pending.length) await env.SNAP.put('pending:v1', pending.join(','), { expirationTtl: 3600 });
            else await env.SNAP.delete('pending:v1');
          } finally {
            await env.SNAP.delete(KEYS.lock);
          }
        })();
        if (!cached) await work; // first ever load: wait for it
        else ctx.waitUntil(work);
        if (!cached) body = await env.SNAP.get(KEYS.snapshot, 'json');
      } else refreshing = true;
    }
  }
  if (!body) return new Response(JSON.stringify({ error: 'No snapshot yet' }), { status: 503, headers: { ...SECURITY_HEADERS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  return new Response(JSON.stringify({ ...body, refreshing }), { headers: { ...SECURITY_HEADERS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (req.method !== 'GET' && req.method !== 'HEAD') return notFound();
    const url = new URL(req.url);
    const m = /^\/c\/([^/]+)(\/.*)?$/.exec(url.pathname);
    if (!m || !safeEqual(m[1], env.ACCESS_KEY ?? '')) return notFound();
    const rest = m[2] ?? '/';
    if (rest === '/api/snapshot') return getSnapshot(env, ctx, url);
    if (rest.startsWith('/api/')) return notFound();
    // Static app files (built by Vite). Unknown paths fall back to index.html (hash routing).
    const assetPath = rest === '/' || rest === '' ? '/index.html' : rest;
    let res = await env.ASSETS.fetch(new Request(new URL(assetPath, url.origin).toString(), { method: req.method }));
    if (res.status === 404) return notFound();
    const immutable = assetPath.startsWith('/assets/');
    return withHeaders(res, { 'Cache-Control': immutable ? 'private, max-age=31536000, immutable' : 'private, no-cache' });
  },
};
