/**
 * Defensive parsers for HQ pages that aren't databases.
 * Input is the page rendered to a light markdown (see notion.ts renderBlocks): "## Heading", "- bullet", "  - child",
 * "- [x] todo", "| a | b |" table rows, and fenced code blocks.
 * Every parser finds content by section heading keyword, never by position, and returns empty results on a miss.
 */
import { parseLooseDate, addDays } from '../shared/time';
import type { Mix, Client, VibeArtist, CalDay } from '../shared/schema';

export type Section = { heading: string; level: number; lines: string[] };

export function sections(md: string): Section[] {
  const out: Section[] = [{ heading: '', level: 0, lines: [] }];
  let inCode = false;
  for (const line of md.split('\n')) {
    if (line.startsWith('```')) inCode = !inCode;
    const h = !inCode && /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) out.push({ heading: h[2].trim(), level: h[1].length, lines: [] });
    else out[out.length - 1].lines.push(line);
  }
  return out;
}
/** Lines under the first heading whose text matches, including nested lower-level headings. */
export function section(md: string, match: RegExp): string[] | null {
  const ss = sections(md);
  const i = ss.findIndex((s) => match.test(s.heading));
  if (i < 0) return null;
  const lines = [...ss[i].lines];
  for (let j = i + 1; j < ss.length && ss[j].level > ss[i].level; j++) lines.push(`${'#'.repeat(ss[j].level)} ${ss[j].heading}`, ...ss[j].lines);
  return lines;
}
const bullets = (lines: string[] | null) => (lines ?? []).filter((l) => /^- /.test(l)).map((l) => l.slice(2).trim());
const money = (s: string) => {
  const m = /\$\s?([\d,]+(?:\.\d+)?)/.exec(s);
  return m ? Number(m[1].replace(/,/g, '')) : null;
};
const WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
const unescape = (s: string) => s.replace(/\\([$~_*<>\[\]])/g, '$1');

// ---------------- Studio Board — Muse mirror ----------------
export function parseStudioBoard(mdRaw: string, today: string) {
  const md = unescape(mdRaw);
  const year = Number(today.slice(0, 4));
  const syncedM = /Last synced:\s*([^.\n]+)/i.exec(md);
  const synced = syncedM ? parseLooseDate(syncedM[1], year) : null;

  // Money summary lines
  const moneyLines = bullets(section(md, /^money/i));
  let weekLine: { amount: number; start: string } | null = null;
  let openLine: { open: number; overdue: number } | null = null;
  const deposits: { who: string; amount: number; note: string }[] = [];
  const beatSales: { buyer: string; date: string | null; amount: number; items: number }[] = [];
  for (const l of moneyLines) {
    const wk = /^This week \((?:Mon\s+)?([A-Za-z]+\s+\d+)[^)]*\):\s*\$([\d,]+)/i.exec(l);
    if (wk) weekLine = { start: parseLooseDate(wk[1], year) ?? '', amount: Number(wk[2].replace(/,/g, '')) };
    const op = /^Open mixes:\s*(\d+)\s*\((\d+)\s*overdue\)/i.exec(l);
    if (op) openLine = { open: Number(op[1]), overdue: Number(op[2]) };
    const dep = /^(.+?)\s+—\s+\$([\d,]+)\s+deposit held(.*)$/i.exec(l);
    if (dep) deposits.push({ who: dep[1].trim(), amount: Number(dep[2].replace(/,/g, '')), note: dep[3].trim() });
    const bs = /^Beat sales:\s*(.+?)\s+—\s+(.+?):\s*(.*)$/i.exec(l);
    if (bs) {
      const items = /\btwo\b|\b2\b/i.test(bs[3].split(',')[0]) ? 2 : WORDS[(/(one|two|three|four)\s+(?:non-exclusive\s+)?leases?/i.exec(bs[3])?.[1] ?? 'one').toLowerCase()] ?? 1;
      beatSales.push({ buyer: bs[1].trim(), date: parseLooseDate(bs[2], year), amount: money(bs[3].replace(/\$\d+\/beat[^,;]*/g, '').replace(/\(\$[^)]*\)/g, '')) ?? money(bs[3]) ?? 0, items });
    }
  }

  // Mixes due (skip delivered lines and the rule line)
  const mixes: Mix[] = [];
  for (const l of bullets(section(md, /^mixes due/i))) {
    if (/^rule:/i.test(l) || /\bDELIVERED\b/.test(l)) continue;
    const mm = /^(.+?)\s+—\s+(.+)$/.exec(l);
    if (!mm) continue;
    const due = parseLooseDate(mm[2], year);
    const cm = /(~)?\s*(\d+|one|two|three|four|five)\s+(?:more\s+)?mix(?:es)?/i.exec(mm[2]);
    const n = cm ? (WORDS[cm[2].toLowerCase()] ?? Number(cm[2])) : 1;
    mixes.push({ client: mm[1].trim(), due, count: n || 1, countApprox: !!cm?.[1], note: mm[2].replace(/^[^—(]*?(\(|—)/, '$1').trim().slice(0, 220) });
  }

  // Clients
  const clients: Client[] = [];
  for (const l of bullets(section(md, /^clients/i))) {
    const name = l.split(' — ')[0].trim();
    if (!name || name === l) continue;
    const sessions = /(\d+)\s+paid sessions?/i.exec(l);
    const last = /last paid session\s+([^;]+)/i.exec(l);
    const total = /total paid\s+\$([\d,]+)/i.exec(l);
    const rate = /rate:\s*\$(\d+)\/hr/i.exec(l);
    const isBeat = /beat buyer/i.test(l);
    const unknownAmount = /amount unknown/i.test(l);
    clients.push({
      name,
      paidSessions: sessions ? Number(sessions[1]) : null,
      lastSession: last ? parseLooseDate(last[1], year) : null,
      totalPaid: unknownAmount ? null : total ? Number(total[1].replace(/,/g, '')) : null,
      rate: rate ? Number(rate[1]) : null,
      kind: isBeat ? 'beat' : 'session',
      note: l.split(';').slice(3).join(';').trim().slice(0, 160),
    });
  }

  // Vibe sessions
  const vibe: VibeArtist[] = [];
  for (const l of bullets(section(md, /^vibe sessions/i))) {
    const vm = /^(.+?)\s+—\s+vibe\s+([^—]+?)\s+—\s+(.+)$/i.exec(l);
    if (!vm) continue;
    const res = vm[3];
    const showed = !/no-show/i.test(res) && !/no-show/i.test(vm[2]);
    let outcome: VibeArtist['outcome'] = 'open';
    if (/no-show/i.test(res)) outcome = 'no_show';
    else if (/converted to paid/i.test(res)) outcome = 'converted';
    else if (/booked/i.test(res)) outcome = 'booked';
    else if (/closed|passed/i.test(res)) outcome = 'closed';
    const fp = /first paid session\s+([^)]+)\)/i.exec(res) ?? /same night,\s*([^)]+)\)/i.exec(res);
    const date = parseLooseDate(vm[2], year);
    vibe.push({ artist: vm[1].trim(), date, showed: outcome !== 'no_show' && showed, outcome, firstPaid: fp ? parseLooseDate(fp[1], year) : outcome === 'converted' && /same night/i.test(res) ? date : null, note: res.replace(/^(Converted to paid|Not converted yet|Not converted)\s*/i, '').replace(/^\(|\)$/g, '').slice(0, 160) });
  }

  // Upcoming scheduled sessions (scheduled ≠ revenue)
  const upcoming: { who: string; date: string; note: string }[] = [];
  for (const l of bullets(section(md, /^sessions/i))) {
    if (!/scheduled/i.test(l)) continue;
    const um = /^(.+?)\s+—\s+(.+)$/.exec(l);
    const d = um ? parseLooseDate(um[2], year) : null;
    if (um && d && d >= today) upcoming.push({ who: um[1].trim(), date: d, note: um[2].slice(0, 140) });
  }

  // Sync checks (a record of payments already on Maestro's dashboard — never added to income)
  const syncChecks: { date: string | null; company: string; amount: number }[] = [];
  for (const l of bullets(section(md, /^sync checks/i))) {
    const sm = /^(.+?)\s+—\s+(.+?)\s+—\s+\$([\d,]+)/.exec(l);
    if (sm) syncChecks.push({ date: parseLooseDate(sm[1], year), company: sm[2].trim(), amount: Number(sm[3].replace(/,/g, '')) });
  }
  // Remote-mix clients appear only in Closed; add them so the roster is complete (cash already in the ledger).
  for (const l of bullets(section(md, /^closed/i))) {
    const rm = /^(.+?)\s+—\s+remote mix delivered.*?\$([\d,]+)/i.exec(l);
    if (rm && !clients.some((c) => c.name === rm[1].trim())) clients.push({ name: rm[1].trim(), paidSessions: 0, lastSession: null, totalPaid: Number(rm[2].replace(/,/g, '')), rate: null, kind: 'remote', note: 'Remote mix/master' });
  }
  return { synced, weekLine, openLine, deposits, beatSales, mixes, clients, vibe, upcoming, syncChecks };
}

// ---------------- Rolling 60-Day Calendar ----------------
export function tagItem(title: string): CalDay['items'][number]['tags'] {
  const t = title.toLowerCase();
  const tags: CalDay['items'][number]['tags'] = [];
  if (/\bmix(es)?\b/.test(t)) tags.push('mix');
  if (/vibe/.test(t)) tags.push('vibe');
  if (/brief|mibe|gramoscope|wfh|mpr \d|round due|due \(mpr/.test(t)) tags.push('brief');
  if (/contract|notice|agreement|representation/.test(t)) tags.push('contract');
  if (/panel|speak|bootcamp|boot camp|conference|workshop|keynote/.test(t)) tags.push('speaking');
  if (/sync|session/.test(t) && !tags.includes('mix')) tags.push(/sync/.test(t) ? 'sync' : 'session');
  if (/holiday|thanksgiving|christmas|new year|martin luther/.test(t)) tags.push('holiday');
  if (!tags.length) tags.push('personal');
  return tags;
}
export function parseCalendar(mdRaw: string) {
  const md = unescape(mdRaw).replace(/<\/?b>/g, '');
  const refreshedM = /Refreshed:\s*([^—\n]+?)(?:\s+—|\n)/i.exec(md);
  const verifiedM = /last live verification against Apple Calendar:\s*([^.\n]+?)(?:\.|\n|$)/i.exec(md);
  const toIsoish = (s: string | undefined) => {
    if (!s) return null;
    const d = parseLooseDate(s);
    const t = /(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(s);
    if (!d) return null;
    if (!t) return d;
    let h = Number(t[1]) % 12;
    if (/pm/i.test(t[3])) h += 12;
    return `${d}T${String(h).padStart(2, '0')}:${t[2]}`;
  };
  const days: CalDay[] = [];
  for (const s of sections(md)) {
    const d = s.level === 2 ? parseLooseDate(s.heading) : null;
    if (!d) continue;
    const items = s.lines
      .filter((l) => /^- /.test(l) && !/^- No events/i.test(l))
      .map((l) => {
        const body = l.slice(2).trim();
        const tm = /^((?:All day(?:\s*\(tentative\))?)|(?:\d{1,2}:\d{2}(?:\s*[AP]M)?\s*[–-]\s*\d{1,2}:\d{2}\s*[AP]M))\s+—\s+(.*)$/i.exec(body);
        const title = (tm ? tm[2] : body).trim();
        return { time: tm ? tm[1].replace(/\s*\(tentative\)/i, '') : null, title, tags: tagItem(title), userReported: /user-reported/i.test(title), tentative: /tentative/i.test(body) };
      });
    days.push({ date: d, items });
  }
  return { refreshed: toIsoish(refreshedM?.[1]), lastVerified: toIsoish(verifiedM?.[1]), days };
}

// ---------------- generic helpers ----------------
export function todos(md: string, match?: RegExp): { text: string; checked: boolean }[] {
  const lines = match ? section(md, match) : md.split('\n');
  return (lines ?? []).map((l) => /^\s*- \[( |x)\]\s+(.*)$/i.exec(l)).filter(Boolean).map((m) => ({ checked: m![1].toLowerCase() === 'x', text: unescape(m![2].trim()) }));
}
export function codeJson(md: string, match: RegExp): Record<string, unknown> | null {
  const lines = section(md, match);
  if (!lines) return null;
  const txt = lines.join('\n');
  const m = /```[a-z]*\n([\s\S]*?)```/.exec(txt);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}
export function table(md: string, match: RegExp): string[][] {
  const lines = section(md, match) ?? [];
  return lines.filter((l) => /^\|.*\|$/.test(l.trim())).map((l) => l.trim().slice(1, -1).split('|').map((c) => unescape(c.trim())));
}
export function bulletList(md: string, match: RegExp): string[] {
  return bullets(section(md, match)).map(unescape);
}
/** Strategy Room "Three futures": lines starting with A ·, B ·, C ·. */
export function futures(md: string): { name: string; body: string }[] {
  const lines = section(md, /three futures/i) ?? [];
  const out: { name: string; body: string }[] = [];
  for (const l of lines) {
    const h = /^(?:- )?\s*([ABC]) · (.+)$/.exec(l.trim());
    if (h) out.push({ name: `${h[1]} · ${h[2].trim()}`, body: '' });
    else if (out.length && l.trim()) out[out.length - 1].body += (out[out.length - 1].body ? '\n' : '') + unescape(l.trim());
  }
  return out;
}
/** Royalty Dashboard TuneSat section table rows. */
export function tunesatRows(md: string) {
  const rows = table(md, /tunesat/i);
  return rows.slice(1, 13).map((r) => ({ title: r[0] ?? '', show: r[1] ?? '', detail: r.slice(2).join(' · ') }));
}
export { addDays };
