# C-BIZ Console

A single-page, studio-console-style dashboard for the C-BIZ OFFICIAL music business. It reads the
Cabinet's Notion workspace (HQ) through a **read-only** Notion integration and shows every lane at a glance:
money, studio, beats, sync & royalties, contracts, strategy, career, speaking, calendar, and the Cabinet.

- **View only.** No write routes, no Notion write calls, no forms. Every item links to its source in Notion.
- **Test build.** The Notion "C-BIZ Music Command Center" keeps running as before; nothing here replaces it.
- **No business data in git.** This repo is public. Captured data (`fixtures/`, `seed/`) is git-ignored.

## How it works

```
Notion HQ (read-only integration)
   │  probe last_edited_time → re-read only what changed (≤40 calls/visit, 429 backoff)
   ▼
Cloudflare Worker  ──  KV: snapshot:v1 (last good), state:v1 (per-source cache), seed:v1 (build-time capture)
   │  GET /c/<ACCESS_KEY>/api/snapshot   (stale-while-revalidate, 15 min)
   ▼
React app (Vite, hand-built SVG charts, self-hosted fonts) under /c/<ACCESS_KEY>/
```

- Every request must carry the key in the path. Anything else, any method other than GET/HEAD, and any wrong key → **404**.
- Headers: `X-Robots-Tag: noindex`, `Referrer-Policy: no-referrer`, CSP with `frame-ancestors` for Notion, no `X-Frame-Options`.
- Counting rules and metric formulas live in `src/shared/rules.ts` and are unit-tested (`tests/`).
- The source map is in `SOURCES.md`. Decisions and status are in `BUILD_NOTES.md`.

## Run locally

```bash
npm install
npm test                 # counting rules, health lights, access model, resilience
npm run dev              # http://localhost:5173 — serves seed/seed.json if present
# full Worker locally (assets + key gate + KV):
npm run build
echo 'ACCESS_KEY="local-dev-key-change-me-0123456789"' > .dev.vars
npx wrangler dev --local # then open http://localhost:8787/c/local-dev-key-change-me-0123456789/
```

To run against live Notion locally, add `NOTION_TOKEN="..."` to `.dev.vars` (git-ignored).

## Deploy (Cloudflare, Kris's account)

```bash
export CLOUDFLARE_API_TOKEN=...   # "Edit Cloudflare Workers" template; or run `npx wrangler login`
./scripts/deploy.sh               # creates KV, deploys, sets a random ACCESS_KEY and prints the link once
npx wrangler secret put NOTION_TOKEN
```

## Connect Notion (read-only)

1. notion.so/profile/integrations → **New integration** → Internal → name it "C-BIZ Console (read-only)".
2. Capabilities: tick **Read content** only. Untick insert, update, comments and user information.
3. Copy the secret and store it as a Worker secret: `npx wrangler secret put NOTION_TOKEN`
   (or Cloudflare dashboard → Workers → cbiz-console → Settings → Variables and Secrets → Add → Secret).
4. In Notion, add the integration (••• → Connections) to: **C-BIZ Music Command Center**, **Studio Board — Muse mirror**,
   **Rolling 60-Day Calendar**, **MAESTRO** (covers Brief Board, Royalty Dashboard, Beat Leases), **CLAUDE** (covers Contract Vault),
   **MUSE**, **GROK BOT**, **CHAT GPT**, **Scout Trackers**, **Sync Tracker**, and the HQ root page if you prefer one connection
   (connections carry down to child pages).

## Rotate the access key

```bash
ROTATE_KEY=1 ./scripts/deploy.sh      # new random key, printed once; the old link stops working immediately
```
Then update the embed and the "Open full screen" link on the Notion page, and re-add the iPhone home-screen icon.

## Add a source

1. Add a `db(...)` or `page(...)` entry to `SOURCES` in `src/worker/sources.ts` (id, owner, Notion ID, mapper).
2. If it fills a new part of the snapshot, add it to the Zod schema in `src/shared/schema.ts` and to `EMPTY` in `src/worker/snapshot.ts`.
3. Parse pages by **section heading** with the helpers in `src/worker/parsers.ts`, never by position; return empty on a miss.
4. Add it to `SOURCES.md` and connect the integration to the page in Notion.

## Add to iPhone home screen

Open the full-screen link in Safari → Share → **Add to Home Screen**. The icon opens `/c/<key>/` full screen.
