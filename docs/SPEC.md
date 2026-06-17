# RULE SLOT — 기획 (Single Source of Truth)

This document is the **canonical spec** for game content and scoring. When code and
this doc disagree, this doc wins — fix the code, or if the spec genuinely changed,
update this doc in the same change. Cross-check any content/scoring edit against this
file before shipping. See [Known deviations](#known-deviations--deferred) for accepted gaps.

> Why this exists: features were built piecemeal across waves without a single
> reference, so implementations drifted (non-spec pair bonuses leaked into scoring,
> rule descriptions accreted 사족, parking caps diverged). This file is the conformance baseline.

---

## Modes

| Mode | Config | Score record | Notes |
|---|---|---|---|
| **빠른 게임 (quick)** | none — legacy preset (pre-`season-1`) | local only | Must stay **identical to pre-`season-1`**. Fruit/gem only, base 족보 + 색/종류 보너스 + 규칙 보너스. No daily/season config. |
| **일일 도전 (daily)** | `RunConfig` from DB challenge (seed + 2 sets + basic rule set) | server replay → ranking | 5 base attempts/day, +5 via one ad refill (`DAILY_MAX_ATTEMPTS`). Only the day's best score ranks. First play of day: **+20 시즌 점수** (once/day). |
| **퍼즐 (puzzle)** | fixed seed + fixed rule bag per puzzle | clear / no-clear | Deterministic, solvable by skill not luck. p01, p02 (Season 1). Solver test asserts a clearing sequence exists. |
| **스파이어 (spire)** | `RunConfig`, escalating | run total | Target score, artifacts, rule buy/remove, 정산, 주머니 (symbol pouch). |

All non-quick modes are **replay-deterministic** (anti-cheat): `replayRun` / `replaySpireRun`,
guarded by `replayFuzz` (500 runs). Never introduce nondeterminism (`Math.random`, wall-clock)
into the scoring/cascade path.

---

## Symbol sets (`lib/symbols/sets.ts`)

Six sets, three symbols each. `number` is the odd one out (no base 족보 — see scoring).

| Set | id | symbols | per-set bonuses |
|---|---|---|---|
| 숫자 | `number` | 0, 4, 7 | none (number-specific rules instead) |
| 과일 | `fruit` | 🍒 체리, 🍋 레몬, 🍇 포도 | 3종 모두 +50, 다섯 칸 모두 +100 |
| 보석 | `gem` | 💎 다이아, 🔴 루비, 🔵 사파이어 | 3종 모두 +80, 다섯 칸 모두 +150 |
| 고양이 | `cat` | 🐱 치즈냥, 🐈‍⬛ 턱시도냥, 🐈 삼색냥 | 1개당 +30, 이웃한 1개당 −60, 3종 모두 +200 |
| 교통수단 | `vehicle` | ✈️ 비행기, 🚢 배, 🚗 자동차 | 이동 1회당 +20, 재굴림 1회당 +20 |
| 괴물 | `monster` | 🧛 드라큘라, 🧟 좀비, 👻 유령 | 복사 1회당 +40 |

**There are NO pair-bonus rules.** Cat is 고양이 3종, vehicle is 교통수단 3종 — independently.
"과수원 보석상" (fruit+gem pair) and "고양이 택시" (cat+vehicle pair) were **non-spec**
inventions (`lib/pairRules.ts`); removed. `PAIR_RULES = []` and must stay empty.

Score-table bonus labels (`bonusRowLabel` in `ReferenceModal.tsx`) must be self-explanatory:
- `all-types` → "{set} 3종 모두 등장"
- `all-symbols` → "다섯 칸 모두 {set}"
- `per-symbol` → "{set} 1개당"
- `adjacent-penalty` → "서로 이웃(바로 옆 칸)한 {set} 1개당" (negative)
- `per-event` → "{set} {이동|재굴림|복사} 1회당"

The 점수표 shows **only the sets in the current pool** — base 족보 + 숫자 세트 설명 + a card per present set.

---

## Base 족보 scoring (`data/scoreTable.ts`)

Computed on the **color/value** of symbols (not set membership). `number` set does not form 족보.

| 족보 | 점수 |
|---|---|
| 페어 (Pair) | 10 |
| 트리플 (Triple) | 30 |
| 투페어 (Two Pair) | 90 |
| 풀하우스 (Full House) | 180 |
| 포카드 (Four of a Kind) | 300 |
| 파이브카드 (Five of a Kind) | 700 |

족보 강화(`HAND_FLAT_UPGRADE`) = +50 flat; double upgrades multiply by `2 ** doubleCount`.

---

## Combo rules — A–B board effects (`lib/rules/combos.ts`)

Ten combo rules, `build: 'combo'`. A combo belongs to **two** sets, has a board EFFECT
(transform/reroll) during cascade (NOT a score bonus), joins the pool only when BOTH sets
are present, offered only when both sets can roll.

| id | sets |
|---|---|
| `red-dye` / `blue-dye` | fruit + gem |
| `ruby-convert` / `diamond-convert` | number + gem |
| `vandalism` / `why-here` | cat + vehicle |
| `shakedown` / `gem-obsession` | monster + gem |
| `combo-zombie-cat` / `combo-ghost-cat` | monster + cat |

---

## Rule-description style

- **한다체** (declarative plain form), uniform across all rule descriptions. No 합니다체.
- **No 사족**: don't append speculative/redundant clauses. Banned patterns:
  - "(유지된 칸은 이후 규칙으로 바뀔 수 있다)" / "이후 다른 규칙으로는 바뀔 수 있습니다."
  - "마지막 칸이 이전 스핀의 값을 유지한다" style over-explanation when "다음 스핀 첫 굴림에서 유지된다" already says it.
- Describe what the rule does, once, concretely.

Example (유료 주차): `교통수단 칸 중 원하는 2칸을 직접 골라 칸마다 30점을 잃는다. 고른 칸은 다음 스핀 첫 굴림에서 유지된다.`

---

## Select rules (`lib/cascade.ts` `selectCount`)

- `swap` → exactly 2.
- `park` (유료 주차) → **원하는 2칸**: the player keeps up to 2 vehicle cells of their
  choice — `min(2, #vehicles)`. (Capped at 2 by design: keeping every vehicle was too
  strong/사기. Reverted from an earlier "원하는 만큼" variable-count attempt.) Uses the
  standard fixed-count auto-complete select.
- default → 1.

---

## UI labels (renames)

- '시즌으로' / '시즌 허브로' / '공식 도전' are retired.
- exit (SpireClient) → **'나가기'**
- back-to-hub (Spire/Daily result) → **'메인 화면으로'**
- attempts label (Daily) → **'도전 횟수'**
- `/me` season score shows **"…점"**, never "/ 3000" (max is not 3000).

---

## Known deviations / deferred

1. **fruit/gem set 확률** use ×3 (matching FRUIT/GEM SURGE); spec calls for ×4 (`lib/symbols/sets.ts` header note). Unreconciled.

2. **`SYMBOL_SETS` not fully engine-wired.** The legacy engine uses fruit/gem `SymbolType`;
   cat/vehicle/monster set bonuses score from set membership + events, but those sets'
   own rules aren't all authored.

---

## Open bugs (reported, not yet fixed)

- **vehicle-parking next-spin skip**: after parking a vehicle, the next spin's 유료 주차 is skipped.
- **held-cell rolling animation**: held (parked/locked) cells still play a roll animation — should not.
- **same-value reroll animation**: a reroll that lands the same symbol looks like no roll happened
  (commit `c8e93da` addressed same-value rerolls; verify it covers this case / hasn't regressed).
