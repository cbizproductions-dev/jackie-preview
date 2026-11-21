import React, { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { Snapshot } from '../shared/schema';
import { SnapCtx } from './ui';
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
  const [more, setMore] = useState(false);
  const embedded = (() => { try { return window.self !== window.top; } catch { return true; } })();

  useEffect(() => {
    const on = () => { setRoute(routeFromHash()); setMore(false); window.scrollTo(0, 0); };
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);

  // Serve cached snapshot immediately; if the Worker is rebuilding in the background, poll until it finishes.
  useEffect(() => {
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    let first = true;
    const load = async () => {
      try {
        const r = await fetch(`./api/snapshot${first ? '' : '?continue=1'}`, { cache: 'no-store' });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const body = (await r.json()) as any;
        const parsed = Snapshot.safeParse(body);
        if (!parsed.success) throw new Error('Snapshot failed validation');
        setSnap(parsed.data);
        const busy = !!body.refreshing || (Array.isArray(body.pending) && body.pending.length > 0);
        setUpdating(busy);
        if (busy && tries++ < 12) timer = setTimeout(load, 6000);
      } catch (e) {
        setErr(String((e as Error).message));
        setUpdating(false);
      }
      first = false;
    };
    load();
    return () => clearTimeout(timer);
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
