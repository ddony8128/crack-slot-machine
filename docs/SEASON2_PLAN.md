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
| R2 | 유지(hold) vs 봉인(lock) | introduce a `hold` (first-roll-only, overwritable by later rules) distinct from the current immutable `lock`; reword rules; cascade支持. | med | ☐ |
| O3 | Guest→account merge | on signup, optionally attach guest's quick records to the account. | low | ☐ |
| E1 | Cell-status board model | board cells carry statuses (e.g. `haunted`); engine/score/reveal aware. DEEP — prerequisite for monster set. | high | ☐ |
| E2 | Symbol tags / hybrids | symbol tag system + hybrid symbols (zombie_cat…) as registered symbols + render. | high | ☐ |
| S1 | Cat set rules | 식빵굽기/우다다다/점프의 달인 … (hold + move/rotate via event log). | med | ☐ |
| S2 | Vehicle set rules | 유료 주차/물류 사업/배 크다 … (move/reroll triggers, selection-limited). | med | ☐ |
| S3 | Monster set rules | 가족 만들기/유령들림 … (needs E1+E2). | high | ☐ |
| D1 | A–B pair rules | `pairRuleMap[setA+setB]` included in a run's pool when present. | low | ☐ |
| SP1 | Spire 이어하기 (resume) | persist in-progress spire run (localStorage v0; DB later); resume vs new. | med | ☐ |

Process per WU: subagent implements (supervised) → vitest (scoped) + eslint → fix → tsc → commit+push. Periodic full tsc/vitest/next build at integration points.

Notes / decisions captured from the spec:
- Quick game ranking is separate from season ranking; resets with the season; never feeds season points (state the copy in-UI).
- Guest UUID shown as `게스트-####`, never the raw UUID.
- Rule cards must show a TIMING badge (separate from the type/build) — it's load-bearing for understanding.
- FOUR FORTUNE = replaces the 4 penalty with +20/four (A안) — engine already does this; only the wording was ambiguous.
- CLEAN SWEEP is already [순서 적용] (position-aware, v0.1 WU-CS).
- Monster & vehicle sets need the event log (done) + Cell-status (E1) + tags (E2) before their rules (S3) are safe to add.
