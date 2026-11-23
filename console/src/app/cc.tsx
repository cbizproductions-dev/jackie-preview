/**
 * "From the Command Center": the Command Center's own words and figures, shown in full (not re-summarized).
 * Everything here comes from the Command Center's data.json (its daily refresh), labelled with its "as of" time.
 * Durango hold applies to every line.
 */
import React from 'react';
import { emph } from './emph';
import { useSnap, Section, Led } from './ui';
import { isDurango } from '../shared/derive';

type Stat = { v: string; l: string; n?: string; color?: string };
type Strip = { kicker: string; title: string; accent?: string; stats: Stat[] };
const ok = (t: unknown): t is string => typeof t === 'string' && t.trim() !== '' && !isDurango(t);
const arr = <T,>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);
const toneLight = (t: string | undefined) => (t === 'red' ? 'red' : t === 'amber' ? 'amber' : t === 'green' ? 'green' : 'none') as 'red' | 'amber' | 'green' | 'none';

function useCC() {
  const s = useSnap();
  const cc = (s.cc ?? null) as Record<string, any> | null;
  const asOf = typeof cc?.as_of === 'string' ? (cc.as_of as string) : null;
  return { cc, asOf };
}
export function CCAsOf() {
  const { asOf } = useCC();
  return <span className="cap">Command Center{asOf ? ` · ${asOf}` : ''}</span>;
}

/** Room summary: the room's kicker, title, the Command Center's insight paragraph and every stat on its strip. */
export function CCRoom({ room, insight, title = 'From the Command Center' }: { room: string; insight?: string; title?: string }) {
  const { cc } = useCC();
  if (!cc) return null;
  const strip = cc.room_strips?.[room] as Strip | undefined;
  const text = cc.insights?.[insight ?? room];
  if (!strip && !ok(text)) return null;
  return (
    <Section title={title} right={<CCAsOf />}>
      <div className="panel cc-room" style={strip?.accent ? { borderLeft: `3px solid ${strip.accent}` } : undefined}>
        {strip && <div className="label">{strip.kicker}</div>}
        {strip && <div className="mid" style={{ fontSize: 20, marginTop: 2 }}>{strip.title}</div>}
        {ok(text) && <p className="cc-say">{emph(text)}</p>}
        {strip && (
          <div className="cc-stats">
            {arr<Stat>(strip.stats).filter((x) => ok(x.l) && !isDurango(`${x.v} ${x.n ?? ''}`)).map((x) => (
              <div className="cc-stat" key={x.l}>
                <div className="cc-v" style={x.color ? { borderBottom: `2px solid ${x.color}` } : undefined}>{x.v}</div>
                <div className="cc-l">{x.l}</div>
                {ok(x.n) && <div className="cap">{x.n}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}

/** The Command Center's one-line headline for today. */
export function CCHeadline() {
  const { cc } = useCC();
  if (!ok(cc?.headline)) return null;
  return (
    <div className="panel cc-headline" role="note">
      <div className="label">The Command Center says</div>
      <p>{cc!.headline}</p>
      <CCAsOf />
    </div>
  );
}

/** Needs you now · Decide this week · Wins — every item, as written. */
export function CCBrief() {
  const { cc } = useCC();
  const groups = arr<{ title: string; tone: string; items: string[] }>(cc?.brief).map((g) => ({ ...g, items: arr<string>(g.items).filter(ok) })).filter((g) => g.items.length);
  if (!groups.length) return null;
  return (
    <Section title="Today’s brief" right={<CCAsOf />}>
      <div className="grid g3">
        {groups.map((g) => (
          <div className="panel" key={g.title}>
            <div className="strip-row"><strong>{g.title}</strong><Led light={toneLight(g.tone)} word={false} /></div>
            <ul className="cc-list">{g.items.map((i, k) => <li key={k}>{emph(i)}</li>)}</ul>
          </div>
        ))}
      </div>
    </Section>
  );
}

/** Interesting facts: [big number, headline, detail, accent]. */
export function CCFacts() {
  const { cc } = useCC();
  const facts = arr<unknown[]>(cc?.facts).filter((f) => ok(f[1]) && !isDurango(String(f[2] ?? '')));
  if (!facts.length) return null;
  return (
    <Section title="Interesting facts" right={<CCAsOf />}>
      <div className="grid g3">
        {facts.map((f, i) => (
          <div className="panel cc-fact" key={i} style={{ borderLeft: `3px solid ${typeof f[3] === 'string' ? f[3] : 'var(--hair-2)'}` }}>
            <div className="cc-big">{String(f[0])}</div>
            <div className="mid" style={{ fontSize: 17 }}>{String(f[1])}</div>
            {ok(f[2]) && <div className="sub" style={{ marginTop: 4 }}>{emph(f[2])}</div>}
          </div>
        ))}
      </div>
    </Section>
  );
}

/** Money on the table: [amount, what, detail, accent]. Not income until paid. */
export function CCMoneyOnTable() {
  const { cc } = useCC();
  const rows = arr<unknown[]>(cc?.money).filter((r) => ok(r[1]) && !isDurango(String(r[2] ?? '')));
  if (!rows.length) return null;
  return (
    <Section title="Money on the table" right={<CCAsOf />}>
      <div className="grid g3">
        {rows.map((r, i) => (
          <div className="panel cc-fact" key={i} style={{ borderLeft: `3px solid ${typeof r[3] === 'string' ? r[3] : 'var(--hair-2)'}` }}>
            <div className="cc-big">{String(r[0])}</div>
            <div className="mid" style={{ fontSize: 17 }}>{String(r[1])}</div>
            {ok(r[2]) && <div className="sub" style={{ marginTop: 4 }}>{emph(r[2])}</div>}
          </div>
        ))}
      </div>
      <p className="cap">Possible money, not income. Nothing here is counted until it’s paid.</p>
    </Section>
  );
}

/** Pace table and the illustrative tax set-aside, as the Command Center computes them. */
export function CCPace() {
  const { cc } = useCC();
  const pace = arr<string[]>(cc?.cash?.pace);
  const sa = cc?.cash?.setaside as { income?: number; rates?: number[]; note?: string } | undefined;
  if (!pace.length && !sa) return null;
  return (
    <Section title="Pace and set-aside (Command Center)" right={<CCAsOf />}>
      <div className="panel">
        {!!pace.length && (
          <div className="tbl-wrap"><table className="tbl"><tbody>
            {pace.map((p, i) => <tr key={i}><td><strong>{p[0]}</strong></td><td className="n">{p[1]}</td><td className="cap">{[p[2], p[3]].filter(Boolean).join(' · ')}</td></tr>)}
          </tbody></table></div>
        )}
        {sa?.income != null && arr<number>(sa.rates).length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div className="label">Tax set-aside on {`$${Math.round(sa.income).toLocaleString('en-US')}`} (illustrative)</div>
            <div className="mid">{arr<number>(sa.rates).map((r) => `${r}% = $${Math.round((sa.income! * r) / 100).toLocaleString('en-US')}`).join(' · ')}</div>
            {ok(sa.note) && <div className="cap">{sa.note}</div>}
          </div>
        )}
      </div>
    </Section>
  );
}

/** How the Command Center counts (its footnote), shown in full. */
export function CCFootnote() {
  const { cc } = useCC();
  if (!ok(cc?.foot)) return null;
  return <p className="foot"><strong>How these are counted (Command Center):</strong> {cc!.foot}</p>;
}

/** Recommended moves with urgency. */
export function CCMoves() {
  const { cc } = useCC();
  const moves = arr<{ title: string; action: string; urgency: string }>(cc?.moves).filter((m) => ok(m.title) && !isDurango(m.action ?? ''));
  if (!moves.length) return null;
  return (
    <Section title="Recommended moves" right={<CCAsOf />}>
      <div className="panel">
        {moves.map((m, i) => (
          <div className="row" key={i} style={{ gridTemplateColumns: '1fr' }}>
            <div className="t"><span className={`pill ${m.urgency === 'Now' ? 'bad' : m.urgency === 'This week' ? 'warn' : ''}`}>{m.urgency}</span> <strong>{m.title}</strong><div className="sub">{emph(m.action)}</div></div>
          </div>
        ))}
      </div>
    </Section>
  );
}

/** Proposed experiments (what, why, metric, current) and extra ideas. */
export function CCExperiments() {
  const { cc } = useCC();
  const rows = arr<string[]>(cc?.experiments?.rows).filter((r) => ok(r[0]));
  const ideas = arr<string>(cc?.experiments?.ideas).filter(ok);
  if (!rows.length && !ideas.length) return null;
  return (
    <Section title="Experiments in detail" right={<CCAsOf />}>
      <div className="grid g3">
        {rows.map((r, i) => (
          <div className="panel" key={i}>
            <div className="strip-row"><strong>{r[0]}</strong>{r[5] && <span className="pill">{r[5]}</span>}</div>
            {ok(r[1]) && <div className="sub" style={{ marginTop: 4 }}>{r[1]}</div>}
            {ok(r[2]) && <div className="cap" style={{ marginTop: 6 }}>Why: {r[2]}</div>}
            {ok(r[3]) && <div className="cap">Measure: {r[3]}{r[4] ? ` · now ${r[4]}` : ''}</div>}
          </div>
        ))}
      </div>
      {!!ideas.length && <div className="panel" style={{ marginTop: 8 }}><div className="label">More ideas</div><ul className="cc-list">{ideas.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
    </Section>
  );
}

/** The ROI read and its caveat. */
export function CCRoiRead() {
  const { cc } = useCC();
  const read = cc?.roi?.read, note = cc?.roi?.note;
  if (!ok(read) && !ok(note)) return null;
  return (
    <div className="panel" style={{ marginTop: 8 }}>
      {ok(read) && <p className="cc-say" style={{ marginTop: 0 }}>{read}</p>}
      {ok(note) && <div className="cap">{note}</div>}
    </div>
  );
}

/** Career eras and recent streaks. */
export function CCEras() {
  const { cc } = useCC();
  const eras = arr<[number, number, string, string]>(cc?.momentum?.eras).filter((e) => ok(e[2]));
  const patterns = arr<[string, string, string, string]>(cc?.momentum?.patterns).filter((p) => ok(p[2]));
  const opened = typeof cc?.momentum?.studio_open === 'string' ? cc!.momentum.studio_open : null;
  if (!eras.length && !patterns.length) return null;
  return (
    <Section title="Eras and streaks" right={<CCAsOf />}>
      <div className="grid g2">
        {!!eras.length && (
          <div className="panel">
            <div className="label">Career eras</div>
            {eras.map((e, i) => (
              <div className="row" key={i}><span className="t"><span aria-hidden="true" style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: e[3], marginRight: 8 }} /><strong>{e[2]}</strong></span><span className="r num">{e[0] === e[1] ? e[0] : `${e[0]}–${e[1]}`}</span></div>
            ))}
            {opened && <div className="cap" style={{ marginTop: 6 }}>Studio opened {opened}</div>}
          </div>
        )}
        {!!patterns.length && (
          <div className="panel">
            <div className="label">Studio streaks</div>
            {patterns.map((p, i) => (
              <div className="row" key={i}><span className="t"><Led light={toneLight(p[3])} word={false} /> <strong>{p[2]}</strong></span><span className="r cap">{p[0]} – {p[1]}</span></div>
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}

/** Vibe funnel per unique artist, as the Command Center counts it. */
export function CCFunnel() {
  const { cc } = useCC();
  const f = arr<{ stage: string; n: number }>(cc?.funnel).filter((x) => ok(x.stage));
  if (!f.length) return null;
  const max = Math.max(...f.map((x) => x.n), 1);
  return (
    <Section title="Vibe funnel (Command Center)" right={<CCAsOf />}>
      <div className="panel">
        {f.map((x) => (
          <div key={x.stage} style={{ margin: '6px 0' }}>
            <div className="strip-row"><span>{x.stage}</span><span className="num">{x.n}</span></div>
            <div aria-hidden="true" style={{ height: 8, borderRadius: 4, background: 'var(--raised)' }}><div style={{ width: `${(x.n / max) * 100}%`, height: '100%', borderRadius: 4, background: 'var(--lane-studio)' }} /></div>
          </div>
        ))}
        {ok(cc?.funnel_sub) && <div className="cap" style={{ marginTop: 6 }}>{cc!.funnel_sub}</div>}
      </div>
    </Section>
  );
}

/** The Command Center's own notes for the next 7 days (includes context the calendar doesn't carry). */
export function CCNext7() {
  const { cc } = useCC();
  const days = arr<{ d: string; items: string[]; tone: string }>(cc?.next7).map((d) => ({ ...d, items: arr<string>(d.items).filter(ok) })).filter((d) => d.items.length);
  if (!days.length) return null;
  return (
    <Section title="The week ahead, with notes" right={<CCAsOf />}>
      <div className="panel">
        {days.map((d) => (
          <div className="row" key={d.d} style={{ gridTemplateColumns: '1fr' }}>
            <div className="t"><Led light={toneLight(d.tone)} word={false} /> <strong>{d.d}</strong>
              <ul className="cc-list">{d.items.map((i, k) => <li key={k}>{emph(i)}</li>)}</ul>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
