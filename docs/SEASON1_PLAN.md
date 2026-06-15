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
| 7 | Daily ad-refill | migration `0003`; `daily_user_status`; 5 base +5 ad → 10 max; dummy-ad modal + refill API; attempts UI; tests. | med | ☐ NEXT |
| 8 | Puzzle engine | fixed board/seed/rule-bag; goal checker (`PuzzleGoal`); `/api/puzzles/[key]/{start,submit}`; play client; achievement distribution; `puzzle_user_records`; tests. | high | ☐ |
| 9 | Spire v0 | start with number set; choose 1 of 2 seed-picked sets (symbols replace 0s, rules unlock); seed start board; 10 stages; bag UI; `/api/spire/{start,submit-stage,finish}`; `spire_user_records`; tests. | high | ☐ |

Deferred (post-v0.1): spire rewards/artifacts; full puzzle 10-set; per-set extra rules
(cat/vehicle/monster rule pools); daily rotation tuning; season-points reflection per mode;
real ad SDK; symbol-set engine fully replacing legacy fruit/gem hardcodes.

Process per WU: subagent implements (supervised) → `vitest` (scoped) + `eslint` → fix →
`tsc` → commit + push. Periodic full `tsc`/`vitest`/`next build` at integration points.
