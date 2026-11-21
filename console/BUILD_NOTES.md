# BUILD_NOTES — C-BIZ Console (test build)

Running log so another Claude session can pick up. Newest first within each section.

## Status
- [x] Phase 0 — HQ mapped (see SOURCES.md). Cross-checks against Gmail done (see "Discrepancies").
- [x] Phase 1 — Worker, read-only Notion client, snapshot builder, KV caching, Zod schema, tests (rules, health, access, resilience).
- [ ] Phase 2 — design system + components
- [ ] Phase 3 — screens
- [ ] Phase 4 — deploy + Notion page (needs Kris: Cloudflare token + Notion integration + page approval)
- [ ] Phase 5 — QA checklist

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
