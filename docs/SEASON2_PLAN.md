# Season v0.2 — onboarding + rule-engine clarity work-unit plan

Builds on v0.1 (done: foundation, daily/puzzle/spire play, RC, config-driven scoring,
event log, position-aware CLEAN SWEEP). This phase: onboarding polish + making the
rule engine explicit (trigger timing, hold vs lock) and laying the groundwork the
new sets (cat/vehicle/monster) need.

Each WU: independently testable + committed (test + lint per unit).

| WU | Title | Scope | Risk | Status |
|----|-------|-------|------|--------|
| R1 | Rule trigger-timing (발동 시점) | add `phase` to Rule ('pre-spin'/'sequential'/'scoring'/'next-spin') + classify all 31 rules + timing badge in RuleCard/ReferenceModal; fix FOUR FORTUNE wording (감점 대신 +20). Data+UI, additive. | low | ✅ `d62a11f` |
| H1 | Season hub status cards | each mode card shows live status (daily N/M attempts + refill, puzzle cleared count, spire best stage/score). Server reads. | low | ✅ `1c65cd5` |
| O1 | Guest identity | backend-issued guest UUID + display name (게스트-####), localStorage; /quick uses it. | med | ✅ `5f12853`,`6a450e1` |
| O2 | Guest fast-game ranking | record quick runs (guest or member) → a fast-game leaderboard, version+season-scoped, NOT in season points; result-screen 회원가입 CTA. | med | ✅ `5f12853`,`6a450e1` |
| R2 | 유지(hold) — all current rules | DECISION: all current rules are hold (no 봉인). Held cells keep first-roll value but later rules can modify them; removed immutability; reworded rules. | med | ✅ `ae60a26` |
| O3 | Guest→account merge | on signup, optionally attach guest's quick records to the account. | low | ☐ |
| E1 | Cell-status board model | done as **E1-lite**: parallel `frame.haunted[]` (no board-type refactor); `computeHand` adds a phantom ghost per haunted cell. | high | ✅ `d89b811` |
| E2 | Symbol tags / hybrids | symbol tag system + hybrid symbols (zombie_cat…). | high | ⏸ deferred ON PURPOSE — no v0.2 rule produces/consumes a hybrid, so adding the symbols+tags now would be dead code. Land it WITH the first rule that needs it (e.g. a monster rule that turns a cat into a 좀비고양이), so the abstraction has a real consumer. |

### Post-v0.2 polish (done, beyond the table)
- ✅ `b2521f6` — config-driven 점수표 (set bonuses + pair rules from SYMBOL_SETS/PAIR_RULES).
- ✅ `76500b3` — haunted-cell 👻 indicator (SpinLog.haunted → board badge).
- ✅ `6e08843` — `[다음 스핀]` hold infra + 유료 주차 (the deferred S2 rule; finally exercises the next-spin category).
| S1 | Cat set rules | 식빵 굽기/우다다다/점프의 달인 (hold + rotate/swap; symbol_moved events). | med | ✅ `0ca2a3e` |
| S2 | Vehicle set rules | 러시아워/물류 사업/배 크다 (weight×slots, random swaps, copy-neighbors). 유료 주차 deferred (needs next-spin hold). | med | ✅ `a31a405` |
| S3 | Monster set rules | 유령 들림 (haunt) + 가족 만들기 (dracula copy → +40). | high | ✅ `d89b811` |
| D1 | A–B pair rules | config-driven `PAIR_RULES` + pool inclusion + generic pair-bonus scoring. | low | ✅ `0ec0ccf` |
| SP1 | Spire 이어하기 (resume) | localStorage {seed, set, actions}; resume re-dispatches actions (replay-safe). Reload→resume E2E ✓. | med | ✅ `76c7089` |

Process per WU: subagent implements (supervised) → vitest (scoped) + eslint → fix → tsc → commit+push. Periodic full tsc/vitest/next build at integration points.

## Remaining after this wave (recommended approach)
- **E1 (haunted cells) — do "E1-lite", NOT a full board refactor.** Add a parallel `haunted: boolean[]` to the cascade frame (threaded exactly like `locked`/`events`/`scoreBoards`); keep the board as `SymbolType[]`. `computeHand(board, haunted?)` adds a phantom `ghost` to the n-of-a-kind multiset for each haunted cell (hands only; set bonuses stay board-only for v0). Thread `haunted` through scoreResult/scoreItems/finalize/replay. Replay-fuzz must stay green. This is far lower risk than a `Cell[]` rewrite and covers 유령들린 칸.
- **S3 (monster) v0**: `monster-family` (가족 만들기 = copy leftmost dracula → leftmost non-dracula; the +40 copy bonus already rewards it) + `monster-haunt` (유령 들림 = mark leftmost monster cell haunted). Needs E1-lite. Defer hybrids.
- **E2 (hybrid symbols zombie_cat…)**: only if a rule actually needs them; otherwise skip for v0.
- **D1 (pair rules)**: pairRuleMap[`a+b`] (sorted key) merged into buildRulePool when both sets are in the run; ship with 1–2 example pair rules.
- **SP1 (spire resume)**: persist {seed, chosenSetId, actions} to localStorage during a run; resume = configureRun + beginRun + re-dispatch stored actions to rebuild state, then continue.
- **O3 (guest→account merge)**: on signup, a Db method to reassign the guest display-name's quick runs to the new player.

Notes / decisions captured from the spec:
- Quick game ranking is separate from season ranking; resets with the season; never feeds season points (state the copy in-UI).
- Guest UUID shown as `게스트-####`, never the raw UUID.
- Rule cards must show a TIMING badge (separate from the type/build) — it's load-bearing for understanding.
- FOUR FORTUNE = replaces the 4 penalty with +20/four (A안) — engine already does this; only the wording was ambiguous.
- CLEAN SWEEP is already [순서 적용] (position-aware, v0.1 WU-CS).
- Monster & vehicle sets need the event log (done) + Cell-status (E1) + tags (E2) before their rules (S3) are safe to add.
