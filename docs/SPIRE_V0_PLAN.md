# 첨탑 오르기 (Spire) v0 — work-unit plan

Roguelike rebuild: the current spire is ONE continuous RC run with score-gating
(`spireProgress`). v0 replaces that with a **stateful, multi-attempt, shop-between-stages**
model. Each stage attempt is its own seeded RC run; persistent run state
(money / symbolBag / rulePool / handUpgrades / artifacts) mutates via the shop
between attempts. Server replays the action sequence + recomputes all economy.

## Locked decisions (from the spec, confirmed by the user)
1. **Shop opens after clear AND after fail (1–2).** 3rd fail = run end (no shop).
2. **Clear settlement order:** interest `floor(balance/5)` (on pre-payout balance)
   → remaining-spin bonus (+2/spin) → stage clear payout → shop.
   **Fail (1–2):** support +5 only (no interest/bonus/payout) → shop → retry same stage.
3. **Symbol bag is ALWAYS 20.** Increasing any symbol REQUIRES decreasing another
   (new set buy = +3 symbols, replace 3). First-set choice replaces 3 zeros.
4. **Hand upgrades are UNLIMITED.** `finalHand = (base + 50×flatCount) × 2^doubleCount`.

## Constants
- 10 stages, max **7** spins/stage, immediate clear when `stageScore ≥ target`.
- Targets: 500,1000,2000,4000,6000,8000,10000,12000,15000,20000.
- Clear payout: st1–3=4, st4–6=6, st7–9=8, st10=0.
- Start money 0. Start bag: 0×12, 4×5, 7×3 (=20). MAX_FAILURES=3. SPIN_BONUS=2.
  INTEREST_DIVISOR=5. FAIL_SUPPORT=5. RULE_POOL_MAX=10. BAG_TOTAL=20.
- Base rule pool (8): center-lock, last-lock, seven-fever, four-shield,
  seven-double, select-swap, select-reroll, select-copy. + 2 random from the
  chosen set = initial pool of 10.
- Shop prices: artifact slots [6,5,4]; symbol+1 = current count; new set = 3;
  rule = 1; hand +50 = 1; hand ×2 = 3; reroll = 1.
- Artifacts at stage 3/6/9 clear (choose 1 of 2, or skip). v0: temp/empty catalog;
  artifacts do NOT break the bag-20 cap.

## stageAttemptSeed (replay-deterministic)
`stageAttemptSeed = ${runSeed}:stage-${stage}:attempt-${attempt}`
`initialBoard = rollBoard(${stageAttemptSeed}:initial, symbolBag)`
Shop offers seeded from `${runSeed}:shop:${shopVisitIndex}:${rerollCount}`.

## Work units
| WU | Title | Scope | Status |
|----|-------|-------|--------|
| SP-A | Economy config + helpers | new targets/payouts/spins(7), money constants, base-rule ids, `spireInterest/spireSpinBonus/spireClearPayout`. Update old tests. | ✅ `fd1efb0` |
| SP-B | SpireRunState + pure reducers | state type + deterministic reducers: initSetChoice, buySymbolIncrement, buySymbolSet, buyRule(cap10+removal), buyHandFlat, buyHandDouble, rerollShop, settleClear, settleFail; `assertBag20`/`pickSetRules`/`addRulesToPool`. 50 tests. | ✅ `5c1696c` |
| SP-C | Hand-upgrade scoring | `(base+50×flat)×2^double` applied to hand score in score.ts, gated by a passed-in `handUpgrades`. | ✅ `5f7fc36` |
| SP-D | Stage-attempt run config | `stageAttemptSeed`, per-stage RC config from current bag/pool, immediate-clear (stop at target ≤7 spins). | ✅ `7083180` |
| SP-E | Run replayer + hand-upgrade threading | `SpireAction[]` + `replaySpireRun` (threads state across stages, replays each via existing replayRun); `RunConfig.handUpgrades`→finalize→scoring. Live React controller + recording lands with SP-H. | ✅ `48588a3` |
| SP-F | Authoritative verification | `verifySpireRun` — replay + claim-match + offered-set anti-tamper. Thin HTTP route + DB persistence land with SP-H (needs the live action stream). | ✅ `ea94332` |
| SP-G | DB persistence | SpireRunState snapshot + final record (reach stage, totalScore, money, artifacts); widen finalize `actions` to carry `SpireAction[]`. | ☐ |
| SP-H | Controller + Shop UI + seeded offer generator + submit route wiring | React controller drives stages×attempts×shop and records `SpireAction[]`; shop sections (artifact/symbol/set/rule/hand/reroll) + replace-symbol confirm; seeded shop-offer generator; wire `/api/spire/submit` to `verifySpireRun`. | ☐ |
| SP-I | First-set selection UI | already partial (choosing phase) — adapt to new state. | ☐ |
| SP-J | Artifacts | 3/6/9 selection + effects (v0 temp). | ☐ |
| SP-K | Resume | extend spireResume to the new SpireAction stream. | ☐ |

### Progress note (this session)
Foundation **SP-A–SP-D** complete, tested, pushed (full suite 462+ green, replay-fuzz green, tsc 0). The pure, replay-critical core is done: economy math, all shop/settlement reducers, hand-upgrade scoring, and per-stage seeding/clear. Remaining **SP-E–SP-K** is the integration layer (store state-machine, server replay extension, DB migration, shop UI, artifacts) — larger and interdependent; SP-E (controller) is the keystone that wires the foundation into a playable loop.

Process per WU: subagent (supervised) → vitest (scoped) + eslint → fix → tsc → commit+push.
Replay-fuzz + full suite at integration points. Build the new model additively;
swap SpireClient/routes off the old `spireProgress` at SP-E/F, then delete it.
