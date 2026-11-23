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
- 72 unit tests pass (Nov 22): every counting rule, every metric-dictionary formula, health thresholds, access model (404 without key, no write methods), read-only guard, 429 backoff, failed source keeps last good data + Partial, unchanged sources not re-read, call budget, Durango hold.
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
- **Call budget per visit** (`NOTION_CALL_BUDGET`, default 40) because Workers Free caps outbound requests at 50 per invocation. The client repeats `?fresh=1` (max 4) while sources are pending. On Workers Paid this can go to ~400.
- **Freshness probe:** databases = newest row's `last_edited_time` (1 query, data source id cached); pages = page `last_edited_time`.
- **Freshness light** counts only the daily-feed sources (Studio Board, Calendar "Last verified", Command Center daily run). Slow-moving references (Contract Vault, Sync Tracker…) show their age but don't trip it. Matches how the Command Center sets its light.
- **Studio revenue light**: the in-progress week counts only once it has already passed the goal (cash received can't go down). Otherwise complete weeks only.
- **Pace** follows the Revenue & Trajectory definition (last 3 weeks, including the week in progress), labelled as such, so the app and Notion agree.
- **Stretch goal** read from Goals & Milestones ("Weekly studio goal — $1,000"). The config constant is only a fallback.
- **Roles** in the Cabinet screen come from each member's HQ section page at runtime (first paragraph). Beacon has no page of its own.
- **Calendar**: titles and times only; notes (addresses etc.) are not shown.
- Command Center `data.json` (runbook code block) is read for derived displays (health notes, ROI, scouting/briefs/contacts counts, momentum events, cash calendar, projections).

## Nov 22 update (accounts, freshness, Command Center match)
- **Account pinned.** `wrangler.toml` now has `account_id = "5944c3a0070ea5f916836cf0c750a1ad"` (cbizproductions@gmail.com). Worker `cbiz-console`, KV `SNAP`, both secrets live there. No Pages project, no cron.
- **Fresh on every open.** The app shows the saved copy instantly, then calls `/api/snapshot?fresh=1`, which refreshes inside that request (the old background refresh was cut off after 30 s, which is why the snapshot got stuck).
  Change detection = one Notion search sorted by last edit (the "sweep", 1 call); only sources edited since the last pass are re-read. A full check of every source runs on first use, after a failure, or every 6 h. Budget stays 40.
  If Notion fails, the saved copy is shown with a banner naming its time.
- **Health lights come from the Command Center** (`data.json` → `health`), so the Dashboard and Notion always agree. If live data reads differently, the Strategy screen says so under the light. Fallback: the Dashboard's own computation.
- **Studio freshness** uses the Studio Board's own "Last synced" date, not the page's edit time.
- **One mix count:** "X open · Y overdue · Z due in the next 7 days", where Z never includes overdue mixes. Same wording on Home, Strategy, Studio and the agent view.
- **Who writes SNAP:** only the Worker (`snapshot:v1`, `state:v1`). `seed:v1` and `seed-state:v1` were one-time uploads during the build (Nov 21). No scheduled task writes to it.
- **Checked live (Nov 22):** whoami = cbizproductions@gmail.com; tail during 4 loads: no errors; full check 20 Notion calls / ~7 s, normal open 1 call / ~1 s; CPU 23–52 ms per fresh request; numbers on screen in 0.4–1.5 s on a phone-size screen, fresh data in 1.4–2.1 s.
  All headline numbers and all 10 lights match the Command Center (as of Sun Nov 22, 11:05 AM ET).

## Apple Calendar live feed (Nov 22, Kris approved)
- Optional Worker secret `APPLE_CAL_URL` = iCloud "Public Calendar" link(s) (webcal:// or https://, several separated by spaces). Apple Calendar only; Kris doesn't use Google Calendar.
- Read on every open (at most once a minute), next 60 days, titles and times only (no notes, locations, attendees). Repeats, removed and moved repeats, cancelled events and multi-day all-day events handled (`src/worker/ical.ts`, `tests/apple.test.ts`).
- Only events the Notion calendar doesn't already have are added, marked "from Apple Calendar". Durango hold applies. Muse's Notion calendar stays the main record.
- If iCloud fails, the last good copy stays and the source shows as failed. The link is never logged.
- To stop it: turn off "Public Calendar" on the iPhone, or delete the secret.

## Command Center content in full (Nov 22)
- `src/app/cc.tsx` shows the Command Center's own words from data.json, unshortened and labelled with its "as of" time: Home (headline, Today's brief, Interesting facts), each room's summary + all strip stats (Money, Studio, Beats, Sync, Contracts, Strategy, Career), Money on the table, CC pace + illustrative set-aside, counting footnote, recommended moves, experiments in detail + ideas, ROI read, eras and streaks, vibe funnel, week-ahead notes (Calendar). Agent view gets the headline, brief, facts, moves and room insights.
- Durango hold filters every line. No extra Notion calls (data.json is already read).

## Creative Output + Since Last Update (Nov 22)
- **Creative screen** (`src/app/screens/Creative.tsx`, logic in `src/shared/creative.ts`): from the Brief Board, Studio Board, Weekly Scorecard and Beat Leases. No new tracker.
  Stage counts use each brief's current status and match the Command Center's own Brief Board counts (checked against data.json `rooms.briefs`). Briefs are dated by Due.
  "Tracks completed" is Not on file (tracks made outside a brief aren't logged). Titles are counted only where the record names them. Styles come only from words in brief titles. Placements on file (BMI + TuneSat) are shown separately as a different count.
- **Since last update** (`src/worker/changes.ts`, panel `src/app/since.tsx` on Home after Today's moves): each fresh read is compared with the last one, stored inside `state:v1` (no new KV key, no schedule, no Notion calls).
  Only verified changes: money in, Brief Board stage moves, bookings, new paying clients, deliveries, newly overdue mixes, overdue cleared, goals reached, data issues closed, Command Center light changes. Ranked by business importance. No repeats; 30 days kept.
  A category is compared only when its source read OK both times. Old back-filled briefs aren't news. The first run set a baseline and listed only records with their own recent date. "New" = since this device's last visit (browser storage, per device).

## Nov 23 changes (Kris)
- **Home:** "Mix & Brief Queue" (open mixes + briefs at Committed / In progress, plus Contract only while it still has a date ahead; next date = Due or Round 2 due, whichever is next; overdue = date passed and not Submitted; red when anything is overdue). "Booked Ahead" replaces "2026 So Far" (paid sessions in the next 14 days from the Studio Board, hours from the note, rate from the note or the client roster, "rate not set" otherwise; expected, not income; fill against the weekly goal for the next 7 days). "2026 So Far" moved to the top of Money unchanged. Today's brief now sits under Today's moves. All data.json facts render.
- **Freshness:** Monday with nothing in yet reads "$0 so far · week just started" (only when the Weekly Scorecard itself was read). Mid-refresh guard: a source that reads empty or less than half its last size keeps its last good copy, shows "updating", is re-read next open, and is never compared by Since last update; after 30 minutes the new read is accepted. `DATA_VERSION` forces one re-read of every source when a parser learns new fields.
- **Studio:** "All artists" from the Studio Board's "## Artist profiles" (merge note skipped), grouped like the Command Center's toggle.
- **Sync:** "This week's 5" (data.json `sync_week5`, "✓ sent" once the Shared Sync Contacts row is Contacted/Replied), "Sync trajectory" (Month: upfront fees from the ledger + BMI placed ~5 months after quarter end, labelled approximate; gaps where the ledger has no monthly data; lines for briefs delivered by Due date and outreach by "Last contacted". Week: lines only), "Sync playbook" (data.json `sync_tips`).
- **New sources:** Shared Sync Contacts (database, all rows; "Last contacted" / "Follow-up" are text, parsed as loose dates) and the three scout trackers (found by title, Status = Replied only, every 6 h). A replied lead counts as waiting on Kris only if its row doesn't say handled / passed / pending on their side and Kris hasn't already answered.
- **Navigation:** phone bar Home · Money · Studio · Sync · Calendar · More; "Follow-ups" (owed mixes, money owed, rebook candidates, vibe artists not paid with "hot" inside 14 days, sync contacts past Follow-up with no reply (Durango on hold), scout replies waiting on Kris, briefs due in 7 days) in More.

## Open questions / blocked
1. Workers Free nominally allows 10 ms CPU per request; fresh requests use 23–52 ms. Not failing today, but if it starts to, Workers Paid ($5/mo) removes the risk. Not changed without Kris's OK.

## Discrepancies found (Phase 0)
Details (with names and amounts) are kept out of git: see `fixtures/DISCREPANCIES.md` locally and the final report to Kris.
Summary: 2 Brief Board rows look stale against email (both already open Data issues in the Intelligence Feed);
this week's studio cash and the latest BMI statement date match outside sources; one rolling-30-day figure differs by timing only.
