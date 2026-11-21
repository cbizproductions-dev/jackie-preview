import React from 'react';
import { useSnap, Header, Section, Empty, labelTime, Led, NotionLink, SourceBadge } from '../ui';
import { ROOMS, TRACKED_FOR_FRESHNESS } from '../../shared/derive';

const ago = (iso: string | null, now: string) => {
  if (!iso) return 'Not on file';
  const h = (Date.parse(now) - Date.parse(iso)) / 3600000;
  return h < 1 ? 'within the hour' : h < 48 ? `${Math.round(h)} h ago` : `${Math.round(h / 24)} days ago`;
};

export default function Cabinet() {
  const s = useSnap();
  const runs = s.maintenance;
  const last = runs[0];
  const lastDaily = runs.find((r) => r.type === 'Daily');
  return (
    <>
      <Header kicker="The Cabinet" title="Cabinet" sources="HQ log pages (last edited time only), Maintenance Log" notion={ROOMS.hq} art="couch" />
      <Section title="Members who touch music">
        <div className="panel">
          {s.members.length ? s.members.map((m) => (
            <div className="row" key={m.name} style={{ gridTemplateColumns: '1fr auto' }}>
              <span className="t"><strong>{m.name}</strong><div className="sub">{m.role}</div><div className="cap">Role from: {m.roleSource}{m.owns.length ? ` · Owns: ${m.owns.join(', ')}` : ''}</div></span>
              <span className="r"><div className="num" style={{ fontSize: 13 }}>{ago(m.lastActive, s.generatedAt)}</div><a className="link-sm" href={m.logUrl} target="_blank" rel="noopener noreferrer">{m.logName} ↗</a></span>
            </div>
          )) : <Empty>Cabinet logs haven’t been read yet.</Empty>}
          <p className="cap">Last activity = the log page’s last edited time. The Console doesn’t summarize anyone’s log — tap through to read it.</p>
        </div>
      </Section>

      <Section title="Command Center refresh">
        <div className="panel">
          {lastDaily ? <div className="row"><span className="t"><strong>{lastDaily.run}</strong><div className="cap">{lastDaily.issues || 'No issues logged'}</div></span><span className="r"><Led light={lastDaily.result === 'OK' ? 'green' : lastDaily.result === 'Partial' ? 'amber' : 'red'} /><div className="cap">{lastDaily.result}</div></span></div> : <Empty>No daily run in the Maintenance Log.</Empty>}
          {last && last !== lastDaily && <div className="row"><span className="t">Latest entry: {last.run}<div className="cap">{last.issues}</div></span><span className="r cap">{last.result}</span></div>}
          <NotionLink href={ROOMS.maint}>Maintenance Log ↗</NotionLink>
        </div>
      </Section>

      <Section title="Source freshness" right={<SourceBadge snap={s} />}>
        <div className="panel">
          <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Source</th><th>Owner</th><th>Last edited</th><th>State</th></tr></thead>
            <tbody>{s.sources.map((x) => (
              <tr key={x.id}>
                <td><a href={x.url} target="_blank" rel="noopener noreferrer">{x.name}</a>{x.note && <div className="cap">{x.note}</div>}</td>
                <td className="cap">{x.owner}</td>
                <td className="cap">{x.lastEdited ? (x.lastEdited.length > 10 ? labelTime(x.lastEdited) : x.lastEdited) : '—'}</td>
                <td>{x.state === 'failed' ? <Led light="red" /> : x.state === 'stale' ? <Led light={TRACKED_FOR_FRESHNESS.includes(x.id) ? 'amber' : 'none'} /> : x.state === 'not_connected' ? <span className="cap">Not read</span> : <Led light="green" />}{!TRACKED_FOR_FRESHNESS.includes(x.id) && x.state !== 'failed' && <div className="cap">Reference</div>}</td>
              </tr>
            ))}</tbody></table></div>
          <p className="cap">Green = updated within 2 days. The freshness light counts the daily-feed sources (Studio Board, Calendar, daily refresh); reference sources show their age only.</p>
        </div>
      </Section>

      <Section title="Open data issues">
        <div className="panel">
          {s.issues.length ? s.issues.map((i, k) => (
            <div className="row" key={k} style={{ gridTemplateColumns: '1fr' }}>
              <span className="t"><span className="pill warn">▲ Data issue</span> <strong>{i.title}</strong><div className="sub">{i.detail}</div><div className="cap">Sources: {i.sources.join(' vs ')} · {i.origin === 'console' ? 'found by the Console' : 'Intelligence Feed'}{i.url ? <> · <a href={i.url} target="_blank" rel="noopener noreferrer">Open ↗</a></> : null}</div></span>
            </div>
          )) : <Empty>No open data issues.</Empty>}
          <p className="cap">Conflicts are shown, never resolved here. Kris’s word beats any agent’s record; on studio conflicts, Kris’s word beats Maestro’s. Snapshot {labelTime(s.generatedAt)}.</p>
        </div>
      </Section>
    </>
  );
}
