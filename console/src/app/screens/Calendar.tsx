import React from 'react';
import { useSnap, Header, Section, Empty, labelTime } from '../ui';
import { ROOMS } from '../../shared/derive';
import { addDays, labelDay } from '../../shared/time';

export default function Calendar() {
  const s = useSnap();
  const end = addDays(s.today, 9);
  const days = Array.from({ length: 10 }, (_, i) => addDays(s.today, i)).map((d) => ({ date: d, items: s.calendar.days.find((x) => x.date === d)?.items ?? [] }));
  const lv = s.calendar.lastVerified;
  const stale = lv ? (Date.parse(s.generatedAt) - Date.parse(lv.length > 10 ? `${lv}:00-05:00` : `${lv}T12:00:00-05:00`)) / 86400000 > 2 : true;
  return (
    <>
      <Header kicker="Rolling 60-Day Calendar · Muse" title="Calendar" sources="Rolling 60-Day Calendar (from Apple Calendar)" notion={ROOMS.calendar} art="couch" />
      <div className={`banner ${stale ? 'warn' : ''}`}>{stale ? '▲' : '●'} <span>Last verified against Apple Calendar: <strong>{lv ? lv.replace('T', ' ') : 'Not on file'}</strong>{stale ? ' — more than 2 days ago; the list may be out of date.' : ''}{s.calendar.refreshed ? ` · page refreshed ${s.calendar.refreshed.replace('T', ' ')}` : ''}</span></div>
      <Section title={`Next 10 days · to ${labelDay(end, { month: 'short', day: 'numeric' })}`}>
        <div className="panel">
          {days.map((d) => (
            <div className="cal-day" key={d.date}>
              <div className={`d${d.date === s.today ? ' today' : ''}`}>{labelDay(d.date, { weekday: 'short' })}<br />{labelDay(d.date, { month: 'short', day: 'numeric' })}</div>
              <div>
                {d.items.length ? d.items.map((it, i) => (
                  <div key={i} style={{ marginBottom: 6 }}>
                    <div><strong>{it.title.replace(/\s*\(user-reported.*\)/i, '')}</strong></div>
                    <div className="cap">{it.time ?? ''}{it.tentative ? ' · tentative' : ''}{it.userReported ? ' · user-reported' : ''} {it.tags.filter((t) => t !== 'personal').map((t) => <span key={t} className="pill gold" style={{ marginLeft: 4 }}>{t}</span>)}</div>
                  </div>
                )) : <span className="cap">No events</span>}
              </div>
            </div>
          ))}
          <p className="cap">Titles and times only (notes and addresses stay in Notion). Music items are tagged. {labelTime(s.generatedAt)}.</p>
          {!s.calendar.days.length && <Empty>The calendar couldn’t be read.</Empty>}
        </div>
      </Section>
    </>
  );
}
