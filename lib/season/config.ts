/** Season 1 static facts. Dates are stored on the seasons row; these mirror it
 *  for client display and pure helpers. KST (UTC+9). */
export const SEASON_TITLE = 'RULE SLOT Season 1';
export const SEASON_SLUG = '2026-06-season-1';

// 2026-06-15 12:00 KST  →  2026-06-28 12:00 KST
export const SEASON_STARTS_AT = '2026-06-15T03:00:00Z';
export const SEASON_ENDS_AT = '2026-06-28T03:00:00Z';

export type SeasonMode = 'spire' | 'puzzle' | 'daily';

export const MODE_LABELS: Record<SeasonMode | 'event' | 'quick', string> = {
  spire: '첨탑 오르기',
  puzzle: '퍼즐 모드',
  daily: '일일 도전',
  event: '이벤트',
  quick: '빠른 게임',
};
