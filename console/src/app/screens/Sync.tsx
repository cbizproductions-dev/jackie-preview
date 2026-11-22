import React from 'react';
import { useSnap, Header, Section, money, moneyAuto, pct, signedPct, Empty, HBars, NotionLink, shortDay, useTip, useWidth } from '../ui';
import { CCRoom } from '../cc';
import { ROOMS, bmiSummary, catalogNumbers } from '../../shared/derive';
import { quarterKey, syncReplyRate, briefConversion, round2 } from '../../shared/rules';

const COMPANIES = ['Gramoscope', 'MIBE', 'Figure & Groove', 'Space and Sound', 'Endless Noise', 'Silver Sun', 'Sync Collective'];

export default function Sync() {
  const s = useSnap();
  const { bind, el } = useTip();
  const { ref: chartRef, w: W } = useWidth();
  const active = s.briefs.filter((b) => ['New', 'Committed', 'In progress'].includes(b.status ?? ''));
  const groups = ['In progress', 'Committed', 'New'].map((g) => ({ g, rows: active.filter((b) => b.status === g) })).filter((x) => x.rows.length);
  const working = s.cc?.active_briefs as { kicker: string; rows: string[][]; note: string } | undefined;
  const conv = briefConversion(s.briefs);
  const lean = s.insights.find((i) => /lean|library/i.test(i.title) && /\$/.test(i.observation));
  const directBy = new Map<string, number>();
  if (lean) for (const m of lean.observation.matchAll(/(Gramoscope|MIBE|Figure (?:and|&) Groove|Space and Sound|Endless Noise|Silver Sun|Sync Collective)\s*=?\s*\$([\d,]+)/g)) directBy.set(m[1].replace('and Groove', '& Groove'), Number(m[2].replace(/,/g, '')));
  const companies = [...new Set([...COMPANIES, ...s.briefs.map((b) => b.company).filter(Boolean) as string[]])];

  // BMI bars with real gaps for missing quarters
  const stm = s.bmi.map((b) => ({ ...b, k: quarterKey(b.statement)! })).filter((b) => b.k).sort((a, b) => a.k.year - b.k.year || a.k.q - b.k.q);
  const first = stm[0]?.k, last = stm[stm.length - 1]?.k;
  const slots: { label: string; v: number | null }[] = [];
  if (first && last) for (let y = first.year, q = first.q; y < last.year || (y === last.year && q <= last.q); q === 4 ? (y++, (q = 1)) : q++) {
    const hit = stm.find((b) => b.k.year === y && b.k.q === q);
    slots.push({ label: `${y} Q${q}`, v: hit?.royalties ?? null });
  }
  const bs = bmiSummary(s);
  const maxB = Math.max(1, ...slots.map((x) => x.v ?? 0));
  const H = 170, bw = (W - 10) / Math.max(slots.length, 1);
  const last4 = stm.slice(-4);
  const tv = last4.reduce((a, b) => a + (b.usTv ?? 0), 0), st = last4.reduce((a, b) => a + (b.streaming ?? 0), 0), intl = last4.reduce((a, b) => a + (b.international ?? 0), 0);
  const conc = s.insights.find((i) => /titles\s*=\s*\d+%/i.test(i.title));
  const rising = s.insights.find((i) => /rising networks/i.test(i.action));
  const cat = catalogNumbers(s);
  const catIns = s.insights.find((i) => /registered works have earned|registered BMI works/i.test(i.title + i.observation));
  const version = s.insights.find((i) => /version/i.test(i.title));
  const contacts = (s.cc?.rooms?.contacts ?? []) as [string, number][];
  const cnt = (k: RegExp) => contacts.find((c) => k.test(c[0]))?.[1] ?? null;
  const replied = cnt(/^replied/i), reached = cnt(/reached/i);
  const upside = ((s.cc?.cash?.calendar ?? []) as string[][]).find((c) => /tunesat/i.test(c[1]));
  const nextBmi = ((s.cc?.cash?.calendar ?? []) as string[][]).find((c) => /BMI statement/i.test(c[1]));

  return (
    <>
      <Header kicker="Brief Board · Royalty Dashboard · Sync Tracker" title="Sync & Royalties" sources="Brief Board (Maestro), BMI Statements, Intelligence Feed, Command Center data.json" notion={ROOMS.sync} art="la" />
      <CCRoom room="sync" />

      {working && working.rows?.length > 0 && (
        <Section title="Working on now">
          <div className="panel">
            <div className="label" style={{ marginBottom: 6 }}>{working.kicker}</div>
            {working.rows.map((r, i) => <div className="row" key={i}><span className="t"><strong>{r[1]}</strong><div className="cap">{r[2]}</div></span><span className="r"><span className="pill gold">{r[3]}</span><div className="cap">{r[0]}</div></span></div>)}
            <p className="cap">{working.note}</p>
          </div>
        </Section>
      )}

      <Section title="Active briefs" right={<NotionLink href={ROOMS.briefBoard} />}>
        <div className="panel">
          {groups.length ? groups.map((g) => (
            <div key={g.g} style={{ marginBottom: 8 }}>
              <div className="label">{g.g}</div>
              {g.rows.map((b) => <div className="row" key={b.url}><span className="t"><a href={b.url} target="_blank" rel="noopener noreferrer"><strong>{b.brief}</strong></a><div className="cap">{b.company} · {b.code} · {b.deliverables} {b.type}</div></span><span className="r cap">{b.round2 ? `R2 ${shortDay(b.round2)}–${shortDay(b.round2End)}` : `Due ${shortDay(b.due)}`}</span></div>)}
            </div>
          )) : <Empty>No active briefs on the Brief Board.</Empty>}
        </div>
      </Section>

      <Section title="Library scorecard">
        <div className="panel">
          <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Library</th><th className="n">Briefs</th><th className="n">Won</th><th className="n">Direct $</th></tr></thead>
            <tbody>{companies.map((c) => {
              const v = conv.find((x) => x.company === c);
              return <tr key={c}><td>{c}</td><td className="n">{v?.total ?? '—'}</td><td className="n">{v ? `${v.won} (${pct(v.rate)})` : '—'}</td><td className="n">{directBy.has(c) ? money(directBy.get(c)!) : '—'}</td></tr>;
            })}</tbody></table></div>
          {s.mode === 'seed' && <p className="cap" style={{ color: 'var(--warn)' }}>▲ The build-time capture holds only the active briefs, so brief counts here are partial. Full counts appear once live reads start.</p>}
          <p className="cap">Won = Contract or Paid/Placed. Briefs and won from the Brief Board (Contract or Paid/Placed ÷ all briefs). Confirmed direct $ from Maestro’s dashboard via the Intelligence Feed. “—” = not on file.</p>
          {lean && <p className="sub">{lean.title}: {lean.observation} <span className="pill">{lean.evidence}</span></p>}
        </div>
      </Section>

      <Section title="BMI statements">
        <div className="panel">
          {bs && <div className="grid g3" style={{ marginBottom: 10 }}>
            <div><div className="label">Latest · {bs.latest.statement}</div><div className="mid">{moneyAuto(bs.latest.royalties)}</div></div>
            <div><div className="label">vs prior quarter</div><div className="mid">{signedPct(bs.qoq, 1)}</div><div className="cap">{bs.prevQ?.statement}</div></div>
            <div><div className="label">vs a year ago</div><div className="mid">{signedPct(bs.yoy, 1)}</div><div className="cap">{bs.yoyRow?.statement ?? 'No same quarter on file'}</div></div>
          </div>}
          <div ref={chartRef} className="no-swipe">
            <svg className="chart" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="BMI royalties by statement quarter; missing statements shown as gaps">
              {slots.map((x, i) => {
                const h = x.v == null ? 0 : (x.v / maxB) * (H - 30);
                const X = 5 + i * bw;
                return x.v == null
                  ? <rect key={x.label} x={X + 1} y={H - 24} width={Math.max(bw - 2, 1)} height={2} fill="var(--hair-2)" {...bind(`${x.label}: not in the files (gap, not $0)`)} />
                  : <rect key={x.label} className="bar-hover" x={X + 1} y={H - 22 - h} width={Math.max(bw - 2, 1)} height={h} rx={2} fill="var(--lane-bmi)" {...bind(`${x.label}: ${money(x.v, true)}`)} />;
              })}
              {slots.map((x, i) => (x.label.endsWith('Q1') && (W > 480 || Number(x.label.slice(0, 4)) % 2 === 0) ? <text key={x.label} x={5 + i * bw} y={H - 6}>{x.label.slice(2, 4) === '16' ? '' : `’${x.label.slice(2, 4)}`}</text> : null))}
            </svg>
          </div>
          <div className="legend"><span><i style={{ background: 'var(--lane-bmi)' }} />Royalties by statement</span><span><i style={{ background: 'var(--hair-2)', height: 2 }} />Gap: statement not in the files (not $0)</span></div>
          <p className="cap">Royalties by statement year — not cash-deposit dates. 19 older statements aren’t in the files, so pre-2023 years read low.</p>
          {el}
        </div>
      </Section>

      <div className="grid g2">
        <Section title="Where the money comes from">
          <div className="panel">
            <div className="label">Last 4 statements by source</div>
            <HBars label="BMI by source, last 4 statements" fmt={(n) => money(n)} rows={[{ label: 'US broadcast & cable TV', v: round2(tv), color: 'var(--lane-bmi)' }, { label: 'Streaming & digital', v: round2(st), color: 'var(--lane-studio)' }, { label: 'International', v: round2(intl), color: 'var(--lane-remote)' }]} />
            {conc && <p className="sub" style={{ marginTop: 8 }}><strong>{conc.title}.</strong> {conc.observation}</p>}
            {rising && <p className="sub"><strong>Rising networks:</strong> {rising.action.replace(/^Prioritize[^:]*:\s*/i, '')}</p>}
          </div>
        </Section>
        <Section title="TuneSat pipeline (not income)">
          <div className="panel">
            {s.tunesat.rows.length ? s.tunesat.rows.map((r, i) => <div className="row" key={i}><span className="t"><strong>{r.title}</strong><div className="cap">{r.show}</div></span><span className="r cap">{r.detail}</span></div>)
              : upside ? <><div className="mid" style={{ fontSize: 18 }}>{upside[2].split('.')[0]}</div><div className="cap">Itemized list: open the Royalty Dashboard.</div></> : <Empty>No TuneSat detections on file.</Empty>}
            <p className="cap">Detected on TV but not paid. Not income until a BMI statement pays them, and some may be buyouts or no-back-end deals that never will. Expected timing: {upside?.[0] ?? '—'}{nextBmi ? ` · next statement ${nextBmi[0]}` : ''}.</p>
            <NotionLink href={ROOMS.royalty} />
          </div>
        </Section>
      </div>

      <div className="grid g2">
        <Section title="Catalog intelligence">
          <div className="panel">
            <div className="row"><span className="t">Registered works</span><span className="r num">{cat.registered?.toLocaleString('en-US') ?? 'Not on file'}</span></div>
            <div className="row"><span className="t">Have paid at least once</span><span className="r num">{cat.earned ?? '—'} ({pct(cat.earned != null && cat.registered ? cat.earned / cat.registered : null)})</span></div>
            {catIns && <p className="sub">{catIns.observation}</p>}
            {version && <p className="sub"><strong>Versioning:</strong> {version.observation} <span className="pill">{version.evidence}</span></p>}
          </div>
        </Section>
        <Section title="Sync outreach">
          <div className="panel">
            <div className="mid">{pct(syncReplyRate(replied, reached), 1)} <span className="cap">reply rate</span></div>
            <HBars label="Sync contacts by status" rows={contacts.map(([k, v]) => ({ label: k, v }))} />
            <p className="cap">Replied ÷ (reached + replied). Read only — Durango conference contacts stay on hold and never appear as actions.</p>
            <NotionLink href={ROOMS.syncTracker} />
          </div>
        </Section>
      </div>
      <p className="foot">Dataset counts (statements, briefs, contacts on file) use stricter definitions than Kris’s career figures (2,000+ placements, 210+ shows), so they’re smaller. See Career for the side-by-side.</p>
    </>
  );
}
