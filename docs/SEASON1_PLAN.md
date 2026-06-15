# Season 1 v0.1 — work-unit plan

Spec: config-driven symbol sets / rule sets / score; seed-based start board; engine
event log; daily ad-refill; puzzle goals + distribution; spire v0 (set choice + 10 stages).
Each work unit (WU) is independently testable + committed (test + lint per unit).

Order: **config → score/board foundations → event log → generalized scoring → new
symbols → daily ad-refill → puzzle → spire**.

| WU | Title | Scope | Risk | Status |
|----|-------|-------|------|--------|
| 1 | Config structures | `lib/symbols/sets.ts`, `lib/rules/sets.ts`, `lib/modes/config.ts` + types + integrity tests. 6 symbol sets (number/fruit/gem/cat/vehicle/monster), rule-set configs (daily_basic_1/2, spire_basic_temp). No engine wiring. | low | ✅ 78a52a3 |
| 2 | Score tweaks | 4 penalty 20→30; confirm numbers excluded from poker hands; tests. | low | ✅ 0da2d7d |
| 3 | Seed start board | `lib/board/initialBoard.ts` — `initialBoardFor(seed, weights)` (deterministic) + tests. | low | ✅ dd05dae |
| 4 | Engine event log | `EngineEvent` type; cascade emits rerolled/transformed/moved/copied/locked; attach to SpinLog; tests. | med | ✅ b9cfd5d |
| 5 | Config-driven scoring | `score.ts` generalized: hands over all non-number symbols in active sets; per-set bonuses (fruit/gem 3종·올, cat neighbor, vehicle move/reroll via events, monster copy via events). | high | ✅ ef90fe0 |
| 6 | New symbols in engine | extend `SymbolType` + `BASE_WEIGHTS` + `SymbolView` for cat/vehicle/monster; tests. | med | ✅ 9413270 |
| 7 | Daily ad-refill | migration `0003`; `daily_user_status`; 5 base +5 ad → 10 max; dummy-ad modal + refill API; attempts UI; tests. | med | ✅ `0a8d0b6` |
| 8a | Puzzle core | goal checker (`PuzzleGoal` 6-type union) + `checkPuzzleRun`; evolved config (goals/seed/initialBoard/availableRuleIds); `puzzle_user_records` + distribution; tests. | high | ✅ `a98a30d`,`058c802` |
| 8b | Puzzle play | `/api/puzzles/[key]/{start,submit}` + play client + distribution UI. | high | ✅ `96f0b51` |
| 9a | Spire core | seed set-choice + bag mutation (`lib/spire/run.ts`) + `spire_user_records`; tests. | high | ✅ `53dbabe`,`058c802` |
| 9b | Spire play | set-choice UI + bag HUD + staged 50-spin run + `/api/spire/{start,submit}`. | high | ✅ `6e28ce5` |
| RC | Configurable-run store mode | store/replay/verify start a run from a config { initialBoard, weights/bag, maxSpins, provisioning: offer/pool/fixed } reconstructable server-side. Additive; defaults reproduce legacy behavior. | high | ✅ `977ee7e` |

**All v0.1 work units complete.** Verified end-to-end: tsc 0 · 319 tests · `next build` ok · daily/puzzle/spire full-play E2E passing (in-memory DB).

Deferred polish (post-v0.1, see "Deferred" below): wire **daily** to seed-start-board + 'pool' (currently legacy offer/00000 start); cat/vehicle/monster set-specific rules; spire per-stage rewards/artifacts; puzzle seed/board tuning for p03–p10; season-points reflection of puzzle/spire/daily into the season leaderboard query (rows are written; `buildSeasonRanking` already aggregates them).

Deferred (post-v0.1): spire rewards/artifacts; full puzzle 10-set; per-set extra rules
(cat/vehicle/monster rule pools); daily rotation tuning; season-points reflection per mode;
real ad SDK; symbol-set engine fully replacing legacy fruit/gem hardcodes.

Process per WU: subagent implements (supervised) → `vitest` (scoped) + `eslint` → fix →
`tsc` → commit + push. Periodic full `tsc`/`vitest`/`next build` at integration points.
