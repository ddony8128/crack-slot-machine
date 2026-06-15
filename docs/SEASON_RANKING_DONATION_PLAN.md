# Season ranking redefinition + donation + score-rise — work-unit plan

Redefines the season point formulas (the current `buildSeasonRanking` uses older
ones), adds immediate daily first-play points + lazy daily rank settlement, a
score-rise animation, and the donation/supporter feature.

## Locked decisions
- **Daily boundary + settlement reference = 12:00 KST (noon).** Already in code
  (`DAY_BOUNDARY_UTC_HOURS=3`); window for key D = [D 12:00 KST, D+1 12:00 KST).
- **Lazy settlement.** A day's rank rewards count only once its window has ended
  (`dailyWindow(D).endsAt <= now`), computed when the ranking is viewed/queried —
  no cron. (Optional admin "정산" button later.)

## New formulas (spec §3–5)
- **Puzzle** (best kept per puzzle): `100 + leftoverSpins×10` (leftover = spinLimit − spinsUsed).
- **Daily**: `+20` first-play per played day (immediate) `+` rank reward for SETTLED days:
  top10% → +50, top50% → +30, else 0. Cutoffs `top10=max(1,ceil(N*0.1))`, `top50=max(1,ceil(N*0.5))`. Top10 gets +50 only (not +50+30).
- **Spire** (best run only): `maxClearedStage×100 + money×10 + totalUnusedSpins×10` (unused spins summed over CLEARED stages only).
- **Donation**: ≥ 10,000원 → 후원자 badge (manual admin grant).

## Score-rise animation (spec §6)
Point-granting endpoints return `SeasonScoreChange { previousSeasonScore, newSeasonScore, delta, previousRank, newRank, reason }`; a slot-style count-up UI plays it. Reasons: PUZZLE_FIRST_CLEAR / PUZZLE_RECORD_IMPROVED / DAILY_FIRST_PLAY / DAILY_RANK_TOP_10 / DAILY_RANK_TOP_50 / SPIRE_BEST_UPDATED.

## Work units
| WU | Title | Scope | Status |
|----|-------|-------|--------|
| SR-B | New pure formulas | puzzleScore / dailyRankReward+DAILY_FIRST_PLAY / spireSeasonScore / SUPPORTER_MIN_AMOUNT + cutoffs. | ✅ `928c900` |
| SR-C | Store the new data | spire submit → money + unusedSpins via verifySpireRun; puzzle submit → leftover; both stored as best_scores.score/seasonPoints. | ✅ `fc09f02` |
| SR-D | Swap buildSeasonRanking | new formulas; daily = +20/day + settled-rank reward (lazy via `now`); caps removed. | ✅ `fc09f02` |
| SR-E | Score-rise API + animation | submit endpoints return SeasonScoreChange (before/after snapshot); SeasonScoreRise count-up on result screens. | ✅ `7b80b6c` |
| SR-F | Donation + supporter badge | players.supporter_badge (migration 0005) + admin grant route/UI; DonationModal + useDonationPrompt (daily-exhausted / spire-end / all-puzzles-cleared, localStorage dedup, hidden for supporters); leaderboard 후원자 chip. | ✅ this commit |

Process per WU: subagent (supervised) → vitest + eslint → tsc → commit+push.

### Status: COMPLETE
All units shipped (494 tests, tsc 0, build OK). Deploy note: apply `supabase/migrations/0005_supporter_badge.sql` to prod for the badge column.
