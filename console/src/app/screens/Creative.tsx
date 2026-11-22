import React, { useState } from 'react';
import { useSnap, Header, Section, Empty, HBars, NotionLink, shortDay, NOT_ON_FILE } from '../ui';
import { ROOMS, isDurango } from '../../shared/derive';
import { pipeline, monthly, directions, recentWork, stageOf, STAGE_LABEL, STAGE_COLOR, titlesOf, type Period } from '../../shared/creative';
import { addDays } from '../../shared/time';

const PERIODS: { id: Period; label: string }[] = [{ id: 'year', label: 'This year' }, { id: '12m', label: '12 months' }, { id: 'all', label: 'All on file' }];
const MONTH = (mk: string) => new Date(`${mk}-15T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });

export default function Creative() {
  const s = useSnap();
  const [period, setPeriod] = useState<Period>('year');
  const briefs = s.briefs.filter((b) => !isDurango(`${b.brief} ${b.company ?? ''}`));
  const briefsOk = s.sources.find((x) => x.id === 'briefs')?.state !== 'failed' && briefs.length > 0;
  const p = pipeline(briefs, period, s.today);
  const months = monthly(briefs, s.today);
  const worked = (m: (typeof months)[number]) => m.in_progress + m.delivered + m.accepted + m.placed;
  const cur = months[months.length - 1];
  const prior = months.slice(0, -1);
  const priorAvg = prior.reduce((a, m) => a + worked(m), 0) / prior.length;
  const max = Math.max(1, ...months.map(worked));
  const dir = directions(briefs, s.today);
  const recent = recentWork(briefs, s.today);
  const placementsStat = ((s.cc as any)?.room_strips?.sync?.stats ?? []).find((x: any) => /placements/i.test(x.l ?? ''));
  // Studio-side output for the same month (Studio Board + Weekly Scorecard).
  const mk = s.today.slice(0, 7);
  const sessionsThisMonth = s.weeks.filter((w) => w.start.slice(0, 7) === mk).reduce((a, w) => a + (w.paidSessions ?? 0), 0);
  const deliveriesThisMonth = (s.studio.deliveries ?? []).filter((d) => d.date?.slice(0, 7) === mk).length;
  const leases = s.leases.rows;

  const stat = (v: number | null, l: string, n: string, color?: string) => (
    <div className="cc-stat">
      <div className="cc-v" style={color ? { borderBottom: `2px solid ${color}` } : undefined}>{v == null ? <span className="missing">{NOT_ON_FILE}</span> : v}</div>
      <div className="cc-l">{l}</div>
      <div className="cap">{n}</div>
    </div>
  );

  return (
    <>
      <Header kicker="Brief Board · Studio Board" title="Creative Output" sources="Brief Board (Maestro), Studio Board (Muse), Weekly Scorecard, Beat Leases & Registrations, Command Center data.json" notion={ROOMS.briefBoard} art="couch" />

      <Section title="Production pipeline" right={
        <div role="tablist" style={{ display: 'flex', gap: 4 }}>{PERIODS.map((x) => <button key={x.id} role="tab" aria-selected={period === x.id} onClick={() => setPeriod(x.id)} className="pill" style={{ minHeight: 44, cursor: 'pointer', background: period === x.id ? 'var(--raised)' : 'none', color: period === x.id ? 'var(--gold-hi)' : undefined }}>{x.label}</button>)}</div>
      }>
        <div className="panel">
          {!briefsOk ? <Empty>The Brief Board couldn’t be read, so these counts are Not on file right now.</Empty> : (
            <>
              <div className="cc-stats">
                {stat(null, 'Tracks completed', 'Not logged in HQ: tracks made outside a brief aren’t recorded anywhere')}
                {stat(p.awaiting, 'Submitted, awaiting', `${p.passed ? `+${p.passed} the client passed on · ` : ''}${p.inProgress ? `${p.inProgress} in progress now` : 'none in progress'}`, STAGE_COLOR.delivered)}
                {stat(p.acceptedOnly, 'Accepted', `agreement signed or taken into a library${p.acceptedTitles.named ? ` · at least ${p.acceptedTitles.named} titles named` : ''}`, STAGE_COLOR.accepted)}
                {stat(p.placed, 'Paid or placed', 'confirmed on the Brief Board', STAGE_COLOR.placed)}
              </div>
              <div className="cap" style={{ marginTop: 10 }}>
                <strong>{p.delivered} briefs delivered in total</strong>{p.deliveredTitles.named ? ` (at least ${p.deliveredTitles.named} titles named in ${p.deliveredTitles.counted} of them)` : ''} = submitted + passed + accepted + paid or placed. {p.received} briefs on file for this period · {p.notDone} not done (expired or not taken). Each brief is counted once, by its date on the Brief Board, at its current stage. An acceptance isn’t a placement, and a submission isn’t a sale.
              </div>
              {placementsStat && <div className="banner" style={{ marginTop: 10 }}>◆ <span><strong>{placementsStat.v} {String(placementsStat.l).toLowerCase()}</strong> (all time, {placementsStat.n}). That’s a different count: airings of your catalog found on BMI statements and by TuneSat, not brief outcomes.</span></div>}
            </>
          )}
        </div>
      </Section>

      <Section title="Monthly creative momentum" right={<span className="cap">Briefs by month, last 12 months</span>}>
        <div className="panel">
          {briefsOk ? (
            <>
              <div className="strip-row"><span className="mid">{MONTH(cur.month)}: {worked(cur)} worked</span><span className="cap">12-month average {priorAvg.toFixed(1)} a month</span></div>
              <div className="cmonths" role="img" aria-label={`Briefs worked per month: ${months.map((m) => `${MONTH(m.month)} ${worked(m)}`).join(', ')}`}>
                {months.map((m) => (
                  <div className="cmonth" key={m.month}>
                    <div className="cbar" style={{ height: 96 }}>
                      {(['placed', 'accepted', 'delivered', 'in_progress'] as const).map((k) => m[k] ? <span key={k} style={{ height: `${(m[k] / max) * 100}%`, background: STAGE_COLOR[k] }} /> : null)}
                    </div>
                    <div className="num cap" style={{ textAlign: 'center' }}>{worked(m) || ''}</div>
                    <div className="cap" style={{ textAlign: 'center' }}>{MONTH(m.month)}</div>
                  </div>
                ))}
              </div>
              <div className="legend" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 6 }}>
                {(['in_progress', 'delivered', 'accepted', 'placed'] as const).map((k) => <span key={k} className="cap"><span aria-hidden="true" style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: STAGE_COLOR[k], marginRight: 6 }} />{STAGE_LABEL[k]}</span>)}
              </div>
              <p className="cap">“Worked” = briefs in progress, delivered, accepted or placed. A month with no briefs on the board isn’t a month with no music made: tracks outside briefs aren’t logged in HQ.</p>
            </>
          ) : <Empty>Not on file right now.</Empty>}
        </div>
      </Section>

      <div className="grid g2">
        <Section title="Creative direction" right={<span className="cap">Last 12 months</span>}>
          <div className="panel">
            {dir.rows.length ? <HBars rows={dir.rows.map((r) => ({ label: r.label, v: r.n, color: 'var(--lane-bmi)' }))} label="Styles named in brief titles" /> : <Empty>No style words in recent brief titles.</Empty>}
            <p className="cap">Styles only where the brief’s own title names them ({dir.tagged} of {dir.of} briefs worked in the last 12 months). One brief can name more than one style.</p>
          </div>
        </Section>
        <Section title="Studio output this month">
          <div className="panel">
            <div className="cc-stats">
              {stat(sessionsThisMonth, 'Paid sessions', 'Weekly Scorecard, this month')}
              {stat(deliveriesThisMonth || null, 'Mix deliveries logged', 'Studio Board; only deliveries Muse recorded with a date')}
              {stat(leases, 'Beat leases logged', 'Beat Leases & Registrations, all time')}
            </div>
          </div>
        </Section>
      </div>

      <Section title="Recent work" right={<NotionLink href={ROOMS.briefBoard}>Brief Board ↗</NotionLink>}>
        <div className="panel">
          {recent.length ? recent.map((b) => {
            const st = stageOf(b.status);
            const t = titlesOf(b);
            return (
              <div className="row" key={b.url || b.brief}>
                <span className="t">
                  <a href={b.url} target="_blank" rel="noopener noreferrer"><strong>{b.brief}</strong></a>
                  <div className="cap">{[b.company, b.type, b.code, t ? `${t} title${t > 1 ? 's' : ''}` : null].filter(Boolean).join(' · ')}</div>
                </span>
                <span className="r" style={{ textAlign: 'right' }}>
                  <span className="pill" style={{ borderColor: STAGE_COLOR[st], color: STAGE_COLOR[st] }}>{b.status}</span>
                  <div className="cap">{shortDay(b.due)}{b.due && b.due > s.today ? ' (due)' : ''}</div>
                </span>
              </div>
            );
          }) : <Empty>No recent briefs on file.</Empty>}
          <p className="cap">Status exactly as the Brief Board has it. Dates are the board’s Due date{recent.some((b) => b.due && b.due > addDays(s.today, 0)) ? '; future dates are deadlines' : ''}.</p>
        </div>
      </Section>
    </>
  );
}
