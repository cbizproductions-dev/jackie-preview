import React, { useState } from 'react';
import { useSnap, money, pct, signedPct, Ladder, Spark, Led, Section, Count, labelTime, day, SourceBadge, Empty, lightWord, Header } from '../ui';
import { CCHeadline, CCBrief, CCFacts } from '../cc';
import { mixBriefQueue, bookedAhead } from '../../shared/work';
import { SinceLastUpdate } from '../since';
import { goalTargets, thisWeekMetric, yearMetrics, todaysMoves, healthLights, ROOMS, studioOps, monthMetrics, currentWeek } from '../../shared/derive';
import { momentum, weekCash, weekStatus } from '../../shared/rules';
import { labelDay, addDays, weekStart } from '../../shared/time';

export default function Home() {
  const s = useSnap();
  const t = goalTargets(s);
  const wk = thisWeekMetric(s);
  const yr = yearMetrics(s);
  const ops = studioOps(s);
  const mo = momentum(s.weeks, s.today);
  const mq = mixBriefQueue(s);
  const ba = bookedAhead(s);
  const mm = monthMetrics(s);
  const moves = todaysMoves(s);
  const lights = healthLights(s);
  const [open, setOpen] = useState<string | null>(null);
  const prog = wk.value != null ? wk.value / t.goal : null;
  const inProg = wk.status === 'in_progress';
  const cur = currentWeek(s);
  const lastWeek = s.weeks.find((w) => w.start === addDays(weekStart(s.today), -7));

  const go = (id: string) => () => { location.hash = `#/${id}`; };
  const next = nextUp(s);

  return (
    <>
      <Header kicker="C-BIZ OFFICIAL · Music business" title="Dashboard" sources="Weekly Scorecard, Income Ledger, Goals, Studio Board, Intelligence Feed" notion={ROOMS.home} />
      <div className="bridge" role="group" aria-label="Meter bridge">
        <button className="meter wide" onClick={go('money')} aria-label={`This week: ${money(wk.value)} of $${t.goal} goal${inProg ? ', in progress' : ''}. Open Money.`}>
          <span className="label">This week · {wk.period}{s.updating.includes('scorecard') ? ' · updating' : ''}</span>
          <span className="val"><Count value={wk.value} fmt={(n) => money(n)} /></span>
          <Ladder value={wk.value} max={t.stretch * 1.1} label={`This week: ${money(wk.value)} of $${t.goal} goal${inProg ? ', in progress' : ''}`} ticks={[{ at: t.goal, label: `$${t.goal}` }, { at: t.stretch, label: `$${t.stretch.toLocaleString('en-US')}`, dashed: true }]} />
          <span className="msub">{!wk.value && wk.status === 'in_progress' && (wk.note === 'week just started' || s.today === weekStart(s.today)) ? '$0 so far · week just started' : <>{prog == null ? 'Not on file' : `${pct(prog)} of $${t.goal}`}{wk.status === 'ok' ? ' · week complete' : ' · week in progress'}</>}</span>
        </button>
        <button className="meter" onClick={go('calendar')} aria-label={`Booked ahead: ${ba.count} paid session${ba.count === 1 ? '' : 's'} in the next 14 days, ${money(ba.expected)} expected, not income. Open Calendar.`}>
          <span className="label">Booked ahead · 14 days</span>
          <span className="val sm">{ba.count} session{ba.count === 1 ? '' : 's'}</span>
          <Ladder value={ba.week.expected} max={t.goal} segments={16} label={`Next 7 days: ${money(ba.week.expected)} expected of the $${t.goal} goal`} ticks={[{ at: t.goal, label: `$${t.goal}` }]} />
          <span className="msub">
            {ba.count ? <>{ba.hoursKnown ? `${ba.hours} hrs` : `${ba.hours}+ hrs`} · {money(ba.expected)} expected, not income{ba.rateMissing ? ` · ${ba.rateMissing} rate not set` : ''}<br />Next 7 days: {money(ba.week.expected)} of ${t.goal}</> : 'Nothing booked in the next 14 days'}
            {ba.next && <><br />Next: {ba.next.who}, {labelDay(ba.next.date, { weekday: 'short', month: 'short', day: 'numeric' })}{ba.next.time ? ` · ${ba.next.time}` : ''}{ba.next.rate == null ? ' · rate not set' : ''}</>}
          </span>
        </button>
        <button className="meter" onClick={go('studio')} aria-label={`Vibe to paid ${pct(ops.vibe.rate)}, ${ops.vibe.paid} of ${ops.vibe.showed}. Open Studio.`}>
          <span className="label">Vibe → paid</span>
          <span className="val sm">{ops.vibe.rate == null ? <span className="missing">Not on file</span> : pct(ops.vibe.rate)}</span>
          <span className="msub">{ops.vibe.paid} of {ops.vibe.showed} who showed{ops.vibe.booked ? ` · +${ops.vibe.booked} booked, not paid yet` : ''}</span>
        </button>
        <button className="meter" onClick={go('studio')} aria-label={`Mix and brief queue: ${mq.mixes} mixes, ${mq.briefs} briefs; ${mq.overdueMixes} mixes overdue${mq.overdueBriefs ? `, ${mq.overdueBriefs} briefs past due` : ''}. Open Studio.`}>
          <span className="label">Mix &amp; Brief Queue</span>
          <span className="val sm" style={{ color: mq.anyOverdue ? 'var(--bad)' : undefined, whiteSpace: 'normal', lineHeight: 1.15 }}><span style={{ whiteSpace: 'nowrap' }}>{mq.mixes} mixes</span> <span style={{ whiteSpace: 'nowrap' }}>· {mq.briefs} briefs</span></span>
          <span className="msub"><Led light={mq.anyOverdue ? 'red' : mq.mixes + mq.briefs >= 6 ? 'amber' : 'green'} word={false} /> {mq.overdueMixes} overdue mix{mq.overdueMixes === 1 ? '' : 'es'}{mq.overdueBriefs ? ` · ${mq.overdueBriefs} brief${mq.overdueBriefs === 1 ? '' : 's'} past due` : ''}{mq.approx ? ' (some counts approx.)' : ''}
            {mq.nextBrief && <><br />Next brief: {mq.nextBrief.brief} · {labelDay(mq.nextBrief.next!, { weekday: 'short', month: 'short', day: 'numeric' })}</>}
          </span>
        </button>
        <button className="meter" onClick={go('money')} aria-label={'windowWeeks' in mo && mo.windowWeeks ? `Momentum ${signedPct((mo as any).change)}, ${(mo as any).label}` : 'Momentum: not enough complete weeks'}>
          <span className="label">Momentum</span>
          {mo.windowWeeks ? (
            <span className="val sm" style={{ color: ((mo as any).change ?? 0) >= 0 ? 'var(--ok)' : 'var(--bad)' }}>
              {((mo as any).change ?? 0) >= 0 ? '▲' : '▼'} {signedPct((mo as any).change)}
            </span>
          ) : <span className="val sm missing">—</span>}
          <Spark label="Studio-side cash, last 8 weeks" data={mo.spark.map((p) => ({ v: p.total, dashed: p.inProgress }))} />
          <span className="msub">
            {mo.windowWeeks ? `${mo.windowWeeks} vs ${mo.windowWeeks} complete weeks` : (mo as any).reason}
            <span className="extra"><br />Wk: {money(cur ? weekCash(cur) : null)} vs {money(lastWeek ? weekCash(lastWeek) : null)}{cur && weekStatus(cur.start, s.today) !== 'complete' ? ' (in progress)' : ''}
            <br />Mo: {money(mm.studioThis)} so far vs {money(mm.studioPrev)}</span>
          </span>
        </button>
      </div>
      <CCHeadline />

      <Section title="Today’s moves" right={<span className="cap">Overdue · money · deadlines</span>}>
        {moves.length ? (
          <ol className="moves">
            {moves.map((m, i) => (
              <li key={i}>
                <a href={m.url} target="_blank" rel="noopener noreferrer">
                  <span className={`led ${m.cat === 'overdue' ? 'red' : m.cat === 'money' ? 'amber' : 'none'}`} aria-hidden="true" style={{ marginTop: 2 }}>{m.cat === 'overdue' ? '■' : m.cat === 'money' ? '▲' : '●'}</span>
                  <span>
                    <div className="what">{m.what}</div>
                    <div className="why">{m.why}</div>
                    <div className="src">{m.source} ↗</div>
                  </span>
                </a>
              </li>
            ))}
          </ol>
        ) : <Empty>Nothing overdue, owed or due in the next 7 days.</Empty>}
      </Section>

      <CCBrief />

      <SinceLastUpdate />

      <Section title="Ten health lights" right={<a className="link-sm" href="#/strategy">Rules ›</a>}>
        <div className="leds">
          {lights.map((l) => (
            <button key={l.area} className="led-btn" aria-expanded={open === l.area} onClick={() => setOpen(open === l.area ? null : l.area)} aria-label={`${l.area}: ${lightWord(l.light)}. ${l.today}`}>
              <Led light={l.light} word={false} />
              <span className="led-name">{l.area}</span>
              <span className="led-word" style={{ color: 'var(--ink-3)' }}>{lightWord(l.light)}</span>
            </button>
          ))}
        </div>
        {open && (() => {
          const l = lights.find((x) => x.area === open)!;
          return (
            <div className="panel" style={{ marginTop: 8 }} role="region" aria-label={`${l.area} rule`}>
              <div className="strip-row"><strong>{l.area}</strong><Led light={l.light} /></div>
              <div className="mid" style={{ fontSize: 17 }}>Today: {l.today}</div>
              {l.note && <div className="cap">{l.note}</div>}
              <div className="sub" style={{ marginTop: 6 }}>● Good: {l.rule.green}<br />▲ Watch: {l.rule.amber}<br />■ Act: {l.rule.red}</div>
            </div>
          );
        })()}
      </Section>

      <CCFacts />

      <div className="grid g2">
        <Section title="Next up">
          <div className="panel">
            {next ? (
              <>
                <div className="label">{day(next.date)}</div>
                {next.items.map((it, i) => (
                  <div key={i} style={{ marginTop: i ? 10 : 4 }}>
                    {it.time && <div className="cap">{it.time}</div>}
                    <div className="mid" style={{ fontSize: 19 }}>{it.title}</div>
                  </div>
                ))}
                <div className="cap" style={{ marginTop: 6 }}>From the Rolling 60-Day Calendar (Muse)</div>
              </>
            ) : <Empty>No session or music event on the calendar in the next 60 days.</Empty>}
          </div>
        </Section>
        <Section title="Signal check">
          <div className="panel">
            <div className="row"><span className="t">Snapshot</span><span className="r num">{labelTime(s.generatedAt)}</span></div>
            <div className="row"><span className="t">State</span><span className="r"><SourceBadge snap={s} /></span></div>
            <div className="row"><span className="t">Stale or failed sources</span><span className="r">{s.sources.filter((x) => x.state === 'stale' || x.state === 'failed').map((x) => x.name).join(', ') || 'None'}</span></div>
            <div className="row"><span className="t">Open data issues</span><a className="r link-sm" style={{ justifyContent: "flex-end" }} href="#/cabinet">{s.issues.length} ›</a></div>
          </div>
        </Section>
      </div>
      {s.mode === 'seed' && <p className="cap" style={{ marginTop: 16 }}>Showing the build-time capture from {labelTime(s.generatedAt)}. Live reads start once the read-only Notion integration is connected.</p>}
    </>
  );
}

function nextUp(s: ReturnType<typeof useSnap>) {
  for (const d of s.calendar.days) {
    if (d.date < s.today) continue;
    const it = d.items.find((i) => i.tags.some((t) => ['session', 'vibe', 'sync', 'speaking', 'brief'].includes(t)));
    // Show every entry on that day, not just the first music item.
    if (it) return { date: d.date, items: d.items.map((i) => ({ time: i.time, title: i.title.replace(/\s*\(user-reported.*\)/i, '') })) };
  }
  const u = s.studio.upcoming[0];
  return u ? { date: u.date, items: [{ time: null as string | null, title: `${u.who} — booked session` }] } : null;
}
export { labelDay };
