import React, { useState } from 'react';
import { useSnap, Header, Section, Empty, money, shortDay, NotionLink, day } from '../ui';
import { CCRoom, CCEras } from '../cc';
import { ROOMS } from '../../shared/derive';
import { addDays } from '../../shared/time';

const BRAND = [
  { item: 'IMDb', note: 'Page live · name change to “C-BIZ OFFICIAL” in progress · “Known For” goal: the Olympics · soundtrack credits added in batches', match: /imdb/i },
  { item: 'LinkedIn build-out', note: 'Producer / sync profile', match: /linkedin/i },
  { item: 'Instagram @cbiz_official', note: 'Source of all photos (read only)', match: /instagram/i },
  { item: 'Professional one-sheet', note: '', match: /one-sheet/i },
  { item: 'Disco pitch playlists', note: 'Selected works · cinematic trailer', match: /disco/i },
  { item: 'Bio & Credits and website links', note: '', match: /bio|website/i },
];

export default function Career() {
  const s = useSnap();
  const [view, setView] = useState<'30' | '90' | '10y'>('90');
  const events = ((s.cc?.momentum?.events ?? []) as [string, string, string, string, boolean][]).map((e) => ({ date: e[0], kind: e[1], title: e[2], sub: e[3], verified: e[4] }));
  const tl = (s.cc?.tl ?? []) as string[][];
  const from = view === '30' ? addDays(s.today, -30) : view === '90' ? addDays(s.today, -90) : '0000';
  const inMotion = s.career.inMotion.join(' ');
  const photos = s.photos.filter((p) => p.code && p.approved && /kris/i.test(p.kind));

  return (
    <>
      <Header kicker="Milestones, Discoveries & Career" title="Career & Brand" sources="Milestones room, Command Center data.json (momentum), Photo Library" notion={ROOMS.career} art="redcarpet" />
      <CCRoom room="milestones" />
      <Section title="Momentum timeline" right={
        <div role="tablist" style={{ display: 'flex', gap: 4 }}>{(['30', '90', '10y'] as const).map((v) => <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className="pill" style={{ minHeight: 44, cursor: 'pointer', background: view === v ? 'var(--raised)' : 'none', color: view === v ? 'var(--gold-hi)' : undefined }}>{v === '10y' ? '10 years' : `${v} days`}</button>)}</div>
      }>
        <div className="panel">
          {view === '10y' ? (
            tl.length ? tl.map((t, i) => <div className="row" key={i}><span className="t"><strong>{t[1]}</strong><div className="cap">{t[2]}</div></span><span className="r label">{t[0]}</span></div>) : <Empty>No long-range timeline on file.</Empty>
          ) : (
            events.filter((e) => e.date >= from).length ? events.filter((e) => e.date >= from).reverse().map((e, i) => (
              <div className="row" key={i}><span className="t"><span className={`pill ${e.verified ? 'ok' : ''}`}>{e.verified ? 'Verified' : 'Kris-reported'}</span> <strong>{e.title}</strong><div className="cap">{e.sub} · {e.kind}</div></span><span className="r cap">{shortDay(e.date)}</span></div>
            )) : <Empty>No turning points recorded in this window.</Empty>
          )}
          <p className="cap">Verified = a statement, payment, agreement or Studio Board record is on file. Kris-reported = your account, not yet backed by a record.</p>
        </div>
      </Section>

      <CCEras />

      <Section title="Career figures vs verified data">
        <div className="panel">
          {s.career.figures.length > 1 ? (
            <div className="tbl-wrap"><table className="tbl"><thead><tr>{s.career.figures[0].map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>{s.career.figures.slice(1).map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i} className={i === 3 ? 'cap' : ''}>{c}</td>)}</tr>)}</tbody></table></div>
          ) : <Empty>The comparison table isn’t on file.</Empty>}
          <p className="cap">Career figures are your reported numbers (one-sheet). Dataset counts use stricter definitions and only the statements on file.</p>
        </div>
      </Section>

      <div className="grid g2">
        <Section title="Credits — verified">
          <div className="panel">{s.career.verifiedCredits.length ? s.career.verifiedCredits.map((c) => <div className="row" key={c}><span className="t">{c}</span></div>) : <Empty>Not on file.</Empty>}</div>
        </Section>
        <Section title="Credits — Kris-reported">
          <div className="panel">{s.career.reportedCredits.length ? s.career.reportedCredits.map((c) => <p key={c} className="sub">{c}</p>) : <Empty>Not on file.</Empty>}</div>
        </Section>
      </div>

      <Section title="Brand presence">
        <div className="grid g3">
          {BRAND.map((b) => {
            const row = s.brand.rows.find((r) => b.match.test(r.item));
            if (row) return (
              <div className="panel" key={b.item}>
                <div className="strip-row"><strong>{b.item}</strong><span className="pill gold">{row.status || 'Tracked'}</span></div>
                {row.key && <div className="mid" style={{ fontSize: 18 }}>{row.key}</div>}
                <div className="cap">{row.lastChecked ? `Checked ${day(row.lastChecked)}` : 'Not checked yet'} · <a href={row.url} target="_blank" rel="noopener noreferrer">Brand Presence ↗</a>{row.link ? <> · <a href={row.link} target="_blank" rel="noopener noreferrer">Open</a></> : null}</div>
              </div>
            );
            const tracked = b.match.test(inMotion) || b.match.test(s.career.verifiedCredits.join(' '));
            return <div className="panel" key={b.item}><div className="strip-row"><strong>{b.item}</strong><span className={`pill ${tracked ? 'gold' : ''}`}>{tracked ? 'In HQ' : 'Not tracked in HQ'}</span></div><div className="cap">{tracked ? b.note || 'Tracked in the Milestones room' : 'No status recorded in HQ.'}</div></div>;
          })}
        </div>
        <p className="cap">{s.brand.found ? 'Live from Brandon’s Brand Presence tracker in HQ.' : 'Brandon’s Brand Presence tracker isn’t in HQ yet; it appears here automatically once it exists and is shared with the integration.'}</p>
      </Section>

      <Section title="Photos">
        {photos.length ? (
          <div className="photo-grid">
            {photos.map((p) => <iframe key={p.code} title={`Instagram post ${p.code} (@cbiz_official)`} src={`https://www.instagram.com/p/${p.code}/embed`} loading="lazy" referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-popups" />)}
          </div>
        ) : <div className="panel"><Empty>No approved photos of Kris in the Photo Library yet.</Empty></div>}
        <p className="cap">Official Instagram post embeds from @cbiz_official, listed in the Photo Library — only posts where Kris is the person pictured. Loaded only when you scroll here.</p>
        <NotionLink href="https://app.notion.com/p/41e8b67fa84e81e4876fc8e2bdc1874e">Photo Library ↗</NotionLink>
      </Section>
      {money(null) && null}
    </>
  );
}
