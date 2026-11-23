import React, { useState } from 'react';
import { useSnap, Header, Section, Empty } from '../ui';
import { ROOMS } from '../../shared/derive';
import { followUps, FOLLOW_GROUPS, type FollowGroup } from '../../shared/followups';

export default function Followups() {
  const s = useSnap();
  const all = followUps(s);
  const [only, setOnly] = useState<FollowGroup | null>(null);
  const shown = only ? all.filter((f) => f.group === only) : all;
  const label = Object.fromEntries(FOLLOW_GROUPS);
  const scoutOff = !s.scoutLeads?.found;
  const syncOff = !(s.syncContacts ?? []).length;
  return (
    <>
      <Header kicker="Studio Board · Cash Flow Radar · Sync Contacts · Scout Trackers · Brief Board" title="Follow-ups" sources="Studio Board (Muse), Cash Flow Radar, Shared Sync Contacts, Scout trackers, Brief Board" notion={ROOMS.studioBoard} art="couch" />
      <Section title={`Everything waiting · ${all.length}`} right={<span className="cap">Oldest first</span>}>
        <div className="fu-chips" role="group" aria-label="Filter by group">
          <button className="pill" aria-pressed={!only} onClick={() => setOnly(null)}>All {all.length}</button>
          {FOLLOW_GROUPS.map(([g, l]) => {
            const n = all.filter((f) => f.group === g).length;
            return <button key={g} className="pill" aria-pressed={only === g} onClick={() => setOnly(only === g ? null : g)} disabled={!n}>{l} {n}</button>;
          })}
        </div>
        <div className="panel">
          {shown.length ? shown.map((f, i) => (
            <div className="row" key={`${f.group}-${f.who}-${i}`} style={{ gridTemplateColumns: '1fr auto' }}>
              <span className="t">
                <span className="pill" style={{ marginRight: 6 }}>{label[f.group]}</span>{f.hot && <span className="pill gold" style={{ marginRight: 6 }}>Hot</span>}
                <a href={f.url} target="_blank" rel="noopener noreferrer"><strong>{f.who}</strong></a>
                <div className="cap">{f.why}</div>
                <div className="cap">{f.source} ↗</div>
              </span>
              <span className="r cap" style={{ textAlign: 'right', color: f.age > 0 && (f.group === 'mix' || f.group === 'owed') ? 'var(--bad)' : undefined }}>{f.ageLabel}</span>
            </div>
          )) : <Empty>Nothing waiting{only ? ' in this group' : ''}.</Empty>}
          <p className="cap">
            View only; act in Notion or the app each row links to. Rebook = paid studio clients with nothing booked and 14+ days since their last session. Hot = vibe within the last 14 days.
            {syncOff ? ' Shared Sync Contacts couldn’t be read this time, so sync follow-ups aren’t listed.' : ' Sync follow-ups use each contact’s Follow-up date; Durango contacts stay on hold.'}
            {scoutOff ? ' The scout trackers couldn’t be found, so scout replies aren’t listed.' : ' Scout replies are checked every 6 hours.'}
          </p>
        </div>
      </Section>
    </>
  );
}
