// v2 score constants (see docs/RULESLOT_SPEC.md §3).

// Seven score by count of 'seven' cells.
export const SEVEN_SCORE: Record<number, number> = {
  1: 10,
  2: 77,
  3: 150,
  4: 500,
  5: 777,
};

// Hand (n-of-a-kind among colored symbols only).
export const HAND_PAIR = 10;
export const HAND_TWO_PAIR = 90;
export const HAND_TRIPLE = 30;
export const HAND_FULL_HOUSE = 180;
export const HAND_FOUR_KIND = 300;
export const HAND_FIVE_KIND = 700;

// Color / type bonuses (additive).
export const BONUS_ALL_FRUIT_TYPES = 50;  // all 3 fruit types present
export const BONUS_ALL_GEM_TYPES = 80;    // all 3 gem types present
export const BONUS_ONLY_FRUITS = 100;     // all 5 cells fruits
export const BONUS_ONLY_GEMS = 150;       // all 5 cells gems
export const BONUS_ALL_BLUE = 200;        // all 5 cells in BLUE set
export const BONUS_ALL_RED = 250;         // all 5 cells in RED set

// Four penalty per four.
export const FOUR_PENALTY_PER = 20;

// Score-rule bonuses.
export const BONUS_77 = 77;
export const CLEAN_BONUS = 60;

// Multiplier triggers.
export const ZERO_DRAW_MIN = 3; // zeros >= 3 grants an extra rule pick
export const FOURS_4_MULT = 3;  // fours == 4 -> next multiplier 3
export const FOURS_5_MULT = 4;  // fours == 5 -> next multiplier 4
