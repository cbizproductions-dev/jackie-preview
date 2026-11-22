import React from 'react';
import { useSnap, Header, Section, money, pct, Empty, HBars, NotionLink } from '../ui';
import { CCRoom } from '../cc';
import { ROOMS, isDurango } from '../../shared/derive';
import { beatTransactions } from '../../shared/rules';

export default function Beats() {
  const s = useSnap();
  // A bundle (one buyer, one date) is one transaction, however many leases it contains.
  const tx = beatTransactions(s.studio.beatSales.map((b) => ({ buyer: b.buyer, date: b.date ?? '', amount: b.amount })));
  const leases = s.studio.beatSales.reduce((a, b) => a + b.items, 0);
  const scouting = (s.cc?.rooms?.scouting ?? []) as { lane: string; found: number; contacted: number; held: number; paid: number }[];
  const roi = (s.cc?.roi?.rows ?? []) as any[][];
  const replied = (lane: string) => {
    const r = roi.find((x) => (lane.startsWith('Mix') ? /mix\/master/i : lane.startsWith('Major') ? /major/i : /beat/i).test(String(x[0])));
    return r && /replied/i.test(String(r[5])) ? Number(r[4]) : null;
  };
  const agent: Record<string, string> = { 'Beat buyers': 'Muse', 'Mix/master': 'Muse', 'Major artists': 'Maestro' };
  const warmIns = s.insights.find((i) => /warm leads?\s*\(/i.test(i.observation));
  const warm = warmIns ? (/warm leads?\s*\(([^)]+)\)/i.exec(warmIns.observation)?.[1] ?? '').split(/,\s*/).filter((n) => n && !isDurango(n)) : [];
  const heldStat = ((s.cc?.room_strips?.beats?.stats ?? []) as { v: string; l: string; n: string }[]).find((x) => /held/i.test(x.l));
  const heldTotal = scouting.reduce((a, l) => a + (l.held ?? 0), 0);
  const majors = roi.find((x) => /major/i.test(String(x[0])));
  const priceMoves = s.cashMoves.filter((m) => /price/i.test(m.text));
  const decide = ((s.cc?.brief ?? []) as { title: string; items: string[] }[]).flatMap((b) => b.items).filter((i) => /price/i.test(i));

  return (
    <>
      <Header kicker="Scout Trackers · Studio Board" title="Beats & Scouting" sources="Studio Board (sales), Scout Trackers counts via Command Center data.json, Intelligence Feed" notion={ROOMS.beats} art="redcarpet" />
      <CCRoom room="beats" />
      <Section title="Beat sales">
        <div className="grid g3">
          <div className="panel"><div className="label">Purchases</div><div className="mid">{tx.count}</div><div className="cap">{leases} lease{leases === 1 ? '' : 's'} · a bundle counts once</div></div>
          <div className="panel"><div className="label">Total</div><div className="mid">{money(tx.total)}</div><div className="cap">Cash received</div></div>
          <div className="panel"><div className="label">Average purchase</div><div className="mid">{money(tx.average)}</div><div className="cap">Per transaction, not per lease</div></div>
        </div>
        {s.leases.rows === 0 && tx.count > 0 && <div className="banner warn">▲ Beat Leases & Registrations (Maestro) has no rows, but the Studio Board shows {leases} signed lease{leases === 1 ? '' : 's'}. <NotionLink href={ROOMS.leases} /></div>}
      </Section>

      <Section title="Scouting funnel by lane" right={<NotionLink href={ROOMS.scout} />}>
        {scouting.length ? (
          <div className="grid g3">
            {scouting.map((l) => (
              <div className="panel" key={l.lane}>
                <div className="strip-row"><strong>{l.lane}</strong><span className="pill">{agent[l.lane] ?? '—'}</span></div>
                <HBars label={`${l.lane} funnel`} fmt={(n) => n.toLocaleString('en-US')} rows={[
                  { label: 'Found', v: l.found }, { label: 'Contacted', v: l.contacted }, { label: 'Replied', v: replied(l.lane), note: replied(l.lane) == null ? '' : '' }, { label: 'Paid', v: l.paid, color: 'var(--ok)' },
                ]} />
                <div className="cap" style={{ marginTop: 6 }}>Held for review {l.held} · sale rate {pct(l.contacted ? l.paid / l.contacted : null, 1)}</div>
              </div>
            ))}
          </div>
        ) : <Empty>Scouting counts aren’t on file in this snapshot.</Empty>}
        <p className="cap">Counts from the Command Center’s daily read of the Scout Trackers (view-mode counts). “Not on file” = the tracker doesn’t record replies for that lane.</p>
      </Section>

      <div className="grid g2">
        <Section title="Warm leads">
          <div className="panel">
            {warm.length ? warm.map((n) => <div className="row" key={n}><span className="t"><strong>{n}</strong></span><span className="r cap">Personal follow-up</span></div>) : <Empty>No warm leads flagged in HQ right now.</Empty>}
            {priceMoves.map((m) => <div className="cap" key={m.text} style={{ marginTop: 6 }}>{m.checked ? '✓' : '▲'} {m.text} — Cash Flow Radar</div>)}
            {warmIns && <div className="cap" style={{ marginTop: 6 }}>From “{warmIns.title}” · {warmIns.evidence}</div>}
          </div>
        </Section>
        <Section title="Held leads — a decision, not a backlog">
          <div className="panel">
            <div className="mid">{heldStat?.v ?? (heldTotal || '—')}</div>
            <div className="cap">{heldStat ? `${heldStat.l} · ${heldStat.n}` : 'Held for your OK across lanes'}. Age: scouting began Oct 18, 2026; per-lead hold dates aren’t on file.</div>
            <p className="sub">One batch rule (approve, drop, or let Muse/Maestro decide by rule) clears these at once.</p>
          </div>
        </Section>
      </div>

      <Section title="Major-artist pitches">
        <div className="panel">
          {majors ? <><div className="row"><span className="t">Contacted</span><span className="r num">{majors[2]}</span></div><div className="row"><span className="t">Paid</span><span className="r num">{majors[4]}</span></div><p className="cap">{majors[9]} Kept separate from ordinary leases.</p></> : <Empty>No major-artist pitch data on file.</Empty>}
        </div>
      </Section>

      <Section title="Price consistency">
        <div className="panel">
          {decide.length || priceMoves.length ? (
            <div className="banner warn" style={{ margin: 0 }}>▲ <span><strong>Data issue — prices differ by source.</strong> Kris-reported: $100 online / $125 in person. Studio Board (first scout sale): $100/beat scout-lead rate with a $25 bundle discount. {decide.length ? `Command Center brief: “${decide[0]}”` : ''}</span></div>
          ) : <Empty>No conflicting beat prices found in HQ.</Empty>}
        </div>
      </Section>
    </>
  );
}
