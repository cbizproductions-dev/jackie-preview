/**
 * Read-only Notion API client.
 * Only GET endpoints plus POST /v1/data_sources/{id}/query (a read: Notion uses POST for query bodies).
 * There is deliberately no create/update/append/comment method anywhere in this file — see tests/readonly.test.ts.
 * Notion-Version 2025-09-03 = databases contain data sources; linked views can't be queried, so we always query
 * the original database's data source.
 */
export const NOTION_VERSION = '2025-09-03';
const BASE = 'https://api.notion.com/v1';

export type Block = { id: string; type: string; has_children: boolean; [k: string]: any };

export class NotionReader {
  private last = 0;
  private gapMs: number;
  calls = 0;
  constructor(private token: string, opts: { requestsPerSecond?: number; fetchImpl?: typeof fetch; sleep?: (ms: number) => Promise<void> } = {}) {
    this.gapMs = 1000 / (opts.requestsPerSecond ?? 2.5);
    this.fetchImpl = opts.fetchImpl ?? ((...a) => fetch(...a));
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }
  private fetchImpl: typeof fetch;
  private sleep: (ms: number) => Promise<void>;

  /** Throttled request with retry on 429/5xx (Retry-After honoured, exponential backoff otherwise). */
  private async req(method: 'GET' | 'POST', path: string, body?: unknown): Promise<any> {
    if (method === 'POST' && !/^\/data_sources\/[\w-]+\/query$/.test(path)) throw new Error('Read-only client: POST allowed only for data source queries');
    for (let attempt = 0; attempt < 5; attempt++) {
      const wait = this.last + this.gapMs - Date.now();
      if (wait > 0) await this.sleep(wait);
      this.last = Date.now();
      this.calls++;
      const res = await this.fetchImpl(BASE + path, {
        method,
        headers: { Authorization: `Bearer ${this.token}`, 'Notion-Version': NOTION_VERSION, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.status === 429 || res.status >= 500) {
        const ra = Number(res.headers.get('Retry-After'));
        await this.sleep(Number.isFinite(ra) && ra > 0 ? ra * 1000 : 500 * 2 ** attempt);
        continue;
      }
      if (!res.ok) throw new Error(`Notion ${res.status} on ${path}: ${(await res.text()).slice(0, 200)}`);
      return res.json();
    }
    throw new Error(`Notion rate-limited on ${path} after 5 attempts`);
  }

  page(id: string) {
    return this.req('GET', `/pages/${id}`);
  }
  database(id: string) {
    return this.req('GET', `/databases/${id}`);
  }
  /** All rows of a database's first data source. */
  async rows(databaseId: string): Promise<{ rows: any[]; lastEdited: string | null }> {
    const db = await this.database(databaseId);
    const ds = db.data_sources?.[0]?.id;
    if (!ds) throw new Error(`No data source on database ${databaseId}`);
    const rows: any[] = [];
    let cursor: string | undefined;
    do {
      const r = await this.req('POST', `/data_sources/${ds}/query`, { page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) });
      rows.push(...r.results);
      cursor = r.has_more ? r.next_cursor : undefined;
    } while (cursor);
    // Same definition as probeDatabase(): the most recently edited row.
    const lastEdited = rows.reduce<string | null>((a, p) => (!a || p.last_edited_time > a ? p.last_edited_time : a), null);
    return { rows, lastEdited };
  }
  /** Cheapest freshness check: the most recently edited row (and the data source id, cached by the caller). */
  async probeDatabase(databaseId: string, dataSourceId?: string | null): Promise<{ lastEdited: string | null; dataSourceId: string }> {
    let ds = dataSourceId;
    if (!ds) ds = (await this.database(databaseId)).data_sources?.[0]?.id as string;
    const r = await this.req('POST', `/data_sources/${ds}/query`, { page_size: 1, sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }] });
    const rowEdited: string | null = r.results?.[0]?.last_edited_time ?? null;
    return { lastEdited: rowEdited, dataSourceId: ds! };
  }
  async children(blockId: string, depth = 0, maxDepth = 3): Promise<Block[]> {
    const out: Block[] = [];
    let cursor: string | undefined;
    do {
      const r = await this.req('GET', `/blocks/${blockId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`);
      for (const b of r.results as Block[]) {
        out.push(b);
        // Don't descend into child pages/databases (they are separate sources) or images.
        if (b.has_children && depth < maxDepth && !['child_page', 'child_database'].includes(b.type)) b.children = await this.children(b.id, depth + 1, maxDepth);
      }
      cursor = r.has_more ? r.next_cursor : undefined;
    } while (cursor);
    return out;
  }
  /** Page rendered to light markdown for the section parsers, plus its last_edited_time. */
  async pageMarkdown(id: string, maxDepth = 3): Promise<{ md: string; lastEdited: string | null }> {
    const [p, blocks] = await Promise.all([this.page(id), this.children(id, 0, maxDepth)]);
    return { md: renderBlocks(blocks), lastEdited: p.last_edited_time ?? null };
  }
}

const rt = (arr: any[] | undefined) => (arr ?? []).map((t) => t.plain_text ?? '').join('');

export function renderBlocks(blocks: Block[], indent = ''): string {
  const lines: string[] = [];
  for (const b of blocks) {
    const v = b[b.type] ?? {};
    const kids = b.children ? renderBlocks(b.children, b.type === 'bulleted_list_item' || b.type === 'numbered_list_item' || b.type === 'to_do' ? indent + '  ' : indent) : '';
    switch (b.type) {
      case 'heading_1': case 'heading_2': case 'heading_3': {
        const lvl = Number(b.type.slice(-1));
        lines.push(`${'#'.repeat(lvl)} ${rt(v.rich_text)}`);
        if (kids) lines.push(kids); // toggle headings
        break;
      }
      case 'bulleted_list_item': case 'numbered_list_item':
        lines.push(`${indent}- ${rt(v.rich_text)}`);
        if (kids) lines.push(kids);
        break;
      case 'to_do':
        lines.push(`${indent}- [${v.checked ? 'x' : ' '}] ${rt(v.rich_text)}`);
        break;
      case 'code':
        lines.push('```' + (v.language ?? ''), rt(v.rich_text), '```');
        break;
      case 'table':
        for (const row of b.children ?? []) lines.push(`| ${(row.table_row?.cells ?? []).map((c: any[]) => rt(c).replace(/\|/g, '/')).join(' | ')} |`);
        break;
      case 'child_page':
        lines.push(`${indent}[page] ${v.title ?? ''}`);
        break;
      default:
        if (v.rich_text) lines.push(indent + rt(v.rich_text));
        if (kids) lines.push(kids);
    }
  }
  return lines.join('\n');
}

// ---------- property readers (databases) ----------
export const prop = {
  text: (p: any): string => (p ? rt(p.title ?? p.rich_text) : ''),
  num: (p: any): number | null => (p && typeof p.number === 'number' ? p.number : null),
  select: (p: any): string | null => p?.select?.name ?? p?.status?.name ?? null,
  multi: (p: any): string[] => (p?.multi_select ?? []).map((o: any) => o.name),
  date: (p: any): string | null => p?.date?.start ?? null,
  dateEnd: (p: any): string | null => p?.date?.end ?? null,
  check: (p: any): boolean => !!p?.checkbox,
  formula: (p: any): number | string | null => p?.formula?.number ?? p?.formula?.string ?? null,
};
