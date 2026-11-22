import React, { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { Snapshot } from '../shared/schema';
import { SnapCtx, labelTime } from './ui';
import Home from './screens/Home';

const Money = lazy(() => import('./screens/Money'));
const Studio = lazy(() => import('./screens/Studio'));
const Beats = lazy(() => import('./screens/Beats'));
const Sync = lazy(() => import('./screens/Sync'));
const Contracts = lazy(() => import('./screens/Contracts'));
const Strategy = lazy(() => import('./screens/Strategy'));
const Career = lazy(() => import('./screens/Career'));
const Speaking = lazy(() => import('./screens/Speaking'));
const Calendar = lazy(() => import('./screens/Calendar'));
const Cabinet = lazy(() => import('./screens/Cabinet'));
const System = lazy(() => import('./screens/System'));

export const SCREENS = [
  { id: 'home', name: 'Home', C: Home },
  { id: 'money', name: 'Money', C: Money },
  { id: 'studio', name: 'Studio', C: Studio },
  { id: 'sync', name: 'Sync', C: Sync },
  { id: 'beats', name: 'Beats', C: Beats },
  { id: 'contracts', name: 'Contracts', C: Contracts },
  { id: 'strategy', name: 'Strategy', C: Strategy },
  { id: 'career', name: 'Career', C: Career },
  { id: 'speaking', name: 'Speaking', C: Speaking },
  { id: 'calendar', name: 'Calendar', C: Calendar },
  { id: 'cabinet', name: 'Cabinet', C: Cabinet },
  { id: 'system', name: 'System', C: System },
] as const;
const TABS = ['home', 'money', 'studio', 'sync'];

const routeFromHash = () => {
  const id = location.hash.replace(/^#\/?/, '').split('?')[0];
  return SCREENS.some((s) => s.id === id) ? id : 'home';
};

export default function App() {
  const [route, setRoute] = useState(routeFromHash());
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [fallback, setFallback] = useState<{ at: string; reason: string } | null>(null);
  const [more, setMore] = useState(false);
  const embedded = (() => { try { return window.self !== window.top; } catch { return true; } })();

  useEffect(() => {
    const on = () => { setRoute(routeFromHash()); setMore(false); window.scrollTo(0, 0); };
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);

  // Show the saved copy instantly, then read Notion fresh on every open (only what changed) and swap it in.
  // If Notion can't be reached, keep the saved copy and say how old it is.
  useEffect(() => {
    let alive = true;
    const get = async (fresh: boolean) => {
      const r = await fetch(`./api/snapshot${fresh ? '?fresh=1' : ''}`, { cache: 'no-store' });
      const body = (await r.json().catch(() => ({}))) as any;
      if (!r.ok) throw new Error(body?.error ?? `HTTP ${r.status}`);
      const parsed = Snapshot.safeParse(body);
      if (!parsed.success) throw new Error('Snapshot failed validation');
      return { snap: parsed.data, body };
    };
    (async () => {
      let haveSaved = false;
      try {
        const saved = await get(false);
        if (!alive) return;
        setSnap(saved.snap);
        haveSaved = true;
      } catch { /* no saved copy yet: the fresh read below fills it */ }
      setUpdating(true);
      try {
        for (let pass = 0; pass < 4 && alive; pass++) {
          const f = await get(true);
          if (!alive) return;
          setSnap(f.snap);
          setFallback(f.body.fallback ? { at: f.body.savedAt ?? f.snap.generatedAt, reason: f.body.fallbackReason ?? '' } : null);
          if (f.body.fallback || !(Array.isArray(f.body.pending) && f.body.pending.length)) break;
        }
      } catch (e) {
        if (!haveSaved) setErr(String((e as Error).message));
        else setFallback({ at: '', reason: 'Couldn’t reach the dashboard service' });
      }
      if (alive) setUpdating(false);
    })();
    return () => { alive = false; };
  }, []);

  // Swipe between screens on phone (ignores horizontally scrollable areas).
  const touch = useRef<{ x: number; y: number; ok: boolean } | null>(null);
  const order = SCREENS.map((s) => s.id);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY, ok: !(e.target as Element).closest('.tbl-wrap, .no-swipe, iframe') };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touch.current;
    touch.current = null;
    if (!s?.ok || window.innerWidth >= 960) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x, dy = t.clientY - s.y;
    if (Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.6) return;
    const i = order.indexOf(route as any);
    const next = order[i + (dx < 0 ? 1 : -1)];
    if (next) location.hash = `#/${next}`;
  };

  const Screen = SCREENS.find((s) => s.id === route)!.C;
  const link = (id: string, name: string, cls = '') => (
    <a key={id} href={`#/${id}`} className={cls} aria-current={route === id ? 'page' : undefined}><span className="tab-led" />{name}</a>
  );
  return (
    <SnapCtx.Provider value={snap}>
      {embedded && (
        <div className="embedbar">
          <span className="brand">C-BIZ Official Dashboard</span>
          <a href={location.href} target="_blank" rel="noopener">Open full screen ↗</a>
        </div>
      )}
      <div className={`shell${embedded ? ' embedded' : ''}`}>
        <nav className="rail" aria-label="Screens">
          <div className="brand">C-BIZ<br />Official<br />Dashboard</div>
          {SCREENS.map((s) => link(s.id, s.name))}
        </nav>
        <main className="main" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          {updating && <div className="updating" style={{ position: 'fixed', top: embedded ? 62 : 10, right: 14, zIndex: 20 }} role="status"><i />Updating…</div>}
          {fallback && snap && <div className="banner warn" role="status">▲ <span>Showing saved data from {labelTime(fallback.at || snap.generatedAt)}. {fallback.reason ? `${fallback.reason}. ` : ''}It will refresh the next time you open the dashboard.</span></div>}
          {err && !snap && <div className="banner bad" role="alert">Couldn’t load the snapshot ({err}). Pull to refresh, or open the Command Center in Notion.</div>}
          {!snap ? <Skeleton /> : (
            <Suspense fallback={<Skeleton />}>
              <Screen />
            </Suspense>
          )}
        </main>
      </div>
      {more && (
        <div className="morepanel" role="dialog" aria-label="More screens">
          {SCREENS.filter((s) => !TABS.includes(s.id)).map((s) => link(s.id, s.name))}
        </div>
      )}
      <nav className="tabbar" aria-label="Main">
        {SCREENS.filter((s) => TABS.includes(s.id)).map((s) => link(s.id, s.name))}
        <button type="button" aria-expanded={more} aria-current={!TABS.includes(route) ? 'page' : undefined} onClick={() => setMore((m) => !m)}><span className="tab-led" />More</button>
      </nav>
    </SnapCtx.Provider>
  );
}

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="sk" style={{ height: 96, margin: '16px 0' }} />
      <div className="bridge">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="meter"><div className="sk" style={{ height: 12, width: '60%' }} /><div className="sk" style={{ height: 30 }} /><div className="sk" style={{ height: 14 }} /></div>)}</div>
      <div className="sk" style={{ height: 220, marginTop: 16 }} />
    </div>
  );
}
