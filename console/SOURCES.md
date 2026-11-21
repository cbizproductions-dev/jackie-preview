# SOURCES — Phase 0 map of HQ (read once, Nov 21 2026)

Structure only. Values (names, amounts) are deliberately left out because this repo is public.
**Read** = how the Worker reads it at runtime. **Fragility**: 🟢 structured database read · 🟡 page parsed by section heading · 🔴 parsed from free text (falls back to "Not on file" + Open in Notion).
All reads are read-only (Notion API `2025-09-03`, integration with *Read content* only). The Worker never writes.

## Command Center data layer (owner: Claude) — headline numbers come from here as-is

| Source | Type | ID | Properties used | Feeds | Fragility |
|---|---|---|---|---|---|
| Weekly Scorecard | database | 41e8b67fa84e81989b1fe343221cde6a | Week (title), Week start (date), Sessions $, Remote mix $, Beat sales $ (number), Paid sessions, Paid hours, Vibe sessions held, Vibe no-shows, New paying clients, Goal $, Status (Complete/In progress), Confidence, Notes. `Total $`/`Goal met` are formulas — **recomputed as Sessions+Remote+Beats** | This Week, weekly bars, momentum, pace, capacity | 🟢 |
| Income Ledger (aggregated) | database | 41e8b67fa84e8129b391da63aeaa8972 | Entry, Year, Month (2026 only), Lane (BMI royalties / Direct sync fees / Studio sessions / Remote mix/master / Beat leases / Other), Basis, Amount, Confidence, Source | 2026 so far, lanes, monthly, year compare | 🟢 (pre-2026 rows are yearly, no month) |
| BMI Statements (mirror) | database | 41e8b67fa84e8145b9eec92c5c4c6f3c | Statement ("YYYY Qn"), Royalties, US broadcast & cable TV, Streaming & digital, International, Radio & other, New placements, Plays, Titles earning, Countries, Shows & programs, Networks | BMI bars (gaps = missing statements), QoQ/YoY, royalties light | 🟢 |
| Goals & Milestones | database | 41e8b67fa84e818b8766d7638ea3be2d | Goal, Target, Current, Unit ($/count), Period (Weekly/Monthly/Milestone/Operational), Origin, As of, Notes | $600 goal + $1,000 stretch (both Period=Weekly), goal meters | 🟢 |
| Intelligence Feed | database | 41e8b67fa84e812cbfbbd875db88e23e | Insight, Kind, Evidence (Established/Likely/Hypothesis), Status, Urgency (Now/This week/This month/Watch), Lane (multi), Rank, Whose lane, Source, Observation, Action, Impact | Insights feed, Today's Moves ("Now"), Data issues (Kind = Data issue), experiments, catalog %, warm leads | 🟢 rows · 🔴 some numbers inside Observation text (catalog %, library $) |
| Maintenance Log | database | 41e8b67fa84e81a4aa3ade6a1840e3db | Run, Date, Type (Daily/Build/…), Result (OK/Partial/Failed), Issues | Command Center refresh status, freshness | 🟢 |
| Photo Library | database | 41e8b67fa84e81e4876fc8e2bdc1874e | Photo name, Kind, Approved by Kris, Use in, Notes (Instagram code) | Career photos (official embeds, Kris only) | 🟡 code is read from Notes/name |
| Runbook (`data.json` code block) | page | 41e8b67fa84e816fa932f429411bd3ed | Code block under heading "data.json" — the Command Center's own computed state: health notes, ROI, scouting / brief / contact counts, momentum events, cash calendar (expected money, receivables), active-brief card, timeline | Derived displays only | 🟡 one JSON block; missing → sections show "Not on file" |
| System, Sources & Maintenance | page | 41e8b67fa84e812b805de57f67067498 | Tables under "Source map" and "Metric dictionary"; bullets under "Counting rules", "Known limitations" | System screen, Cabinet "owns" column | 🟡 |
| Rooms: Cash Flow Radar | page | 41e8b67fa84e818283ffdb9b4b8af4e4 | to_do blocks under "Money moves this week" (checked state mirrored) | Today's Moves | 🟡 |
| Rooms: Strategy Room | page | 41e8b67fa84e8128a28aced006840039 | Experiment approval to_dos; "Three futures" toggle (A/B/C callouts); health-light thresholds (copied into `src/shared/health.ts`) | Strategy screen | 🟡 futures 🔴 |
| Rooms: Milestones, Discoveries & Career | page | 41e8b67fa84e8109bbc9f7bbb64101d2 | Tables "Career figures vs verified data", "Full timeline"; lists after "Verified credits", "In motion" | Career screen | 🟡 |
| Rooms: Revenue & Trajectory, Studio & Clients, Beats & Scouting, Sync/Royalties/Catalog, Contracts & Rights | pages | see `src/shared/derive.ts` `ROOMS` | Mostly generated SVG panels + narrative toggles; numbers already in data.json. Used for "Open in Notion" links and definitions (projection scenarios) | Links, definitions | n/a |

## Source systems (owned by other members) — live lists

| Source | Owner | Type | ID | Read | Fragility |
|---|---|---|---|---|---|
| Studio Board — Muse mirror | Muse | page | 4118b67fa84e815d87f9da794bb520d8 | Sections: Money (week line, open-mix line, deposits, beat sales), Mixes due, Sessions (scheduled), Sync checks (never added to income), Clients, Closed (remote mixes), Vibe sessions; "Last synced" line | 🟡 bullet format "Name — date, …"; tested against a capture |
| Brief Board | Maestro | database (1 data source) | 41b8b67fa84e81cebdcecf359661e777 | Brief, Company, Status (New/Not taking/Committed/In progress/Contract/Submitted/Paid/Placed/Passed/Expired), Type, Code, Due, Round 2 due (range), Deliverable count, Notes, Taking it? | 🟢 |
| C-Biz Royalty / Placement Dashboard | Maestro | page | 4178b67fa84e815db947ef2baf0e563a | Table under the "TuneSat" heading (detections not yet on a statement); otherwise last_edited only | 🔴 large page; falls back to the data.json pipeline count |
| Contract Vault | Maestro (since Nov 17) | database | ee36a866c6f74c14ab243f5377cff8bc (lives under CLAUDE) | Agreement, Counterparty, Type, Signed status, Exclusivity, Exit status, Flags, Next action, Next action date, Last day to send notice, Current period ends | 🟢 ("inferred" detected from text) |
| Beat Leases & Registrations | Maestro | database | 058a6cd1bf004ec88c9b3204f9050837 | Row count only (empty on Nov 21 → known gap) | 🟢 |
| Sync Tracker (Maestro + Claude) | Maestro + Claude | page (contains contact DBs) | 40a8b67fa84e817789e6e7e10e23edd1 | last_edited only; counts via data.json `rooms.contacts` | 🟡 |
| Scout Trackers (Maestro + Muse) | Muse / Maestro | page with 3 lead DBs | 4088b67fa84e81b4af51c5e44d03c171 | last_edited only; counts via data.json `rooms.scouting`, `roi` | 🟡 |
| Rolling 60-Day Calendar | Muse | page | 4178b67fa84e81d5a551c62aa4d62c46 | "Refreshed" and "last live verification against Apple Calendar" lines; "## Day" headings with "- time — title" bullets. Notes not shown | 🟡 |

## Cabinet (HQ root 1488b67fa84e80f69ff0c33b8ecc1b94, "Cabinet — Quick Access")

| Member | Log page (last_edited only — never summarized) | Role read from |
|---|---|---|
| Claude | 4008b67fa84e8131be8fc031b01df058 | CLAUDE section 3fe8b67fa84e8108a731db641473c228 |
| Muse | 4008b67fa84e813fb439ca1ae2f45a44 | MUSE section 3fe8b67fa84e812c9954dfdfd9a434d0 |
| Maestro (Grok Bot · Council) | GROK BOT log 4008b67fa84e811bb288e86cc67ba06d | MAESTRO section 40d8b67fa84e814dbc79c3784bb92f9b |
| Daniel (Grok Bot · Council manager) | GROK BOT log | GROK BOT section 3fe8b67fa84e814c85c2cf25e34e3d56 |
| Beacon (Grok Bot · Council) | GROK BOT log | — no page of its own |
| ChatGPT (IMDb register) | 4008b67fa84e81df8623f3c82d23db8b | CHAT GPT section 3fe8b67fa84e8108982ad63bf1c3fb94 |

## Not in HQ (recorded, not invented)
- **Beacon's speaking/funding leads:** live in a pipeline file outside HQ (referenced in the Grok Bot log). App shows "Not tracked in HQ".
- **Brand items** (LinkedIn, one-sheet link, Disco playlists, website): only mentioned in the Milestones room's "In motion" list; no status tracker. IMDb work is logged in CHAT GPT / GROK BOT pages (not a structured tracker).
- **Rate card:** no rate card page in HQ; app shows Kris-reported rates labelled as such.
- **Speaking history dates:** not in HQ or the calendar window; shown as Kris-reported.

## Limits worth knowing
- This workspace has a small hourly allowance for SQL **and rows-mode** MCP queries (hit during Phase 0). The Worker uses the public API (data source queries), which has its own ~3 req/s limit; the client throttles to 2.5 req/s and retries 429s.
- Linked views can't be queried through the API, so the Worker always queries the original databases.
