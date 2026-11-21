import React from 'react';
import { useSnap, Header, Section, Empty, day, NotionLink } from '../ui';
import { ROOMS } from '../../shared/derive';

const HISTORY = [
  { when: 'Aug 8, 2026', what: 'Greg’s Sync / Placement Bootcamp, Atlanta — sole speaker' },
  { when: 'Aug 14, 2026', what: 'Full Sail University sync licensing panel, Orlando' },
  { when: 'Date not on file', what: '“Secrets to Sync Success” panel, film festival in McDonough, GA' },
  { when: 'May 2026', what: 'Durango sync conference, Ventura, CA (performed)' },
  { when: 'Date not on file', what: 'Featured speaker, Sync Spotlight (Matthew Still’s sync licensing conference)' },
];

export default function Speaking() {
  const s = useSnap();
  const upcoming = s.calendar.days.filter((d) => d.date >= s.today).flatMap((d) => d.items.filter((i) => i.tags.includes('speaking')).map((i) => ({ date: d.date, ...i })));
  return (
    <>
      <Header kicker="Speaking & Panels" title="Speaking" sources="Rolling 60-Day Calendar; Beacon’s leads are not tracked in HQ" notion={ROOMS.career} art="redcarpet" />
      <Section title="Upcoming">
        <div className="panel">
          {upcoming.length ? upcoming.map((u, i) => <div className="row" key={i}><span className="t"><strong>{u.title}</strong></span><span className="r cap">{day(u.date)}{u.time ? ` · ${u.time}` : ''}</span></div>) : <Empty>No speaking events on the calendar in the next 60 days.</Empty>}
          <div className="banner" style={{ marginTop: 10 }}>○ <span><strong>Beacon’s speaking & funding leads: not tracked in HQ.</strong> Beacon’s pipeline lives outside HQ (referenced in the Grok Bot log), so the Console can’t read it. Open the log to see what Beacon has posted.</span></div>
          <NotionLink href="https://app.notion.com/p/4008b67fa84e811bb288e86cc67ba06d">Grok Bot log ↗</NotionLink>
        </div>
      </Section>
      <Section title="History">
        <div className="panel">
          {HISTORY.map((h) => <div className="row" key={h.what}><span className="t">{h.what}</span><span className="r"><span className="pill">Kris-reported</span><div className="cap">{h.when}</div></span></div>)}
          <p className="cap">Kris-reported unless a date is confirmed in HQ or the calendar. The Durango conference is history only — nobody from it is shown as an action or outreach target.</p>
        </div>
      </Section>
      <Section title="Speaker kit links">
        <div className="panel">
          <div className="row"><span className="t">Condensed bio & credits</span><span className="r"><NotionLink href={ROOMS.career}>Milestones room ↗</NotionLink></span></div>
          <div className="row"><span className="t">Professional one-sheet</span><span className="r cap">No link in HQ yet</span></div>
          <p className="cap">Links come from HQ only.</p>
        </div>
      </Section>
    </>
  );
}
