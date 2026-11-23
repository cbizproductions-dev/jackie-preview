/**
 * Sync trajectory (Nov 23): money by month (upfront fees + BMI by statement), briefs delivered and outreach sent.
 * Missing data is a gap (null), never $0. No smoothing.
 */
import type { Snapshot } from './schema';
import { addDays, weekStart } from './time';

const DELIVERED = ['submitted', 'passed', 'contract', 'paid/placed', 'paid', 'placed'];
const STATEMENT_LAG_MONTHS = 5; // BMI pays a quarter about 5 months after it ends (HQ: "2026 Q3 expected around Feb 2027").

export function monthKeys(today: string, n = 12): string[] {
  const [y, m] = today.split('-').map(Number);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(new Date(Date.UTC(y, m - 1 - i, 1)).toISOString().slice(0, 7));
  return out;
}
/** "2026 Q2" → the month BMI is expected to pay it ("2026-11"). Approximate. */
export function statementMonth(statement: string): string | null {
  const m = /(\d{4})\s*Q([1-4])/i.exec(statement);
  if (!m) return null;
  const endMonth = Number(m[2]) * 3; // Mar, Jun, Sep, Dec
  const d = new Date(Date.UTC(Number(m[1]), endMonth - 1 + STATEMENT_LAG_MONTHS, 1));
  return d.toISOString().slice(0, 7);
}

export function syncMonthly(s: Snapshot) {
  const months = monthKeys(s.today);
  // Upfront sync fees have months in the Income Ledger only from 2026 on; earlier months are a gap.
  const monthly = s.ledger.filter((r) => r.month && /sync/i.test(r.lane));
  const firstMonthly = s.ledger.filter((r) => r.month).map((r) => r.month!).sort()[0] ?? null;
  const contacts = s.syncContacts ?? [];
  return months.map((mk) => {
    const fees = firstMonthly && mk >= firstMonthly ? monthly.filter((r) => r.month === mk).reduce((a, r) => a + (r.amount ?? 0), 0) : null;
    const bmiRows = s.bmi.filter((b) => statementMonth(b.statement) === mk && b.royalties != null);
    const bmi = bmiRows.length ? bmiRows.reduce((a, b) => a + (b.royalties ?? 0), 0) : 0;
    const briefs = s.briefs.filter((b) => b.due?.slice(0, 7) === mk && DELIVERED.includes((b.status ?? '').toLowerCase())).length;
    const outreach = contacts.length ? contacts.filter((c) => c.lastContacted?.slice(0, 7) === mk).length : null;
    return { key: mk, fees, bmi, bmiStatements: bmiRows.map((b) => b.statement), briefs, outreach };
  });
}

export function syncWeekly(s: Snapshot, n = 12) {
  const ws = weekStart(s.today);
  const contacts = s.syncContacts ?? [];
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const start = addDays(ws, -7 * i);
    const end = addDays(start, 6);
    const inWeek = (d: string | null | undefined) => !!d && d >= start && d <= end;
    out.push({
      key: start,
      briefs: s.briefs.filter((b) => inWeek(b.due) && DELIVERED.includes((b.status ?? '').toLowerCase())).length,
      outreach: contacts.length ? contacts.filter((c) => inWeek(c.lastContacted)).length : null,
    });
  }
  return out;
}
