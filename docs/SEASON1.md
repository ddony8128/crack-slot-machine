# RULE SLOT Season 1 — build status

Branch `season-1` (off `main`). Public-test season: accounts + 4 modes + season ranking.
`CLIENT_VERSION=2.0.0`, `RULESET_VERSION=2`, season slug `2026-06-season-1`
(6/15 12:00 ~ 6/28 12:00 KST).

## Done & verified (tsc 0 · 220 tests · build ✓ · daily play E2E ✓)

**Foundation**
- Schema `supabase/migrations/0002_season1.sql`: `players`(auth, soft-delete), `seasons`,
  `best_scores`, `daily_challenges`, `puzzle_stages`; `game_runs` generalized to all modes
  (player_id/season_id/mode/daily_date_key/puzzle_key/stage_index/cleared/…); event flow intact.
- `Db` interface + **both** impls (memory + supabase) for every new method; memory DB now a
  `globalThis` singleton so local-dev-without-Supabase shares one store across pages+routes.
- Player auth: `lib/server/{password,playerSession,playerAuth}.ts` (scrypt + HMAC cookie `rs_player`).
  API `/api/auth/{signup,login,logout,me}` + `/signup` `/login` `/privacy` pages.
- Pure season scoring `lib/season/scoring.ts` (spire/puzzle/daily formulas + `buildSeasonRanking`,
  3000-pt cap, daily top-10) with tests.

**Daily challenge (fully working)**
- `lib/daily/challenge.ts` (KST 12:00 boundary date key, shared per-day seed, group rotation).
- API `/api/daily/{current,start,submit,leaderboard}`: 3 attempts/day, server replay-verify,
  best-score upsert. Pages `/season/daily` (play, reuses GameScreen) + `/season/daily/leaderboard`.

**Hub / ranking / quick**
- `/season` hub, `/season/leaderboard` (season ranking), `/me` (profile), `SeasonNav`, home → `/season`.
- `/quick` guest play (no login, no ranking, no submit).

## Scaffolded (forward-ready stubs, NOT yet playable)
- **Puzzle**: `lib/puzzle/config.ts` (10 puzzles: key/goal/spinLimit/sets), `/api/puzzles`,
  `/season/puzzle` list + `/season/puzzle/[key]` "준비 중". `best_scores`/`game_runs` ready (mode 'puzzle').
- **Spire**: `lib/spire/config.ts` (10 stage targets, reward types, artifacts), `/api/spire`,
  `/season/spire` preview "준비 중". DB ready (mode 'spire').

## To run / deploy
1. New Supabase project → run `0001_init.sql` then `0002_season1.sql`.
2. `.env.local`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`
   (the player session cookie is signed with `ADMIN_SESSION_SECRET`).
3. Local dev without Supabase falls back to the in-memory DB (seeds Season 1).

## Next implementation steps (in priority order)
1. **Puzzle play**: a goal auto-checker for `PuzzleGoal` + a PuzzleClient (reuse GameScreen with a
   fixed seed + spin limit) + `/api/puzzles/[key]/{start,submit}` → `best_scores` (mode 'puzzle', cleared).
2. **Spire run**: stage loop (5 spins/stage, target gating), reward selection (rule add/remove,
   bag adjust, artifacts), run state, `/api/spire/{start,submit-stage,finish}` → best run season points.
3. **Symbol-set expansion**: generalize the engine from fixed fruit/gem to groupA/groupB so daily
   rotation + puzzle/spire sets (괴담/카드/고양이/오컬트/시간) actually change play. Today the engine
   still uses the legacy 9 symbols; daily rotation labels are stored but not yet wired into play.
4. Admin: season create/activate, daily list, ranking CSV, verification-failure review.
