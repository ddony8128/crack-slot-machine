/** 프리 시즌 1 static facts. Dates are stored on the seasons row; these mirror it
 *  for client display and pure helpers. KST (UTC+9). */
export const SEASON_TITLE = '프리 시즌 1';
export const SEASON_SLUG = '2026-06-season-1';

// 2026-06-16 12:00 KST  →  2026-06-30 12:00 KST (14 days)
export const SEASON_STARTS_AT = '2026-06-16T03:00:00Z';
export const SEASON_ENDS_AT = '2026-06-30T03:00:00Z';

/** Test-season notice shown on the season hub. */
export const SEASON_NOTICE =
  '프리 시즌 1은 테스트 시즌입니다. 랭킹 점수는 정상적으로 기록되지만, 시즌 중 점수표·규칙·밸런스가 변경될 수 있습니다.';

export type SeasonMode = 'spire' | 'puzzle' | 'daily';

export const MODE_LABELS: Record<SeasonMode | 'event' | 'quick', string> = {
  spire: '첨탑 오르기',
  puzzle: '퍼즐 모드',
  daily: '일일 도전',
  event: '이벤트',
  quick: '빠른 게임',
};
