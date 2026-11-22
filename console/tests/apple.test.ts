import { describe, it, expect } from 'vitest';
import { parseIcs, readApple, sameEvent } from '../src/worker/ical';
import { mergeApple, assemble } from '../src/worker/snapshot';

// Synthetic calendar (no real data).
const ICS = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  'UID:a1',
  'DTSTART;TZID=America/New_York:20261123T180000',
  'DTEND;TZID=America/New_York:20261123T193000',
  'SUMMARY:Studio session \\, Test Artist',
  'DESCRIPTION:Private notes that must never show',
  'LOCATION:Somewhere private',
  'BEGIN:VALARM',
  'TRIGGER:-PT15M',
  'SUMMARY:Alarm text',
  'END:VALARM',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:a2',
  'DTSTART:20261124T160000Z',
  'DTEND:20261124T170000Z',
  'SUMMARY:Call with a very long title that gets',
  '  folded onto the next line',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:a3',
  'DTSTART;VALUE=DATE:20261125',
  'DTEND;VALUE=DATE:20261128',
  'SUMMARY:Test trip',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:a4',
  'DTSTART;TZID=America/New_York:20260105T110000',
  'DTEND;TZID=America/New_York:20260105T120000',
  'RRULE:FREQ=WEEKLY;BYDAY=MO,WE',
  'EXDATE;TZID=America/New_York:20261125T110000',
  'SUMMARY:Weekly thing',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:a4',
  'RECURRENCE-ID;TZID=America/New_York:20261130T110000',
  'DTSTART;TZID=America/New_York:20261130T150000',
  'DTEND;TZID=America/New_York:20261130T160000',
  'SUMMARY:Weekly thing (moved)',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:a5',
  'DTSTART;TZID=America/New_York:20261126T100000',
  'STATUS:CANCELLED',
  'SUMMARY:Cancelled thing',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:a6',
  'DTSTART;TZID=America/New_York:20261127T100000',
  'DTEND;TZID=America/New_York:20261127T110000',
  'SUMMARY:Durango follow-up',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

describe('Apple Calendar feed', () => {
  const items = parseIcs(ICS, '2026-11-22', '2026-12-01');
  const on = (d: string) => items.filter((i) => i.date === d).map((i) => `${i.time} ${i.title}`);

  it('reads titles and times in New York time, never notes or locations', () => {
    expect(on('2026-11-23')).toEqual(['11:00 AM–12:00 PM Weekly thing', '6:00–7:30 PM Studio session , Test Artist']);
    expect(on('2026-11-24')).toEqual(['11:00 AM–12:00 PM Call with a very long title that gets folded onto the next line']);
    expect(JSON.stringify(items)).not.toMatch(/Private|Somewhere|Alarm/);
  });
  it('shows a multi-day all-day event once, with its end date', () => {
    expect(on('2026-11-25')).toContain('All day Test trip (through Fri, Nov 27)');
    expect(on('2026-11-26').join()).not.toMatch(/Test trip/);
  });
  it('expands repeats, skips removed and moved ones, drops cancelled', () => {
    // Mon/Wed repeat: Wed Nov 25 removed (EXDATE), Mon Nov 30 moved to 3 PM.
    expect(items.filter((i) => i.title === 'Weekly thing').map((i) => `${i.date} ${i.time}`)).toEqual(['2026-11-23 11:00 AM–12:00 PM']);
    expect(on('2026-11-30')).toEqual(['3:00–4:00 PM Weekly thing (moved)']);
    expect(JSON.stringify(items)).not.toMatch(/Cancelled thing/);
  });
  it('adds only what the Notion calendar is missing, and keeps the Durango hold', () => {
    const cal = { refreshed: null, lastVerified: null, days: [{ date: '2026-11-23', items: [{ time: '6:00–7:30 PM', title: 'Test Artist — studio session', tags: ['session' as const], userReported: false, tentative: false }] }] };
    const added = mergeApple(cal, { items, readAt: '2026-11-22T12:00:00Z' }, '2026-11-22');
    const d23 = cal.days.find((d) => d.date === '2026-11-23')!.items.map((i) => i.title);
    expect(d23.filter((t) => /test artist/i.test(t))).toHaveLength(1); // not duplicated
    expect(d23).toContain('Weekly thing');
    expect(cal.days.flatMap((d) => d.items).some((i) => /durango/i.test(i.title))).toBe(false);
    expect(cal.days.find((d) => d.date === '2026-11-25')!.items[0]).toMatchObject({ apple: true, time: 'All day' });
    expect(added).toBeGreaterThan(0);
    expect(cal.days.map((d) => d.date)).toEqual([...cal.days.map((d) => d.date)].sort());
  });
  it('matches the same event written differently', () => {
    expect(sameEvent('Haircut - Krispy Kutz', 'Krispy Kutz — haircut')).toBe(true);
    expect(sameEvent('Dentist', 'Krispy Kutz — haircut')).toBe(false);
  });
  it('keeps the last good copy and never logs the link when iCloud fails', async () => {
    const prev = { items, readAt: '2026-11-22T12:00:00Z' };
    const bad = (async () => new Response('nope', { status: 404 })) as unknown as typeof fetch;
    const r = await readApple('webcal://p00-caldav.icloud.com/published/2/SECRET', '2026-11-22', '2026-12-01', prev, bad);
    expect(r.items).toBe(items);
    expect(r.error).toMatch(/404/);
    expect(r.error).not.toMatch(/SECRET/);
  });
  it('turns webcal links into https and reads them', async () => {
    let asked = '';
    const ok = (async (u: string) => { asked = u; return new Response(ICS); }) as unknown as typeof fetch;
    const r = await readApple('webcal://p00-caldav.icloud.com/published/2/X', '2026-11-22', '2026-12-01', undefined, ok);
    expect(asked.startsWith('https://')).toBe(true);
    expect(r.error).toBeNull();
    expect(r.items.length).toBe(items.length);
  });
  it('shows up as a source, and a failed feed is labelled', () => {
    const s = assemble({ sources: {}, apple: { items: [], readAt: null, error: 'Apple Calendar answered 404' } }, new Date('2026-11-22T15:00:00Z'));
    const src = s.sources.find((x) => x.id === 'apple')!;
    expect(src.state).toBe('failed');
    expect(assemble({ sources: {} }, new Date('2026-11-22T15:00:00Z')).sources.some((x) => x.id === 'apple')).toBe(false);
  });
});
