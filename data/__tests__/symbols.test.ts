import { describe, it, expect } from 'vitest';
import {
  SYMBOL_EMOJI,
  BASE_WEIGHTS,
  FRUITS,
  GEMS,
  CATS,
  VEHICLES,
  MONSTERS,
  NUMBERS,
} from '@/data/symbols';
import { SYMBOL_SETS } from '@/lib/symbols/sets';
import type { SymbolType } from '@/types';

// Source of truth for the full symbol key list: every symbol id declared across
// SYMBOL_SETS (numbers + fruits + gems + the Season 1 cat/vehicle/monster sets).
const ALL_SET_SYMBOL_IDS = SYMBOL_SETS.flatMap((set) =>
  set.symbols.map((s) => s.id),
);

const NEW_SEASON1_IDS = ['cat', 'vehicle', 'monster'].flatMap(
  (setId) =>
    SYMBOL_SETS.find((s) => s.id === setId)!.symbols.map((sym) => sym.id),
);

describe('symbol key coverage', () => {
  it('BASE_WEIGHTS has exactly the SYMBOL_SETS symbol ids (no missing/extra)', () => {
    const weightKeys = Object.keys(BASE_WEIGHTS).sort();
    expect(weightKeys).toEqual([...ALL_SET_SYMBOL_IDS].sort());
  });

  it('SYMBOL_EMOJI has exactly the SYMBOL_SETS symbol ids (no missing/extra)', () => {
    const emojiKeys = Object.keys(SYMBOL_EMOJI).sort();
    expect(emojiKeys).toEqual([...ALL_SET_SYMBOL_IDS].sort());
  });

  it('BASE_WEIGHTS and SYMBOL_EMOJI cover the same key set', () => {
    expect(Object.keys(BASE_WEIGHTS).sort()).toEqual(
      Object.keys(SYMBOL_EMOJI).sort(),
    );
  });

  it('every symbol has a non-empty emoji glyph', () => {
    for (const id of ALL_SET_SYMBOL_IDS) {
      expect(SYMBOL_EMOJI[id as SymbolType]).toBeTruthy();
    }
  });

  it('emoji match SYMBOL_SETS (source of truth)', () => {
    for (const set of SYMBOL_SETS) {
      for (const sym of set.symbols) {
        expect(SYMBOL_EMOJI[sym.id as SymbolType]).toBe(sym.emoji);
      }
    }
  });
});

describe('Season 1 weight-0 default', () => {
  it('the 9 new cat/vehicle/monster symbols default to weight 0', () => {
    expect(NEW_SEASON1_IDS).toHaveLength(9);
    for (const id of NEW_SEASON1_IDS) {
      expect(BASE_WEIGHTS[id as SymbolType]).toBe(0);
    }
  });

  it('legacy fruit and gem symbols still weight 1', () => {
    for (const id of [...FRUITS, ...GEMS]) {
      expect(BASE_WEIGHTS[id]).toBe(1);
    }
  });

  it('number symbols still weight 1', () => {
    for (const id of NUMBERS) {
      expect(BASE_WEIGHTS[id]).toBe(1);
    }
  });
});

describe('Season 1 set membership arrays', () => {
  it('CATS holds the three cat ids', () => {
    expect(CATS).toEqual(['cheese_cat', 'tuxedo_cat', 'calico_cat']);
  });

  it('VEHICLES holds the three vehicle ids', () => {
    expect(VEHICLES).toEqual(['plane', 'ship', 'car']);
  });

  it('MONSTERS holds the three monster ids', () => {
    expect(MONSTERS).toEqual(['dracula', 'zombie', 'ghost']);
  });

  it('each Season 1 array matches its SYMBOL_SETS definition', () => {
    const byId = (setId: string) =>
      SYMBOL_SETS.find((s) => s.id === setId)!.symbols.map((s) => s.id);
    expect(CATS).toEqual(byId('cat'));
    expect(VEHICLES).toEqual(byId('vehicle'));
    expect(MONSTERS).toEqual(byId('monster'));
  });
});
