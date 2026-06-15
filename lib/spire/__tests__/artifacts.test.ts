import { describe, it, expect } from 'vitest';
import { ARTIFACTS, ARTIFACTS_BY_ID, artifactOffered } from '@/lib/spire/artifacts';
import { SYMBOL_SETS_BY_ID } from '@/lib/symbols/sets';

describe('artifact catalog', () => {
  it('has unique ids and a valid by-id map', () => {
    const ids = ARTIFACTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(Object.keys(ARTIFACTS_BY_ID)).toHaveLength(ARTIFACTS.length);
  });

  it('every requiredSetId is a real non-number set', () => {
    for (const a of ARTIFACTS) {
      for (const setId of a.requiredSetIds ?? []) {
        const set = SYMBOL_SETS_BY_ID[setId];
        expect(set, `${a.id} requires unknown set ${setId}`).toBeTruthy();
        expect(set.isNumberSet).toBeFalsy();
      }
    }
  });
});

describe('artifactOffered', () => {
  const owned = ['number', 'fruit'];
  it('excludes already-owned artifacts', () => {
    expect(artifactOffered(ARTIFACTS_BY_ID['ledger'], owned, ['ledger'])).toBe(false);
    expect(artifactOffered(ARTIFACTS_BY_ID['ledger'], owned, [])).toBe(true);
  });
  it('offers set artifacts only when the set is owned', () => {
    expect(artifactOffered(ARTIFACTS_BY_ID['receipt'], owned, [])).toBe(true); // fruit owned
    expect(artifactOffered(ARTIFACTS_BY_ID['vault'], owned, [])).toBe(false); // gem not owned
  });
  it('general/number artifacts need no set', () => {
    expect(artifactOffered(ARTIFACTS_BY_ID['four-statue'], ['number'], [])).toBe(true);
    expect(artifactOffered(ARTIFACTS_BY_ID['blank-canvas'], ['number'], [])).toBe(true);
  });
});
