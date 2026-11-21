// Screen-print header art: the Command Center's traced vectors of Kris's own @cbiz_official photos (from the runbook).
// The trace files live in fixtures/ (git-ignored) and are bundled at build time; if absent, headers render without art.
const files = import.meta.glob('../../fixtures/*_trace.json', { eager: true, import: 'default' }) as Record<string, { w: number; h: number; paths: string }>;
const pick = (n: string) => Object.entries(files).find(([k]) => k.endsWith(`/${n}_trace.json`))?.[1];
export const ART = { couch: pick('couch'), la: pick('la'), redcarpet: pick('redcarpet') } as const;
