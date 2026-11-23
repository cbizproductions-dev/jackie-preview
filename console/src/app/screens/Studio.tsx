import React from 'react';
import { emph } from '../emph';
import { useSnap, Header, Section, money, pct, Fold, Empty, Led, day, shortDay, HBars, Math_ } from '../ui';
import { CCRoom, CCFunnel } from '../cc';
import { ROOMS, studioOps, rebookCandidates, goalTargets } from '../../shared/derive';
import { isOverdue, weekCash } from '../../shared/rules';
import { addDays, daysBetween } from '../../shared/time';

const ARTIST_GROUPS: [string, string][] = [['paid', 'Paid studio clients'], ['remote', 'Remote mix clients'], ['beat', 'Beat buyers'], ['sync', 'Sync collaborators'], ['pipeline', 'Booked or in the pipeline'], ['closed', 'Closed or passed'], ['other', 'Other']];

export default function Studio() {
  const s = useSnap();
  const artists = s.studio.artists ?? [];
  const ops = studioOps(s);
  const t = goalTargets(s);
  const rebook = new Set(rebookCandidates(s).map((c) => c.name));
  const weekOut = addDays(s.today, 7);
  const mixes = [...s.studio.mixes].sort((a, b) => (a.due ?? '9').localeCompare(b.due ?? '9'));
  const group = (m: (typeof mixes)[number]) => (isOverdue(m.due, s.today) ? 'Overdue' : m.due && m.due <= weekOut ? 'Due this week' : 'Later');
  const open = s.studio.vibe.filter((v) => v.outcome === 'open' || v.outcome === 'booked');
  const done = s.studio.vibe.filter((v) => v.outcome === 'closed' || v.outcome === 'no_show');
  const converted = s.studio.vibe.filter((v) => v.outcome === 'converted');
  // cohorts by month of vibe session
  const cohorts = new Map<string, { showed: number; paid: number; booked: number }>();
  for (const v of s.studio.vibe) {
    if (!v.date || !v.showed) continue;
    const k = v.date.slice(0, 7);
    const c = cohorts.get(k) ?? { showed: 0, paid: 0, booked: 0 };
    c.showed++;
    if (v.outcome === 'converted') c.paid++;
    if (v.outcome === 'booked') c.booked++;
    cohorts.set(k, c);
  }
  const common = s.insights.find((i) => /vibe|referr|convert/i.test(i.title) && i.status === 'Active' && i.kind !== 'Data issue');
  const recentWeeks = s.weeks.slice(-4);
  const hoursPerWeek = recentWeeks.length ? recentWeeks.reduce((a, w) => a + (w.paidHours ?? 0), 0) / recentWeeks.length : null;
  const rate = ops.hourly ?? 75;
  const conc = ops.conc;

  return (
    <>
      <Header kicker="Studio Board · Muse" title="Studio & Clients" sources="Studio Board — Muse mirror, Weekly Scorecard, Intelligence Feed" notion={ROOMS.studio} art="couch" />
      <CCRoom room="studio" />
      {s.studio.synced && daysBetween(s.studio.synced, s.today) > 2 && <div className="banner warn">▲ Studio Board last synced {day(s.studio.synced)} — more than 2 days ago.</div>}

      <Section title="Mix queue" right={<span className="cap">{ops.queue.open} open · {ops.queue.overdue} overdue</span>}>
        <div className="panel">
          {mixes.length ? (
            <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Client</th><th className="n">Mixes</th><th>Due</th><th>Status</th></tr></thead>
              <tbody>{mixes.map((m, i) => {
                const g = group(m);
                return <tr key={i}><td>{m.client}<div className="cap">{m.note.replace(/^\(?overdue[;)]?[,;—\s]*/i, '').slice(0, 110)}</div></td><td className="n">{m.countApprox ? '~' : ''}{m.count}</td><td>{shortDay(m.due)}</td>
                  <td><Led light={g === 'Overdue' ? 'red' : g === 'Due this week' ? 'amber' : 'green'} word={false} /> {g}{g === 'Overdue' && m.due ? ` · ${daysBetween(m.due, s.today)}d` : ''}</td></tr>;
              })}</tbody></table></div>
          ) : <Empty>No mixes owed right now.</Empty>}
          <p className="cap">A mix is due 7 days after the session (the due date itself is on time). Counted by artist + date, as the Studio Board tracks them.</p>
        </div>
      </Section>

      <Section title="Client roster">
        <div className="panel">
          {s.studio.clients.map((c) => {
            const om = s.studio.mixes.filter((m) => m.client === c.name).reduce((a, m) => a + m.count, 0);
            const kind = c.kind === 'beat' ? 'Beat buyer' : c.kind === 'remote' ? 'Remote mix/master' : c.paidSessions && c.paidSessions >= 2 ? 'Repeat client' : 'One session so far';
            return (
              <div className="row" key={c.name} style={rebook.has(c.name) ? { background: 'rgba(201,160,75,.07)', margin: '0 -8px', padding: '8px' } : undefined}>
                <span className="t"><strong>{c.name}</strong>{rebook.has(c.name) && <span className="pill gold" style={{ marginLeft: 6 }}>Rebook</span>}
                  <div className="cap">{kind}{c.kind === 'session' ? ` · ${c.rate ? `$${c.rate}/hr` : '$75/hr'}` : ''}{c.lastSession ? ` · last ${shortDay(c.lastSession)}` : ''}{om ? ` · ${om} mix${om > 1 ? 'es' : ''} open` : ''}</div></span>
                <span className="r"><span className="num">{money(c.totalPaid)}</span><div className="cap">{c.paidSessions ?? 0} paid session{c.paidSessions === 1 ? '' : 's'}</div></span>
              </div>
            );
          })}
          <p className="cap">Gold rows: rebook candidates — one paid session, 14+ days ago. “Not on file” means the amount wasn’t recorded, not $0.</p>
        </div>
      </Section>

      <Section title={`All artists · ${artists.length}`} right={<span className="cap">From the Studio Board’s artist profiles</span>}>
        <div className="panel">
          {artists.length ? ARTIST_GROUPS.map(([g, label]) => {
            const xs = artists.filter((a) => a.group === g);
            if (!xs.length) return null;
            return (
              <Fold key={g} title={`${label} (${xs.length})`}>
                {xs.map((a) => <div className="row" key={a.name} style={{ gridTemplateColumns: '1fr' }}><span className="t"><strong>{a.name}</strong><div className="cap">{emph(a.note)}</div></span></div>)}
              </Fold>
            );
          }) : <Empty>No artist profiles on the Studio Board right now.</Empty>}
          <p className="cap">Every artist Kris has connected with, not just paying clients, grouped like the Command Center’s “All artists” list. Read from the Studio Board — Muse mirror.</p>
        </div>
      </Section>

      <div className="grid g2">
        <Section title="Vibe pipeline">
          <div className="panel">
            <div className="label" style={{ marginBottom: 6 }}>In motion</div>
            {open.length ? open.map((v) => <div className="row" key={v.artist}><span className="t"><strong>{v.artist}</strong><div className="cap">{v.note || '—'}</div></span><span className="r"><span className={`pill ${v.outcome === 'booked' ? 'gold' : ''}`}>{v.outcome === 'booked' ? 'Booked' : 'Open'}</span></span></div>) : <Empty>No vibe artists in motion.</Empty>}
            <Fold title={`Converted (${converted.length})`}>{converted.map((v) => <div className="row" key={v.artist}><span className="t">{v.artist}</span><span className="r cap">vibe {shortDay(v.date)} → paid {shortDay(v.firstPaid)}</span></div>)}</Fold>
            <Fold title={`Closed, passed & no-shows (${done.length})`}>{done.map((v) => <div className="row" key={v.artist}><span className="t">{v.artist}{v.outcome === 'no_show' && <span className="pill bad" style={{ marginLeft: 6 }}>No-show</span>}</span><span className="r cap">{shortDay(v.date)}</span></div>)}</Fold>
          </div>
        </Section>
        <Section title="Conversion by cohort">
          <div className="panel">
            <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Vibe month</th><th className="n">Showed</th><th className="n">Paid</th><th className="n">Booked</th><th className="n">Rate</th></tr></thead>
              <tbody>{[...cohorts.entries()].sort().map(([k, c]) => <tr key={k}><td>{k}</td><td className="n">{c.showed}</td><td className="n">{c.paid}</td><td className="n">{c.booked}</td><td className="n">{pct(c.paid / c.showed)}</td></tr>)}</tbody></table></div>
            <p className="cap">Per unique artist who showed. Recent cohorts are still maturing (median time to convert: {ops.medianDays ?? '—'} days).</p>
            {common && <div className="well" style={{ marginTop: 8 }}><span className="pill gold">{common.evidence}</span> <strong>What converters had in common:</strong> {common.observation}<div className="cap">Intelligence Feed · {common.title}</div></div>}
          </div>
        </Section>
      </div>

      <CCFunnel />

      <Section title="Mix delivery record">
        <div className="panel">
          {(() => {
            const d = s.studio.deliveries;
            const timed = d.filter((x) => x.due && x.date);
            const onTime = timed.filter((x) => x.date! <= x.due!).length;
            const hrs = d.filter((x) => x.hours != null);
            const mixHours = hrs.reduce((a, x) => a + (x.hours ?? 0), 0);
            const sessionRev = ops.sessionRevenue ?? 0, sessionHrs = ops.hours ?? 0;
            return d.length ? (
              <>
                <div className="row"><span className="t">Deliveries on record</span><span className="r num">{d.length}</span></div>
                <div className="row"><span className="t">On time (due date known)</span><span className="r num">{timed.length ? `${onTime} of ${timed.length}` : 'Not on file'}</span></div>
                <div className="row"><span className="t">Mix hours logged</span><span className="r num">{hrs.length ? `${mixHours} hrs · ${hrs.length} mix${hrs.length === 1 ? '' : 'es'}` : 'Not on file yet'}</span></div>
                {hrs.length > 0 && sessionHrs > 0 && <div className="row"><span className="t">$/hr incl. logged mix time</span><span className="r num">${(sessionRev / (sessionHrs + mixHours)).toFixed(2)}/hr</span></div>}
                <p className="cap">From the Studio Board (Muse). Mix hours come from you when you tell Muse a mix is done; until most mixes carry hours, the $/hr figure undercounts mix time.</p>
              </>
            ) : <Empty>No delivered mixes recorded on the Studio Board yet.</Empty>;
          })()}
        </div>
      </Section>

      <Section title="Operating metrics">
        <div className="grid g3">
          <div className="panel"><div className="label">Avg paid session</div><div className="mid">{money(ops.avgSession)}</div><div className="cap">{money(ops.sessionRevenue)} ÷ {ops.paidSessions ?? '—'} sessions</div></div>
          <div className="panel"><div className="label">Realized hourly</div><div className="mid">{ops.hourly != null ? `$${ops.hourly.toFixed(2)}/hr` : 'Not on file'}</div><div className="cap">Session $ ÷ {ops.hours ?? '—'} paid hours. Mix time isn’t tracked, so true $/hr is lower.</div></div>
          <div className="panel"><div className="label">Repeat rate</div><div className="mid">{pct(ops.repeat.rate)}</div><div className="cap">{ops.repeat.repeat} of {ops.repeat.total} session clients have 2+ paid sessions</div></div>
          <div className="panel"><div className="label">Vibe → first paid (median)</div><div className="mid">{ops.medianDays != null ? `${ops.medianDays} days` : 'Not on file'}</div><div className="cap">Across {converted.length} conversions</div></div>
          <div className="panel" style={{ gridColumn: 'span 1' }}>
            <div className="label">Client concentration</div>
            <div className="mid">{pct(conc.share)}</div>
            <svg className="chart" viewBox="0 0 300 40" role="img" aria-label={`Top 2 clients ${pct(conc.share)} of session revenue; thresholds 40% and 65%`}>
              <rect x="0" y="8" width="300" height="12" rx="3" fill="var(--well)" />
              <rect x="0" y="8" width={300 * (conc.share ?? 0)} height="12" rx="3" fill={(conc.share ?? 0) > 0.65 ? 'var(--bad)' : (conc.share ?? 0) >= 0.4 ? 'var(--warn)' : 'var(--ok)'} />
              {[0.4, 0.65].map((x) => <g key={x}><line x1={300 * x} x2={300 * x} y1="2" y2="24" stroke="var(--ink)" strokeWidth="2" /><text x={300 * x} y="39" textAnchor="middle" fontSize="9">{x * 100}%</text></g>)}
            </svg>
            <div className="cap">Top 2 ({conc.names.join(' + ')}) = {money(conc.top2)} of {money(conc.total)}</div>
          </div>
        </div>
      </Section>

      <Section title="Capacity math">
        <div className="panel">
          <HBars label="Paid hours per week needed vs recent average" fmt={(n) => `${n.toFixed(1)} hrs`} rows={[
            { label: 'Recent avg (last 4 wks)', v: hoursPerWeek, color: 'var(--lane-studio)' },
            { label: `$${t.goal} goal`, v: t.goal / rate, color: 'var(--gold)' },
            { label: `$${t.stretch.toLocaleString('en-US')} stretch`, v: t.stretch / rate, color: 'var(--gold-lo)' },
          ]} />
          <Math_>{`Hours needed = goal ÷ realized rate ($${rate.toFixed(2)}/hr)\n$${t.goal} ÷ ${rate.toFixed(2)} = ${(t.goal / rate).toFixed(1)} hrs\n$${t.stretch} ÷ ${rate.toFixed(2)} = ${(t.stretch / rate).toFixed(1)} hrs\nRecent average = paid hours over the last ${recentWeeks.length} weeks ÷ ${recentWeeks.length}`}</Math_>
          <p className="cap">Every session also books future mixing time (mixing is included in the rate). More session hours means more mixes owed the following week.</p>
        </div>
      </Section>

      <Section title="Rate card" dim>
        <Fold title="Show rates (Kris-reported)">
          <div className="panel">
            <div className="row"><span className="t">Studio time incl. mixing & mastering</span><span className="r num">$75/hr · 2-hr min</span></div>
            <div className="row"><span className="t">Block</span><span className="r num">4 hrs for $275</span></div>
            <div className="row"><span className="t">Service pack (clean, show mix, a cappella, DJ version)</span><span className="r num">$40 / song</span></div>
            <div className="row"><span className="t">Mix & master</span><span className="r num">$100</span></div>
            <div className="row"><span className="t">Beat lease</span><span className="r num">$100 online · $125 in person</span></div>
            <p className="cap">Kris-reported — no rate card found in HQ. Non-standard rates on the Studio Board: {s.studio.clients.filter((c) => c.rate && c.rate !== 75).map((c) => `${c.name} $${c.rate}/hr`).join(', ') || 'none'}. The first scout beat sale used a $100/beat scout-lead rate with a bundle discount — see the price flag on Beats.</p>
          </div>
        </Fold>
      </Section>
    </>
  );
}
export { weekCash };
