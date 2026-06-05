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
   - `clean-bonus` active and fours == 0: **+120** (`CLEAN_BONUS = 120`)
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

## 4b. Interactive SELECT rules (resumable cascade)
Three `select`-type rules (build `order`) PAUSE the cascade for player input,
then RESUME. Selectable cells = any cell NOT frozen by a pre-roll lock (locked
cells are absolute and off-limits). Cells an earlier rule already wrote ARE still
selectable — the select rule simply OVERWRITES them (pure sequential model).
- `select-copy` (SELECT COPY): player picks ONE non-locked cell at index i≥1;
  `cell[i] = cell[i-1]`. Eligible cells = non-locked AND index ≥ 1.
  If none eligible → AUTO-SKIP (no pause; step "SELECT COPY (건너뜀)").
- `select-swap` (SELECT SWAP): player picks TWO non-locked cells a,b; swap their
  symbols. Needs ≥ 2 non-locked cells; fewer → AUTO-SKIP.
- `select-reroll` (SELECT REROLL): player picks ONE non-locked cell i; reroll via
  `rollSymbol(weights, rng)`. Needs ≥ 1 non-locked cell; none → AUTO-SKIP.
When a select rule resolves (player picked, or it auto-skips) it pushes a
`SpinLogStep` (label = rule name, or "{name} (건너뜀)" when skipped) like other
cascade rules.

### Resumable cascade engine (`lib/cascade.ts`)
A single engine backs both the pure path and the interactive store path:
- `beginCascade(base, rules, ctx, opts?)`: runs the PRE-ROLL HOLD pass, captures
  `baseResult`, returns a frame
  `{ working, locked, steps, baseResult, slotIndex, pending, done, interactive }`
  and immediately advances.
- `advanceCascade(frame, rules, ctx, opts?)`: processes non-lock/weight/score
  rules from `frame.slotIndex` (pure sequential — a later rule overwrites an
  earlier one; only `locked` cells are off-limits). On a `select` rule that needs
  input it sets `frame.pending = { kind, ruleName, selectable }` and RETURNS
  (paused; slotIndex stays on that rule). Auto-skipped select rules push their
  step and continue. When all slots are processed `frame.done = true`. With
  `opts.autoSkipSelect`, select rules ALWAYS auto-skip (the pure path).
- `resolveSelection(frame, rules, ctx, indices)`: applies the pending select rule
  with the chosen indices (copy/swap/reroll) — overwriting those cells — pushes a
  step, sets `frame.interactive = true`, clears `pending`, advances past the rule,
  then continues advancing to the next pause or completion.

`applyRules` (lib/applyRules.ts) is a thin wrapper that runs
`beginCascade(..., { autoSkipSelect: true })` to completion, so it stays pure &
total — a `select` rule encountered there always AUTO-SKIPS.

## 5. Rule application (`applyRules`)
Three phases:
- **Weight phase (pre-roll)**: `computeWeights(slotRules, BASE_WEIGHTS)` multiplies weights for
  every active `weight`-type rule (in `computeWeights`: `seven-fever` seven ×3, `fruit-surge` each
  fruit ×3, `gem-surge` each gem ×3, `no-zero` zero → 0, `diamond-cut` diamond → 0 AND sapphire → 0),
  then the board is rolled by
  `rollBoard(slotRules, weights,
  previousResult, rng)` (5 cells). `rollBoard` honors the `number-spin` PRE-ROLL roll-restriction:
  if `number-spin` is active, every cell `i` whose `previousResult[i]` was a number (seven/zero/four)
  is rolled restricted to {seven, zero} (via `rollSymbolFrom`) so it lands on 0 or 7 (never 4); all
  other cells roll normally with `rollSymbol`. With `number-spin` absent, `rollBoard` ≡ `baseSpin`.
  `baseSpin` is retained for other callers/tests. **Exception by id:**
  `four-shield` is a `reroll` rule but ALSO multiplies the `zero` weight by **×2** in this phase
  (checked by id, like the weight rules; stacks multiplicatively with other weight rules).
- **PRE-ROLL HOLD phase (locks)**: BEFORE the cascade, scan ALL slot rules. For each `lock` rule
  freeze its cell(s) to the PREVIOUS spin value: `center-lock` → cell[2] = previousResult[2],
  `last-lock` → cell[4] = previousResult[4], `fruit-freeze` → the leftmost TWO indices of
  `previousResult` whose symbol is a FRUIT (cherry/lemon/grape) are each held to that previous value
  (if fewer than two fruits exist, hold however many there are: 0, 1, or 2). A held cell is set
  `locked=true`. A held
  cell **does not spin** and is **ABSOLUTE**: it is order-independent — no later reroll/transform/meta
  can ever change it regardless of slot position, and lock order among themselves is irrelevant
  (different cells). Locks push **no** `SpinLogStep`s. The `lock`-type rules are
  `center-lock`, `last-lock`, and `fruit-freeze`.
  After this phase, `baseResult = [...working]` is captured: this is the effective LANDING board with
  held cells = previous value and all other cells = the raw roll. `applyRules` returns it.
- **Cascade phase (post-roll)**: iterate slot rules **top → bottom** (index 0→4). For each active rule
  that is NOT `weight`, NOT `score`, and NOT `lock` (locks were already applied), apply its effect to
  the working array and push a `SpinLogStep { label, result: <copy>, locked: <copy> }`.

**Conflict model — PURE SEQUENTIAL (top→bottom; a later rule overwrites the current board).** Held
(locked) cells are resolved PRE-ROLL and are ABSOLUTE: a locked cell is frozen and NO rule may ever
change it, regardless of slot position. Every OTHER (non-lock) rule applies in slot order to the
working board and writes its target cell(s) FREELY — overwriting whatever an earlier rule wrote. The
ONLY restriction on any reroll/transform/select/meta write is that it must never touch a `locked`
cell. There is NO first-claim / "upper wins" anymore; the LATER rule wins. Reading a cell always
reads its current (most-recently-written) value. Consequences:
- A `lock` ALWAYS protects its cell, regardless of slot position — the hold is pre-roll and absolute.
- Among non-lock rules ORDER MATTERS and the LOWER (later) rule wins. Example: `gem-fish` rerolls
  cell1, then `left-pair` below it overwrites cell1 = cell0; if the order is reversed, `left-pair`
  sets cell1 = cell0 first and `gem-fish` may then reroll it. A lower rule is never silently
  no-op'd by an earlier write.

`locked: boolean[5]` is set true for each cell frozen by a lock rule in the pre-roll hold pass (used
by the UI to render frozen cells greyed-out for the WHOLE reveal — they never spin). Each
`SpinLogStep` carries a `locked` snapshot; `applyRules` returns the final `locked` array too.

"write a cell" = set it unless it is `locked` (then it overwrites the current value). "reroll a cell"
= write it via `rollSymbol(weights, rng)` (full active weights) unless a rule specifies a restricted
set. Every reroll/transform below targets only NON-locked cells; a "leftmost X" reroll finds the
leftmost NON-locked cell matching X.

Per-rule post-roll behavior (cell indices 0-based):
- `four-shield` (reroll): every cell == four (and not locked) rerolled once. (Also applies a
  zero ×2 weight in the pre-roll weight phase — see above.)
- `four-parry` (reroll, loop-until): the leftmost NON-locked cell == four is rerolled REPEATEDLY
  (`rollSymbol`, full weights) until it is NOT a four, capped at **30** iterations. No-op if no such
  cell. (Mirrors the fruit-fish/gem-fish loop pattern.)
- `gem-shuffle` (reroll, loop-until): the leftmost NON-locked GEM cell is rerolled REPEATEDLY
  (`rollSymbol`, full weights) until it is NOT a gem, capped at **30** iterations. No-op if no such
  cell. [anti-gem]
- `fruit-fish` (reroll, loop-until): the leftmost NON-locked NON-fruit cell (a number or gem) is
  rerolled REPEATEDLY until it IS a fruit, capped at **30** iterations. No-op if none.
- `gem-fish` (reroll, loop-until): the leftmost NON-locked NON-gem cell (a number or fruit) is
  rerolled REPEATEDLY until it IS a gem, capped at **30** iterations. Symmetric to
  `fruit-fish`. No-op if none.
- `number-spin` (weight): PRE-ROLL roll-restriction, NOT a post-roll cascade rule. It is handled in
  `rollBoard` during the roll (see §5) and produces NO step. It is skipped by the cascade.
- `left-pair` (transform): cell[1] = cell[0].
- `center-echo` (transform): cell[3] = cell[1].
- `third-mirror` (transform): cell[2] = cell[4].
- `first-cherry` (transform): cell[0] = 'cherry'.
- `safe-convert` (transform): ALL NON-locked four → ruby (loops over every cell, skipping locked
  cells; no-op if none).
- `zero-to-seven` (transform): ALL zero → seven (NON-locked cells).
- `red-dye` (transform): ALL NON-locked lemon AND diamond → cherry (ruby is untouched).
- `blue-dye` (transform): ALL NON-locked lemon AND diamond → sapphire.
- `center-lock` (lock): PRE-ROLL HOLD — cell[2] held at previousResult[2]; locked[2]=true. Resolved
  before the spin; the cell does not spin and is absolute (cannot be changed by any other rule).
- `last-lock` (lock): PRE-ROLL HOLD — cell[4] held at previousResult[4]; locked[4]=true. Same as above.
- `fruit-freeze` (lock): PRE-ROLL HOLD — the leftmost two indices of previousResult whose symbol is a
  FRUIT (cherry/lemon/grape) are held to those previous values; locked=true on each (0/1/2 cells
  depending on how many fruits the previous result had). Resolved before the spin; held cells do not
  spin and are absolute.
- `diamond-cut` (weight): PRE-ROLL weight rule — sets diamond weight = 0 AND sapphire weight = 0, so
  neither symbol can appear this spin. No post-roll cascade effect.
- `copy-above` (meta): duplicates the EFFECT of the rule directly above (`slotRules[i-1]`), for
  ALL rule types:
  - post-roll cascade types (reroll/transform): the effect is re-applied once on the board in
    applyRules (overwriting per the sequential model — e.g. a re-applied transform writes its target
    again; a re-applied "leftmost X" reroll picks the now-leftmost matching NON-locked cell, which may
    differ from the first pass), pushing a step `label: "COPY ABOVE → {above.name}"`.
  - `weight` rules: the multiplier is applied an extra time in `computeWeights` (via
    `expandRules`). No board change; the step is still labeled with the copied rule's name.
  - `score` rules (seven-double / bonus-77 / clean-bonus): counted an extra time in `scoreResult`
    (via `expandRules`) — seven-double doubles again (×2 per occurrence), bonus-77/clean-bonus add
    their value again. No board change; step labeled with the copied rule's name.
  If the slot above is empty/null, a `copy-above`, or a `lock` (locks are pre-roll, nothing to
  duplicate on the board), COPY ABOVE is a no-op ("COPY ABOVE → (none)"). It never recurses into
  another copy-above. `expandRules(slots)` (lib/expandRules.ts) produces the effect-expanded list
  used by computeWeights and scoreResult.
- `weight` and `score` types: no post-roll effect (handled in roll / scoring).

`applyRules` returns `{ finalResult, steps, locked, baseResult }`, all fresh copies. `baseResult`
already has held cells = previous value (and all other cells = the rolled base).

## 6. Rule pool (29)
Type ∈ `weight | reroll | transform | lock | score | meta | select`. Grouped by `build`.
All `description` strings are CLEAN KOREAN SENTENCES — no emojis, no arrows, no parentheses.

| id | name | build | type | effect |
|---|---|---|---|---|
| seven-fever | SEVEN FEVER | 7 | weight | seven weight ×3 |
| seven-double | SEVEN DOUBLE | 7 | score | 7-based score ×2 this spin |
| zero-to-seven | ZERO ASCEND | 7 | transform | all 0 → 7 |
| number-spin | NUMBER SPIN | 7 | weight | PRE-ROLL: cells that started as a number land on 0 or 7 (never 4) |
| fruit-surge | FRUIT SURGE | fruit | weight | fruit weight ×3 |
| diamond-cut | DIAMOND CUT | fruit | weight | diamond weight → 0 AND sapphire weight → 0 (neither appears) |
| fruit-fish | FRUIT FISH | fruit | reroll | leftmost non-fruit cell reroll until fruit (cap 30) |
| gem-surge | GEM SURGE | gem | weight | gem weight ×3 |
| gem-fish | GEM FISH | gem | reroll | leftmost non-gem cell reroll until gem (cap 30) |
| first-cherry | FIRST CHERRY | color | transform | cell1 → 🍒 |
| red-dye | RED DYE | color | transform | all 🍋 and 💎 → 🍒 |
| blue-dye | BLUE DYE | color | transform | all 🍋 and 💎 → 🔵 |
| center-lock | CENTER LOCK | order | lock | cell3 keeps previous spin value |
| last-lock | LAST LOCK | order | lock | cell5 keeps previous value |
| fruit-freeze | FRUIT FREEZE | order | lock | leftmost two fruit cells of the previous result are held |
| left-pair | LEFT PAIR | order | transform | cell2 = cell1 |
| center-echo | CENTER ECHO | order | transform | cell4 = cell2 |
| third-mirror | THIRD MIRROR | order | transform | cell3 = cell5 |
| copy-above | COPY ABOVE | order | meta | re-apply the active rule directly above |
| select-copy | SELECT COPY | order | select | player picks one cell (i≥1); cell[i] = cell[i-1] |
| select-swap | SELECT SWAP | order | select | player picks two cells; swap their symbols |
| select-reroll | SELECT REROLL | order | select | player picks one cell; reroll it |
| no-zero | NO ZERO | safe | weight | zero weight → 0 (no zeros) |
| four-shield | FOUR SHIELD | safe | reroll | all 4s reroll once; this spin zero weight ×2 |
| four-parry | FOUR PARRY | safe | reroll | leftmost 4 reroll until not a 4 (cap 30) |
| safe-convert | SAFE CONVERT | safe | transform | all 4 → 🔴 |
| gem-shuffle | GEM SHUFFLE | safe | reroll | leftmost gem cell reroll until non-gem (cap 30) [anti-gem] |
| bonus-77 | LUCKY SEVEN-SEVEN | score | score | +77 points |
| clean-bonus | CLEAN SWEEP | score | score | +120 if no 4s on board |

(Removed in v2.1: lucky-convert, edge-mirror, fourth-lock, zero-fog, zero-break.)
(Removed in v2.2: unique-second.)
(Added in v2.3: select-copy, select-swap, select-reroll. Pool is now **29 rules**.)

## 7. Types
```ts
type RuleType = 'weight' | 'reroll' | 'transform' | 'lock' | 'score' | 'meta' | 'select';
type Rule = { id: string; name: string; description: string; type: RuleType; build?: string };

type SelectKind = 'copy' | 'swap' | 'reroll';
type PendingSelection = {
  kind: SelectKind; ruleName: string;
  count: number;          // cells to pick: copy/reroll=1, swap=2
  selectable: boolean[];  // which cells the player may pick (length 5)
};

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
  pendingSelection: PendingSelection | null; // set while status === 'awaiting-selection'
};

type GameStatus =
  | 'start' | 'choosing-rule' | 'placing'
  | 'ready-to-spin' | 'spinning' | 'spin-result' | 'finished'
  | 'awaiting-selection';   // paused mid-cascade for a `select` rule's input

type SpinLog = {
  spinIndex: number; baseResult: SymbolType[]; steps: {label:string; result:SymbolType[]}[];
  finalResult: SymbolType[]; hand: string; handScore: number; sevenScore: number;
  bonusScore: number; penalty: number; baseRoundScore: number; multiplier: number;
  roundScore: number;       // baseRoundScore * multiplier
  zeroDraw: boolean;        // zeros>=3 triggered extra pick
  multiplierSet: number;    // multiplier granted to next spin (1 if none)
  interactive: boolean;     // true if a `select` rule actually resolved this spin
};
```

## 8. Store status flow & actions
`start → choosing-rule (offer 3) → placing → ready-to-spin → spinning → spin-result → (choosing-rule | finished)`

When the cascade hits a `select` rule the spin PAUSES:
`ready-to-spin → spin() → awaiting-selection → selectCells(...) → (awaiting-selection | spin-result)`.
The in-progress `CascadeFrame` is held in a closure variable inside
`buildInitializer` (NOT in GameState).

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
- `spin()` — from 'ready-to-spin'. weights = computeWeights; base = rollBoard;
  frame = beginCascade(base, ruleSlots, {previousResult, weights, rng}). If
  `frame.pending` → set `currentResult = frame.working`, `pendingSelection`
  (kind/ruleName/count/selectable), status 'awaiting-selection' (frame stashed in
  the closure). Else `finalize(frame)`.
- `selectCells(indices)` — from 'awaiting-selection'. Validate (right count, all
  distinct, all selectable), then `resolveSelection(frame, ...)`. If pending again
  → update currentResult/pendingSelection, stay 'awaiting-selection'. Else
  `finalize(frame)`.
- `finalize(frame)` — score/items/specials on `frame.working`; build the SpinLog
  (baseResult = frame.baseResult, steps = frame.steps, finalResult = frame.working,
  lockedCells = frame.locked, `interactive = frame.interactive`, plus the usual
  fields); apply nextMultiplier; push log; advance currentResult/previousResult/
  nextMultiplier/extraRulePickCount; status 'spin-result'; pendingSelection = null;
  clear the stashed frame. (This is the shared tail of spin/selectCells.)
- `next()` — from 'spin-result'. If extraRulePickCount>0: decrement, offer 3, status 'choosing-rule'
  (do NOT advance spinIndex). Else spinIndex++; if >= maxSpins → 'finished' else offer 3,
  status 'choosing-rule'.
- `reset()` — fresh 'start', keep nickname; clears pendingSelection and the
  stashed cascade frame.

### Reveal behavior for interactive spins
`useSpinReveal`: if `latestLog.interactive` is true, the reveal jumps straight to
the final board + scoreReady (NO roll/step playback), same as the reduced-motion
path — the player already watched the cascade resolve interactively. During
'awaiting-selection' there is no new log yet, so the reveal hook stays idle and
`SlotMachine` shows the store's `currentResult` (the partial board), with
selectable cells rendered clickable. Non-interactive spins keep the animated
reveal.

Offering excludes any rule currently in a slot OR the bag (compare by id). With 26 rules this never
starves a 3-card offer.

## 9. UI requirements (summary; details in UI task)
- 5 rule slots shown vertically, numbered 1–5, with an explicit "위 → 아래 순서로 적용" indicator.
- A bag area; drag-and-drop (@dnd-kit) between slots and bag, plus reorder within.
- After picking a card (`placing`), the player drops/clicks it into a slot or the bag.
- StatusBar shows Spin X / 7 and the active nextMultiplier badge when > 1.
- An in-game button opens a reference modal listing all rules (by build) + the full score table.
- Symbols rendered via Twemoji SVG (fruits/gems) and styled number badges (7/0/4).
- Reduced-motion respected.
