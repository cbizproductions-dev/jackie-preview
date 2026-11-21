/**
 * The Phase 0 source map in code. Each source knows how to read itself from HQ (read-only) and which part of the
 * snapshot it fills. See SOURCES.md for the human version.
 */
import { NotionReader, prop, renderBlocks } from './notion';
import * as P from './parsers';
import type { Snapshot } from '../shared/schema';

export type SourceDef = {
  id: string;
  name: string;
  owner: string;
  kind: 'database' | 'page';
  notionId: string;
  depth?: number;
  read: (r: NotionReader, today: string) => Promise<{ data: Partial<Snapshot> & Record<string, unknown>; lastEdited: string | null }>;
};
const url = (id: string) => `https://app.notion.com/p/${id.replace(/-/g, '')}`;
const P_ = (row: any) => row.properties ?? {};

const db = (id: string, name: string, owner: string, notionId: string, map: (rows: any[]) => Partial<Snapshot> & Record<string, unknown>): SourceDef => ({
  id, name, owner, kind: 'database', notionId,
  read: async (r) => {
    const { rows, lastEdited } = await r.rows(notionId);
    return { data: map(rows), lastEdited };
  },
});
const page = (id: string, name: string, owner: string, notionId: string, depth: number, map: (md: string, today: string) => Partial<Snapshot> & Record<string, unknown>): SourceDef => ({
  id, name, owner, kind: 'page', notionId, depth,
  read: async (r, today) => {
    const { md, lastEdited } = await r.pageMarkdown(notionId, depth);
    return { data: map(md, today), lastEdited };
  },
});

export const SOURCES: SourceDef[] = [
  db('scorecard', 'Weekly Scorecard', 'Claude', '41e8b67fa84e81989b1fe343221cde6a', (rows) => ({
    weeks: rows.map((x) => {
      const p = P_(x);
      return {
        start: prop.date(p['Week start']) ?? '', label: prop.text(p['Week']),
        sessions: prop.num(p['Sessions $']), remote: prop.num(p['Remote mix $']), beats: prop.num(p['Beat sales $']),
        paidSessions: prop.num(p['Paid sessions']), paidHours: prop.num(p['Paid hours']), vibeHeld: prop.num(p['Vibe sessions held']), vibeNoShows: prop.num(p['Vibe no-shows']),
        sheetStatus: prop.select(p['Status']) ?? '', confidence: prop.select(p['Confidence']) ?? '', goal: prop.num(p['Goal $']), notes: prop.text(p['Notes']), url: url(x.id),
      };
    }).filter((w) => w.start).sort((a, b) => a.start.localeCompare(b.start)),
  })),
  db('ledger', 'Income Ledger', 'Claude', '41e8b67fa84e8129b391da63aeaa8972', (rows) => ({
    ledger: rows.map((x) => {
      const p = P_(x);
      return { entry: prop.text(p['Entry']), year: prop.select(p['Year']) ?? '', month: prop.select(p['Month']), lane: prop.select(p['Lane']) ?? '', basis: prop.select(p['Basis']) ?? '', amount: prop.num(p['Amount']), confidence: prop.select(p['Confidence']) ?? '', source: prop.text(p['Source']), url: url(x.id) };
    }),
  })),
  db('bmi', 'BMI Statements', 'Claude (mirror of Maestro)', '41e8b67fa84e8145b9eec92c5c4c6f3c', (rows) => ({
    bmi: rows.map((x) => {
      const p = P_(x);
      const n = (k: string) => prop.num(p[k]);
      return { statement: prop.text(p['Statement']), royalties: n('Royalties'), usTv: n('US broadcast & cable TV'), streaming: n('Streaming & digital'), international: n('International'), radio: n('Radio & other'), newPlacements: n('New placements'), plays: n('Plays'), titlesEarning: n('Titles earning'), countries: n('Countries'), shows: n('Shows & programs'), networks: n('Networks'), url: url(x.id) };
    }),
  })),
  db('goals', 'Goals & Milestones', 'Claude', '41e8b67fa84e818b8766d7638ea3be2d', (rows) => ({
    goals: rows.map((x) => {
      const p = P_(x);
      return { goal: prop.text(p['Goal']), target: prop.num(p['Target']), current: prop.num(p['Current']), unit: prop.select(p['Unit']) ?? '', period: prop.select(p['Period']) ?? '', origin: prop.select(p['Origin']) ?? '', asOf: prop.date(p['As of']), notes: prop.text(p['Notes']), url: url(x.id) };
    }),
  })),
  db('intel', 'Intelligence Feed', 'Claude', '41e8b67fa84e812cbfbbd875db88e23e', (rows) => ({
    insights: rows.map((x) => {
      const p = P_(x);
      return { id: x.id, title: prop.text(p['Insight']), kind: prop.select(p['Kind']) ?? '', evidence: prop.select(p['Evidence']), status: prop.select(p['Status']) ?? '', urgency: prop.select(p['Urgency']), lanes: prop.multi(p['Lane']), rank: prop.num(p['Rank']), whoseLane: prop.select(p['Whose lane']), source: prop.text(p['Source']), observation: prop.text(p['Observation']), action: prop.text(p['Action']), impact: prop.select(p['Impact']), url: url(x.id) };
    }),
  })),
  db('maint', 'Maintenance Log', 'Claude', '41e8b67fa84e81a4aa3ade6a1840e3db', (rows) => ({
    maintenance: rows.map((x) => {
      const p = P_(x);
      return { run: prop.text(p['Run']), date: prop.date(p['Date']), type: prop.select(p['Type']) ?? '', result: prop.select(p['Result']) ?? '', issues: prop.text(p['Issues']), url: url(x.id), created: x.created_time as string };
    }).sort((a, b) => b.created.localeCompare(a.created)).slice(0, 12).map(({ created, ...r }) => r),
  })),
  db('photos', 'Photo Library', 'Claude', '41e8b67fa84e81e4876fc8e2bdc1874e', (rows) => ({
    photos: rows.map((x) => {
      const p = P_(x);
      const notes = prop.text(p['Notes']);
      const code = /instagram\.com\/p\/([\w-]+)/.exec(notes)?.[1] ?? /\b(D[\w-]{9,11})\b/.exec(notes + ' ' + prop.text(p['Photo name']))?.[1] ?? '';
      return { name: prop.text(p['Photo name']), code, kind: prop.select(p['Kind']) ?? '', approved: prop.check(p['Approved by Kris']), useIn: prop.multi(p['Use in']) };
    }),
  })),
  db('briefs', 'Brief Board', 'Maestro', '41b8b67fa84e81cebdcecf359661e777', (rows) => ({
    briefs: rows.map((x) => {
      const p = P_(x);
      return { brief: prop.text(p['Brief']), company: prop.select(p['Company']), status: prop.select(p['Status']), type: prop.select(p['Type']), code: prop.text(p['Code']), due: prop.date(p['Due'])?.slice(0, 10) ?? null, round2: prop.date(p['Round 2 due']), round2End: prop.dateEnd(p['Round 2 due']) ?? prop.date(p['Round 2 due']), deliverables: prop.text(p['Deliverable count']), notes: prop.text(p['Notes']).slice(0, 400), url: url(x.id) };
    }),
  })),
  db('vault', 'Contract Vault', 'Maestro', 'ee36a866c6f74c14ab243f5377cff8bc', (rows) => ({
    contracts: rows.map((x) => {
      const p = P_(x);
      const next = prop.text(p['Next action']);
      return { agreement: prop.text(p['Agreement']), counterparty: prop.text(p['Counterparty']), type: prop.select(p['Type']), signed: prop.select(p['Signed status']), exclusivity: prop.select(p['Exclusivity']), exit: prop.select(p['Exit status']), flags: prop.multi(p['Flags']), nextAction: next, nextActionDate: prop.date(p['Next action date']), noticeBy: prop.date(p['Last day to send notice']), periodEnds: prop.date(p['Current period ends']), inferred: /inferred/i.test(next + prop.text(p['Notes'])), url: url(x.id) };
    }),
  })),
  db('leases', 'Beat Leases & Registrations', 'Maestro', '058a6cd1bf004ec88c9b3204f9050837', (rows) => ({ leases: { rows: rows.length } })),
  page('studio', 'Studio Board — Muse mirror', 'Muse', '4118b67fa84e815d87f9da794bb520d8', 2, (md, today) => {
    const sb = P.parseStudioBoard(md, today);
    return { studio: { synced: sb.synced, mixes: sb.mixes, clients: sb.clients, vibe: sb.vibe, deposits: sb.deposits, upcoming: sb.upcoming, syncChecks: sb.syncChecks, beatSales: sb.beatSales }, _weekLine: sb.weekLine, _openLine: sb.openLine };
  }),
  page('calendar', 'Rolling 60-Day Calendar', 'Muse', '4178b67fa84e81d5a551c62aa4d62c46', 1, (md) => ({ calendar: P.parseCalendar(md) })),
  page('cash', 'Cash Flow Radar', 'Claude', '41e8b67fa84e818283ffdb9b4b8af4e4', 1, (md) => ({ cashMoves: P.todos(md, /money moves/i) })),
  page('strategy', 'Strategy Room', 'Claude', '41e8b67fa84e8128a28aced006840039', 4, (md) => ({ experimentTodos: P.todos(md), futures: P.futures(md) })),
  page('runbook', 'Pulse generator & runbook (data.json)', 'Claude', '41e8b67fa84e816fa932f429411bd3ed', 1, (md) => ({ cc: P.codeJson(md, /^data\.json/i) ?? {} })),
  page('system', 'System, Sources & Maintenance', 'Claude', '41e8b67fa84e812b805de57f67067498', 3, (md) => ({
    system: { dictionary: P.table(md, /metric dictionary|every headline metric/i), rules: P.bulletList(md, /counting rules/i), limitations: P.bulletList(md, /known limitations/i) },
    _sourceMap: P.table(md, /source map/i),
  })),
  page('career', 'Milestones, Discoveries & Career', 'Claude', '41e8b67fa84e8109bbc9f7bbb64101d2', 4, (md) => {
    const lines = md.split('\n');
    const listAfter = (re: RegExp) => {
      const i = lines.findIndex((l) => re.test(l));
      if (i < 0) return [];
      const out: string[] = [];
      for (let j = i + 1; j < lines.length && out.length < 12; j++) {
        const l = lines[j].trim();
        if (/^- /.test(l)) out.push(l.slice(2));
        else if (out.length && l) break;
      }
      return out;
    };
    return {
      career: {
        figures: P.table(md, /career figures/i),
        timeline: P.table(md, /full timeline/i),
        verifiedCredits: listAfter(/verified credits/i),
        reportedCredits: lines.filter((l) => /user-reported credits/i.test(l)).map((l) => l.trim()),
        inMotion: listAfter(/in motion/i),
      },
    };
  }),
  // The dashboard is very large; read only the top level, then just the table under the TuneSat heading (≤ ~6 calls).
  {
    id: 'royalty', name: 'C-Biz Royalty / Placement Dashboard', owner: 'Maestro', kind: 'page', notionId: '4178b67fa84e815db947ef2baf0e563a',
    read: async (r) => {
      const page = await r.page('4178b67fa84e815db947ef2baf0e563a');
      const top = await r.children('4178b67fa84e815db947ef2baf0e563a', 0, 0);
      const text = (b: any) => (b[b.type]?.rich_text ?? []).map((t: any) => t.plain_text).join('');
      const h = top.findIndex((b) => /^heading_/.test(b.type) && /tunesat/i.test(text(b)));
      let md = '';
      if (h >= 0) {
        const head = top[h];
        // Table may sit right after the heading, or inside a toggle heading.
        const candidates = head.has_children ? await r.children(head.id, 0, 0) : top.slice(h + 1, h + 4);
        const tbl = candidates.find((b) => b.type === 'table');
        if (tbl) {
          tbl.children = await r.children(tbl.id, 0, 0);
          md = renderBlocks([{ ...head, has_children: false }, tbl]);
        }
      }
      return { data: { tunesat: { rows: P.tunesatRows(md), note: 'Detected by TuneSat, not on a BMI statement yet — not income until a statement pays them.' } }, lastEdited: page.last_edited_time ?? null };
    },
  },
  page('synctracker', 'Sync Tracker', 'Maestro + Claude', '40a8b67fa84e817789e6e7e10e23edd1', 0, () => ({})),
  page('scout', 'Scout Trackers', 'Muse / Maestro', '4088b67fa84e81b4af51c5e44d03c171', 0, () => ({})),
];

/** Cabinet members who touch music. Roles are read from each member's own HQ section page at runtime. */
export const CABINET = [
  { name: 'Claude', logName: 'Claude Daily Updates', log: '4008b67fa84e8131be8fc031b01df058', section: '3fe8b67fa84e8108a731db641473c228', match: /claude/i },
  { name: 'Muse', logName: 'MUSE — Daily Updates', log: '4008b67fa84e813fb439ca1ae2f45a44', section: '3fe8b67fa84e812c9954dfdfd9a434d0', match: /muse/i },
  { name: 'Maestro (Grok Bot · Council)', logName: 'GROK BOT — Daily Updates', log: '4008b67fa84e811bb288e86cc67ba06d', section: '40d8b67fa84e814dbc79c3784bb92f9b', match: /maestro/i },
  { name: 'Daniel (Grok Bot · Council)', logName: 'GROK BOT — Daily Updates', log: '4008b67fa84e811bb288e86cc67ba06d', section: '3fe8b67fa84e814c85c2cf25e34e3d56', match: /daniel/i },
  { name: 'Beacon (Grok Bot · Council)', logName: 'GROK BOT — Daily Updates', log: '4008b67fa84e811bb288e86cc67ba06d', section: null, match: /beacon/i },
  { name: 'ChatGPT', logName: 'CHAT GPT — Daily Updates', log: '4008b67fa84e81df8623f3c82d23db8b', section: '3fe8b67fa84e8108982ad63bf1c3fb94', match: /chat ?gpt/i },
] as const;

export async function readCabinet(r: NotionReader, sourceMap: string[][]): Promise<Snapshot['members']> {
  const logs = new Map<string, string | null>();
  for (const c of CABINET) if (!logs.has(c.log)) logs.set(c.log, (await r.page(c.log)).last_edited_time ?? null);
  const out: Snapshot['members'] = [];
  for (const c of CABINET) {
    let role = 'No role description on its own HQ page';
    let roleSource = 'HQ';
    if (c.section) {
      try {
        const kids = await r.children(c.section, 0, 0);
        const first = kids.map((b) => (b[b.type]?.rich_text ?? []).map((t: any) => t.plain_text).join('')).find((t) => t.trim().length > 20 && !/^\s*📌|daily updates|ongoing log|^\s*start here/i.test(t));
        if (first) { role = first.trim().slice(0, 180); roleSource = `${c.name.split(' ')[0]} section page`; }
      } catch { /* keep default */ }
    }
    const owns = sourceMap.filter((row) => row.length >= 3 && c.match.test(row[2] ?? '')).map((row) => row[1].replace(/\s*\(.*\)$/, ''));
    out.push({ name: c.name, role, roleSource, owns, logName: c.logName, logUrl: url(c.log), lastActive: logs.get(c.log) ?? null });
  }
  return out;
}
