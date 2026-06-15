import type { SymbolType } from '@/types';
import { countFours, countZeros } from '@/lib/score';
import { ZERO_DRAW_MIN, FOURS_4_MULT, FOURS_5_MULT } from '@/data/scoreTable';

/**
 * Detect number special triggers on finalResult; they affect the NEXT spin.
 * `opts` gates each special: ON only in 빠른 게임 (no opts → legacy default ON).
 * Season modes pass {four:false, zero:false}; 첨탑 enables them only via the
 * 4 석상 / 0 석상 artifacts (see lib/spire/stage.ts).
 */
export function detectSpecials(
  result: SymbolType[],
  opts?: { four?: boolean; zero?: boolean },
): {
  zeroDraw: boolean;
  nextMultiplier: number;
} {
  const fourOn = opts?.four ?? true;
  const zeroOn = opts?.zero ?? true;
  const zeros = countZeros(result);
  const fours = countFours(result);

  const zeroDraw = zeroOn && zeros >= ZERO_DRAW_MIN;

  let nextMultiplier = 1;
  if (fourOn) {
    if (fours === 5) nextMultiplier = FOURS_5_MULT;
    else if (fours === 4) nextMultiplier = FOURS_4_MULT;
  }

  return { zeroDraw, nextMultiplier };
}
