import React from 'react';
import { useSnap, Header, Section, WeeklyBars, StackBar, money, moneyAuto, pct, Fold, Math_, Ladder, Empty, NotionLink, signedPct } from '../ui';
import { CCRoom, CCMoneyOnTable, CCPace, CCFootnote } from '../cc';
import { ROOMS, goalTargets, laneTotals, monthMetrics, yearMetrics, studioOps } from '../../shared/derive';
import { pace, weekCash, weekStatus, beatTransactions, round2, STUDIO_WEEKS_START } from '../../shared/rules';
import { addDays, weekStart, parseLooseDate, daysBetween, labelDay } from '../../shared/time';

const LANE_COUNT = (lane: string, s: ReturnType<typeof useSnap>, year: string): { n: number | null; unit: string } => {
  if (lane === 'Studio sessions') {
    const n = s.studio.clients.filter((c) => c.kind === 'session' && c.totalPaid != null).reduce((a, c) => a + (c.paidSessions ?? 0), 0);
    return { n: n || null, unit: 'session' };
  }
  if (lane === 'Remote mix/master') return { n: s.studio.clients.filter((c) => c.kind === 'remote').length || null, unit: 'mix' };
  if (lane === 'Beat leases') return { n: beatTransactions(s.studio.beatSales.map((b) => ({ buyer: b.buyer, date: b.date ?? '', amount: b.amount }))).count || null, unit: 'purchase' };
  if (lane === 'BMI royalties') return { n: s.bmi.filter((b) => b.statement.startsWith(year)).length || null, unit: 'statement' };
  if (lane === 'Direct sync fees') {
    const n = s.ledger.filter((r) => r.year === year && r.lane === lane).reduce((a, r) => a + Math.max(1, r.source.split(/\.\s/).filter((x) => !/not added/i.test(x)).join(' ').match(/\$\d/g)?.length ?? 0), 0);
    return { n: n || null, unit: 'payment' };
  }
  return { n: null, unit: '' };
};

export default function Money() {
  const s = useSnap();
  const t = goalTargets(s);
  const yr = yearMetrics(s);
  const lanes = laneTotals(s, yr.year);
  const mm = monthMetrics(s);
  const ops = studioOps(s);
  const ws = weekStart(s.today);
  const slots = Array.from({ length: 12 }, (_, i) => addDays(ws, (i - 11) * 7));
  const weeks = slots.map((start) => {
    const w = s.weeks.find((x) => x.start === start);
    return { start, v: w ? weekCash(w) : start < STUDIO_WEEKS_START ? null : null, inProgress: weekStatus(start, s.today) !== 'complete' };
  });
  const p = pace(s.weeks, s.today);
  const avgSession = ops.avgSession ?? 0;
  const present = p.present.weekly;
  const scen = present == null ? [] : [
    { name: 'Conservative pace', w: p.conservative.weekly!, how: `Average since first paid week (${p.conservative.from ? labelDay(p.conservative.from, { month: 'short', day: 'numeric' }) : '—'}): (${p.conservative.basis.join(' + ')}) ÷ ${p.conservative.basis.length}` },
    { name: 'Present pace', w: present, how: `Average of the last 3 weeks: (${p.present.basis.join(' + ')}) ÷ 3${p.includesInProgress ? ' — includes the week in progress' : ''}` },
    { name: '+1 two-hour session a week', w: present + 150, how: `Present pace + $150` },
    { name: '+5 one-time clients rebook monthly', w: present + (5 * 150) / 4.33, how: `Present pace + 5 × $150 ÷ 4.33` },
    { name: 'Both', w: present + 150 + (5 * 150) / 4.33, how: `Present pace + $150 + $173` },
  ];
  const cash = (s.cc?.cash?.calendar ?? []) as string[][];
  const expected = cash.filter((c) => ['BOOKED', 'LIKELY', 'PENDING', 'ESTIMATE', 'UPSIDE', 'BOOK IT'].includes(c[3]));
  const receivables = cash.filter((c) => c[3] === 'CHASE').map((c) => {
    let d = parseLooseDate(c[2], Number(s.today.slice(0, 4)));
    if (d && d > s.today) d = parseLooseDate(c[2], Number(s.today.slice(0, 4)) - 1);
    return { title: c[1], detail: c[2], age: d ? daysBetween(d, s.today) : null };
  });
  const labelOf = (k: string) => ({ BOOKED: 'Booked', LIKELY: 'Likely', PENDING: 'Pending', ESTIMATE: 'Estimate', UPSIDE: 'Pipeline (TuneSat)', 'BOOK IT': 'Deposit held' } as Record<string, string>)[k] ?? k;
  const bestPrior = yr.best;

  return (
    <>
      <Header kicker="Cash Flow Radar · Revenue & Trajectory" title="Money" sources="Weekly Scorecard, Income Ledger, Goals & Milestones, Command Center data.json" notion={ROOMS.revenue} art="la" />

      <CCRoom room="revenue" />

      <Section title="Weekly studio-side cash">
        <div className="panel">
          <WeeklyBars weeks={weeks} goal={t.goal} stretch={t.stretch} today={s.today} />
          <p className="cap">Cash received only: paid sessions, remote mix/master and beat leases. BMI and sync checks never count toward the weekly goal. Weeks before {labelDay(STUDIO_WEEKS_START, { month: 'short', day: 'numeric' })} are “n/f” — not on file, not $0.{t.stretchFromConfig ? ' Stretch target from config (not in Goals & Milestones).' : ''}</p>
          <Fold title="Weekly detail">
            <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Week</th><th className="n">Sessions</th><th className="n">Remote</th><th className="n">Beats</th><th className="n">Total</th><th>Status</th></tr></thead>
              <tbody>{[...s.weeks].reverse().map((w) => <tr key={w.start}><td><a href={w.url} target="_blank" rel="noopener noreferrer">{labelDay(w.start, { month: 'short', day: 'numeric' })}</a></td><td className="n">{money(w.sessions)}</td><td className="n">{money(w.remote)}</td><td className="n">{money(w.beats)}</td><td className="n">{money(weekCash(w))}</td><td>{weekStatus(w.start, s.today) === 'complete' ? w.confidence : 'In progress'}</td></tr>)}</tbody>
            </table></div>
          </Fold>
        </div>
      </Section>

      <Section title={`Revenue by lane · ${yr.year}`}>
        <div className="panel">
          <div className="big" style={{ marginBottom: 8 }}>{moneyAuto(lanes.sum)}</div>
          <StackBar label={`Revenue by lane, ${yr.year}`} rows={lanes.rows.map((r) => ({ label: r.label, v: r.total, color: r.color }))} />
          <div className="tbl-wrap" style={{ marginTop: 10 }}><table className="tbl"><thead><tr><th>Lane</th><th className="n">{yr.year}</th><th className="n">Share</th><th className="hide-sm">Basis</th><th className="n">Avg</th></tr></thead>
            <tbody>{lanes.rows.map((r) => {
              const c = LANE_COUNT(r.key, s, yr.year);
              return <tr key={r.key}><td><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: r.color, marginRight: 6 }} />{r.label}</td><td className="n">{moneyAuto(r.total)}</td><td className="n">{pct(r.share)}</td><td className="cap hide-sm">{r.basis}</td><td className="n">{r.total != null && c.n ? <>{money(round2(r.total / c.n))}<div className="cap">per {c.unit}</div></> : '—'}</td></tr>;
            })}</tbody>
          </table></div>
          <p className="cap">BMI = statement year. Direct sync = payment or work-order date, Confirmed paid only. Studio = cash received. A beat bundle is one purchase. Remote-mix dates are approximate.</p>
        </div>
      </Section>

      <div className="grid g2">
        <Section title="Monthly totals">
          <div className="panel">
            <div className="row"><span className="t">Studio-side, {mm.mk} to date</span><span className="r num">{money(mm.studioThis)}</span></div>
            <div className="row"><span className="t">Studio-side, all of {mm.pk}</span><span className="r num">{money(mm.studioPrev)}</span></div>
            <div className="row"><span className="t">All lanes, {mm.mk} to date</span><span className="r num">{money(mm.allThis)}</span></div>
            <div className="row"><span className="t">All lanes, all of {mm.pk}</span><span className="r num">{money(mm.allPrev)}</span></div>
            <div className="row"><span className="t">{yr.year} to date vs all of {Number(yr.year) - 1}</span><span className="r num">{moneyAuto(yr.ytd.value)} vs {moneyAuto(yr.lastYear)}</span></div>
            <p className="cap">Same basis both sides. {Number(yr.year) - 1} has no monthly split on file, so the year comparison is year-to-date vs full year. Studio income before Oct 2026 is not on file.</p>
          </div>
        </Section>
        <Section title="Receivables">
          <div className="panel">
            {receivables.length ? receivables.map((r) => (
              <div className="row" key={r.title}><span className="t"><strong>{r.title}</strong><div className="cap">{r.detail}</div></span><span className="r num">{r.age != null ? `${r.age} days` : '—'}</span></div>
            )) : <Empty>No money owed to you on file.</Empty>}
            <p className="cap">Age counted from the work-order date. Owed, not received — never counted as income. Studio Board shows {money(0)} outstanding from clients.</p>
          </div>
        </Section>
      </div>

      <Section title="Expected money (not income)">
        <div className="panel">
          {expected.length ? expected.map((c, i) => (
            <div className="row" key={i}><span className="t"><span className="pill gold">{labelOf(c[3])}</span> <strong>{c[1]}</strong><div className="cap">{c[0]} · {c[2]}</div></span><span className="r cap">Cash Flow Radar</span></div>
          )) : <Empty>Nothing expected on file.</Empty>}
          <p className="cap">Booked = dated on the Studio Board or calendar · Likely = the artist said so · Pending = submitted, waiting on a yes · Estimate = based on past statements. None of it is added to income until paid.</p>
        </div>
      </Section>

      <CCRoom room="cash" title="Cash Flow Radar (Command Center)" />
      <CCMoneyOnTable />

      <Section title="Pace & projections (estimates)">
        <div className="panel">
          {scen.length ? (
            <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Scenario</th><th className="n">Weekly</th><th className="n">Month ×4.33</th><th className="n hide-sm">Year ×52</th></tr></thead>
              <tbody>{scen.map((x) => <tr key={x.name} className={x.name === 'Present pace' ? 'hl' : ''}><td>{x.name}<Math_>{`${x.how}\n= ${money(round2(x.w))}/week\n× 4.33 = ${money(round2(x.w * 4.33))}/month\n× 52 = ${money(round2(x.w * 52))}/year`}</Math_></td><td className="n">{money(Math.round(x.w))}</td><td className="n">{money(Math.round(x.w * 4.33))}</td><td className="n hide-sm">{money(Math.round(x.w * 52))}</td></tr>)}</tbody>
            </table></div>
          ) : <Empty>Not enough weeks on file to estimate a pace.</Empty>}
          <div className="banner warn" style={{ marginTop: 10 }}>▲ <span><strong>Mix-capacity ceiling (estimate).</strong> Every paid session also books mixing time. If delivery caps near 4 mixes a week, sessions cap near 4 a week at the {money(Math.round(avgSession))} average ≈ {money(Math.round(avgSession * 4))}/week. Mix hours aren’t tracked yet, so this is a hypothesis.</span></div>
          <p className="cap">Estimates, not forecasts: simple arithmetic on studio-side cash. Sync and royalties come on top and aren’t guaranteed to repeat.</p>
        </div>
      </Section>

      <CCPace />

      <Section title="Goals & milestones" right={<NotionLink href={ROOMS.goals}>Change a target ↗</NotionLink>}>
        <div className="grid g2">
          {s.goals.map((g) => {
            const inverse = /zero|overdue/i.test(g.goal);
            const left = g.target != null && g.current != null ? g.target - g.current : null;
            return (
              <div className="panel" key={g.goal}>
                <div className="strip-row"><span className="label" style={{ color: 'var(--ink)' }}>{g.goal}</span><span className="pill">{g.origin}</span></div>
                {inverse ? (
                  <div className="mid" style={{ color: (g.current ?? 0) > 0 ? 'var(--bad)' : 'var(--ok)' }}>{g.current ?? '—'} now · target {g.target}</div>
                ) : (
                  <>
                    <div className="mid">{g.unit === '$' ? moneyAuto(g.current) : g.current} <span className="cap">of {g.unit === '$' ? moneyAuto(g.target) : g.target}</span></div>
                    <Ladder value={g.current} max={Math.max(g.target ?? 1, g.current ?? 0)} segments={20} label={`${g.goal}: ${g.current} of ${g.target}`} />
                    <div className="cap" style={{ marginTop: 4 }}>{left != null ? (left > 0 ? `${g.unit === '$' ? moneyAuto(round2(left)) : left} to go` : 'Reached') : 'Not on file'} · as of {g.asOf ?? '—'}</div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </Section>
      <CCFootnote />
      <p className="foot">Revenue, not profit. Expenses aren’t tracked here (Sterling tracks finances). {bestPrior ? `Pre-2023 years read low: 19 older BMI statements aren’t in the files.` : ''}</p>
    </>
  );
}
export { signedPct };
