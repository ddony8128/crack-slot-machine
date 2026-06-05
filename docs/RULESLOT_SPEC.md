# RULE SLOT — Mechanics Spec (v2)

This is the single source of truth for the v2 rework. All implementation (engine,
store, UI) must conform to this. IDs and exact effects are stable contracts.

## 1. Core constants
- Reels (symbol cells): **5** (unchanged).
- Spins per game: **7** (`MAX_SPINS = 7`).
- Rule slots: **5**, applied **top → bottom** (slot index 0 = top … 4 = bottom).
- Offered rule cards per pick: **3** (was 4).
- Bag: unlimited holding area for rules not currently slotted. Bag rules are **inactive**
  (not applied, not scored, not seen by COPY ABOVE).
- Start reels: `['zero','zero','zero','zero','zero']`.

## 2. Symbols (9)
| key | group | color | display |
|---|---|---|---|
| cherry | fruit | red | 🍒 (Twemoji SVG) |
| lemon | fruit | — | 🍋 |
| grape | fruit | blue | 🍇 |
| diamond | gem | — | 💎 |
| ruby | gem | red | 🔴 |
| sapphire | gem | blue | 🔵 |
| seven | number | — | styled badge "7" |
| zero | number | — | styled badge "0" |
| four | number | — | styled badge "4" |

- FRUITS = cherry, lemon, grape. GEMS = diamond, ruby, sapphire.
- RED set = {ruby, cherry}. BLUE set = {sapphire, grape}. (diamond, lemon, numbers are colorless.)
- **Base weights are UNIFORM: every symbol weight = 1 (≈ 11.11% each).** `BASE_WEIGHTS` all 1.

## 3. Scoring (rule-aware)
`scoreResult(finalResult, activeSlotRules)` returns `{ hand, handScore, sevenScore, bonusScore, penalty, baseRoundScore }`.
Scoring sees the **active slot rules** because some rules modify score directly.

Let cells = finalResult (5). counts of each symbol. sevens, fours, zeros = respective counts.

1. **Seven score** by count: `{1:10, 2:77, 3:150, 4:500, 5:777}[sevens]` else 0.
   - If `seven-double` is active → sevenScore × 2.
2. **Hand score** — n-of-a-kind among the 6 COLORED symbols only (numbers ignored). Take the single best:
   - five of a kind (some colored symbol count = 5): **700**
   - four of a kind (max colored count = 4): **300**
   - full house (a colored triple AND a colored pair, i.e. counts include 3 and 2): **180**
   - triple (max colored count = 3, not full house): **30**
   - two pair (two distinct colored symbols each count = 2): **90**
   - pair (one colored symbol count = 2): **10**
   - else hand = "No Hand", 0.
3. **Color/type bonuses** (additive, can stack with each other and with hand):
   - all 3 fruit types present (cherry & lemon & grape each ≥1): **+50**
   - all 3 gem types present (diamond & ruby & sapphire each ≥1): **+80**
   - only fruits (all 5 cells are fruits): **+100**
   - only gems (all 5 cells are gems): **+150**
   - all blue (all 5 cells ∈ {sapphire, grape}): **+200**
   - all red (all 5 cells ∈ {ruby, cherry}): **+250**
4. **Score-rule bonuses** (from active slot rules):
   - `bonus-77` active: **+77**
   - `clean-bonus` active and fours == 0: **+100** (`CLEAN_BONUS = 100`)
5. **Four penalty**: `penalty = fours * 20` (subtracted).
6. `baseRoundScore = sevenScore + handScore + colorBonuses + scoreRuleBonuses - penalty`.

### Global multiplier (applied in the store, not scoreResult)
- The store holds `nextMultiplier` (default 1). When a spin resolves:
  `roundScore = baseRoundScore * nextMultiplier`, then `nextMultiplier` resets to 1.
- Multiplier applies to the WHOLE round score including negatives.

## 4. Special triggers (detected on finalResult, affect NEXT spin)
Evaluated after the round resolves:
- **zeros ≥ 3** → grant +1 extra rule pick before the next spin (`extraRulePickCount += 1`).
  (Replaces the old 2-seven "RULE DRAW". If it triggers on the last spin, it is simply wasted.)
- **fours == 4** → `nextMultiplier = 3` (applies to the NEXT spin's score, 1 use).
- **fours == 5** → `nextMultiplier = 4` (1 use).
  (If both somehow apply, fours==5 wins. fours==4/5 also incur the normal -20/four penalty this spin.)

## 5. Rule application (`applyRules`)
Two phases:
- **Weight phase (pre-roll)**: `computeWeights(slotRules, BASE_WEIGHTS)` multiplies weights for
  every active `weight`-type rule, then `baseSpin` rolls 5 cells. **Exception by id:**
  `four-shield` is a `reroll` rule but ALSO multiplies the `zero` weight by **×2** in this phase
  (checked by id, like the weight rules; stacks multiplicatively with other weight rules).
- **Post-roll phase**: iterate slot rules **top → bottom** (index 0→4). For each active rule that is
  NOT `weight` and NOT `score` type, apply its effect to the working array and push a
  `SpinLogStep { label: rule.name, result: <copy> }`.

**Conflict model — "upper wins" (first-claim).** Maintain `claimed: boolean[5]` (all false). The
FIRST rule to WRITE a cell claims it; any later rule that would write the same cell is skipped.
Reading a cell always reads its current value. Consequences:
- A `lock` only protects a cell when placed ABOVE the reroll/transform it wants to block (the lock
  claims the cell first, so later rules skip it).
- A reroll/transform placed ABOVE a lock claims the cell first, so the lock then finds it claimed
  and FAILS (the cell is not frozen). i.e. "고정이 굴림/변환보다 위에 있어야 적용된다."
- Among non-lock rules the same first-claim rule holds: the topmost rule touching a cell wins.

Also maintain `locked: boolean[5]` set true ONLY when a `lock` rule successfully claims its cell
(used by the UI to render frozen cells greyed-out as the reveal cascades top→bottom). Each
`SpinLogStep` carries a `locked` snapshot; `applyRules` returns the final `locked` array too.

"write a cell" = set it only if unclaimed, then mark it claimed. "reroll a cell" = write it via
`rollSymbol(weights, rng)` (full active weights) unless a rule specifies a restricted set. Every
reroll/transform/lock below targets only UNclaimed cells.

Per-rule post-roll behavior (cell indices 0-based):
- `four-shield` (reroll): every cell == four (and not locked) rerolled once. (Also applies a
  zero ×2 weight in the pre-roll weight phase — see above.)
- `four-parry` (reroll): the leftmost non-locked cell == four rerolled once (one only).
- `gem-shuffle` (reroll): the leftmost non-locked GEM cell rerolled once (one only). [anti-gem]
- `fruit-fish` (reroll): the leftmost non-locked NON-fruit cell (a number or gem) rerolled once
  (one only).
- `gem-fish` (reroll): the leftmost non-locked NON-gem cell (a number or fruit) rerolled once
  (one only). Symmetric to `fruit-fish`.
- `number-spin` (transform): every non-locked cell that is a number (seven/zero/four) rerolled using
  weights RESTRICTED to {seven, zero, four} (renormalized), so it stays a number. (Typed
  `transform` for build grouping, but mechanically uses rng and claims cells like a reroll.)
- `unique-second` (reroll): while cell[1] equals any other cell's symbol, reroll cell[1]
  (full weights). Cap at 30 iterations to avoid infinite loops. (Skip if cell[1] is locked.)
- `left-pair` (transform): cell[1] = cell[0].
- `center-echo` (transform): cell[3] = cell[1].
- `third-mirror` (transform): cell[2] = cell[4].
- `first-cherry` (transform): cell[0] = 'cherry'.
- `safe-convert` (transform): leftmost four → ruby (one only; no-op if none).
- `zero-to-seven` (transform): ALL zero → seven.
- `diamond-to-lemon` (transform): ALL diamond → lemon.
- `grape-to-sapphire` (transform): ALL grape → sapphire.
- `red-dye` (transform): ALL ruby → cherry.
- `blue-dye` (transform): ALL diamond → sapphire.
- `center-lock` (lock): cell[2] = previousResult[2]; locked[2]=true.
- `last-lock` (lock): cell[4] = previousResult[4]; locked[4]=true.
- `copy-above` (meta): let `above = slotRules[thisSlotIndex - 1]`. If `above` exists (active,
  non-null) AND is a post-roll type (reroll/transform/lock/meta), re-apply its effect once
  (same semantics as above) and push a step `label: "COPY ABOVE → {above.name}"`. If the slot
  above is empty/null, or is a weight/score type, COPY ABOVE is a no-op (still push a step noting
  no effect). COPY ABOVE does NOT recurse into another copy-above.
- `weight` and `score` types: no post-roll effect (handled in roll / scoring).

`applyRules` returns `{ finalResult, steps }` with finalResult a fresh copy.

## 6. Rule pool (27)
Type ∈ `weight | reroll | transform | lock | score | meta`. Grouped by `build`.

| id | name | build | type | effect |
|---|---|---|---|---|
| seven-fever | SEVEN FEVER | 7 | weight | seven weight ×3 |
| seven-double | SEVEN DOUBLE | 7 | score | 7-based score ×2 this spin |
| zero-to-seven | ZERO ASCEND | 7 | transform | all 0 → 7 |
| number-spin | NUMBER SPIN | 7 | transform | number cells (7/0/4) re-rolled among {7,0,4} only |
| fruit-surge | FRUIT SURGE | fruit | weight | fruit weight ×2 |
| diamond-to-lemon | DIAMOND CUT | fruit | transform | all 💎 → 🍋 |
| fruit-fish | FRUIT FISH | fruit | reroll | leftmost non-fruit cell reroll once |
| gem-surge | GEM SURGE | gem | weight | gem weight ×2 |
| grape-to-sapphire | GRAPE FREEZE | gem | transform | all 🍇 → 🔵 |
| gem-fish | GEM FISH | gem | reroll | leftmost non-gem cell reroll once |
| first-cherry | FIRST CHERRY | color | transform | cell1 → 🍒 |
| red-dye | RED DYE | color | transform | all 🔴 → 🍒 |
| blue-dye | BLUE DYE | color | transform | all 💎 → 🔵 |
| center-lock | CENTER LOCK | order | lock | cell3 keeps previous spin value |
| last-lock | LAST LOCK | order | lock | cell5 keeps previous value |
| left-pair | LEFT PAIR | order | transform | cell2 = cell1 |
| center-echo | CENTER ECHO | order | transform | cell4 = cell2 |
| third-mirror | THIRD MIRROR | order | transform | cell3 = cell5 |
| copy-above | COPY ABOVE | order | meta | re-apply the active rule directly above |
| unique-second | UNIQUE SECOND | order | reroll | reroll cell2 until no other cell matches it |
| no-zero | NO ZERO | safe | weight | zero weight → 0 (no zeros) |
| four-shield | FOUR SHIELD | safe | reroll | all 4s reroll once; this spin zero weight ×2 |
| four-parry | FOUR PARRY | safe | reroll | leftmost 4 reroll once |
| safe-convert | SAFE CONVERT | safe | transform | leftmost 4 → 🔴 |
| gem-shuffle | GEM SHUFFLE | safe | reroll | leftmost gem cell reroll once (anti-gem) |
| bonus-77 | LUCKY SEVEN-SEVEN | score | score | +77 points |
| clean-bonus | CLEAN SWEEP | score | score | +100 if no 4s on board |

(Removed in v2.1: lucky-convert, edge-mirror, fourth-lock, zero-fog, zero-break.)

## 7. Types
```ts
type RuleType = 'weight' | 'reroll' | 'transform' | 'lock' | 'score' | 'meta';
type Rule = { id: string; name: string; description: string; type: RuleType; build?: string };

type GameState = {
  nickname: string;
  spinIndex: number;        // 0-based, 0..6; == maxSpins when finished
  maxSpins: number;         // 7
  totalScore: number;
  nextMultiplier: number;   // applied to NEXT spin's score (default 1)
  previousResult: SymbolType[];
  currentResult: SymbolType[];
  ruleSlots: Array<Rule | null>;  // length 5, applied top->bottom
  bag: Rule[];                    // inactive holding area
  offeredRules: Rule[];           // 3
  pendingRule: Rule | null;       // chosen card not yet placed
  extraRulePickCount: number;
  spinLogs: SpinLog[];
  status: GameStatus;
};

type GameStatus =
  | 'start' | 'choosing-rule' | 'placing'
  | 'ready-to-spin' | 'spinning' | 'spin-result' | 'finished';

type SpinLog = {
  spinIndex: number; baseResult: SymbolType[]; steps: {label:string; result:SymbolType[]}[];
  finalResult: SymbolType[]; hand: string; handScore: number; sevenScore: number;
  bonusScore: number; penalty: number; baseRoundScore: number; multiplier: number;
  roundScore: number;       // baseRoundScore * multiplier
  zeroDraw: boolean;        // zeros>=3 triggered extra pick
  multiplierSet: number;    // multiplier granted to next spin (1 if none)
};
```

## 8. Store status flow & actions
`start → choosing-rule (offer 3) → placing → ready-to-spin → spinning → spin-result → (choosing-rule | finished)`

- `setNickname(name)`
- `startGame()` — requires nickname; init slots [null×5], bag [], nextMultiplier 1, spinIndex 0,
  totalScore 0, previousResult/currentResult zeros, offer 3, status 'choosing-rule'.
- `selectRule(rule)` — from 'choosing-rule'; set pendingRule; status 'placing'.
- `placePending(target)` — target `{type:'slot', index}` or `{type:'bag'}`. Place pendingRule.
  If target slot occupied, displaced rule moves to bag. pendingRule=null; status 'ready-to-spin'.
- `cancelSelection()` — from 'placing' back to 'choosing-rule'.
- `moveRule(from, to)` — DnD rearrange between slots and bag (both 'ready-to-spin' & 'placing' allowed
  for free arranging). Locations: `{zone:'slot', index}` or `{zone:'bag', index}`.
  - slot↔slot: swap. slot→bag: clear slot, insert into bag at index. bag→slot: place; if slot
    occupied, occupant goes to bag. bag↔bag: reorder.
- `spin()` — from 'ready-to-spin'. Run weight→roll→applyRules(slot rules)→scoreResult(slot rules)→
  apply nextMultiplier→detect specials (set extraRulePickCount / nextMultiplier for next)→push log→
  status 'spin-result'.
- `next()` — from 'spin-result'. If extraRulePickCount>0: decrement, offer 3, status 'choosing-rule'
  (do NOT advance spinIndex). Else spinIndex++; if >= maxSpins → 'finished' else offer 3,
  status 'choosing-rule'.
- `reset()` — fresh 'start', keep nickname.

Offering excludes any rule currently in a slot OR the bag (compare by id). With 30 rules this never
starves a 3-card offer.

## 9. UI requirements (summary; details in UI task)
- 5 rule slots shown vertically, numbered 1–5, with an explicit "위 → 아래 순서로 적용" indicator.
- A bag area; drag-and-drop (@dnd-kit) between slots and bag, plus reorder within.
- After picking a card (`placing`), the player drops/clicks it into a slot or the bag.
- StatusBar shows Spin X / 7 and the active nextMultiplier badge when > 1.
- An in-game button opens a reference modal listing all rules (by build) + the full score table.
- Symbols rendered via Twemoji SVG (fruits/gems) and styled number badges (7/0/4).
- Reduced-motion respected.
