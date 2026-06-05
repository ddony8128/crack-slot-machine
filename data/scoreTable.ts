export const JACKPOT = 1000; // 7 7 7 7 7

export const FIVE_OF_A_KIND = 700;
export const FOUR_OF_A_KIND = 420;
export const THREE_OF_A_KIND = 220;
export const PAIR = 80;

export const ALL_FRUITS = 250; // all 5 cells are fruits
export const ALL_GEMS = 300; // all 5 cells are gems

// penalty: each four = 100; if four count >= 3 add extra 150;
// if four count == 5 total penalty is 700 (override).
export const FOUR_PENALTY_PER = 100;
export const FOUR_PENALTY_EXTRA_3PLUS = 150;
export const FOUR_PENALTY_ALL_FIVE = 700;
