import React, { useState } from 'react';
import { useSnap, Header, Section, Led, Empty, lightWord, NotionLink } from '../ui';
import { ROOMS, healthLights } from '../../shared/derive';

const EVIDENCE = ['Established', 'Likely', 'Hypothesis'];

export default function Strategy() {
  const s = useSnap();
  const lights = healthLights(s);
  const ccHealth = (s.cc?.health ?? []) as { area: string; state: string; note: string }[];
  const [lane, setLane] = useState('All');
  const [ev, setEv] = useState('All');
  const open = s.insights.filter((i) => ['Active', 'Running', 'Proposed'].includes(i.status) && i.kind !== 'Experiment');
  const lanes = ['All', ...new Set(open.flatMap((i) => i.lanes))];
  const shown = open.filter((i) => (lane === 'All' || i.lanes.includes(lane)) && (ev === 'All' || i.evidence === ev)).sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  const exps = s.insights.filter((i) => i.kind === 'Experiment');

  return (
    <>
      <Header kicker="Strategy Room" title="Strategy" sources="Strategy Room, Intelligence Feed, snapshot (health lights computed here)" notion={ROOMS.strategy} art="couch" />
      <Section title="Ten health lights">
        <div className="panel">
          <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Area</th><th>Today</th><th>● Good</th><th>▲ Watch</th><th>■ Act</th></tr></thead>
            <tbody>{lights.map((l) => {
              const cc = ccHealth.find((h) => h.area === l.area);
              const differs = cc && cc.state !== l.light && l.light !== 'none';
              return (
                <tr key={l.area}>
                  <td><strong>{l.area}</strong></td>
                  <td><Led light={l.light} /> <div className="cap">{l.today}{l.note ? ` · ${l.note}` : ''}</div>{differs && <div className="cap" style={{ color: 'var(--warn)' }}>Command Center shows {cc!.state} ({cc!.note})</div>}</td>
                  <td className="cap">{l.rule.green}</td><td className="cap">{l.rule.amber}</td><td className="cap">{l.rule.red}</td>
                </tr>
              );
            })}</tbody></table></div>
          <p className="cap">Thresholds from the Strategy Room. No single blended score. Grey (○) = can’t be computed from the snapshot.</p>
        </div>
      </Section>

      <Section title="Insights feed" right={<NotionLink href={ROOMS.intel} />}>
        <div className="panel">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <label className="cap">Area <select value={lane} onChange={(e) => setLane(e.target.value)} style={{ minHeight: 44, background: 'var(--raised)', color: 'var(--ink)', border: '1px solid var(--hair-2)', borderRadius: 8, padding: '0 8px' }}>{lanes.map((l) => <option key={l}>{l}</option>)}</select></label>
            <label className="cap">Evidence <select value={ev} onChange={(e) => setEv(e.target.value)} style={{ minHeight: 44, background: 'var(--raised)', color: 'var(--ink)', border: '1px solid var(--hair-2)', borderRadius: 8, padding: '0 8px' }}>{['All', ...EVIDENCE].map((l) => <option key={l}>{l}</option>)}</select></label>
          </div>
          {shown.length ? shown.map((i) => (
            <div className="row" key={i.id} style={{ gridTemplateColumns: '1fr' }}>
              <div className="t">
                <span className="pill">{i.kind}</span> <span className={`pill ${i.evidence === 'Established' ? 'ok' : i.evidence === 'Likely' ? 'warn' : ''}`}>{i.evidence ?? '—'}</span> {i.urgency && <span className="pill gold">{i.urgency}</span>}
                <div style={{ marginTop: 4 }}><a href={i.url} target="_blank" rel="noopener noreferrer"><strong>{i.title}</strong></a></div>
                <div className="sub">{i.observation}</div>
                {i.action && <div className="cap">Action: {i.action}</div>}
              </div>
            </div>
          )) : <Empty>No open insights match those filters.</Empty>}
          <p className="cap">Shown exactly as the daily refresh wrote them. Established = the records show it · Likely = pattern, small sample · Hypothesis = worth testing.</p>
        </div>
      </Section>

      <Section title="Experiments (view only)">
        <div className="grid g3">
          {exps.length ? exps.map((e) => {
            const todo = s.experimentTodos.find((t) => t.text.toLowerCase().includes(e.title.replace(/^Experiment:\s*/i, '').toLowerCase().slice(0, 14)));
            return (
              <div className="panel" key={e.id}>
                <div className="strip-row"><strong>{e.title.replace(/^Experiment:\s*/i, '')}</strong><span className="pill">{e.status}</span></div>
                <div className="sub">{e.action}</div>
                <div className="cap" style={{ marginTop: 6 }}>Approval: {todo ? (todo.checked ? '☑ Approved in Notion' : '☐ Not approved yet') : 'Not found on the Strategy page'} · {e.evidence}</div>
              </div>
            );
          }) : <Empty>No experiments on file.</Empty>}
        </div>
      </Section>

      <Section title="Three futures">
        {s.futures.length ? (
          <div className="grid g3">
            {s.futures.map((f) => (
              <div className="panel" key={f.name}>
                <div className="strip-row"><strong>{f.name}</strong><span className="pill">Scenario</span></div>
                {f.body.split('\n').map((l, i) => <p key={i} className="sub" style={{ margin: '4px 0' }}>{l}</p>)}
              </div>
            ))}
          </div>
        ) : <div className="panel"><Empty>Couldn’t read the scenarios from the Strategy Room. They’re in the “Three futures” toggle there.</Empty><NotionLink href={ROOMS.strategy} /></div>}
        <p className="cap">Scenarios, not predictions — each uses today’s numbers and states its assumptions.</p>
      </Section>
      {lightWord('none') && null}
    </>
  );
}
