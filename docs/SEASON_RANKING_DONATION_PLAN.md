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
| SR-B | New pure formulas | puzzleScore / dailyRankReward+DAILY_FIRST_PLAY / spireSeasonScore / SUPPORTER_MIN_AMOUNT + cutoffs. Additive (old fns stay until SR-D swap). | ☐ |
| SR-C | Store the new data | puzzle submit → store spinsUsed/spinLimit; spire submit → store money + totalUnusedSpins (verifySpireRun returns them). | ☐ |
| SR-D | Swap buildSeasonRanking | use new formulas; daily = +20/day + settled-rank reward (lazy via `now`); remove per-mode caps per spec. | ☐ |
| SR-E | Score-rise API + animation | endpoints return SeasonScoreChange (recompute player total/rank before+after); slot count-up UI on result screens. | ☐ |
| SR-F | Donation + supporter badge | players.supporter_badge + admin grant UI; donation info + popup (daily-exhausted / spire-end / all-puzzles-cleared, localStorage dedup, hidden for supporters); ranking shows 후원자. | ☐ |

Process per WU: subagent (supervised) → vitest + eslint → tsc → commit+push.
