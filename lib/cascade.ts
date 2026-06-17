import type { EngineEvent, Rule, SelectKind, SpinLogStep, SymbolType } from '@/types';
import { CATS, FRUITS, GEMS, MONSTERS, VEHICLES } from '@/data/symbols';
import { rollSymbol, type Rng } from '@/lib/rng';

export type ApplyCtx = {
  previousResult: SymbolType[];
  weights: Record<SymbolType, number>;
  rng: Rng;
};

const FRUIT_SET = new Set<SymbolType>(FRUITS);
const GEM_SET = new Set<SymbolType>(GEMS);
const CAT_SET = new Set<SymbolType>(CATS);
const MONSTER_SET = new Set<SymbolType>(MONSTERS);
const VEHICLE_SET = new Set<SymbolType>(VEHICLES);

// VEHICLES = [plane, ship, car]; plane/ship literals drive the vehicle rules.
const PLANE: SymbolType = VEHICLES[0];
const SHIP: SymbolType = VEHICLES[1];

/** Max reroll iterations for loop-until-condition rules (fish/shuffle). */
const REROLL_CAP = 30;

/**
 * A `select` rule waiting for player input. `selectable[i]` is true for cells
 * the player may pick (computed per-rule from the current locked state).
 */
export type Pending = {
  kind: SelectKind;
  ruleName: string;
  selectable: boolean[];
  // Cells the player must pick: copy/reroll/family=1, swap=2, park=min(2, #vehicles).
  count: number;
};

/**
 * The full, resumable state of a spin cascade. The same frame is threaded
 * through `beginCascade` -> `advanceCascade` -> `resolveSelection` so the
 * resolution can PAUSE at a `select` rule (interactive) and RESUME later.
 *
 * `interactive` records whether any select rule actually resolved (used by the
 * store to flag the SpinLog and let the reveal skip playback).
 */
export type CascadeFrame = {
  working: SymbolType[];
  locked: boolean[];
  steps: SpinLogStep[];
  baseResult: SymbolType[];
  slotIndex: number;
  pending: Pending | null;
  done: boolean;
  interactive: boolean;
  // ADDITIVE per-spin engine event log (reroll/move/copy/transform/lock), in
  // application order. Read-only data for later set-scoring; emitted alongside the
  // normal board writes and NEVER affects board/score/reveal/replay outcome.
  events: EngineEvent[];
  // Board snapshot AT each score-rule's slot position (in order), so position-
  // sensitive score rules (e.g. CLEAN SWEEP) evaluate against the board at their
  // moment, not the final board. Includes copy-above re-applications of score rules.
  scoreBoards: Array<{ ruleId: string; board: SymbolType[] }>;
  // Per-cell "haunted" flags, threaded exactly like `scoreBoards`. A haunted cell
  // adds ONE phantom 'ghost' to the n-of-a-kind counts at scoring time (E1-lite).
  // No board/score effect on its own; read-only data consumed by computeHand.
  haunted: boolean[];
  // Cell indices to HOLD at the start of the NEXT spin (init []). The next-spin
  // rule 유료 주차 (vehicle-parking) pushes every vehicle cell here. The store
  // copies this onto the committed GameState.nextHoldCells, and the next spin()
  // feeds it back as beginCascade's `preHeld`. No board/score effect on its own;
  // pure cross-spin engine state so replay reproduces it deterministically.
  nextHold: number[];
};

/**
 * Write a cell. Under the PURE SEQUENTIAL + HOLD model a later rule freely
 * overwrites whatever an earlier rule wrote, INCLUDING a `locked` (pre-roll held)
 * cell — `locked` now means "held at the first roll (display only)", NOT immutable.
 * When a held cell is overwritten it is no longer held, so clear its flag. Always
 * writes; returns true.
 */
function write(
  working: SymbolType[],
  locked: boolean[],
  i: number,
  value: SymbolType,
): boolean {
  working[i] = value;
  if (locked[i]) locked[i] = false;
  return true;
}

/**
 * Apply a single non-lock, non-select, non-meta board rule (reroll/transform).
 * Mirrors the original applyRules switch. `select` and `lock` are handled
 * elsewhere; weight/score have no board effect.
 *
 * PURE SEQUENTIAL + HOLD: each rule writes its target(s) freely, overwriting any
 * earlier change, INCLUDING held (`locked`) cells — a held cell is only held on
 * the first roll, later rules may still change it. Writing a held cell clears its
 * held flag (un-greys it). "leftmost X" targeting therefore scans every cell.
 *
 * Returns the indices that were given a FRESH RANDOM ROLL (reroll rules only) so
 * the reveal can animate them even when the value repeats. Transforms return [].
 */
function applyOne(
  rule: Rule,
  working: SymbolType[],
  locked: boolean[],
  ctx: ApplyCtx,
  events: EngineEvent[],
  haunted: boolean[],
): number[] {
  const { weights, rng } = ctx;
  // ADDITIVE event helpers. They only PUSH to `events`; they never read or change
  // any board value, so removing them would leave the cascade outcome identical.
  const emitReroll = (symbolId: SymbolType, index: number) => {
    events.push({ type: 'symbol_rerolled', symbolId, index, byRuleId: rule.id });
  };
  const emitCopy = (symbolId: SymbolType, fromIndex: number, toIndex: number) => {
    events.push({ type: 'symbol_copied', symbolId, fromIndex, toIndex, byRuleId: rule.id });
  };
  const emitTransform = (
    fromSymbolId: SymbolType,
    toSymbolId: SymbolType,
    index: number,
  ) => {
    events.push({ type: 'symbol_transformed', fromSymbolId, toSymbolId, index, byRuleId: rule.id });
  };
  const emitMove = (symbolId: SymbolType, fromIndex: number, toIndex: number) => {
    events.push({ type: 'symbol_moved', symbolId, fromIndex, toIndex, byRuleId: rule.id });
  };
  // Haunt status events: ADDITIVE bookkeeping alongside the haunted[] writes. The
  // authoritative haunted state is the array; these only PUSH to `events` so later
  // EVENT-based scoring (흡혈귀 퇴마사) can count haunt removals.
  const emitHauntAdd = (index: number) => {
    events.push({ type: 'cell_status_added', status: 'haunted', index, byRuleId: rule.id });
  };
  const emitHauntRemove = (index: number) => {
    events.push({ type: 'cell_status_removed', status: 'haunted', index, byRuleId: rule.id });
  };
  switch (rule.id) {
    // ---- reroll ----
    case 'four-shield': {
      const rolled: number[] = [];
      for (let i = 0; i < working.length; i++) {
        if (working[i] === 'four') {
          const old = working[i];
          write(working, locked, i, rollSymbol(weights, rng));
          emitReroll(old, i);
          rolled.push(i);
        }
      }
      return rolled;
    }
    case 'fruit-vitamin': {
      // 비타민 보충: reroll EVERY fruit cell. Each emitReroll carries the OLD
      // (fruit) symbol — score.ts pays +VITAMIN_PER per such event (counts the
      // fruits at THIS moment, not the final board).
      const rolled: number[] = [];
      for (let i = 0; i < working.length; i++) {
        if (FRUIT_SET.has(working[i])) {
          const old = working[i];
          write(working, locked, i, rollSymbol(weights, rng));
          emitReroll(old, i);
          rolled.push(i);
        }
      }
      return rolled;
    }
    case 'cat-turf': {
      // 영역 다툼: reroll every cat cell that has an adjacent (left/right) cat.
      // Compute the targets FIRST (so adjacency is read at rule time, BEFORE any
      // reroll changes the board), THEN reroll them. Mirrors four-shield but gated
      // on the adjacency, like setBonuses' adjacent-penalty.
      const targets: number[] = [];
      for (let i = 0; i < working.length; i++) {
        if (!CAT_SET.has(working[i])) continue;
        const left = i > 0 && CAT_SET.has(working[i - 1]);
        const right = i + 1 < working.length && CAT_SET.has(working[i + 1]);
        if (left || right) targets.push(i);
      }
      for (const i of targets) {
        const old = working[i];
        write(working, locked, i, rollSymbol(weights, rng));
        emitReroll(old, i);
      }
      return targets;
    }
    case 'vehicle-crash': {
      // 교통사고: reroll every vehicle cell that has an adjacent (left/right)
      // vehicle. Same adjacency-gated pattern as cat-turf, with VEHICLE_SET.
      const targets: number[] = [];
      for (let i = 0; i < working.length; i++) {
        if (!VEHICLE_SET.has(working[i])) continue;
        const left = i > 0 && VEHICLE_SET.has(working[i - 1]);
        const right = i + 1 < working.length && VEHICLE_SET.has(working[i + 1]);
        if (left || right) targets.push(i);
      }
      for (const i of targets) {
        const old = working[i];
        write(working, locked, i, rollSymbol(weights, rng));
        emitReroll(old, i);
      }
      return targets;
    }
    case 'vandalism': {
      // 기물 파손 (combo cat×vehicle): reroll every VEHICLE cell with an adjacent
      // (left/right) CAT. Compute targets FIRST (adjacency read before any reroll
      // changes the board), THEN reroll them. Same pattern as vehicle-crash but
      // gated on a CAT neighbour.
      const targets: number[] = [];
      for (let i = 0; i < working.length; i++) {
        if (!VEHICLE_SET.has(working[i])) continue;
        const left = i > 0 && CAT_SET.has(working[i - 1]);
        const right = i + 1 < working.length && CAT_SET.has(working[i + 1]);
        if (left || right) targets.push(i);
      }
      for (const i of targets) {
        const old = working[i];
        write(working, locked, i, rollSymbol(weights, rng));
        emitReroll(old, i);
      }
      return targets;
    }
    case 'shakedown': {
      // 금품 갈취 (combo monster×gem): reroll every GEM cell with an adjacent
      // (left/right) dracula. Compute targets FIRST, THEN reroll. The +70 per
      // rerolled gem is EVENT-scored in score.ts (one symbol_rerolled per target).
      const targets: number[] = [];
      for (let i = 0; i < working.length; i++) {
        if (!GEM_SET.has(working[i])) continue;
        const left = i > 0 && working[i - 1] === 'dracula';
        const right = i + 1 < working.length && working[i + 1] === 'dracula';
        if (left || right) targets.push(i);
      }
      for (const i of targets) {
        const old = working[i];
        write(working, locked, i, rollSymbol(weights, rng));
        emitReroll(old, i);
      }
      return targets;
    }
    case 'four-parry': {
      const idx = working.findIndex((s) => s === 'four');
      if (idx !== -1) {
        const old = working[idx];
        let iter = 0;
        while (iter < REROLL_CAP && working[idx] === 'four') {
          working[idx] = rollSymbol(weights, rng);
          iter += 1;
        }
        if (locked[idx]) locked[idx] = false;
        emitReroll(old, idx);
        return [idx];
      }
      return [];
    }
    case 'gem-shuffle': {
      // 보석 셔플: the LEFTMOST TWO gems are each rerolled until non-gem (기획).
      const rerolled: number[] = [];
      for (let idx = 0; idx < working.length && rerolled.length < 2; idx++) {
        if (!GEM_SET.has(working[idx])) continue;
        const old = working[idx];
        let iter = 0;
        while (iter < REROLL_CAP && GEM_SET.has(working[idx])) {
          working[idx] = rollSymbol(weights, rng);
          iter += 1;
        }
        if (locked[idx]) locked[idx] = false;
        emitReroll(old, idx);
        rerolled.push(idx);
      }
      return rerolled;
    }
    case 'fruit-fish': {
      const idx = working.findIndex((s) => !FRUIT_SET.has(s));
      if (idx !== -1) {
        const old = working[idx];
        let iter = 0;
        while (iter < REROLL_CAP && !FRUIT_SET.has(working[idx])) {
          working[idx] = rollSymbol(weights, rng);
          iter += 1;
        }
        if (locked[idx]) locked[idx] = false;
        emitReroll(old, idx);
        return [idx];
      }
      return [];
    }
    case 'gem-fish': {
      const idx = working.findIndex((s) => !GEM_SET.has(s));
      if (idx !== -1) {
        const old = working[idx];
        let iter = 0;
        while (iter < REROLL_CAP && !GEM_SET.has(working[idx])) {
          working[idx] = rollSymbol(weights, rng);
          iter += 1;
        }
        if (locked[idx]) locked[idx] = false;
        emitReroll(old, idx);
        return [idx];
      }
      return [];
    }

    // ---- transform (COPY: a cell takes another cell's current symbol) ----
    case 'left-pair': {
      const src = working[0];
      if (write(working, locked, 1, src)) emitCopy(src, 0, 1);
      return [];
    }
    case 'center-echo': {
      const src = working[1];
      if (write(working, locked, 3, src)) emitCopy(src, 1, 3);
      return [];
    }
    case 'third-mirror': {
      const src = working[4];
      if (write(working, locked, 2, src)) emitCopy(src, 4, 2);
      return [];
    }
    // ---- transform (SET: a cell becomes a fixed symbol) ----
    case 'first-cherry': {
      const old = working[0];
      if (old !== 'cherry' && write(working, locked, 0, 'cherry')) emitTransform(old, 'cherry', 0);
      return [];
    }
    case 'safe-convert':
      for (let i = 0; i < working.length; i++) {
        const old = working[i];
        if (old === 'four' || old === 'zero') {
          if (write(working, locked, i, 'ruby')) emitTransform(old, 'ruby', i);
        }
      }
      return [];
    case 'zero-to-seven': {
      // 0 상승: the LEFTMOST TWO 0s become 7 (기획).
      let converted = 0;
      for (let i = 0; i < working.length && converted < 2; i++) {
        const old = working[i];
        if (old === 'zero') {
          if (write(working, locked, i, 'seven')) emitTransform(old, 'seven', i);
          converted += 1;
        }
      }
      return [];
    }
    case 'ruby-convert':
      // 루비 변환 (combo number×gem): every 0 OR 7 becomes a ruby.
      for (let i = 0; i < working.length; i++) {
        const old = working[i];
        if (old === 'zero' || old === 'seven') {
          if (write(working, locked, i, 'ruby')) emitTransform(old, 'ruby', i);
        }
      }
      return [];
    case 'diamond-convert':
      // 다이아 변환 (combo number×gem): every 4 becomes a diamond.
      for (let i = 0; i < working.length; i++) {
        const old = working[i];
        if (old === 'four') {
          if (write(working, locked, i, 'diamond')) emitTransform(old, 'diamond', i);
        }
      }
      return [];
    case 'red-dye':
      for (let i = 0; i < working.length; i++) {
        const old = working[i];
        if (old === 'lemon' || old === 'diamond') {
          if (write(working, locked, i, 'cherry')) emitTransform(old, 'cherry', i);
        }
      }
      return [];
    case 'blue-dye':
      for (let i = 0; i < working.length; i++) {
        const old = working[i];
        if (old === 'lemon' || old === 'diamond') {
          if (write(working, locked, i, 'sapphire')) emitTransform(old, 'sapphire', i);
        }
      }
      return [];

    // ---- transform (MOVE: a cat relocates, shifting/swapping cells) ----
    case 'cat-zoomies': {
      // Rightmost cat moves to index 0; the cells between it shift right by one.
      let r = -1;
      for (let i = working.length - 1; i >= 0; i--) {
        if (CAT_SET.has(working[i])) {
          r = i;
          break;
        }
      }
      if (r > 0) {
        const cat = working[r];
        // Shift cells [0..r-1] right into [1..r] (highest first so we read before
        // overwriting), then drop the cat into index 0.
        for (let i = r - 1; i >= 0; i--) {
          const moved = working[i];
          write(working, locked, i + 1, moved);
          emitMove(moved, i, i + 1);
        }
        write(working, locked, 0, cat);
        emitMove(cat, r, 0);
      }
      return [];
    }
    case 'cat-jump': {
      // Leftmost cat swaps with the cell two to its left or two to its right
      // (uniformly random among the valid directions).
      const L = working.findIndex((s) => CAT_SET.has(s));
      if (L !== -1) {
        const targets: number[] = [];
        if (L - 2 >= 0) targets.push(L - 2);
        if (L + 2 <= working.length - 1) targets.push(L + 2);
        if (targets.length > 0) {
          const target = targets.length === 2 ? (rng() < 0.5 ? targets[0] : targets[1]) : targets[0];
          const a = working[L];
          const b = working[target];
          // SWAP: each cell's prior value leaves it and arrives at the other.
          write(working, locked, target, a);
          write(working, locked, L, b);
          emitMove(a, L, target);
          emitMove(b, target, L);
        }
      }
      return [];
    }

    // ---- transform (vehicle) ----
    case 'vehicle-logistics': {
      // Swap two distinct random cells, once per plane on the board. N===0 -> no-op.
      const planes = working.reduce((n, s) => (s === PLANE ? n + 1 : n), 0);
      const n = working.length;
      for (let p = 0; p < planes; p++) {
        const a = Math.floor(rng() * n);
        let b = Math.floor(rng() * n);
        // Reroll the second pick until it differs from the first (cap attempts).
        let iter = 0;
        while (b === a && iter < REROLL_CAP) {
          b = Math.floor(rng() * n);
          iter += 1;
        }
        if (b === a) continue; // could not find a distinct index; skip this swap
        const va = working[a];
        const vb = working[b];
        // SWAP: each cell's prior value leaves it and arrives at the other.
        write(working, locked, a, vb);
        write(working, locked, b, va);
        emitMove(va, a, b);
        emitMove(vb, b, a);
      }
      return [];
    }
    case 'vehicle-bigboat': {
      // Leftmost ship copies itself into its immediate neighbours (in range).
      const s = working.findIndex((sym) => sym === SHIP);
      if (s !== -1) {
        const ship = working[s];
        if (s - 1 >= 0) {
          write(working, locked, s - 1, ship);
          emitCopy(ship, s, s - 1);
        }
        if (s + 1 <= working.length - 1) {
          write(working, locked, s + 1, ship);
          emitCopy(ship, s, s + 1);
        }
      }
      return [];
    }
    // ---- transform (monster) ----
    case 'monster-haunt': {
      // Leftmost monster cell becomes "haunted": at scoring it contributes one
      // extra phantom 'ghost' to the n-of-a-kind counts. No board change, no rng.
      const i = working.findIndex((s) => MONSTER_SET.has(s));
      if (i !== -1) {
        haunted[i] = true;
        emitHauntAdd(i);
      }
      return [];
    }
    case 'jibakryeong': {
      // 지박령: the leftmost ghost cell becomes "haunted" (phantom ghost at
      // scoring, like monster-haunt) AND that ghost is rerolled. The cell stays
      // haunted even though its symbol changed. No ghost -> no-op.
      const i = working.findIndex((s) => s === 'ghost');
      if (i === -1) return [];
      haunted[i] = true;
      emitHauntAdd(i);
      const old = working[i];
      write(working, locked, i, rollSymbol(weights, rng));
      emitReroll(old, i);
      return [i];
    }
    case 'plague': {
      // 퍼져나가는 역병: the leftmost zombie copies itself into both neighbours
      // (in range), THEN the original (center) zombie is rerolled. Copy the sides
      // FIRST from the original zombie value, THEN reroll the center. No zombie ->
      // no-op.
      const i = working.findIndex((s) => s === 'zombie');
      if (i === -1) return [];
      const changed: number[] = [];
      if (i - 1 >= 0) {
        write(working, locked, i - 1, 'zombie');
        emitCopy('zombie', i, i - 1);
        changed.push(i - 1);
      }
      if (i + 1 < working.length) {
        write(working, locked, i + 1, 'zombie');
        emitCopy('zombie', i, i + 1);
        changed.push(i + 1);
      }
      const old = working[i];
      write(working, locked, i, rollSymbol(weights, rng));
      emitReroll(old, i);
      changed.push(i);
      return changed;
    }
    case 'monster-infect': {
      // 전염병: if ANY base monster is on the board, the leftmost BASE cat becomes
      // a zombie_cat HYBRID (scores as both cat AND monster, see lib/symbols/tags).
      // Uses base CATS/MONSTERS for targeting — hybrids participate in scoring via
      // tags, not in rule targeting (v0). No monster or no cat -> no-op.
      const hasMonster = working.some((s) => MONSTER_SET.has(s));
      if (hasMonster) {
        const c = working.findIndex((s) => CAT_SET.has(s));
        if (c !== -1) {
          const old = working[c];
          write(working, locked, c, 'zombie_cat');
          emitTransform(old, 'zombie_cat', c);
        }
      }
      return [];
    }
    case 'vampire-exorcist': {
      // 흡혈귀 퇴마사: every haunted cell that currently holds a dracula is
      // un-haunted (emit cell_status_removed). No board change, no rng. Each
      // removal is EVENT-scored +EXORCIST_PER in score.ts.
      for (let i = 0; i < working.length; i++) {
        if (haunted[i] && working[i] === 'dracula') {
          haunted[i] = false;
          emitHauntRemove(i);
        }
      }
      return [];
    }
    case 'gem-obsession': {
      // 망령의 집착 (combo monster×gem): the leftmost gem cell becomes haunted.
      const i = working.findIndex((s) => GEM_SET.has(s));
      if (i !== -1) {
        haunted[i] = true;
        emitHauntAdd(i);
      }
      return [];
    }
    case 'combo-zombie-cat': {
      // 좀비 고양이 (combo monster×cat): the first cell becomes a zombie_cat hybrid.
      const old = working[0];
      write(working, locked, 0, 'zombie_cat');
      emitTransform(old, 'zombie_cat', 0);
      return [0];
    }
    case 'combo-ghost-cat': {
      // 유령 고양이 (combo monster×cat): every haunted cat cell becomes a ghost_cat
      // hybrid and is un-haunted. Non-cat haunted cells are untouched.
      const changed: number[] = [];
      for (let i = 0; i < working.length; i++) {
        if (haunted[i] && CAT_SET.has(working[i])) {
          const old = working[i];
          write(working, locked, i, 'ghost_cat');
          emitTransform(old, 'ghost_cat', i);
          haunted[i] = false;
          emitHauntRemove(i);
          changed.push(i);
        }
      }
      return changed;
    }

    // ---- lock rules are handled in the PRE-ROLL HOLD pass, not here. ----
    // ---- select rules are interactive — handled via Pending, not here. ----

    default:
      return [];
  }
}

const SELECT_KIND: Record<string, SelectKind> = {
  'select-copy': 'copy',
  'select-swap': 'swap',
  'select-reroll': 'reroll',
  // The two RULE SLOT rules that became PLAYER-SELECTED (직접 선택).
  'monster-family': 'family',
  'vehicle-parking': 'park',
  // cat×vehicle combo: swap the leftmost vehicle-adjacent cat into the chosen cell.
  'why-here': 'catswap',
};

// Inverse of SELECT_KIND: the select rule id for a given kind. Used to tag the
// ADDITIVE engine events with the actual select rule's id (byRuleId).
const SELECT_RULE_ID: Record<SelectKind, string> = {
  copy: 'select-copy',
  swap: 'select-swap',
  reroll: 'select-reroll',
  family: 'monster-family',
  park: 'vehicle-parking',
  catswap: 'why-here',
};

/**
 * 왜 여기 타 있어 (cat×vehicle combo) source: the smallest index of a CAT cell
 * that has a VEHICLE on its immediate left or right. Returns -1 if no such cat
 * exists (in which case the select rule auto-skips). Pure read — no rng.
 */
function leftmostCatNextToVehicle(working: SymbolType[]): number {
  for (let i = 0; i < working.length; i++) {
    if (!CAT_SET.has(working[i])) continue;
    const left = i > 0 && VEHICLE_SET.has(working[i - 1]);
    const right = i + 1 < working.length && VEHICLE_SET.has(working[i + 1]);
    if (left || right) return i;
  }
  return -1;
}

/**
 * Cells the player may pick for the given select rule. Under the PURE SEQUENTIAL +
 * HOLD model a select rule overwrites whatever earlier rules wrote, INCLUDING held
 * (`locked`) cells — held only means "held at the first roll", so every cell is
 * selectable. (`select-copy` still excludes index 0, which has no left neighbour to
 * copy.)
 */
function selectableFor(kind: SelectKind, locked: boolean[], working: SymbolType[]): boolean[] {
  // park restricts to VEHICLE cells; held (locked) cells stay selectable so a
  // vehicle parked last spin can be parked AGAIN this spin (re-held for the next).
  if (kind === 'park') {
    return working.map((sym) => VEHICLE_SET.has(sym));
  }
  const out = locked.map(() => true);
  // select-copy excludes index 0 (no left neighbour to copy from).
  if (kind === 'copy') out[0] = false;
  return out;
}

/** True if the select rule can run at all (else it AUTO-SKIPS, no pause). */
function isApplicable(kind: SelectKind, selectable: boolean[], working: SymbolType[]): boolean {
  const free = selectable.filter(Boolean).length;
  if (kind === 'swap') return free >= 2;
  // family ALSO requires a dracula on the board (the copy source).
  if (kind === 'family') return free >= 1 && working.includes('dracula');
  // catswap ALSO requires a cat adjacent to a vehicle (the swap source).
  if (kind === 'catswap') return free >= 1 && leftmostCatNextToVehicle(working) !== -1;
  // copy / reroll / park each need at least one eligible cell (park: ≥1 vehicle).
  return free >= 1;
}

/**
 * How many cells the player picks for a select rule. copy/reroll/family pick 1,
 * swap picks exactly 2; park (유료 주차) lets the player keep up to 2 vehicle cells
 * of their choice (spec: 원하는 칸 2개 — capped at 2 for balance), i.e. min(2, #vehicles).
 */
function selectCount(kind: SelectKind, selectable: boolean[]): number {
  if (kind === 'swap') return 2;
  if (kind === 'park') return Math.min(2, selectable.filter(Boolean).length);
  return 1;
}

/**
 * PRE-ROLL HOLD pass + frame setup, then advance to the first pause/completion.
 *
 * Locks freeze their cell(s) to `previousResult` (absolute, order-independent);
 * `baseResult` is captured right after, with held cells = previous value and all
 * others = the raw roll. Then the cascade advances until it either reaches a
 * `select` rule that needs player input (frame.pending set, paused) or finishes
 * (frame.done).
 */
export function beginCascade(
  base: SymbolType[],
  rules: (Rule | null)[],
  ctx: ApplyCtx,
  opts: { autoSkipSelect?: boolean; preHeld?: number[] } = {},
): CascadeFrame {
  const working: SymbolType[] = [...base];
  const locked: boolean[] = [false, false, false, false, false];
  // ADDITIVE engine event log for the whole spin. Populated alongside (never
  // instead of) the normal board writes; read-only for later set-scoring.
  const events: EngineEvent[] = [];

  // --- PRE-ROLL HOLD pass: freeze locked cells to the previous spin value. ---
  // A `copy-above` whose slot above is a lock re-applies that lock here too
  // (idempotent for center/last-lock; fruit-freeze then holds the NEXT 2 fruits).
  const prev = ctx.previousResult;

  // CROSS-SPIN HOLD: cells flagged by the previous spin's next-spin rule
  // (유료 주차) are held to their previous value here, exactly like a lock. Runs
  // first so a subsequent lock rule sees them as already held (no double-emit).
  // Deterministic (reads previousResult), so replay reproduces it byte-for-byte.
  if (opts.preHeld) {
    for (const i of opts.preHeld) {
      if (i >= 0 && i < working.length && !locked[i]) {
        working[i] = prev[i];
        locked[i] = true;
        events.push({ type: 'symbol_locked', symbolId: working[i], index: i, byRuleId: 'next-hold' });
      }
    }
  }
  const applyLock = (lockRule: Rule) => {
    if (lockRule.id === 'center-lock') {
      if (!locked[2]) {
        working[2] = prev[2];
        locked[2] = true;
        events.push({ type: 'symbol_locked', symbolId: working[2], index: 2, byRuleId: lockRule.id });
      }
    } else if (lockRule.id === 'last-lock') {
      if (!locked[4]) {
        working[4] = prev[4];
        locked[4] = true;
        events.push({ type: 'symbol_locked', symbolId: working[4], index: 4, byRuleId: lockRule.id });
      }
    } else if (lockRule.id === 'fruit-freeze') {
      let held = 0;
      for (let i = 0; i < prev.length && held < 2; i++) {
        if (FRUIT_SET.has(prev[i]) && !locked[i]) {
          working[i] = prev[i];
          locked[i] = true;
          events.push({ type: 'symbol_locked', symbolId: working[i], index: i, byRuleId: lockRule.id });
          held += 1;
        }
      }
    } else if (lockRule.id === 'cat-hold') {
      // Hold EVERY cell whose previous value was a cat (no count limit).
      for (let i = 0; i < prev.length; i++) {
        if (CAT_SET.has(prev[i]) && !locked[i]) {
          working[i] = prev[i];
          locked[i] = true;
          events.push({ type: 'symbol_locked', symbolId: working[i], index: i, byRuleId: lockRule.id });
        }
      }
    }
  };
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    if (!rule) continue;
    if (rule.type === 'lock') {
      applyLock(rule);
    } else if (rule.id === 'copy-above') {
      const above = i > 0 ? rules[i - 1] : null;
      if (above && above.type === 'lock') applyLock(above);
    }
  }

  const baseResult: SymbolType[] = [...working];

  const frame: CascadeFrame = {
    working,
    locked,
    steps: [],
    baseResult,
    slotIndex: 0,
    pending: null,
    done: false,
    interactive: false,
    events,
    scoreBoards: [],
    haunted: [false, false, false, false, false],
    nextHold: [],
  };

  return advanceCascade(frame, rules, ctx, opts);
}

/**
 * Process slots from `frame.slotIndex` onward (top -> bottom) under PURE
 * SEQUENTIAL + HOLD semantics: each rule overwrites whatever earlier rules wrote,
 * INCLUDING pre-roll held (`locked`) cells (held is first-roll only, modifiable;
 * writing a held cell un-holds it). PAUSES (returns with
 * `frame.pending` set, slotIndex left on the select rule) when it reaches a
 * `select` rule that needs input. Auto-skips a select rule whose constraint can't
 * be met (pushes a "(건너뜀)" step). When all slots are processed, sets
 * `frame.done = true`.
 */
export function advanceCascade(
  frame: CascadeFrame,
  rules: (Rule | null)[],
  ctx: ApplyCtx,
  opts: { autoSkipSelect?: boolean } = {},
): CascadeFrame {
  const { working, locked, steps } = frame;

  for (; frame.slotIndex < rules.length; frame.slotIndex++) {
    const slotIndex = frame.slotIndex;
    const rule = rules[slotIndex];
    if (
      !rule ||
      rule.type === 'weight' ||
      rule.type === 'score' ||
      rule.type === 'lock'
    ) {
      // Score rules don't change the board, but their bonus may depend on the
      // board AT THIS POSITION (e.g. CLEAN SWEEP). Snapshot it here.
      if (rule && rule.type === 'score') {
        frame.scoreBoards.push({ ruleId: rule.id, board: [...working] });
      }
      continue;
    }

    if (rule.type === 'select') {
      const kind = SELECT_KIND[rule.id];
      const selectable = selectableFor(kind, locked, working);
      // The non-interactive (pure) path can never prompt: always auto-skip a
      // select rule there so applyRules stays pure & total.
      if (opts.autoSkipSelect || !isApplicable(kind, selectable, working)) {
        steps.push({ label: `${rule.name} (건너뜀)`, result: [...working], locked: [...locked] });
        continue;
      }
      // Needs player input: pause here. slotIndex stays on this rule.
      frame.pending = { kind, ruleName: rule.name, selectable, count: selectCount(kind, selectable) };
      return frame;
    }

    if (rule.id === 'copy-above') {
      const above = slotIndex > 0 ? rules[slotIndex - 1] : null;
      if (!above || above.id === 'copy-above') {
        steps.push({ label: 'COPY ABOVE → (none)', result: [...working], locked: [...locked] });
        continue;
      }
      if (above.type === 'lock') {
        // The lock (and this copy of it) were already applied in the pre-roll
        // HOLD pass; just acknowledge it here (board already reflects the hold).
        steps.push({ label: `COPY ABOVE → ${above.name}`, result: [...working], locked: [...locked] });
        continue;
      }
      if (above.type === 'select') {
        // Re-run the above SELECT rule: another interactive pick (or auto-skip).
        const kind = SELECT_KIND[above.id];
        const selectable = selectableFor(kind, locked, working);
        if (opts.autoSkipSelect || !isApplicable(kind, selectable, working)) {
          steps.push({ label: `COPY ABOVE → ${above.name} (건너뜀)`, result: [...working], locked: [...locked] });
          continue;
        }
        // Pause here (slotIndex stays on the copy-above slot) for the player.
        frame.pending = { kind, ruleName: `COPY ABOVE → ${above.name}`, selectable, count: selectCount(kind, selectable) };
        return frame;
      }
      // weight/score rules are not board-changing here; only reroll/transform
      // re-apply a post-roll board effect.
      // A copy-above of a SCORE rule re-applies that score rule at THIS position.
      if (above.type === 'score') {
        frame.scoreBoards.push({ ruleId: above.id, board: [...working] });
      }
      let copyRolled: number[] = [];
      if (above.type === 'reroll' || above.type === 'transform') {
        // Events emit NATURALLY from this call, tagged with the above rule's id
        // (the ACTUAL rule applied). No separate emit here -> no double-emit.
        copyRolled = applyOne(above, working, locked, ctx, frame.events, frame.haunted);
      }
      const copyStep: SpinLogStep = { label: `COPY ABOVE → ${above.name}`, result: [...working], locked: [...locked] };
      if (copyRolled.length) copyStep.rerolled = copyRolled;
      steps.push(copyStep);
      continue;
    }

    const rolled = applyOne(rule, working, locked, ctx, frame.events, frame.haunted);
    const step: SpinLogStep = { label: rule.name, result: [...working], locked: [...locked] };
    if (rolled.length) step.rerolled = rolled;
    steps.push(step);
  }

  frame.done = true;
  return frame;
}

/**
 * Apply the pending select rule at `frame.slotIndex` with the player's chosen
 * `indices`, push a step, then resume advancing to the next pause or completion.
 * Under the pure sequential + HOLD model the select rule overwrites the chosen
 * cells freely; a chosen cell that was held becomes un-held (display un-greys).
 */
export function resolveSelection(
  frame: CascadeFrame,
  rules: (Rule | null)[],
  ctx: ApplyCtx,
  indices: number[],
): CascadeFrame {
  const pending = frame.pending;
  if (!pending) return frame;

  const { working, locked, steps } = frame;
  // Use the pending's own label so COPY ABOVE → SELECT shows correctly (the slot
  // rule may be `copy-above`, not the select rule itself).
  const ruleName = pending.ruleName;

  // byRuleId for the ADDITIVE engine events: the select rule's own id. The slot
  // rule may be `copy-above` but the applied effect is still the select rule.
  const selectRuleId = SELECT_RULE_ID[pending.kind];

  // SELECT REROLL gives the chosen cell a fresh random roll, so it must animate
  // even if the value repeats. copy/swap are deterministic — a no-visible-change
  // there genuinely means the board is identical, so no rerolled hint is needed.
  let rerolled: number[] | undefined;
  switch (pending.kind) {
    case 'copy': {
      const i = indices[0];
      const src = working[i - 1];
      // cell[i] = cell[i-1]. Modifying a held cell un-holds it (display un-greys).
      working[i] = src;
      if (locked[i]) locked[i] = false;
      frame.events.push({ type: 'symbol_copied', symbolId: src, fromIndex: i - 1, toIndex: i, byRuleId: selectRuleId });
      break;
    }
    case 'swap': {
      const [a, b] = indices;
      const tmp = working[a];
      working[a] = working[b];
      working[b] = tmp;
      // Modifying held cells un-holds them (display un-greys).
      if (locked[a]) locked[a] = false;
      if (locked[b]) locked[b] = false;
      // TWO moves: each cell's PRIOR value left it and arrived at the other cell.
      frame.events.push({ type: 'symbol_moved', symbolId: tmp, fromIndex: a, toIndex: b, byRuleId: selectRuleId });
      frame.events.push({ type: 'symbol_moved', symbolId: working[a], fromIndex: b, toIndex: a, byRuleId: selectRuleId });
      break;
    }
    case 'reroll': {
      const i = indices[0];
      const old = working[i];
      working[i] = rollSymbol(ctx.weights, ctx.rng);
      if (locked[i]) locked[i] = false; // un-hold the rerolled cell
      frame.events.push({ type: 'symbol_rerolled', symbolId: old, index: i, byRuleId: selectRuleId });
      rerolled = [i];
      break;
    }
    case 'family': {
      // 가족 만들기: the LEFTMOST dracula is copied into the single chosen cell.
      // (isApplicable guaranteed a dracula is present.) Scoring adds +20×draculas.
      const dIdx = working.findIndex((s) => s === 'dracula');
      const c = indices[0];
      write(working, locked, c, 'dracula');
      frame.events.push({ type: 'symbol_copied', symbolId: 'dracula', fromIndex: dIdx, toIndex: c, byRuleId: selectRuleId });
      break;
    }
    case 'catswap': {
      // 왜 여기 타 있어: the LEFTMOST cat with a vehicle neighbour is swapped with
      // the single chosen cell. (isApplicable guaranteed such a cat exists.) No rng
      // -> replay-deterministic. A self-swap (src === c) is a harmless no-op.
      const src = leftmostCatNextToVehicle(working);
      const c = indices[0];
      if (src !== c) {
        const cat = working[src];
        const other = working[c];
        // SWAP: each cell's prior value leaves it and arrives at the other cell.
        write(working, locked, c, cat);
        write(working, locked, src, other);
        frame.events.push({ type: 'symbol_moved', symbolId: cat, fromIndex: src, toIndex: c, byRuleId: selectRuleId });
        frame.events.push({ type: 'symbol_moved', symbolId: other, fromIndex: c, toIndex: src, byRuleId: selectRuleId });
      }
      break;
    }
    case 'park': {
      // 유료 주차: each chosen vehicle cell is held into the next spin (dedupe) and
      // emits a symbol_held event. The 30-point fee per cell is scored EVENT-based.
      for (const i of indices) {
        if (!frame.nextHold.includes(i)) frame.nextHold.push(i);
        frame.events.push({ type: 'symbol_held', symbolId: working[i], index: i, byRuleId: selectRuleId });
      }
      break;
    }
  }

  const selStep: SpinLogStep = { label: ruleName, result: [...working], locked: [...locked] };
  if (rerolled) selStep.rerolled = rerolled;
  steps.push(selStep);
  frame.interactive = true;
  frame.pending = null;
  frame.slotIndex += 1; // advance past the resolved select rule
  return advanceCascade(frame, rules, ctx);
}
