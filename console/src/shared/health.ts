/** The ten health lights. Thresholds copied from the Strategy Room ("How the ten health lights are set"). No blended score. */
import { addDays, daysBetween } from './time';
import { concentration, mixQueue, vibeConversion, weekCash, weekStatus, bmiChange, catalogEarning } from './rules';
import type { Snapshot } from './schema';

export type Light = 'green' | 'amber' | 'red' | 'none';
export type HealthLight = { area: string; light: Light; today: string; rule: { green: string; amber: string; red: string }; note: string; source?: 'command_center' | 'dashboard'; computed?: Light; computedToday?: string };

export const RULES: Record<string, { green: string; amber: string; red: string }> = {
  'Studio revenue': { green: 'Goal hit in 2 of last 3 weeks', amber: '1 of 3', red: '0 of 3' },
  'Delivery capacity': { green: '0 overdue mixes', amber: '1–2 overdue, or 6+ open', red: '2+ overdue and 6+ due within a week' },
  'Client concentration': { green: 'Top 2 < 40% of session $', amber: '40–65%', red: '> 65%' },
  'Vibe conversion': { green: '≥ 30% of artists who showed', amber: '15–30%', red: '< 15%' },
  'Beat lane': { green: 'A sale in each of the last 4 weeks', amber: 'A sale in the last 30 days', red: 'None in 30 days' },
  'Sync pipeline': { green: 'Active committed briefs or WFH in progress', amber: 'None active, submissions pending', red: 'Nothing active or pending' },
  Royalties: { green: 'Latest statement ≥ same quarter last year', amber: 'Down 0–25% YoY', red: 'Down > 25% YoY' },
  'Catalog earning': { green: '≥ 15% of works have paid', amber: '7–15%', red: '< 7%' },
  Contracts: { green: 'No decision due in 90 days', amber: 'Decision due in 90 days', red: 'Deadline in 30 days, undecided' },
  'Data freshness': { green: 'All sources updated within 2 days', amber: 'One source stale or a known gap', red: 'Two or more stale' },
};
const pct = (x: number) => `${Math.round(x * 100)}%`;
const L = (area: string, light: Light, today: string, note = ''): HealthLight => ({ area, light, today, rule: RULES[area], note });

export function studioRevenueLight(weeks: Snapshot['weeks'], goal: number | null, today: string): HealthLight {
  const a = 'Studio revenue';
  if (!goal) return L(a, 'none', 'No data', 'Weekly goal not on file');
  const sorted = [...weeks].sort((x, y) => x.start.localeCompare(y.start));
  const cur = sorted[sorted.length - 1];
  // The in-progress week counts only once it has already reached the goal (cash received can't go down); otherwise complete weeks only.
  const curCounts = !!cur && weekStatus(cur.start, today) !== 'complete' && (weekCash(cur) ?? 0) >= goal;
  const pool = sorted.filter((w) => weekStatus(w.start, today) === 'complete' || (curCounts && w === cur));
  const last3 = pool.slice(-3);
  if (last3.length < 3) return L(a, 'none', 'No data', 'Fewer than 3 weeks on file');
  const hits = last3.filter((w) => (weekCash(w) ?? 0) >= goal).length;
  const light: Light = hits >= 2 ? 'green' : hits === 1 ? 'amber' : 'red';
  return L(a, light, `${hits} of last 3 weeks at $${goal}`, curCounts ? 'Includes this week, already past the goal' : 'Complete weeks only');
}

export function deliveryLight(mixes: Snapshot['studio']['mixes'], today: string): HealthLight {
  const q = mixQueue(mixes, today);
  // Threshold "6+ due within a week" = overdue + due in the next 7 days (both must be delivered this week).
  let light: Light = 'green';
  if (q.overdue >= 2 && q.overdue + q.dueWithinWeek >= 6) light = 'red';
  else if (q.overdue >= 1 || q.open >= 6) light = 'amber';
  return L('Delivery capacity', light, `${q.open} open · ${q.overdue} overdue · ${q.dueWithinWeek} due in the next 7 days`);
}

export function concentrationLight(clients: Snapshot['studio']['clients']): HealthLight {
  const c = concentration(clients);
  if (c.share == null) return L('Client concentration', 'none', 'No data');
  const light: Light = c.share < 0.4 ? 'green' : c.share <= 0.65 ? 'amber' : 'red';
  return L('Client concentration', light, `Top 2 = ${pct(c.share)} of session $`, c.names.join(' + '));
}

export function vibeLight(vibe: Snapshot['studio']['vibe']): HealthLight {
  const v = vibeConversion(vibe);
  if (v.rate == null) return L('Vibe conversion', 'none', 'No data');
  const light: Light = v.rate >= 0.3 ? 'green' : v.rate >= 0.15 ? 'amber' : 'red';
  return L('Vibe conversion', light, `${pct(v.rate)} (${v.paid} of ${v.showed})`);
}

export function beatLight(weeks: Snapshot['weeks'], sales: Snapshot['studio']['beatSales'], today: string): HealthLight {
  const a = 'Beat lane';
  const last4 = [...weeks].sort((x, y) => x.start.localeCompare(y.start)).slice(-4);
  if (last4.length === 4 && last4.every((w) => (w.beats ?? 0) > 0)) return L(a, 'green', 'A sale every week for 4 weeks');
  const from = addDays(today, -29);
  const recent = sales.filter((s) => s.date && s.date >= from && s.date <= today);
  if (recent.length) return L(a, 'amber', `${recent.length} sale(s) in the last 30 days`);
  return L(a, 'red', 'No sale in 30 days');
}

export function syncLight(briefs: Snapshot['briefs']): HealthLight {
  const active = briefs.filter((b) => b.status === 'Committed' || b.status === 'In progress').length;
  const pending = briefs.filter((b) => b.status === 'Submitted').length;
  if (active) return L('Sync pipeline', 'green', `${active} active brief(s)`);
  if (pending) return L('Sync pipeline', 'amber', `${pending} submission(s) pending`);
  if (!briefs.length) return L('Sync pipeline', 'none', 'No data');
  return L('Sync pipeline', 'red', 'Nothing active or pending');
}

export function royaltiesLight(bmi: Snapshot['bmi']): HealthLight {
  const c = bmiChange(bmi);
  if (!c || c.yoy == null) return L('Royalties', 'none', 'No data', 'No same-quarter statement a year earlier on file');
  const light: Light = c.yoy >= 0 ? 'green' : c.yoy >= -0.25 ? 'amber' : 'red';
  return L('Royalties', light, `${c.latest.statement}: ${c.yoy >= 0 ? '+' : ''}${(c.yoy * 100).toFixed(1)}% YoY`);
}

export function catalogLight(earned: number | null, registered: number | null): HealthLight {
  const r = catalogEarning(earned, registered);
  if (r == null) return L('Catalog earning', 'none', 'No data');
  const light: Light = r >= 0.15 ? 'green' : r >= 0.07 ? 'amber' : 'red';
  return L('Catalog earning', light, `${earned} of ${registered!.toLocaleString('en-US')} works (${pct(r)})`);
}

export function contractsLight(contracts: Snapshot['contracts'], today: string): HealthLight {
  if (!contracts.length) return L('Contracts', 'none', 'No data');
  const upcoming = contracts
    .map((c) => ({ c, d: c.noticeBy && c.noticeBy >= today ? c.noticeBy : c.nextActionDate }))
    .filter((x) => x.d && x.d >= today)
    .sort((a, b) => a.d!.localeCompare(b.d!));
  const next = upcoming[0];
  if (!next) return L('Contracts', 'green', 'No decision due in 90 days');
  const days = daysBetween(today, next.d!);
  const name = next.c.counterparty || next.c.agreement;
  if (days <= 30) return L('Contracts', 'red', `${name}: ${days} days`, 'Decision status isn’t recorded, so treated as undecided');
  if (days <= 90) return L('Contracts', 'amber', `${name}: ${days} days`);
  return L('Contracts', 'green', `Next: ${name} in ${days} days`);
}

export function freshnessLight(sources: Snapshot['sources'], knownGaps: string[]): HealthLight {
  const stale = sources.filter((s) => s.state === 'stale' || s.state === 'failed');
  if (stale.length >= 2) return L('Data freshness', 'red', `${stale.length} sources stale`, stale.map((s) => s.name).join(', '));
  if (stale.length === 1 || knownGaps.length)
    return L('Data freshness', 'amber', stale.length ? `${stale[0].name} stale` : knownGaps[0], [...stale.map((s) => s.name), ...knownGaps].join(' · '));
  return L('Data freshness', 'green', 'All sources within 2 days');
}
