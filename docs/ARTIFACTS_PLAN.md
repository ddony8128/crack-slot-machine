# 첨탑 아티팩트 시스템 + 확정 사항 — work-unit plan

Builds the artifact engine on the existing replay-deterministic spire model.
Artifacts live in `SpireRunState.artifacts: string[]` (threaded via `choose_artifact`),
flow into each stage's `RunConfig`, and their effects are applied deterministically
in score.ts / the store / the spire reducers — so server replay reproduces them.

## Locked decisions (from the spec)
- **No duplicate artifacts** in a run. Acquired ONLY via 3/6/9 clear selection or shop — never mid-stage. Owned ones are excluded from offers.
- **Number special hands** (4×4→next×2, 4×5→next×3, 0≥3→extra rule) are **ON only in 빠른 게임**. OFF in all season modes (daily/puzzle/spire) — in 첨탑 they activate ONLY via the 4 석상 / 0 석상 artifacts.
- Balance is intentionally left wide-open; everything is config-tunable, run logs to follow.

## Confirmations already shipped (prior turns)
- Donation feature (SR-F) — spec now prefers a result-screen card over a popup (minor UX; current modal works).
- Lazy daily settlement at noon — handled dynamically in buildSeasonRanking (settled = window ended vs `now`); explicit `score_events`/`settled_at` ledger is a possible later refinement.

## Artifact catalog (effect kind → where applied)
General: 콩의가호(rule-slot-2 applied twice·cascade), 타임캡슐(spin1=0, spin7×2·score), 가계부(interest×2·reducer), 차임벨(2 free rerolls·controller), 새하얀 도화지(empty active slot×50·score), 엔진(+1 first-spin pick·store), 맥가이버 칼(4 rule offers·store), 물뿌리개(onAcquire bag shift), 슬롯머신(onAcquire bag+pool reset).
Number: 4 석상(enable 4-special), 0 석상(enable 0-special).
Fruit: 영수증(all-fruit +300·score), 체리(+1 cherry in hand·score).
Gem: 금고(gem 3종 +200·score), 금괴(gem≥4 → +1 money·score+economy).
Cat: 캣 타워(cancel neighbor penalty·score), 녹아버린 고양이(stage spin1 no cat·weights).
Vehicle: 으스스한 유람선(vehicle copy ×40·score), 전용기(vehicle moved≥6 → spin ×2·score).
Monster: 괴물 자동차(monster move/reroll ×20·score), 빠루(monster reroll≥3 → spin ×2·score).

## Work units
| WU | Title | Scope | Status |
|----|-------|-------|--------|
| AR-A | Catalog + types | ArtifactDef + 21-artifact catalog, no-dup + set-required eligibility. | ✅ `2ba3f07` |
| AR-B | Number-specials gating | RunConfig.numberSpecials; detectSpecials(opts); quick=on, season=off, 첨탑 from 석상. | ✅ `bdbd5bf` |
| AR-C | Score-effect artifacts | 영수증/체리/금고/캣타워/새하얀도화지/유람선/괴물자동차/빠루/전용기 in score.ts. | ✅ `9d1c313` |
| AR-D | Economy + 타임캡슐 | 가계부(interest×2), 차임벨(free rerolls), 금괴(money), 타임캡슐(spin1=0/spin7×2). | ✅ `e4a5bcb` |
| AR-E | Provisioning | 맥가이버 칼(4 offers), 엔진(+1 first pick), 녹아버린 고양이(spin1 no cat). | ✅ `4c7c542` |
| AR-F | Shop buy + 석상 | shop artifact purchase (buyArtifact), 4석상/0석상 via spire config. | ✅ `4c7c542`/`bdbd5bf` |
| AR-G | onAcquire | 물뿌리개(bag shift), 슬롯머신(bag+pool reset), seeded. | ✅ `bc839f2` |
| AR-H | 콩의 가호 | bean-blessing — slot-1 rule applied twice via effective-slots duplication (cascade + scoring + select-pause). | ✅ this commit |

### Status: COMPLETE — all 21 artifacts implemented (566 tests, replayFuzz byte-identical, build OK).
Process per WU: subagent (supervised) → vitest + eslint → tsc → commit+push.
