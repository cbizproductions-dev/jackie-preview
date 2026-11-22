import { z } from 'zod';

export const Status = z.enum(['ok', 'in_progress', 'missing', 'stale', 'conflict']);
export type Status = z.infer<typeof Status>;

/** Every number in the app is one of these. Missing data has value null and status "missing" — never 0. */
export const Metric = z.object({
  value: z.number().nullable(),
  unit: z.enum(['$', '%', 'count', 'days', '$/hr', 'hrs', 'ratio']),
  period: z.string(),
  source: z.string(),
  asOf: z.string(),
  status: Status,
  note: z.string().default(''),
});
export type Metric = z.infer<typeof Metric>;

export const SourceState = z.object({
  id: z.string(),
  name: z.string(),
  owner: z.string(),
  kind: z.enum(['database', 'page']),
  url: z.string(),
  lastEdited: z.string().nullable(),
  readAt: z.string().nullable(),
  state: z.enum(['fresh', 'stale', 'failed', 'not_connected']),
  note: z.string().default(''),
});
export type SourceState = z.infer<typeof SourceState>;

export const DataIssue = z.object({
  title: z.string(),
  sources: z.array(z.string()),
  detail: z.string(),
  url: z.string().optional(),
  origin: z.enum(['intelligence_feed', 'console']),
});
export type DataIssue = z.infer<typeof DataIssue>;

export const Week = z.object({
  start: z.string(),
  label: z.string(),
  sessions: z.number().nullable(),
  remote: z.number().nullable(),
  beats: z.number().nullable(),
  paidSessions: z.number().nullable(),
  paidHours: z.number().nullable(),
  vibeHeld: z.number().nullable(),
  vibeNoShows: z.number().nullable(),
  sheetStatus: z.string(),
  confidence: z.string(),
  goal: z.number().nullable(),
  notes: z.string(),
  url: z.string(),
});
export type Week = z.infer<typeof Week>;

export const LedgerRow = z.object({
  entry: z.string(),
  year: z.string(),
  month: z.string().nullable(),
  lane: z.string(),
  basis: z.string(),
  amount: z.number().nullable(),
  confidence: z.string(),
  source: z.string(),
  url: z.string(),
});
export type LedgerRow = z.infer<typeof LedgerRow>;

export const BmiStatement = z.object({
  statement: z.string(), // "2026 Q2"
  royalties: z.number().nullable(),
  usTv: z.number().nullable(),
  streaming: z.number().nullable(),
  international: z.number().nullable(),
  radio: z.number().nullable(),
  newPlacements: z.number().nullable(),
  plays: z.number().nullable(),
  titlesEarning: z.number().nullable(),
  countries: z.number().nullable(),
  shows: z.number().nullable(),
  networks: z.number().nullable(),
  url: z.string(),
});
export type BmiStatement = z.infer<typeof BmiStatement>;

export const Goal = z.object({
  goal: z.string(),
  target: z.number().nullable(),
  current: z.number().nullable(),
  unit: z.string(),
  period: z.string(),
  origin: z.string(),
  asOf: z.string().nullable(),
  notes: z.string(),
  url: z.string(),
});
export type Goal = z.infer<typeof Goal>;

export const Insight = z.object({
  id: z.string(),
  title: z.string(),
  kind: z.string(),
  evidence: z.string().nullable(),
  status: z.string(),
  urgency: z.string().nullable(),
  lanes: z.array(z.string()),
  rank: z.number().nullable(),
  whoseLane: z.string().nullable(),
  source: z.string(),
  observation: z.string(),
  action: z.string(),
  impact: z.string().nullable(),
  url: z.string(),
});
export type Insight = z.infer<typeof Insight>;

export const Mix = z.object({
  client: z.string(),
  due: z.string().nullable(),
  count: z.number(),
  countApprox: z.boolean(),
  note: z.string(),
});
export type Mix = z.infer<typeof Mix>;

export const Client = z.object({
  name: z.string(),
  paidSessions: z.number().nullable(),
  lastSession: z.string().nullable(),
  totalPaid: z.number().nullable(),
  rate: z.number().nullable(),
  kind: z.enum(['session', 'beat', 'remote']),
  note: z.string(),
});
export type Client = z.infer<typeof Client>;

export const VibeArtist = z.object({
  artist: z.string(),
  date: z.string().nullable(),
  showed: z.boolean(),
  outcome: z.enum(['converted', 'booked', 'open', 'closed', 'no_show']),
  firstPaid: z.string().nullable(),
  note: z.string(),
});
export type VibeArtist = z.infer<typeof VibeArtist>;

export const CalItem = z.object({
  time: z.string().nullable(),
  title: z.string(),
  tags: z.array(z.enum(['session', 'vibe', 'mix', 'brief', 'contract', 'speaking', 'sync', 'holiday', 'personal'])),
  userReported: z.boolean(),
  tentative: z.boolean(),
  /** Came straight from Kris's Apple Calendar feed; not on the Notion calendar yet. */
  apple: z.boolean().optional(),
});
export const CalDay = z.object({ date: z.string(), items: z.array(CalItem) });
export type CalDay = z.infer<typeof CalDay>;

export const Brief = z.object({
  brief: z.string(),
  company: z.string().nullable(),
  status: z.string().nullable(),
  type: z.string().nullable(),
  code: z.string(),
  due: z.string().nullable(),
  round2: z.string().nullable(),
  round2End: z.string().nullable(),
  deliverables: z.string(),
  notes: z.string(),
  url: z.string(),
});
export type Brief = z.infer<typeof Brief>;

export const Contract = z.object({
  agreement: z.string(),
  counterparty: z.string(),
  type: z.string().nullable(),
  signed: z.string().nullable(),
  exclusivity: z.string().nullable(),
  exit: z.string().nullable(),
  flags: z.array(z.string()),
  nextAction: z.string(),
  nextActionDate: z.string().nullable(),
  noticeBy: z.string().nullable(),
  periodEnds: z.string().nullable(),
  inferred: z.boolean(),
  url: z.string(),
});
export type Contract = z.infer<typeof Contract>;

export const Todo = z.object({ text: z.string(), checked: z.boolean() });
export const Member = z.object({
  name: z.string(),
  role: z.string(),
  roleSource: z.string(),
  owns: z.array(z.string()),
  logName: z.string(),
  logUrl: z.string(),
  lastActive: z.string().nullable(),
});
export type Member = z.infer<typeof Member>;

export const Photo = z.object({ name: z.string(), code: z.string(), kind: z.string(), approved: z.boolean(), useIn: z.array(z.string()) });

/** The Command Center's own computed data.json (from the runbook page). Kept loose: it's someone else's format. */
export const CommandCenterData = z.record(z.any());

export const Snapshot = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string(),
  today: z.string(),
  mode: z.enum(['live', 'seed']),
  state: z.enum(['ok', 'partial']),
  failed: z.array(z.string()),
  sources: z.array(SourceState),
  issues: z.array(DataIssue),
  weeks: z.array(Week),
  ledger: z.array(LedgerRow),
  bmi: z.array(BmiStatement),
  goals: z.array(Goal),
  insights: z.array(Insight),
  maintenance: z.array(z.object({ run: z.string(), date: z.string().nullable(), type: z.string(), result: z.string(), issues: z.string(), url: z.string() })),
  photos: z.array(Photo),
  studio: z.object({
    synced: z.string().nullable(),
    mixes: z.array(Mix),
    clients: z.array(Client),
    vibe: z.array(VibeArtist),
    deposits: z.array(z.object({ who: z.string(), amount: z.number(), note: z.string() })),
    upcoming: z.array(z.object({ who: z.string(), date: z.string(), note: z.string() })),
    syncChecks: z.array(z.object({ date: z.string().nullable(), company: z.string(), amount: z.number() })),
    beatSales: z.array(z.object({ buyer: z.string(), date: z.string().nullable(), amount: z.number(), items: z.number() })),
    deliveries: z.array(z.object({ client: z.string(), date: z.string().nullable(), hours: z.number().nullable(), due: z.string().nullable() })).default([]),
  }),
  calendar: z.object({ refreshed: z.string().nullable(), lastVerified: z.string().nullable(), days: z.array(CalDay) }),
  briefs: z.array(Brief),
  contracts: z.array(Contract),
  leases: z.object({ rows: z.number().nullable() }),
  cashMoves: z.array(Todo),
  experimentTodos: z.array(Todo),
  members: z.array(Member),
  tunesat: z.object({ rows: z.array(z.object({ title: z.string(), show: z.string(), detail: z.string() })), note: z.string() }),
  system: z.object({ dictionary: z.array(z.array(z.string())), rules: z.array(z.string()), limitations: z.array(z.string()) }),
  career: z.object({ figures: z.array(z.array(z.string())), timeline: z.array(z.array(z.string())), verifiedCredits: z.array(z.string()), reportedCredits: z.array(z.string()), inMotion: z.array(z.string()) }),
  futures: z.array(z.object({ name: z.string(), body: z.string() })),
  /** Brandon's "Brand Presence" database, if it exists in HQ (found by title). */
  brand: z.object({ found: z.boolean(), url: z.string(), rows: z.array(z.object({ item: z.string(), status: z.string(), key: z.string(), link: z.string(), lastChecked: z.string().nullable(), url: z.string() })) }).default({ found: false, url: '', rows: [] }),
  /** Beacon's "Speaking & Funding Leads" database, if it exists in HQ (found by title). */
  leads: z.object({ found: z.boolean(), url: z.string(), rows: z.array(z.object({ lead: z.string(), type: z.string(), date: z.string().nullable(), location: z.string(), status: z.string(), link: z.string(), url: z.string() })) }).default({ found: false, url: '', rows: [] }),
  /** Screen-print header art (traced from Kris's own photos), read from the runbook page. */
  art: z.record(z.object({ w: z.number(), h: z.number(), paths: z.string() })).default({}),
  cc: CommandCenterData,
});
export type Snapshot = z.infer<typeof Snapshot>;
