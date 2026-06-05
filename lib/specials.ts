import type { SymbolType } from '@/types';
import { countFours, countZeros } from '@/lib/score';
import { ZERO_DRAW_MIN, FOURS_4_MULT, FOURS_5_MULT } from '@/data/scoreTable';

// Detect special triggers on finalResult; affect the NEXT spin.
export function detectSpecials(result: SymbolType[]): {
  zeroDraw: boolean;
  nextMultiplier: number;
} {
  const zeros = countZeros(result);
  const fours = countFours(result);

  const zeroDraw = zeros >= ZERO_DRAW_MIN;

  let nextMultiplier = 1;
  if (fours === 5) nextMultiplier = FOURS_5_MULT;
  else if (fours === 4) nextMultiplier = FOURS_4_MULT;

  return { zeroDraw, nextMultiplier };
}
