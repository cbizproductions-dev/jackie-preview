import { NotionReader } from './notion';
import { SOURCES, readCabinet } from './sources';
import { Snapshot, type SourceState, type DataIssue } from '../shared/schema';
import { consoleConflicts, freshnessOf } from '../shared/derive';
import { nyDate } from '../shared/time';

/** Turn a Notion API failure into a sentence Kris can act on. Never includes the token. */
export function explainError(err: string): string {
  if (/\b401\b|unauthorized/i.test(err)) return 'Notion rejected the token (check NOTION_TOKEN in Cloudflare)';
  if (/\b404\b|object_not_found|could not find/i.test(err)) return 'Not shared with the integration (Notion → ••• → Connections → add C-BIZ Console)';
  if (/\b403\b|restricted/i.test(err)) return 'Integration lacks Read content permission';
  if (/\b400\b|validation/i.test(err)) return `Notion refused the request (${err.slice(0, 90)})`;
  if (/rate-limited|\b429\b/i.test(err)) return 'Notion rate limit — will retry';
  return `Read failed (${err.slice(0, 90)})`;
}

export type SrcState = {
  lastEdited: string | null;
  checkedAt: string | null;
  readAt: string | null;
  data: Record<string, unknown> | null;
  dataSourceId?: string | null;
  error?: string | null;
  needsRead?: boolean;
  /** Data is the build-time capture, not a live read yet. */
  fromSeed?: boolean;
};
export type State = { sources: Record<string, SrcState>; members?: Snapshot['members']; membersAt?: string | null; /** Time of the last completed change check. */ sweptAt?: string | null };

export const KEYS = { state: 'state:v1', snapshot: 'snapshot:v1', seed: 'seed:v1', seedState: 'seed-state:v1', lock: 'lock:v1' } as const;
export const STALE_AFTER_MS = 15 * 60 * 1000;
/** A Partial snapshot retries its failed sources sooner. */
export const RETRY_FAILED_MS = 2 * 60 * 1000;
/** Full per-source check at least this often (the one-call sweep covers the time in between). */
export const FULL_CHECK_MS = 6 * 3600 * 1000;
/** Search results can lag a little; each sweep looks back this much further. */
export const SWEEP_OVERLAP_MS = 10 * 60 * 1000;

/**
 * One refresh pass. Probes sources whose last check is older than 15 minutes, re-reads only those whose
 * last_edited_time changed, and stops starting new reads once the call budget is used (Workers Free allows
 * 50 outbound requests per invocation). Remaining sources stay "needsRead" for the next pass.
 */
export async function refreshPass(reader: NotionReader, prev: State, opts: { budget: number; now: Date; force?: boolean }): Promise<{ state: State; pending: string[]; mode: 'sweep' | 'full'; changed: string[] }> {
  const state: State = { ...prev, sources: { ...prev.sources } };
  const nowIso = opts.now.toISOString();
  const today = nyDate(opts.now);
  const pending: string[] = [];
  const changed: string[] = [];
  const dash = (id: string | null | undefined) => (id ?? '').replace(/-/g, '');

  // 1) Find what changed. Normally ONE Notion search call ("edited since the last check"), not one call per source.
  //    A full per-source probe runs when there's no recent sweep (first run, >6 h, or the search failed).
  let mode: 'sweep' | 'full' = 'full';
  const sweptAt = state.sweptAt ? Date.parse(state.sweptAt) : 0;
  if (!opts.force && sweptAt && opts.now.getTime() - sweptAt < FULL_CHECK_MS) {
    try {
      const since = new Date(sweptAt - SWEEP_OVERLAP_MS).toISOString();
      const hits = await reader.editedSince(since, 3);
      mode = 'sweep';
      for (const def of SOURCES) {
        const s = state.sources[def.id];
        const same = (a: string | null | undefined, b: string | null | undefined) => !!a && !!b && dash(a) === dash(b);
        const match = hits.find((h) =>
          (def.kind === 'page' && same(h.id, def.notionId)) ||
          (def.kind === 'database' && (same(h.parentDb, def.notionId) || same(h.parentDs, s?.dataSourceId) || same(h.id, s?.dataSourceId))),
        );
        if (match && s) { state.sources[def.id] = { ...s, needsRead: true, lastEdited: match.edited }; changed.push(def.id); }
      }
      // Cabinet logs: last activity comes straight from the search results (no extra calls).
      if (state.members) state.members = state.members.map((m) => {
        const h = hits.find((x) => dash(x.id) === dash(m.logUrl.split('/').pop()));
        return h && (!m.lastActive || h.edited > m.lastActive) ? { ...m, lastActive: h.edited } : m;
      });
      state.sweptAt = nowIso;
    } catch { mode = 'full'; }
  }

  const order = [...SOURCES].sort((a, b) => (state.sources[a.id]?.checkedAt ?? '').localeCompare(state.sources[b.id]?.checkedAt ?? ''));
  for (const def of order) {
    const s: SrcState = state.sources[def.id] ? { ...state.sources[def.id] } : { lastEdited: null, checkedAt: null, readAt: null, data: null };
    if (!s.data || s.fromSeed) s.needsRead = true;
    if (reader.calls >= opts.budget - 2) { if (mode === 'full' || s.needsRead) pending.push(def.id); state.sources[def.id] = s; continue; }
    if (def.discover) {
      const recent = s.checkedAt && opts.now.getTime() - Date.parse(s.checkedAt) < FULL_CHECK_MS && s.data && !s.fromSeed && !s.needsRead;
      if (!recent && reader.calls < opts.budget * 0.7) {
        try {
          const r = await def.read(reader, today);
          s.data = r.data; s.lastEdited = r.lastEdited; s.readAt = nowIso; s.checkedAt = nowIso; s.error = null; s.needsRead = false; s.fromSeed = false;
          const found = Object.values(r.data)[0] as any;
          if (found?.dsId) s.dataSourceId = found.dsId;
        } catch (e) { s.error = String((e as Error).message ?? e).slice(0, 200); s.checkedAt = null; }
      }
      state.sources[def.id] = s;
      continue;
    }
    try {
      if (mode === 'full' && !s.needsRead) {
        let lastEdited: string | null;
        if (def.kind === 'database') {
          const p = await reader.probeDatabase(def.notionId, s.dataSourceId);
          lastEdited = p.lastEdited;
          s.dataSourceId = p.dataSourceId;
        } else lastEdited = (await reader.page(def.notionId)).last_edited_time ?? null;
        if (lastEdited !== s.lastEdited) { s.needsRead = true; changed.push(def.id); }
        s.lastEdited = lastEdited;
      }
      s.checkedAt = nowIso;
      if (s.needsRead) {
        if (reader.calls >= opts.budget * 0.7) { pending.push(def.id); state.sources[def.id] = s; continue; }
        const r = await def.read(reader, today);
        s.data = r.data;
        s.lastEdited = r.lastEdited ?? s.lastEdited;
        s.readAt = nowIso;
        s.needsRead = false;
        s.fromSeed = false;
        if (def.kind === 'database' && !s.dataSourceId) {
          try { s.dataSourceId = (await reader.database(def.notionId)).data_sources?.[0]?.id ?? null; } catch { /* optional */ }
        }
      }
      s.error = null;
    } catch (e) {
      s.error = String((e as Error).message ?? e).slice(0, 200); // last good data is kept in s.data
      s.checkedAt = null; // re-check on the next pass
    }
    state.sources[def.id] = s;
  }
  if (mode === 'full' && !pending.length) state.sweptAt = nowIso;
  // Cabinet roles: re-read at most every 6 hours (activity times come from the sweep).
  if (reader.calls < opts.budget - 10 && (!state.membersAt || opts.now.getTime() - Date.parse(state.membersAt) > FULL_CHECK_MS)) {
    try {
      const sm = (state.sources.system?.data?._sourceMap as string[][]) ?? [];
      state.members = await readCabinet(reader, sm);
      state.membersAt = nowIso;
    } catch { /* keep previous */ }
  }
  return { state, pending, mode, changed };
}

const EMPTY: Omit<Snapshot, 'generatedAt' | 'today' | 'mode' | 'state' | 'failed' | 'sources' | 'issues'> = {
  schemaVersion: 1, weeks: [], ledger: [], bmi: [], goals: [], insights: [], maintenance: [], photos: [],
  studio: { synced: null, mixes: [], clients: [], vibe: [], deposits: [], upcoming: [], syncChecks: [], beatSales: [], deliveries: [] },
  calendar: { refreshed: null, lastVerified: null, days: [] }, briefs: [], contracts: [], leases: { rows: null },
  cashMoves: [], experimentTodos: [], members: [], tunesat: { rows: [], note: '' },
  system: { dictionary: [], rules: [], limitations: [] },
  career: { figures: [], timeline: [], verifiedCredits: [], reportedCredits: [], inMotion: [] }, futures: [], cc: {}, art: {}, brand: { found: false, url: '', rows: [] }, leads: { found: false, url: '', rows: [] },
};

export function assemble(st: State, now: Date, mode: 'live' | 'seed' = 'live'): Snapshot {
  const nowIso = now.toISOString();
  const today = nyDate(now);
  const merged: Record<string, any> = { ...structuredClone(EMPTY) };
  let weekLine = null, openLine = null;
  const sources: SourceState[] = [];
  const failed: string[] = [];
  for (const def of SOURCES) {
    const s = st.sources[def.id];
    if (s?.data) {
      for (const [k, v] of Object.entries(s.data)) {
        if (k === '_weekLine') weekLine = v as any;
        else if (k === '_openLine') openLine = v as any;
        else if (!k.startsWith('_')) merged[k] = v;
      }
    }
    let state: SourceState['state'] = 'fresh';
    let note = '';
    if (def.discover && (!s?.data || !(Object.values(s.data)[0] as any)?.found)) { state = 'not_connected'; note = s?.error ? explainError(s.error) : 'Not in HQ yet (or not shared with the integration)'; }
    else if (!s || (!s.data && !s.error)) { state = 'not_connected'; note = 'Not read yet'; failed.push(def.name); }
    else if (s.fromSeed && !s.error) { state = 'stale'; note = 'Showing the build-time capture until the first live read'; failed.push(def.name); }
    else if (s.error) { state = 'failed'; note = `${explainError(s.error)} — ${s.data ? `showing last good data${s.readAt ? ` from ${s.readAt.slice(0, 10)}` : ''}` : 'no data yet'}`; failed.push(def.name); }
    if (def.id === 'studio' && s?.data && state !== 'failed') {
      const synced = (merged.studio?.synced as string | null) ?? null;
      state = freshnessOf(synced ? `${synced}T23:59:00-05:00` : s.lastEdited, nowIso);
      if (synced) note = `Board last synced ${synced}`;
    }
    sources.push({ id: def.id, name: def.name, owner: def.owner, kind: def.kind, url: def.discover ? ((Object.values(s?.data ?? {})[0] as any)?.url || 'https://app.notion.com/p/1488b67fa84e80f69ff0c33b8ecc1b94') : `https://app.notion.com/p/${def.notionId}`, lastEdited: s?.lastEdited ?? null, readAt: s?.readAt ?? null, state, note });
  }
  // Calendar freshness uses its own "Last verified" line, not just the page edit time.
  const cal = sources.find((x) => x.id === 'calendar');
  if (cal && cal.state !== 'failed' && merged.calendar?.lastVerified) {
    const lv = merged.calendar.lastVerified as string;
    const ageDays = (Date.parse(nowIso) - Date.parse(lv.length > 10 ? `${lv}:00-05:00` : `${lv}T12:00:00-05:00`)) / 86400000;
    cal.state = ageDays > 2 ? 'stale' : 'fresh';
    cal.note = `Last verified against Apple Calendar ${lv.replace('T', ' ')}`;
  }
  // The Command Center daily refresh itself, from the Maintenance Log.
  const lastDaily = (merged.maintenance as Snapshot['maintenance']).find((r) => r.type === 'Daily');
  sources.push({ id: 'refresh', name: 'Command Center daily refresh', owner: 'Claude', kind: 'database', url: 'https://app.notion.com/p/41e8b67fa84e81a4aa3ade6a1840e3db', lastEdited: lastDaily?.date ?? null, readAt: null, state: lastDaily?.date && (Date.parse(today) - Date.parse(lastDaily.date)) / 86400000 <= 2 ? 'fresh' : 'stale', note: lastDaily ? `${lastDaily.result}: ${lastDaily.run}` : 'No daily run on file' });

  merged.members = st.members ?? [];
  const snap = {
    ...merged, schemaVersion: 1, generatedAt: nowIso, today, mode, state: failed.length ? 'partial' : 'ok', failed, sources, issues: [] as DataIssue[],
  } as Snapshot;
  const fromFeed: DataIssue[] = snap.insights
    .filter((i) => i.kind === 'Data issue' && i.status === 'Active')
    .map((i) => ({ title: i.title, sources: i.source.split(/;\s*/).filter(Boolean), detail: i.observation, url: i.url, origin: 'intelligence_feed' as const }));
  snap.issues = [...fromFeed, ...consoleConflicts(snap, weekLine, openLine)];
  return Snapshot.parse(snap);
}
