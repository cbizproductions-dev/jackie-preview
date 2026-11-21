/**
 * Builds the "seed" snapshot from the Phase 0 captures in ./fixtures (git-ignored, never committed).
 * The seed lets the Console show real data before the read-only Notion integration is connected.
 * It is labelled "Build-time capture" in the app and is replaced by live reads once NOTION_TOKEN is set.
 * Run: npx vite-node scripts/build-seed.ts  → writes seed/seed.json
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { parseStudioBoard, parseCalendar } from '../src/worker/parsers';
import { assemble, type State } from '../src/worker/snapshot';

const F = (n: string) => readFileSync(`fixtures/${n}`, 'utf8');
const J = (n: string) => JSON.parse(F(n));
const url = (id: string) => `https://app.notion.com/p/${id}`;
const CAPTURED = '2026-11-21T16:00:00Z';
const extra = J('extra.json');

const weeks = J('weekly.json').map((w: any) => ({
  start: w.start, label: w.week, sessions: w.sessions, remote: w.remote, beats: w.beats, paidSessions: w.paidSessions, paidHours: w.paidHours,
  vibeHeld: w.vibeHeld, vibeNoShows: w.vibeNoShows, sheetStatus: w.status, confidence: w.confidence, goal: w.goal, notes: w.notes, url: w.url,
}));
const ledger = J('ledger.json').map((r: any[]) => ({ entry: r[0], year: r[1], month: r[2], lane: r[3], basis: r[4], amount: r[5], confidence: r[6], source: r[7], url: url(r[8]) }));
const bmi = J('bmi.json').map((r: any[]) => ({ statement: r[0], royalties: r[1], usTv: r[2], streaming: r[3], international: r[4], radio: r[5], newPlacements: r[6], plays: r[7], titlesEarning: r[8], countries: r[9], shows: r[10], networks: r[11], url: url(r[12]) }));
const goals = J('goals.json').map((g: any) => ({ goal: g.goal, target: g.target, current: g.current, unit: g.unit, period: g.period, origin: g.origin, asOf: g.asOf, notes: g.notes, url: url(g.id) }));
const insights = J('intel.json').map((r: any[]) => ({ id: r[0], title: r[1], kind: r[2], evidence: r[3], status: r[4], urgency: r[5], lanes: r[6], rank: r[7], whoseLane: r[8], source: r[9], observation: r[10], action: r[11], impact: r[12], url: url(r[0]) }));
const maintenance = J('maintlog.json').map((m: any) => ({ run: m.run, date: m.date, type: m.type, result: m.result, issues: m.issues, url: url(m.id) }));
const contracts = J('contracts.json').map((c: any) => ({
  agreement: (c.Agreement ?? '').replace(/\\_/g, '_'), counterparty: c.Counterparty ?? '', type: c.Type ?? null, signed: c['Signed status'] ?? null, exclusivity: null,
  exit: c['Exit status'] ?? null, flags: c.Flags ? JSON.parse(c.Flags) : [], nextAction: c['Next action'] ?? '', nextActionDate: c['date:Next action date:start'] ?? null,
  noticeBy: c['date:Last day to send notice:start'] ?? null, periodEnds: c['date:Current period ends:start'] ?? null, inferred: /inferred/i.test(c['Next action'] ?? ''), url: c.url ?? '',
}));
const photos = [
  ['Overview 1', 'DZn3u8lRlN-'], ['Overview 2', 'DXXAs4cEWzc'], ['Overview 3', 'DZ6Je-MkaWv'], ['Milestones 1', 'DfZ3PiCxNpq'], ['Milestones 2', 'Dbtx31jR3-7'],
].map(([name, code]) => ({ name, code, kind: 'Authentic photo of Kris', approved: true, useIn: ['Milestones'] }));

const sb = parseStudioBoard(F('studio-board.md'), '2026-11-21');
const le = extra.lastEdited as Record<string, string>;
const src = (id: string, data: Record<string, unknown>) => ({ lastEdited: le[id] ?? null, checkedAt: CAPTURED, readAt: CAPTURED, data, error: null });

const state: State = {
  sources: {
    scorecard: src('scorecard', { weeks }), ledger: src('ledger', { ledger }), bmi: src('bmi', { bmi }), goals: src('goals', { goals }),
    intel: src('intel', { insights }), maint: src('maint', { maintenance }), photos: src('photos', { photos }), briefs: src('briefs', { briefs: extra.briefs }),
    vault: src('vault', { contracts }), leases: src('leases', { leases: { rows: 0 } }),
    studio: src('studio', { studio: { synced: sb.synced, mixes: sb.mixes, clients: sb.clients, vibe: sb.vibe, deposits: sb.deposits, upcoming: sb.upcoming, syncChecks: sb.syncChecks, beatSales: sb.beatSales }, _weekLine: sb.weekLine, _openLine: sb.openLine }),
    calendar: src('calendar', { calendar: parseCalendar(F('calendar.md')) }), cash: src('cash', { cashMoves: extra.cashMoves }),
    strategy: src('strategy', { experimentTodos: extra.experimentTodos, futures: extra.futures }), runbook: src('runbook', { cc: J('command-center-data.json') }),
    system: src('system', { system: extra.system }), career: src('career', { career: extra.career }),
    royalty: src('royalty', { tunesat: { rows: [], note: 'Detected by TuneSat, not on a BMI statement yet — not income until a statement pays them.' } }),
    synctracker: src('synctracker', {}), scout: src('scout', {}),
  },
  members: extra.members,
  membersAt: CAPTURED,
};
const snap = assemble(state, new Date(CAPTURED), 'seed');
mkdirSync('seed', { recursive: true });
writeFileSync('seed/seed.json', JSON.stringify(snap));
writeFileSync('seed/state.json', JSON.stringify(state));
console.log(`seed: ${snap.weeks.length} weeks, ${snap.ledger.length} ledger rows, ${snap.insights.length} insights, ${snap.contracts.length} contracts, ${snap.issues.length} issues, state=${snap.state}`);
