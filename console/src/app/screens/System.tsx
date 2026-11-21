import React from 'react';
import { useSnap, Header, Section, Empty, labelTime, SourceBadge } from '../ui';
import { ROOMS } from '../../shared/derive';
import { NOTION_VERSION } from '../../worker/notion';

declare const __APP_VERSION__: string;

export default function System() {
  const s = useSnap();
  const d = s.system.dictionary;
  return (
    <>
      <Header kicker="System, Sources & Maintenance" title="System" sources="System page (read at runtime)" notion={ROOMS.system} art="la" />
      <Section title="This app">
        <div className="panel">
          <div className="row"><span className="t">Version</span><span className="r num">{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'}</span></div>
          <div className="row"><span className="t">Snapshot</span><span className="r num">{labelTime(s.generatedAt)}</span></div>
          <div className="row"><span className="t">State</span><span className="r"><SourceBadge snap={s} /></span></div>
          <div className="row"><span className="t">Notion API version</span><span className="r num">{NOTION_VERSION}</span></div>
          <p className="cap">View only. The Dashboard never writes to Notion, email, Instagram or anywhere else. Every item links to its source in Notion.</p>
        </div>
      </Section>
      <Section title="Counting rules">
        <div className="panel">{s.system.rules.length ? <ul style={{ margin: 0, paddingLeft: 18 }}>{s.system.rules.map((r) => <li key={r} className="sub" style={{ marginBottom: 6 }}>{r}</li>)}</ul> : <Empty>Couldn’t read the counting rules from the System page.</Empty>}</div>
      </Section>
      <Section title="Metric dictionary">
        <div className="panel">
          {d.length > 1 ? <div className="tbl-wrap"><table className="tbl"><thead><tr>{d[0].map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{d.slice(1).map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i} className={i ? 'cap' : ''}>{c}</td>)}</tr>)}</tbody></table></div> : <Empty>Couldn’t read the metric dictionary.</Empty>}
        </div>
      </Section>
      <Section title="Known limitations">
        <div className="panel">
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {s.system.limitations.map((r) => <li key={r} className="sub" style={{ marginBottom: 6 }}>{r}</li>)}
            <li className="sub">Dashboard: scouting, outreach and brief totals come from the Command Center’s daily data.json, so they refresh once a day, not live.</li>
            <li className="sub">Dashboard: Beacon’s speaking leads and most brand items aren’t tracked in HQ, so they show “Not tracked in HQ”.</li>
          </ul>
        </div>
      </Section>
    </>
  );
}
