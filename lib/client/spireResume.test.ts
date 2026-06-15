import { beforeEach, describe, expect, it } from 'vitest';
import { saveSpire, loadSpire, clearSpire, type SpireSave } from './spireResume';

const KEY = 'rule-slot-spire-run';

const sample: SpireSave = {
  seed: 'seed-abc',
  runId: 'run-123',
  actions: [
    { type: 'choose_set', chosenSetId: 'fruit' },
    {
      type: 'play_stage',
      actions: [
        { type: 'selectRule', ruleId: 'r1' },
        { type: 'placePending', target: { type: 'slot', index: 0 } },
        { type: 'spin' },
        { type: 'selectCells', indices: [1, 2] },
        { type: 'next' },
      ],
    },
    { type: 'buy_hand_flat', handType: 'Pair' },
  ],
};

describe('spireResume', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('round-trips a saved run through save → load', () => {
    saveSpire(sample);
    expect(loadSpire()).toEqual(sample);
  });

  it('returns null when nothing is saved', () => {
    expect(loadSpire()).toBeNull();
  });

  it('returns null on corrupt JSON', () => {
    window.localStorage.setItem(KEY, '{not valid json');
    expect(loadSpire()).toBeNull();
  });

  it('returns null when required fields are missing', () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ seed: 'x' }), // no runId / actions
    );
    expect(loadSpire()).toBeNull();
  });

  it('returns null when actions is not an array', () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ seed: 'x', runId: 'r', actions: 'nope' }),
    );
    expect(loadSpire()).toBeNull();
  });

  it('clears a saved run', () => {
    saveSpire(sample);
    expect(loadSpire()).not.toBeNull();
    clearSpire();
    expect(loadSpire()).toBeNull();
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });
});
