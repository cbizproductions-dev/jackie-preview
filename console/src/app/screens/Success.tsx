import React from 'react';
import { emph } from '../emph';
import { useSnap, Header, Section, Empty, Led } from '../ui';
import { ROOMS, isDurango } from '../../shared/derive';
import { labelDay } from '../../shared/time';

type Item = { title?: string; body?: string; why?: string; source?: string; url?: string; date?: string; text?: string; who?: string };
const when = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? labelDay(d, { month: 'short', day: 'numeric', year: 'numeric' }) : d ?? '');
const ok = (x: Item) => !isDurango(`${x.title ?? ''} ${x.body ?? ''} ${x.text ?? ''}`);

function Cards({ items, cols = 'g2' }: { items: Item[]; cols?: string }) {
  return (
    <div className={`grid ${cols}`}>
      {items.filter(ok).map((x, i) => (
        <div className="panel" key={i}>
          {x.title && <div className="mid" style={{ fontSize: 17 }}>{x.title}</div>}
          {x.body && <p className="sub" style={{ margin: '6px 0' }}>{emph(x.body)}</p>}
          {x.why && <p className="cap" style={{ margin: '4px 0', color: 'var(--gold-hi)' }}>For you: {x.why}</p>}
          {x.source && (x.url
            ? <a className="link-sm" href={x.url} target="_blank" rel="noopener noreferrer">{x.source}{x.date ? ` · ${when(x.date)}` : ''} ↗</a>
            : <div className="cap">{x.source}{x.date ? ` · ${when(x.date)}` : ''}</div>)}
        </div>
      ))}
    </div>
  );
}

export default function Success() {
  const s = useSnap();
  const c = (s.success ?? null) as Record<string, any> | null;
  const cc = (s.cc ?? {}) as Record<string, any>;
  // Your own wins: live from the Command Center (Wins in today's brief + verified turning points).
  const wins = ((cc.brief ?? []) as { title: string; items: string[] }[]).find((b) => /win/i.test(b.title))?.items ?? [];
  const milestones = ((cc.momentum?.events ?? []) as [string, string, string, string, boolean][]).filter((e) => e[4]).slice(-6).reverse();
  const list = (k: string) => (Array.isArray(c?.[k]) ? (c![k] as Item[]) : []);

  return (
    <>
      <Header kicker="Researched for C-BIZ · Command Center" title="Success" sources="Your Command Center (live) and researched industry sources (linked on each card)" notion={ROOMS.home} art="redcarpet" />
      {c?.researched && <p className="cap" style={{ marginTop: 8 }}>Researched {when(c.researched)}{c.next_refresh ? ` · next refresh ${c.next_refresh}` : ''}. Every outside fact links to its source; forecasts and single surveys are labelled as such.</p>}

      <Section title="Your wins" right={<span className="cap">Live from the Command Center</span>}>
        <div className="grid g2">
          <div className="panel">
            <div className="label">This stretch</div>
            {wins.length ? <ul className="cc-list">{wins.filter((w) => !isDurango(w)).map((w, i) => <li key={i}>{emph(w)}</li>)}</ul> : <Empty>No wins listed in today’s brief.</Empty>}
          </div>
          <div className="panel">
            <div className="label">Verified turning points</div>
            {milestones.length ? milestones.map((e, i) => <div className="row" key={i}><span className="t"><Led light="green" word={false} /> <strong>{e[2]}</strong><div className="cap">{e[3]}</div></span><span className="r cap">{/^\d{4}-\d{2}-\d{2}$/.test(e[0]) ? labelDay(e[0], { month: 'short', day: 'numeric' }) : e[0]}</span></div>) : <Empty>Not on file.</Empty>}
          </div>
        </div>
      </Section>

      {!c ? (
        <div className="panel" style={{ marginTop: 16 }}><Empty>The researched sections (stories, quotes, lessons, industry and sync landscape) haven’t been loaded yet.</Empty></div>
      ) : (
        <>
          <Section title="Lessons to implement" right={<span className="cap">From your own numbers</span>}><Cards items={list('lessons')} /></Section>
          <Section title="Words to work by">
            <div className="grid g2">
              {list('quotes').filter(ok).map((q, i) => (
                <figure className="panel" key={i} style={{ margin: 0 }}>
                  <blockquote className="mid" style={{ margin: 0, fontSize: 18, lineHeight: 1.45 }}>“{q.text}”</blockquote>
                  <figcaption className="cap" style={{ marginTop: 6 }}>{q.who}</figcaption>
                </figure>
              ))}
            </div>
          </Section>
          <Section title="Success stories"><Cards items={list('stories')} /></Section>
          <Section title="Music business landscape"><Cards items={list('industry')} /></Section>
          <Section title="Sync landscape"><Cards items={list('sync')} /></Section>
          <Section title="Stay ahead of the curve" right={<span className="cap">Tailored to your catalog and lanes</span>}><Cards items={list('ahead')} cols="g3" /></Section>
        </>
      )}
    </>
  );
}
