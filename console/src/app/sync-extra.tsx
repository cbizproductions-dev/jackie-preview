/** Sync screen additions (Kris, Nov 23): This week's 5, Sync trajectory, Sync playbook. View only. */
import React, { useState } from 'react';
import { useSnap, Section, Empty, money, useWidth } from './ui';
import { syncMonthly, syncWeekly } from '../shared/synctraj';
import { labelDay } from '../shared/time';
import { isDurango } from '../shared/derive';
import { maestroPrompt } from '../shared/maestro';

const short = (d: string) => labelDay(d, { month: 'short', day: 'numeric' });
const idOf = (u: string) => (u.split('/').pop() ?? '').replace(/-/g, '').split('?')[0];

export function SyncWeek5() {
  const s = useSnap();
  const w = (s.cc as any)?.sync_week5 as { week_label?: string; rule?: string; items?: { name: string; company: string; type: string; email: string; how: string; row: string }[] } | undefined;
  const [copied, setCopied] = useState<string | null>(null);
  const items = (w?.items ?? []).filter((x) => !isDurango(`${x.name} ${x.company}`));
  if (!items.length) return null;
  const status = (row: string) => s.syncContacts.find((c) => idOf(c.url) === idOf(row))?.status ?? '';
  const copy = async (key: string, text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 1800); } catch { /* clipboard blocked: the text is still visible to select */ }
  };
  return (
    <Section title="This week’s 5" right={<span className="cap">{w?.week_label ?? ''}</span>}>
      <div className="panel">
        {items.map((x) => {
          const st = status(x.row);
          const sent = /^(contacted|replied)$/i.test(st);
          return (
            <div className="row w5" key={x.row || x.email} style={{ gridTemplateColumns: '1fr' }}>
              <div className="t">
                <div className="strip-row">
                  <strong>{x.name}</strong>
                  <span>{sent ? <span className="pill ok">✓ sent{/replied/i.test(st) ? ' · replied' : ''}</span> : <span className="pill">{x.type}</span>}</span>
                </div>
                <div className="cap">{x.company}{sent ? ` · ${x.type}` : ''}</div>
                <button className="w5-email" onClick={() => copy(`e:${x.email}`, x.email)} aria-label={`Copy ${x.email}`}>{copied === `e:${x.email}` ? 'Copied ✓' : x.email} <span aria-hidden="true">⧉</span></button>
                <div className="sub">{x.how}</div>
                {x.row && <a className="link-sm" href={x.row} target="_blank" rel="noopener noreferrer">Tracker row ↗</a>}
                {!sent && (() => {
                  const prompt = maestroPrompt(x, w?.week_label);
                  const key = `p:${x.row || x.email}`;
                  return (
                    <details className="w5-prompt">
                      <summary>Prompt for Maestro{/draft ready/i.test(st) ? ' · draft ready' : ''}</summary>
                      <pre tabIndex={0} aria-label={`Prompt for Maestro about ${x.name}`}>{prompt}</pre>
                      <button className="w5-email" onClick={() => copy(key, prompt)}>{copied === key ? 'Copied ✓ paste it to Maestro' : 'Copy prompt for Maestro'} <span aria-hidden="true">⧉</span></button>
                    </details>
                  );
                })()}
              </div>
            </div>
          );
        })}
        {w?.rule && <p className="cap">{w.rule}</p>}
      </div>
    </Section>
  );
}

export function SyncPlaybook() {
  const s = useSnap();
  const t = (s.cc as any)?.sync_tips as { researched?: string; next_refresh?: string; items?: { title: string; body: string; source: string; date: string; url: string }[] } | undefined;
  const items = t?.items ?? [];
  if (!items.length) return null;
  const when = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? short(d) : d ?? '');
  return (
    <Section title="Sync playbook" right={<span className="cap">Researched {when(t?.researched)} · next refresh {when(t?.next_refresh)}</span>}>
      <div className="grid g2">
        {items.map((x, i) => (
          <div className="panel" key={i}>
            <div className="mid" style={{ fontSize: 17 }}>{x.title}</div>
            <p className="sub" style={{ margin: '6px 0' }}>{x.body}</p>
            <a className="link-sm" href={x.url} target="_blank" rel="noopener noreferrer">{x.source}{x.date ? ` · ${/^\d{4}-\d{2}-\d{2}$/.test(x.date) ? labelDay(x.date, { month: 'short', day: 'numeric', year: 'numeric' }) : x.date}` : ''} ↗</a>
          </div>
        ))}
      </div>
    </Section>
  );
}

export function SyncTrajectory() {
  const s = useSnap();
  const [mode, setMode] = useState<'month' | 'week'>('month');
  const { ref, w: W } = useWidth();
  const month = syncMonthly(s);
  const week = syncWeekly(s);
  const H = 190, padL = 6, padR = 6, padT = 12, padB = 26;
  const n = mode === 'month' ? month.length : week.length;
  const slot = (W - padL - padR) / n;
  const money$ = month.map((m) => (m.fees == null && !m.bmi ? null : (m.fees ?? 0) + m.bmi));
  const maxM = Math.max(1, ...money$.map((v) => v ?? 0));
  const counts = mode === 'month' ? month : week;
  const maxC = Math.max(1, ...counts.flatMap((c) => [c.briefs, c.outreach ?? 0]));
  const y$ = (v: number) => padT + (H - padT - padB) * (1 - v / maxM);
  const yC = (v: number) => padT + (H - padT - padB) * (1 - v / maxC);
  const cx = (i: number) => padL + slot * i + slot / 2;
  const line = (vals: (number | null)[]) => {
    // Gaps break the line; no smoothing.
    let d = '';
    vals.forEach((v, i) => { if (v == null) return; d += `${d && vals[i - 1] != null ? 'L' : 'M'}${cx(i).toFixed(1)},${yC(v).toFixed(1)}`; });
    return d;
  };
  const label = (k: string) => (mode === 'month' ? labelDay(`${k}-15`, { month: 'short' }) : short(k));
  const hasOutreach = s.syncContacts.length > 0;
  const every = W < 480 ? 2 : 1;
  return (
    <Section title="Sync trajectory" right={
      <div role="tablist" style={{ display: 'flex', gap: 4 }}>{(['month', 'week'] as const).map((v) => <button key={v} role="tab" aria-selected={mode === v} onClick={() => setMode(v)} className="pill" style={{ minHeight: 44, cursor: 'pointer', background: mode === v ? 'var(--raised)' : 'none', color: mode === v ? 'var(--gold-hi)' : undefined }}>{v === 'month' ? 'Month' : 'Week'}</button>)}</div>
    }>
      <div className="panel">
        <div ref={ref}>
          <svg width={W} height={H} role="img" aria-label={mode === 'month' ? `Sync money and activity by month: ${month.map((m, i) => `${label(m.key)} ${money$[i] == null ? 'no data' : money(money$[i])}, ${m.briefs} briefs, ${m.outreach ?? 'no'} outreach`).join('; ')}` : `Briefs and outreach by week: ${week.map((w) => `${label(w.key)} ${w.briefs} briefs, ${w.outreach ?? 'no'} outreach`).join('; ')}`}>
            {mode === 'month' && month.map((m, i) => {
              const bw = Math.max(4, slot * 0.6), x = cx(i) - bw / 2;
              if (m.fees == null && !m.bmi) return <text key={m.key} x={cx(i)} y={H - padB - 4} textAnchor="middle" fontSize="11" fill="var(--ink-3)">–</text>;
              const fe = m.fees ?? 0;
              return (
                <g key={m.key}>
                  {fe > 0 && <rect x={x} y={y$(fe)} width={bw} height={H - padB - y$(fe)} fill="var(--lane-sync)" rx="2"><title>{`${label(m.key)}: upfront fees ${money(fe)}`}</title></rect>}
                  {m.bmi > 0 && <rect x={x} y={y$(fe + m.bmi)} width={bw} height={y$(fe) - y$(fe + m.bmi)} fill="var(--lane-bmi)" rx="2"><title>{`${label(m.key)}: BMI ${m.bmiStatements.join(', ')} ${money(m.bmi)} (month approximate)`}</title></rect>}
                </g>
              );
            })}
            <path d={line(counts.map((c) => c.briefs))} fill="none" stroke="var(--ink)" strokeWidth="2" />
            {hasOutreach && <path d={line(counts.map((c) => c.outreach))} fill="none" stroke="var(--lane-studio)" strokeWidth="2" strokeDasharray="5 3" />}
            {counts.map((c, i) => (
              <g key={`p${c.key}`}>
                <circle cx={cx(i)} cy={yC(c.briefs)} r="3" fill="var(--ink)" />
                {c.outreach != null && <circle cx={cx(i)} cy={yC(c.outreach)} r="3" fill="var(--lane-studio)" />}
                {i % every === 0 && <text x={cx(i)} y={H - 8} textAnchor="middle" fontSize="12" fill="var(--ink-3)">{label(c.key)}</text>}
              </g>
            ))}
            <line x1={padL} x2={W - padR} y1={H - padB} y2={H - padB} stroke="var(--hair-2)" />
          </svg>
        </div>
        <div className="legend" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 6 }}>
          {mode === 'month' && <><span className="cap"><Sw c="var(--lane-sync)" />Upfront sync fees</span><span className="cap"><Sw c="var(--lane-bmi)" />BMI by statement</span></>}
          <span className="cap"><Sw c="var(--ink)" line />Briefs delivered</span>
          {hasOutreach && <span className="cap"><Sw c="var(--lane-studio)" line dashed />Outreach sent</span>}
        </div>
        <p className="cap">
          {mode === 'month'
            ? `Bars use their own $ scale (top = ${money(maxM)}); lines use a count scale (top = ${maxC}). “–” = no monthly data on file (the Income Ledger has months from 2026 on), not $0. BMI statements are placed about 5 months after their quarter ends, the payment timing HQ uses, so their month is approximate.`
            : `Briefs and outreach only: sync money is too lumpy to show weekly. Top of scale = ${maxC}.`}
          {' '}Briefs delivered = Brief Board rows at Submitted, Passed, Contract or Paid/Placed, by their Due date. {hasOutreach ? 'Outreach sent = Shared Sync Contacts “Last contacted” dates.' : 'Outreach: Shared Sync Contacts couldn’t be read, so it’s not shown.'} No smoothing.
        </p>
      </div>
    </Section>
  );
}
function Sw({ c, line, dashed }: { c: string; line?: boolean; dashed?: boolean }) {
  return line
    ? <svg width="18" height="10" aria-hidden="true" style={{ marginRight: 6, verticalAlign: 'middle' }}><line x1="0" x2="18" y1="5" y2="5" stroke={c} strokeWidth="2" strokeDasharray={dashed ? '5 3' : undefined} /></svg>
    : <span aria-hidden="true" style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: c, marginRight: 6 }} />;
}
export { Empty };
