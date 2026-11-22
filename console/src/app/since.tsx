/** SINCE LAST UPDATE — the most important verified business changes, newest visit first. */
import React, { useEffect, useMemo, useState } from 'react';
import { useSnap, Section, labelTime } from './ui';
import { labelDay } from '../shared/time';

const SEEN_KEY = 'cbiz:lastSeen';
const ICON: Record<string, string> = { ok: '●', info: '◆', warn: '▲', bad: '■' };
const COLOR: Record<string, string> = { ok: 'var(--ok)', info: 'var(--gold-hi)', warn: 'var(--warn)', bad: 'var(--bad)' };

function readSeen(): string | null {
  try { return localStorage.getItem(SEEN_KEY); } catch { return null; }
}
function writeSeen(v: string) {
  try { localStorage.setItem(SEEN_KEY, v); } catch { /* private mode: fine */ }
}

export function SinceLastUpdate() {
  const s = useSnap();
  const ch = s.changes;
  // The visit before this one (this device). Saved once per load, so "new" stays marked while you read.
  const [lastSeen] = useState(readSeen);
  useEffect(() => { if (s.mode === 'live') writeSeen(s.generatedAt); }, [s.generatedAt, s.mode]);
  const [all, setAll] = useState(false);

  const list = useMemo(() => {
    if (!ch) return [];
    const week = Date.parse(s.generatedAt) - 7 * 86400000;
    return ch.events
      .filter((e) => Date.parse(e.seenAt) >= week)
      .map((e) => ({ ...e, isNew: !lastSeen || Date.parse(e.seenAt) > Date.parse(lastSeen) }))
      // Business importance first, then newest.
      .sort((a, b) => Number(b.isNew) - Number(a.isNew) || b.priority - a.priority || b.seenAt.localeCompare(a.seenAt));
  }, [ch, lastSeen, s.generatedAt]);

  if (!ch) return null;
  const newCount = list.filter((e) => e.isNew).length;
  const shown = all ? list : list.slice(0, 4);
  const since = lastSeen ? `your last visit (${labelTime(lastSeen)})` : 'tracking began';

  return (
    <Section title="Since last update" right={<span className="cap">{newCount ? `${newCount} new since ${lastSeen ? 'your last visit' : 'tracking began'}` : 'Last 7 days'}</span>}>
      <div className="panel since">
        {!list.length ? (
          <p className="sub" style={{ margin: 0 }}>Nothing significant has changed in HQ in the last 7 days{ch.baselineAt ? ` (tracking since ${labelTime(ch.baselineAt)})` : ''}.</p>
        ) : (
          <>
            {!newCount && <p className="cap" style={{ marginTop: 0 }}>Nothing new since {since}. Most important changes from the last 7 days:</p>}
            <ol className="since-list">
              {shown.map((e) => (
                <li key={e.key}>
                  <a href={e.url} target="_blank" rel="noopener noreferrer">
                    <span className="since-dot" aria-hidden="true" style={{ color: COLOR[e.tone] }}>{ICON[e.tone]}</span>
                    <span>
                      <span className="what">{e.title}{e.isNew && <span className="pill gold" style={{ marginLeft: 6 }}>New</span>}</span>
                      <span className="why">{e.detail}</span>
                      <span className="src">{e.recordDate ? labelDay(e.recordDate, { month: 'short', day: 'numeric' }) : `Spotted ${labelTime(e.seenAt)}`} · {e.source} ↗</span>
                    </span>
                  </a>
                </li>
              ))}
            </ol>
            {list.length > 4 && <button className="link-sm since-more" onClick={() => setAll(!all)} aria-expanded={all}>{all ? 'Show fewer' : `Show all ${list.length}`}</button>}
          </>
        )}
        <p className="cap" style={{ marginBottom: 0 }}>Only verified changes in HQ records: money in, briefs moving stages, bookings, deliveries, overdue mixes, goals and light changes. Refreshes and edits aren’t counted. Tracking started {labelTime(ch.baselineAt)}, so nothing before that is listed unless its record carries its own date.</p>
      </div>
    </Section>
  );
}
