import React from 'react';
import { useSnap, Header, Section, Runway, Empty, day, NotionLink, Led, Fold } from '../ui';
import { CCRoom } from '../cc';
import { ROOMS } from '../../shared/derive';
import { daysBetween, addDays } from '../../shared/time';

export default function Contracts() {
  const s = useSnap();
  const horizon = addDays(s.today, 540);
  const upcoming = s.contracts
    .map((c) => ({ c, d: c.noticeBy && c.noticeBy >= s.today ? c.noticeBy : c.nextActionDate }))
    .filter((x) => x.d && x.d >= s.today && x.d <= horizon)
    .sort((a, b) => a.d!.localeCompare(b.d!));
  const lightOf = (d: string) => { const n = daysBetween(s.today, d); return n <= 30 ? 'red' : n <= 90 ? 'amber' : 'green'; };
  // Real rights questions stay visible; paperwork-only flags (not countersigned) fold into one line.
  const watch = s.contracts.filter((c) => c.flags.some((f) => /conflict|overlap/i.test(f)) || /ambiguous/i.test(c.exclusivity ?? ''));
  const paperwork = s.contracts.filter((c) => !watch.includes(c) && c.flags.some((f) => /unsigned|unclear/i.test(f)));
  const by = (pred: (c: (typeof s.contracts)[number]) => boolean) => s.contracts.filter(pred).length;
  const exitCounts = new Map<string, number>();
  for (const c of s.contracts.filter((c) => /representation|library|publishing/i.test(c.type ?? ''))) exitCounts.set(c.exit ?? 'Not stated', (exitCounts.get(c.exit ?? 'Not stated') ?? 0) + 1);

  return (
    <>
      <Header kicker="Contract Vault · Maestro" title="Contracts & Rights" sources="Contract Vault (Maestro)" notion={ROOMS.contracts} art="redcarpet" />
      <CCRoom room="contracts" />
      <Section title="Deadline runway" right={<span className="cap">Solid = confirmed · hollow/dashed = inferred</span>}>
        <div className="panel">
          {upcoming.length ? (
            <>
              <div className="no-swipe"><div>
                <Runway today={s.today} items={upcoming.slice(0, 6).map(({ c, d }) => ({ date: d!, label: c.counterparty || c.agreement, light: lightOf(d!) as any, inferred: c.inferred, sub: `${day(d)} · ${daysBetween(s.today, d!)} days${c.inferred ? ' · inferred' : ''}` }))} />
              </div></div>
              {upcoming.slice(0, 6).map(({ c, d }) => (
                <div className="row" key={c.url}>
                  <span className="t"><Led light={lightOf(d!) as any} word={false} /> <a href={c.url} target="_blank" rel="noopener noreferrer"><strong>{c.agreement}</strong></a><div className="cap">{c.nextAction.length > 170 ? c.nextAction.slice(0, 170).replace(/\s\S*$/, '') + '…' : c.nextAction}</div></span>
                  <span className="r"><span className="num">{daysBetween(s.today, d!)}d</span><div className="cap">{c.inferred ? 'Inferred' : 'Confirmed'}</div></span>
                </div>
              ))}
            </>
          ) : <Empty>No contract decisions in the next 18 months.</Empty>}
          <p className="cap">Red: due within 30 days and undecided · Amber: within 90 days. Decisions aren’t recorded in the Vault, so every upcoming one is treated as undecided.</p>
        </div>
      </Section>

      <Section title="Watch list">
        <div className="panel">
          {watch.length ? watch.map((c) => <div className="row" key={c.url}><span className="t"><a href={c.url} target="_blank" rel="noopener noreferrer">{c.agreement}</a><div className="cap">{c.flags.join(' · ')}</div></span><span className="r cap">{c.signed}</span></div>) : <Empty>No overlaps or ambiguous agreements flagged.</Empty>}
          {paperwork.length > 0 && (
            <Fold title={`Paperwork only: not countersigned or unclear (${paperwork.length})`}>
              {paperwork.map((c) => <div className="row" key={c.url}><span className="t"><a href={c.url} target="_blank" rel="noopener noreferrer">{c.agreement}</a></span><span className="r cap">{c.signed}</span></div>)}
            </Fold>
          )}
          <p className="sub" style={{ marginTop: 8 }}>Standing notes from the Vault: MIBE titles stay exclusive in perpetuity — retitle before pitching them elsewhere. Some tracks sit with two companies (overlap flags above).</p>
        </div>
      </Section>

      <Section title={`All agreements · ${s.contracts.length}`} right={<NotionLink href={ROOMS.vault}>Contract Vault ↗</NotionLink>}>
        <div className="panel">
          {s.contracts.length ? [...new Set(s.contracts.map((c) => c.type ?? 'Other'))].sort().map((t) => {
            const rows = s.contracts.filter((c) => (c.type ?? 'Other') === t).sort((a, b) => a.agreement.localeCompare(b.agreement));
            return (
              <Fold key={t} title={`${t} (${rows.length})`}>
                {rows.map((c) => (
                  <div className="row" key={c.url}>
                    <span className="t"><a href={c.url} target="_blank" rel="noopener noreferrer">{c.agreement}</a><div className="cap">{[c.counterparty, c.signed, c.exit].filter(Boolean).join(' · ')}</div></span>
                    <span className="r cap">{c.nextActionDate ? day(c.nextActionDate) : ''}</span>
                  </div>
                ))}
              </Fold>
            );
          }) : <Empty>The Contract Vault couldn’t be read.</Empty>}
          <p className="cap">Every row in Maestro’s Contract Vault, read live. Tap one to open it in Notion.</p>
        </div>
      </Section>

      <Section title={`Briefs signed to contract · ${s.briefs.filter((b) => b.status === 'Contract').length}`} right={<NotionLink href={ROOMS.briefBoard}>Brief Board ↗</NotionLink>}>
        <div className="panel">
          {s.briefs.filter((b) => b.status === 'Contract').length ? (
            <Fold title="Show the list">
              {s.briefs.filter((b) => b.status === 'Contract').sort((a, b) => (b.due ?? '').localeCompare(a.due ?? '')).map((b) => (
                <div className="row" key={b.url}><span className="t"><a href={b.url} target="_blank" rel="noopener noreferrer">{b.brief}</a><div className="cap">{[b.company, b.code, b.type].filter(Boolean).join(' · ')}</div></span><span className="r cap">{b.due ? day(b.due) : ''}</span></div>
              ))}
            </Fold>
          ) : <Empty>No briefs marked Contract on the Brief Board.</Empty>}
          <p className="cap">Brief Board rows with status “Contract” (Maestro). Shown here, not under Sync’s active briefs.</p>
        </div>
      </Section>

      <Section title="Counts by type">
        <div className="grid g3">
          <div className="panel"><div className="label">Work-for-hire</div><div className="mid">{by((c) => /work for hire/i.test(c.type ?? ''))}</div><div className="cap">{by((c) => /work for hire/i.test(c.type ?? '') && /fully executed/i.test(c.signed ?? ''))} executed · {by((c) => /work for hire/i.test(c.type ?? '') && /not countersigned/i.test(c.signed ?? ''))} not countersigned</div></div>
          <div className="panel"><div className="label">Representation & library deals</div><div className="mid">{by((c) => /representation|library|publishing/i.test(c.type ?? ''))}</div><div className="cap">{[...exitCounts.entries()].map(([k, v]) => `${v} ${k.toLowerCase()}`).join(' · ')}</div></div>
          <div className="panel"><div className="label">Split sheets · other</div><div className="mid">{by((c) => /split/i.test(c.type ?? ''))} · {by((c) => !/work for hire|representation|library|publishing|split/i.test(c.type ?? ''))}</div><div className="cap">{s.contracts.length} agreements on file</div></div>
        </div>
      </Section>
      <p className="foot">Source: Contract Vault (Maestro). Not legal advice. Nothing here edits an agreement. <NotionLink href={ROOMS.vault} /></p>
    </>
  );
}
