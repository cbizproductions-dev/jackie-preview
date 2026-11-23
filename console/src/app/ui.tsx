import React, { useEffect, useRef, useState, createContext, useContext } from 'react';
import type { Snapshot } from '../shared/schema';
import { labelDay, labelTime } from '../shared/time';
import { ART } from './art';

// ---------------- formatting ----------------
export const NOT_ON_FILE = 'Not on file';
export const money = (n: number | null | undefined, cents = false) =>
  n == null ? NOT_ON_FILE : '$' + n.toLocaleString('en-US', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });
export const moneyAuto = (n: number | null | undefined) => (n == null ? NOT_ON_FILE : money(n, Math.round(n) !== n));
export const pct = (x: number | null | undefined, d = 0) => (x == null ? NOT_ON_FILE : `${(x * 100).toFixed(d)}%`);
export const signedPct = (x: number | null | undefined, d = 0) => (x == null ? '—' : `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(d)}%`);
export const day = (s: string | null | undefined) => (s ? labelDay(s) : NOT_ON_FILE);
export const shortDay = (s: string | null | undefined) => (s ? labelDay(s, { month: 'short', day: 'numeric' }) : '—');
export { labelTime };

export const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// ---------------- snapshot context ----------------
export const SnapCtx = createContext<Snapshot | null>(null);
export const useSnap = () => useContext(SnapCtx)!;

// ---------------- number that ticks up once ----------------
export function Count({ value, fmt = (n: number) => String(n) }: { value: number | null; fmt?: (n: number) => string }) {
  const [v, setV] = useState(value == null || reducedMotion() ? value : 0);
  const done = useRef(false);
  useEffect(() => {
    if (value == null || reducedMotion() || done.current) { setV(value); return; }
    done.current = true;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 400);
      setV(value * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  if (value == null) return <span className="missing">{NOT_ON_FILE}</span>;
  return <>{fmt(Math.round((v ?? 0) * 100) / 100)}</>;
}

// ---------------- header with screen-print art ----------------
export function Header({ kicker, title, sources, notion, art = 'couch' }: { kicker: string; title: string; sources: string; notion: string; art?: keyof typeof ART }) {
  const s = useSnap();
  const a = s?.art?.[art] ?? ART[art];
  return (
    <header className="hdr">
      {a && <svg className="art" viewBox={`0 0 ${a.w} ${a.h}`} preserveAspectRatio="xMaxYMax meet" aria-hidden="true" dangerouslySetInnerHTML={{ __html: a.paths }} />}
      <div className="hdr-text">
        <div className="kicker">{kicker}</div>
        <h1>{title}</h1>
        <div className="asof">
          Data as of {s ? labelTime(s.generatedAt) : '…'}
          {s?.mode === 'seed' ? ' (build-time capture)' : ''} · {sources}
        </div>
      </div>
      <a className="btn-notion open" href={notion} target="_blank" rel="noopener noreferrer">Open in Notion ↗</a>
    </header>
  );
}

export function Strip({ children, dim, right }: { children: React.ReactNode; dim?: boolean; right?: React.ReactNode }) {
  return (
    <div className="strip-row">
      <h2 className={`strip${dim ? ' dim' : ''}`} style={{ margin: 0 }}>{children}</h2>
      {right}
    </div>
  );
}
export function Section({ title, right, children, dim }: { title: string; right?: React.ReactNode; children: React.ReactNode; dim?: boolean }) {
  return (
    <section className="section">
      <Strip dim={dim} right={right}>{title}</Strip>
      {children}
    </section>
  );
}
export function Fold({ title, children, open }: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details className="fold" open={open}>
      <summary>{title}</summary>
      {children}
    </details>
  );
}
export function Math_({ children, label = 'Show the arithmetic' }: { children: React.ReactNode; label?: string }) {
  return (
    <details className="math">
      <summary>{label}</summary>
      <div className="well">{children}</div>
    </details>
  );
}
export const NotionLink = ({ href, children = 'Open in Notion ↗' }: { href: string; children?: React.ReactNode }) => (
  <a className="link-sm" href={href} target="_blank" rel="noopener noreferrer">{children}</a>
);
export const Empty = ({ children }: { children: React.ReactNode }) => <p className="sub" style={{ margin: '6px 0' }}>{children}</p>;

// ---------------- status: color + shape + word ----------------
export type Light = 'green' | 'amber' | 'red' | 'none';
const SHAPE: Record<Light, string> = { green: '●', amber: '▲', red: '■', none: '○' };
const WORD: Record<Light, string> = { green: 'Good', amber: 'Watch', red: 'Act', none: 'No data' };
export function Led({ light, word = true }: { light: Light; word?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span className={`led ${light}`} aria-hidden="true">{SHAPE[light]}</span>
      {word && <span className="led-word" style={{ color: light === 'none' ? 'var(--ink-3)' : `var(--${light === 'green' ? 'ok' : light === 'amber' ? 'warn' : 'bad'})` }}>{WORD[light]}</span>}
    </span>
  );
}
export const lightWord = (l: Light) => WORD[l];

// ---------------- LED ladder meter ----------------
export function Ladder({ value, max, ticks = [], segments = 24, color, label }: { value: number | null; max: number; ticks?: { at: number; label: string; dashed?: boolean }[]; segments?: number; color?: string; label: string }) {
  const [on, setOn] = useState(reducedMotion() ? 1 : 0);
  useEffect(() => { const t = setTimeout(() => setOn(1), 30); return () => clearTimeout(t); }, []);
  const lit = value == null ? 0 : Math.max(0, Math.min(segments, Math.round((value / max) * segments * on)));
  return (
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value ?? undefined} aria-valuetext={label}>
      <div className="ladder" style={{ gridTemplateColumns: `repeat(${segments}, 1fr)` }}>
        {Array.from({ length: segments }, (_, i) => (
          <i key={i} className={i < lit ? 'on' : ''} style={{ ['--seg' as any]: color ?? (i / segments > 0.92 ? 'var(--gold-hi)' : 'var(--ok)') }} />
        ))}
        {ticks.map((t) => <span key={t.label} className={`tick${t.dashed ? ' dash' : ''}`} style={{ left: `calc(${(t.at / max) * 100}% )` }} />)}
      </div>
      {ticks.length > 0 && (
        <div className="ticklabels" aria-hidden="true">
          {ticks.map((t) => <span key={t.label} style={{ left: `${Math.min(92, Math.max(6, (t.at / max) * 100))}%` }}>{t.label}</span>)}
        </div>
      )}
    </div>
  );
}

// ---------------- sparkline ----------------
export function Spark({ data, w = 120, h = 30, label }: { data: { v: number; dashed?: boolean }[]; w?: number; h?: number; label: string }) {
  if (data.length < 2) return null;
  const max = Math.max(1, ...data.map((d) => d.v));
  const x = (i: number) => 3 + (i * (w - 6)) / (data.length - 1);
  const y = (v: number) => h - 3 - (v / max) * (h - 6);
  const solid = data.filter((d) => !d.dashed);
  const pts = (arr: typeof data, off = 0) => arr.map((d, i) => `${x(i + off)},${y(d.v)}`).join(' ');
  const last = data.length - 1;
  return (
    <svg className="chart" viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label={label} style={{ width: w }}>
      <polyline points={pts(solid)} fill="none" stroke="var(--gold)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {data[last].dashed && <polyline points={`${x(last - 1)},${y(data[last - 1].v)} ${x(last)},${y(data[last].v)}`} fill="none" stroke="var(--gold)" strokeWidth={2} strokeDasharray="3 3" />}
      <circle cx={x(last)} cy={y(data[last].v)} r={3} fill={data[last].dashed ? 'var(--panel)' : 'var(--gold)'} stroke="var(--gold)" strokeWidth={1.5} />
    </svg>
  );
}

// ---------------- tooltip (hover/tap) ----------------
export function useTip() {
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const bind = (text: string) => ({
    onMouseMove: (e: React.MouseEvent) => setTip({ x: e.clientX + 12, y: e.clientY + 12, text }),
    onMouseLeave: () => setTip(null),
    onFocus: (e: React.FocusEvent) => { const r = (e.target as Element).getBoundingClientRect(); setTip({ x: r.left, y: r.bottom + 6, text }); },
    onBlur: () => setTip(null),
    onClick: (e: React.MouseEvent) => setTip({ x: Math.min(e.clientX, window.innerWidth - 250), y: e.clientY + 12, text }),
    tabIndex: 0,
    'aria-label': text,
  });
  const el = tip ? <div className="tip" style={{ left: tip.x, top: tip.y }}>{tip.text}</div> : null;
  return { bind, el };
}

// Charts draw at their real pixel width so text stays at true size on phones.
export function useWidth(fallback = 640) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, w };
}

// ---------------- weekly bars with goal + stretch lines ----------------
export function WeeklyBars({ weeks, goal, stretch, today }: { weeks: { start: string; v: number | null; inProgress: boolean }[]; goal: number; stretch: number; today: string }) {
  const { bind, el } = useTip();
  const { ref, w: W } = useWidth();
  const H = 220, L = 40, B = 26, T = 14;
  const every = W < 480 ? 2 : 1;
  const max = Math.max(stretch * 1.08, ...weeks.map((w) => w.v ?? 0));
  const bw = (W - L - 8) / Math.max(weeks.length, 1);
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  return (
    <div ref={ref}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`Weekly studio-side cash, last ${weeks.length} weeks, goal $${goal}, stretch $${stretch}`}>
        <defs>
          <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="var(--lane-studio)" opacity=".35" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--lane-studio)" strokeWidth="3" />
          </pattern>
        </defs>
        {[0, goal / 2, goal, stretch].map((v) => (
          <g key={v}>
            <line x1={L} x2={W} y1={y(v)} y2={y(v)} stroke={v === goal ? 'var(--gold-hi)' : v === stretch ? 'var(--gold)' : 'var(--hair)'} strokeWidth={v === goal || v === stretch ? 1.5 : 1} strokeDasharray={v === stretch ? '5 4' : undefined} />
            <text x={L - 6} y={y(v) + 4} textAnchor="end">${v.toLocaleString('en-US')}</text>
          </g>
        ))}
        {weeks.map((w, i) => {
          const x = L + i * bw + 3;
          const v = w.v;
          const h = v == null ? 0 : H - B - y(v);
          return (
            <g key={w.start}>
              {v == null ? (
                <text x={x + (bw - 6) / 2} y={H - B - 6} textAnchor="middle" className="lbl">n/f</text>
              ) : (
                <path className="bar-hover" {...bind(`${shortDay(w.start)} week: ${money(v)}${w.inProgress ? ' · in progress' : ''}`)}
                  d={`M${x},${H - B} v${-Math.max(h - 4, 0)} q0,-4 4,-4 h${bw - 14} q4,0 4,4 v${Math.max(h - 4, 0)} z`}
                  fill={w.inProgress ? 'url(#hatch)' : 'var(--lane-studio)'} stroke={w.inProgress ? 'var(--lane-studio)' : 'none'} />
              )}
              {(weeks.length - 1 - i) % every === 0 && <text x={x + (bw - 6) / 2} y={H - 8} textAnchor="middle">{shortDay(w.start)}</text>}
              {w.inProgress && v != null && <text x={x + bw - 6} y={y(v) - 6} textAnchor="end" className="val">in progress</text>}
            </g>
          );
        })}
      </svg>
      <div className="legend">
        <span><i style={{ background: 'var(--lane-studio)' }} />Studio-side cash (sessions + remote mix + beats)</span>
        <span><i style={{ background: 'var(--gold-hi)', height: 2 }} />${goal} goal</span>
        <span><i style={{ borderTop: '2px dashed var(--gold)', height: 0 }} />${stretch.toLocaleString('en-US')} stretch</span>
        <span><i style={{ background: 'repeating-linear-gradient(45deg, var(--lane-studio) 0 2px, transparent 2px 5px)', border: '1px solid var(--lane-studio)' }} />Hatched = week in progress</span>
      </div>
      {el}
    </div>
  );
}

// ---------------- single horizontal stacked bar (lanes) ----------------
export function StackBar({ rows, label }: { rows: { label: string; v: number | null; color: string }[]; label: string }) {
  const { bind, el } = useTip();
  const total = rows.reduce((a, r) => a + (r.v ?? 0), 0);
  let acc = 0;
  return (
    <>
      <svg className="chart" viewBox="0 0 600 34" role="img" aria-label={label} preserveAspectRatio="none" style={{ height: 34 }}>
        {rows.filter((r) => (r.v ?? 0) > 0).map((r) => {
          const w = ((r.v ?? 0) / total) * 600;
          const x = acc;
          acc += w;
          return <rect key={r.label} className="bar-hover" {...bind(`${r.label}: ${moneyAuto(r.v)} (${pct((r.v ?? 0) / total)})`)} x={x + 1} y={2} width={Math.max(w - 2, 1)} height={30} rx={3} fill={r.color} />;
        })}
      </svg>
      <div className="legend">{rows.map((r) => <span key={r.label}><i style={{ background: r.color }} />{r.label}</span>)}</div>
      {el}
    </>
  );
}

// ---------------- horizontal bars (generic) ----------------
export function HBars({ rows, fmt = (n: number) => String(n), color = 'var(--lane-studio)', label }: { rows: { label: string; v: number | null; note?: string; color?: string }[]; fmt?: (n: number) => string; color?: string; label: string }) {
  const max = Math.max(1, ...rows.map((r) => r.v ?? 0));
  return (
    <div role="list" aria-label={label} className="rows">
      {rows.map((r) => (
        <div role="listitem" key={r.label} style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 38%) 1fr auto', gap: 8, alignItems: 'center' }}>
          <span className="sub" style={{ overflowWrap: 'anywhere' }}>{r.label}</span>
          <span style={{ height: 12, background: 'var(--well)', borderRadius: 3 }}>
            <span style={{ display: 'block', height: '100%', width: `${((r.v ?? 0) / max) * 100}%`, minWidth: r.v ? 3 : 0, background: r.color ?? color, borderRadius: 3 }} />
          </span>
          <span className="num" style={{ fontSize: '0.875rem' }}>{r.v == null ? NOT_ON_FILE : fmt(r.v)}{r.note ? <span className="cap"> {r.note}</span> : null}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------- runway timeline (contracts) ----------------
export function Runway({ items, today, days = 540 }: { items: { date: string; label: string; light: Light; inferred: boolean; sub: string }[]; today: string; days?: number }) {
  const { ref, w: W } = useWidth();
  const H = 40 + items.length * 34;
  const t0 = Date.parse(today);
  const x = (d: string) => 12 + ((Date.parse(d) - t0) / 86400000 / days) * (W - 24);
  const marks = [30, 90, 180, 365].filter((d) => d <= days && (W > 480 || d !== 30));
  return (
    <div ref={ref}><svg className="chart" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`Contract deadlines over the next ${days} days`}>
      <line x1={12} x2={W - 12} y1={24} y2={24} stroke="var(--hair-2)" />
      {marks.map((d) => (
        <g key={d}>
          <line x1={12 + (d / days) * (W - 24)} x2={12 + (d / days) * (W - 24)} y1={18} y2={H} stroke="var(--hair)" strokeDasharray="2 4" />
          <text x={12 + (d / days) * (W - 24)} y={12} textAnchor="middle">{d < 365 ? `${d}d` : '1 yr'}</text>
        </g>
      ))}
      <text x={12} y={12}>today</text>
      {items.map((it, i) => {
        const cx = Math.min(W - 16, Math.max(16, x(it.date)));
        const cy = 50 + i * 34;
        const c = it.light === 'red' ? 'var(--bad)' : it.light === 'amber' ? 'var(--warn)' : 'var(--ok)';
        return (
          <g key={i}>
            <line x1={cx} x2={cx} y1={24} y2={cy} stroke={c} strokeDasharray={it.inferred ? '3 3' : undefined} />
            <circle cx={cx} cy={cy} r={6} fill={it.inferred ? 'var(--panel)' : c} stroke={c} strokeWidth={2} />
            <text x={cx > W / 2 ? cx - 12 : cx + 12} y={cy + 4} textAnchor={cx > W / 2 ? 'end' : 'start'} className="val">{it.label.replace(/\s*\(.*$/, '').slice(0, Math.max(14, Math.floor((cx > W / 2 ? cx - 16 : W - cx - 16) / 7.2)))}</text>
            <text x={cx > W / 2 ? cx - 12 : cx + 12} y={cy + 17} textAnchor={cx > W / 2 ? 'end' : 'start'}>{it.sub}</text>
          </g>
        );
      })}
    </svg></div>
  );
}

export function SourceBadge({ snap }: { snap: Snapshot }) {
  if (snap.state === 'ok' && snap.mode === 'live') return <span className="pill ok">● OK</span>;
  if (snap.mode === 'seed') return <span className="pill warn">▲ Build-time capture</span>;
  return <span className="pill warn">▲ Partial: {snap.failed.join(', ')}</span>;
}
