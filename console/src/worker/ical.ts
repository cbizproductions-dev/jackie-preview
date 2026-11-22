/**
 * Apple Calendar live feed (read only).
 * Kris shares an iCloud calendar as a "Public Calendar" link; the link lives only in the Worker secret APPLE_CAL_URL
 * (several links may be separated by spaces or commas). The Worker downloads the .ics text, keeps titles and times
 * for the next 60 days (no notes, no locations, no attendees) and fills in anything the Notion calendar hasn't caught yet.
 */

export type AppleEvent = { date: string; time: string | null; title: string; start: string };
export type AppleState = { items: AppleEvent[]; readAt: string | null; error?: string | null; calendars?: number; stats?: { events: number; repeating: number; latest: string | null; upcoming?: number; nextStart?: string | null; byMonth?: Record<string, number> } };

const NY = 'America/New_York';
const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const pad = (n: number) => String(n).padStart(2, '0');

// ---------- time zone helpers ----------
const fmtCache = new Map<string, Intl.DateTimeFormat>();
function parts(ms: number, tz: string) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    fmtCache.set(tz, f);
  }
  const o: Record<string, number> = {};
  for (const p of f.formatToParts(new Date(ms))) if (p.type !== 'literal') o[p.type] = Number(p.value);
  return { y: o.year, m: o.month, d: o.day, h: o.hour % 24, mi: o.minute, s: o.second };
}
function validTz(tz: string | undefined): string {
  if (!tz) return NY;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return NY;
  }
}
/** Wall-clock time in `tz` → UTC milliseconds. */
function wallToUtc(y: number, m: number, d: number, h: number, mi: number, s: number, tz: string): number {
  const guess = Date.UTC(y, m - 1, d, h, mi, s);
  let ms = guess;
  for (let i = 0; i < 2; i++) {
    const p = parts(ms, tz);
    const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s);
    ms = ms + (guess - asUtc);
  }
  return ms;
}

// ---------- ICS parsing ----------
type Prop = { name: string; params: Record<string, string>; value: string };
function unfold(text: string): string[] {
  return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
}
function prop(line: string): Prop | null {
  const i = line.indexOf(':');
  if (i < 0) return null;
  const [name, ...ps] = line.slice(0, i).split(';');
  const params: Record<string, string> = {};
  for (const p of ps) {
    const [k, v] = p.split('=');
    if (k && v) params[k.toUpperCase()] = v.replace(/^"|"$/g, '');
  }
  return { name: name.toUpperCase(), params, value: line.slice(i + 1) };
}
const unescapeText = (s: string) => s.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim();

type DT = { allDay: boolean; y: number; m: number; d: number; h: number; mi: number; s: number; tz: string };
function parseDT(p: Prop): DT | null {
  const v = p.value.trim();
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(v);
  if (!m) return null;
  const allDay = p.params.VALUE === 'DATE' || !m[4];
  return { allDay, y: +m[1], m: +m[2], d: +m[3], h: +(m[4] ?? 0), mi: +(m[5] ?? 0), s: +(m[6] ?? 0), tz: m[7] ? 'UTC' : validTz(p.params.TZID) };
}
const dtMs = (t: DT) => (t.allDay ? Date.UTC(t.y, t.m - 1, t.d) : wallToUtc(t.y, t.m, t.d, t.h, t.mi, t.s, t.tz));

type Ev = { uid: string; summary: string; start: DT; end: DT | null; durMs: number | null; rrule: Record<string, string> | null; exdates: Set<string>; recurrenceId: string | null; cancelled: boolean };

function dayKeyNY(ms: number) {
  const p = parts(ms, NY);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}
function timeNY(ms: number) {
  const p = parts(ms, NY);
  const h12 = p.h % 12 || 12;
  return { label: `${h12}:${pad(p.mi)}`, ampm: p.h < 12 ? 'AM' : 'PM' };
}
function fmtRange(startMs: number, endMs: number | null) {
  const a = timeNY(startMs);
  if (endMs == null || endMs <= startMs) return `${a.label} ${a.ampm}`;
  const b = timeNY(endMs);
  return a.ampm === b.ampm ? `${a.label}–${b.label} ${b.ampm}` : `${a.label} ${a.ampm}–${b.label} ${b.ampm}`;
}
function parseDuration(v: string): number | null {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(v.trim());
  if (!m) return null;
  return ((+(m[2] ?? 0) * 7 + +(m[3] ?? 0)) * 86400 + +(m[4] ?? 0) * 3600 + +(m[5] ?? 0) * 60 + +(m[6] ?? 0)) * 1000;
}

function readEvents(text: string): Ev[] {
  const out: Ev[] = [];
  let cur: Partial<Ev> | null = null;
  let depth = 0; // skip nested blocks such as VALARM
  for (const line of unfold(text)) {
    if (line === 'BEGIN:VEVENT') { cur = { exdates: new Set(), rrule: null, recurrenceId: null, cancelled: false, end: null, durMs: null, summary: '', uid: '' }; depth = 0; continue; }
    if (!cur) continue;
    if (line.startsWith('BEGIN:')) { depth++; continue; }
    if (line.startsWith('END:') && depth > 0) { depth--; continue; }
    if (line === 'END:VEVENT') {
      if (cur.start) out.push(cur as Ev);
      cur = null;
      continue;
    }
    if (depth) continue;
    const p = prop(line);
    if (!p) continue;
    if (p.name === 'SUMMARY') cur.summary = unescapeText(p.value);
    else if (p.name === 'UID') cur.uid = p.value;
    else if (p.name === 'DTSTART') cur.start = parseDT(p) ?? undefined;
    else if (p.name === 'DTEND') cur.end = parseDT(p);
    else if (p.name === 'DURATION') cur.durMs = parseDuration(p.value);
    else if (p.name === 'STATUS') cur.cancelled = /CANCELLED/i.test(p.value);
    else if (p.name === 'RECURRENCE-ID') { const t = parseDT(p); cur.recurrenceId = t ? String(dtMs(t)) : null; }
    else if (p.name === 'EXDATE') for (const v of p.value.split(',')) { const t = parseDT({ ...p, value: v }); if (t) cur.exdates!.add(String(dtMs(t))); }
    else if (p.name === 'RRULE') cur.rrule = Object.fromEntries(p.value.split(';').map((kv) => kv.split('=')).filter((x) => x.length === 2).map(([k, v]) => [k.toUpperCase(), v]));
  }
  return out;
}

/** Occurrence start times (as wall-clock DTs) of a recurring event, from DTSTART up to `untilMs`. */
function occurrences(ev: Ev, fromMs: number, untilMs: number): DT[] {
  const r = ev.rrule!;
  const freq = r.FREQ;
  const interval = Math.max(1, Number(r.INTERVAL ?? 1));
  const count = r.COUNT ? Number(r.COUNT) : Infinity;
  let until = untilMs;
  if (r.UNTIL) { const t = parseDT({ name: 'UNTIL', params: {}, value: r.UNTIL }); if (t) until = Math.min(until, t.allDay ? Date.UTC(t.y, t.m - 1, t.d) + 86400000 - 1 : dtMs({ ...t, tz: t.tz })); }
  const s = ev.start;
  const at = (y: number, m: number, d: number): DT => ({ ...s, y, m, d });
  const civil = (ms: number) => { const x = new Date(ms); return { y: x.getUTCFullYear(), m: x.getUTCMonth() + 1, d: x.getUTCDate(), wd: x.getUTCDay() }; };
  const base = Date.UTC(s.y, s.m - 1, s.d);
  const res: DT[] = [];
  let n = 0;
  const push = (t: DT) => { if (n >= count) return false; const ms = dtMs(t); if (ms > until) return false; if (ms >= dtMs(s)) { res.push(t); n++; } return true; };
  const byDay = (r.BYDAY ?? '').split(',').filter(Boolean);
  // Without COUNT, jump straight to the window instead of walking years of old repeats.
  let i0 = 0;
  if (!r.COUNT && fromMs > base) {
    const days = (fromMs - base) / 86400000;
    const per = freq === 'DAILY' ? interval : freq === 'WEEKLY' ? 7 * interval : freq === 'MONTHLY' ? 28 * interval : 365 * interval;
    i0 = Math.max(0, Math.floor(days / per) - 2);
    if (freq === 'MONTHLY') i0 = Math.max(0, Math.floor(((new Date(fromMs).getUTCFullYear() - s.y) * 12 + new Date(fromMs).getUTCMonth() - (s.m - 1)) / interval) - 1);
  }
  for (let i = i0; i < i0 + 3000; i++) {
    let cont = true;
    if (freq === 'DAILY') { const c = civil(base + i * interval * 86400000); cont = push(at(c.y, c.m, c.d)); }
    else if (freq === 'WEEKLY') {
      const days = byDay.length ? byDay.map((b) => WEEKDAYS.indexOf(b.slice(-2))).filter((x) => x >= 0).sort() : [civil(base).wd];
      const weekStart = base - civil(base).wd * 86400000 + i * interval * 7 * 86400000;
      for (const wd of days) { const c = civil(weekStart + wd * 86400000); if (!(cont = push(at(c.y, c.m, c.d)))) break; }
    } else if (freq === 'MONTHLY') {
      const mIdx = s.m - 1 + i * interval;
      const y = s.y + Math.floor(mIdx / 12), m = (mIdx % 12) + 1;
      const nth = /^(-?\d)?([A-Z]{2})$/.exec(byDay[0] ?? '');
      let d = r.BYMONTHDAY ? Number(r.BYMONTHDAY) : s.d;
      if (nth && nth[1]) {
        const wd = WEEKDAYS.indexOf(nth[2]); const k = Number(nth[1]);
        const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
        const firstWd = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
        const first = 1 + ((wd - firstWd + 7) % 7);
        d = k > 0 ? first + (k - 1) * 7 : first + Math.floor((dim - first) / 7) * 7 + (k + 1) * 7;
        if (d < 1 || d > dim) continue;
      }
      if (d > new Date(Date.UTC(y, m, 0)).getUTCDate()) continue;
      cont = push(at(y, m, d));
    } else if (freq === 'YEARLY') cont = push(at(s.y + i * interval, s.m, s.d));
    else { push(s); break; }
    if (!cont) break;
  }
  return res;
}

/** Events between `fromDay` and `toDay` (inclusive, New York dates). Titles and times only. */
export function parseIcs(text: string, fromDay: string, toDay: string): AppleEvent[] {
  const events = readEvents(text);
  const fromMs = Date.parse(`${fromDay}T00:00:00Z`) - 2 * 86400000;
  const toMs = Date.parse(`${toDay}T23:59:59Z`) + 86400000;
  const overrides = new Set(events.filter((e) => e.recurrenceId && e.uid).map((e) => `${e.uid}|${e.recurrenceId}`));
  const out: AppleEvent[] = [];
  for (const ev of events) {
    if (ev.cancelled || !ev.summary) continue;
    const durMs = ev.end ? dtMs(ev.end) - dtMs(ev.start) : ev.durMs ?? (ev.start.allDay ? 86400000 : 0);
    const starts = ev.rrule && !ev.recurrenceId ? occurrences(ev, fromMs, toMs) : [ev.start];
    for (const st of starts) {
      const ms = dtMs(st);
      if (ev.rrule && !ev.recurrenceId && (ev.exdates.has(String(ms)) || overrides.has(`${ev.uid}|${ms}`))) continue;
      const endMs = ms + durMs;
      if (endMs < fromMs || ms > toMs) continue;
      if (st.allDay) {
        const first = `${st.y}-${pad(st.m)}-${pad(st.d)}`;
        const lastMs = endMs - 86400000;
        const last = new Date(lastMs).toISOString().slice(0, 10);
        const multi = last > first;
        const day = first < fromDay && last >= fromDay ? fromDay : first; // a trip already under way shows on today
        if (day < fromDay || day > toDay) continue;
        const through = multi ? ` (through ${new Date(lastMs).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' })})` : '';
        out.push({ date: day, time: 'All day', title: `${ev.summary}${through}`, start: `${day}T00:00` });
      } else {
        const day = dayKeyNY(ms);
        if (day < fromDay || day > toDay) continue;
        const p = parts(ms, NY);
        out.push({ date: day, time: fmtRange(ms, durMs ? endMs : null), title: ev.summary, start: `${day}T${pad(p.h)}:${pad(p.mi)}` });
      }
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

// ---------- matching against the Notion calendar ----------
const words = (s: string) => s.toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').split(' ').filter((w) => w.length >= 3 && !['the', 'and', 'for', 'with', 'due', 'session', 'appointment'].includes(w));
/** True when a Notion calendar entry already covers this Apple event (same day, overlapping title words). */
export function sameEvent(appleTitle: string, notionTitle: string): boolean {
  const a = words(appleTitle), b = new Set(words(notionTitle));
  if (!a.length || !b.size) return appleTitle.trim().toLowerCase() === notionTitle.trim().toLowerCase();
  const hits = a.filter((w) => b.has(w) || [...b].some((x) => x.startsWith(w) || w.startsWith(x))).length;
  return hits / Math.min(a.length, b.size) >= 0.5;
}

/** Download every shared calendar in the secret. Keeps the last good copy if iCloud can't be reached. */
export async function readApple(urls: string, today: string, toDay: string, prev: AppleState | undefined, fetchImpl: typeof fetch = fetch): Promise<AppleState> {
  const list = urls.split(/[\s,]+/).map((u) => u.trim().replace(/^webcal:\/\//i, 'https://')).filter((u) => /^https:\/\//i.test(u));
  if (!list.length) return { items: prev?.items ?? [], readAt: prev?.readAt ?? null, error: 'The Apple Calendar link isn’t a valid webcal:// or https:// link' };
  try {
    const items: AppleEvent[] = [];
    const stats = { events: 0, repeating: 0, latest: null as string | null, upcoming: 0, nextStart: null as string | null, byMonth: {} as Record<string, number> };
    for (const u of list) {
      const res = await fetchImpl(u, { headers: { Accept: 'text/calendar' }, signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`Apple Calendar answered ${res.status}${res.status === 404 ? ' (the calendar may no longer be public)' : ''}`);
      const text = await res.text();
      if (!/BEGIN:VCALENDAR/.test(text)) throw new Error('Apple Calendar link didn’t return a calendar');
      items.push(...parseIcs(text, today, toDay));
      for (const ev of readEvents(text)) {
        stats.events++;
        if (ev.rrule) stats.repeating++;
        const d = `${ev.start.y}-${pad(ev.start.m)}-${pad(ev.start.d)}`;
        if (!stats.latest || d > stats.latest) stats.latest = d;
        stats.byMonth[d.slice(0, 7)] = (stats.byMonth[d.slice(0, 7)] ?? 0) + 1;
        if (d >= today) { stats.upcoming++; if (!stats.nextStart || d < stats.nextStart) stats.nextStart = d; }
      }
    }
    items.sort((a, b) => a.start.localeCompare(b.start));
    return { items, readAt: new Date().toISOString(), error: null, calendars: list.length, stats };
  } catch (e) {
    const msg = String((e as Error).message ?? e).replace(/https?:\/\/\S+/g, '[link]');
    return { items: prev?.items ?? [], readAt: prev?.readAt ?? null, error: msg, calendars: list.length };
  }
}
