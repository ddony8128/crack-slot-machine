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

// Four penalty per four. (Season 1 v0.1: -30 per four.)
export const FOUR_PENALTY_PER = 30;
// 유료 주차 (vehicle-parking): lose this much per HELD vehicle cell. Now scored
// EVENT-based — one fee per symbol_held event tagged 'vehicle-parking' (the
// player directly picks up to 2 vehicle cells). Treated as a penalty.
export const PARKING_FEE_PER = 30;
// 가족 만들기 (monster-family): +this per dracula on the FINAL board, per rule
// occurrence (×stacks via copy-above). Added to the bonus, like a set bonus.
export const DRACULA_FAMILY_PER = 20;
// FOUR FORTUNE rule: each 4 scores +this instead of the penalty.
export const FOUR_FORTUNE_PER = 20;

// 비타민 보충: +this per fruit cell rerolled by the rule (counted via the
// symbol_rerolled event log, so it reflects fruits AT the rule's moment).
export const VITAMIN_PER = 5;

// 금품 갈취 (shakedown combo): +this per gem rerolled by the rule (counted via the
// symbol_rerolled event log tagged 'shakedown', so it reflects gems AT the moment).
export const SHAKEDOWN_PER = 70;

// 첨탑 hand upgrade: +this per flat upgrade. Final hand = (base + this×flat) × 2^double.
export const HAND_FLAT_UPGRADE = 50;

// Score-rule bonuses.
export const BONUS_77 = 77;
export const CLEAN_BONUS = 120;
// 미의 추구 (gem-beauty): +this when the board has ≥1 gem-set symbol, per rule
// occurrence (×stacks via copy-above). Gated on a gem being present.
export const GEM_BEAUTY = 100;

// Multiplier triggers.
export const ZERO_DRAW_MIN = 3; // zeros >= 3 grants an extra rule pick
export const FOURS_4_MULT = 3;  // fours == 4 -> next multiplier 3
export const FOURS_5_MULT = 4;  // fours == 5 -> next multiplier 4
