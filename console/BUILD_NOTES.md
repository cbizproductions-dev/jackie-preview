# BUILD_NOTES — C-BIZ OFFICIAL DASHBOARD (test build; repo folder and Worker are still named "console")

Running log so another Claude session can pick up. Newest first within each section.

## Status
- [x] Phase 0 — HQ mapped (see SOURCES.md). Cross-checks against Gmail done (see "Discrepancies").
- [x] Phase 1 — Worker, read-only Notion client, snapshot builder, KV caching, Zod schema, tests (rules, health, access, resilience).
- [x] Phase 2 — design system + components (tokens in `src/app/styles/app.css`, components in `src/app/ui.tsx`)
- [x] Phase 3 — all 12 screens (`src/app/screens/`)
- [x] Phase 4a — deployed to Kris's Cloudflare (cbizproductions@gmail.com): `cbiz-console.localsite-studio.workers.dev`, KV `SNAP`, secrets ACCESS_KEY + NOTION_TOKEN (set by Kris). **All 21 sources read live** as of Nov 21 ~2:09 PM ET; headline numbers and all ten lights match the Command Center.
- [x] Phase 4b — renamed to **C-BIZ OFFICIAL DASHBOARD** (Kris, Nov 21; the Worker/URL and repo folder keep the name `console`). Notion page "🎛️ C-BIZ OFFICIAL DASHBOARD (test)" created under the Command Center (embed + Open full screen + one line) and one line added to Claude Daily Updates. Nothing else in HQ was changed.

## Command Center changes (Kris approved, Nov 21)
- Chart images retired: the "C-BIZ Command Center daily refresh" scheduled task now skips building/uploading SVG panels and keeps everything else (databases, home tiles, Data-as-of stamps, Cash Flow checklist, data.json, Maintenance Log). Existing images stay but no longer update.
- One link callout added at the top of the Command Center home page pointing to the Dashboard.
- The "Command Center refresh watch" task is unchanged.

## Deploy notes (Nov 21)
- This sandbox's proxy injects the Cloudflare token into every api.cloudflare.com request, which breaks wrangler's static-asset upload (it needs its own upload JWT). So the built app is **embedded in the Worker** (`scripts/embed-assets.mjs` → `src/worker/assets.gen.ts`, git-ignored) and served by the Worker; `npm run deploy` does build → embed → deploy. `keep_vars = true` protects dashboard-set values.
- First live run starts from the build-time capture (`seed-state:v1` in KV) so a failed or not-yet-read source shows captured data marked Partial, never a blank screen. Not-yet-read sources make the snapshot Partial.
- Royalty Dashboard is too big to read whole within the free plan's 50 subrequests; the Worker reads only its top level and the table under the TuneSat heading. No such table was found on the live page, so the TuneSat card falls back to the Command Center's count.
- Lessons: the first live attempt failed on every source with the old build and showed blank screens (fixed: fallback + plain-English error notes + 2-minute retry for Partial).
- [~] Phase 5 — QA: everything runnable here passes (see below); Notion-embed and iPhone checks need the deployed URL.

## QA done in this session (Nov 21)
- 57 unit tests pass: every counting rule, every metric-dictionary formula, health thresholds, access model (404 without key, no write methods), read-only guard, 429 backoff, failed source keeps last good data + Partial, unchanged sources not re-read, call budget, Durango hold.
- Real-data check (`fixtures/local.test.ts`, local only): parsers reproduce the Command Center's mix queue, vibe conversion, concentration and this-week figures exactly.
- Local `wrangler dev`: every path without the key → 404; POST → 404; `/c/<key>` → 308 to `/c/<key>/`; noindex, CSP frame-ancestors, no-referrer present; no X-Frame-Options.
- Bundle: 85 KB gzipped main JS (+ ~3 KB per lazy screen); fonts self-hosted; no third-party hosts except Instagram embeds; no secrets in `dist/` or git history.
- Throttled 4G + 4× CPU, local Worker: first contentful paint ~0.57 s, meters with data ~1.1 s.
- Playwright screenshots of all 12 screens at 390×844, 430×932, 1440×900, plus 650 px embed at 390 and 1440: no horizontal overflow, no console errors; tap targets ≥44 px; text ≥12 px (body 15 px).
- Contrast: text ≥4.5:1 (lowest: captions 5.0:1), status glyphs and control outlines ≥3:1. Lane palette re-stepped to pass CVD separation (validator, all pairs ΔE ≥ 8).
- Embed (650 px, phone): meter bridge + Today's Moves header + first move visible.

## Still to verify after deploy
- Real Notion embed on desktop and in the Notion iPhone app (which frame origin Notion uses; adjust `FRAME_ANCESTORS` in `src/worker/index.ts` if needed).
- "Open full screen ↗" from inside the iPhone embed; Add to Home Screen.
- First live refresh against Notion (call budget, parser fit on the live block structure — especially Studio Board bullets and the runbook code block).


## Decisions
- **No business data in git.** The repo (`cbizproductions-dev/jackie-preview`) is public. Kris chose (Nov 21) to keep data out:
  Phase 0 captures live in `console/fixtures/` and the seed in `console/seed/`, both git-ignored. Committed tests use synthetic numbers.
  A real-data test (`fixtures/local.test.ts`) runs only where the fixtures exist.
- **Seed mode.** Until `NOTION_TOKEN` is set, the Worker serves a build-time capture (KV key `seed:v1`), labelled in the UI.
- **Notion-Version `2025-09-03`** (data sources). developers.notion.com is blocked from this sandbox, so a newer version couldn't be checked. One constant in `src/worker/notion.ts`.
- **Call budget per visit** (`NOTION_CALL_BUDGET`, default 40) because Workers Free caps outbound requests at 50 per invocation. The client keeps polling `?continue=1` while sources are pending. On Workers Paid this can go to ~400.
- **Freshness probe:** databases = newest row's `last_edited_time` (1 query, data source id cached); pages = page `last_edited_time`.
- **Freshness light** counts only the daily-feed sources (Studio Board, Calendar "Last verified", Command Center daily run). Slow-moving references (Contract Vault, Sync Tracker…) show their age but don't trip it. Matches how the Command Center sets its light.
- **Studio revenue light**: the in-progress week counts only once it has already passed the goal (cash received can't go down). Otherwise complete weeks only.
- **Pace** follows the Revenue & Trajectory definition (last 3 weeks, including the week in progress), labelled as such, so the app and Notion agree.
- **Stretch goal** read from Goals & Milestones ("Weekly studio goal — $1,000"). The config constant is only a fallback.
- **Roles** in the Cabinet screen come from each member's HQ section page at runtime (first paragraph). Beacon has no page of its own.
- **Calendar**: titles and times only; notes (addresses etc.) are not shown.
- Command Center `data.json` (runbook code block) is read for derived displays (health notes, ROI, scouting/briefs/contacts counts, momentum events, cash calendar, projections).

## Open questions / blocked
1. Cloudflare: deploy target is Kris's **cbizproductions@gmail.com** account (the connected Cloudflare connector is a different account). Sandbox can't reach api.cloudflare.com. Kris declined the in-session token form on Nov 21. Needs: Cloudflare API token (Edit Workers template) added as a network secret for host `api.cloudflare.com`, or Kris runs `npm run deploy` from a laptop.
2. Notion read-only integration token (README "Connect Notion").
3. Phase 4 page approval.

## Discrepancies found (Phase 0)
Details (with names and amounts) are kept out of git: see `fixtures/DISCREPANCIES.md` locally and the final report to Kris.
Summary: 2 Brief Board rows look stale against email (both already open Data issues in the Intelligence Feed);
this week's studio cash and the latest BMI statement date match outside sources; one rolling-30-day figure differs by timing only.
