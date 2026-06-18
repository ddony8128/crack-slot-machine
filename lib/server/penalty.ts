/**
 * 반복 플레이 패널티 판정 (순수 함수).
 *
 * 기준은 "게임과 게임 **사이 쉬는 간격**"이다 — 한 게임을 길게 한다고 벗어나면 안 된다.
 * 즉, 직전 플레이 **종료** 후 다음 플레이 **시작**까지의 간격이 3분 미만인 상태로
 * 5회 연속 이어지면 패널티 대상이다. 게임 자체의 길이는 판정에 들어가지 않는다.
 */

export const PENALTY_WINDOW_MS = 3 * 60 * 1000; // 3분
export const PENALTY_STREAK = 5;

/** 한 번의 플레이: 시작(created_at)·종료(submitted_at) 시각. */
export type PlaySpan = { start: string; end: string };

/**
 * @param spansDesc 플레이어의 최근 플레이 구간 목록, **최신순(종료 시각 기준 내림차순)**.
 *                  방금 끝낸 런을 포함한다.
 * @returns 패널티 조건 충족 여부.
 */
export function triggersPenalty(spansDesc: PlaySpan[]): boolean {
  if (spansDesc.length < PENALTY_STREAK) return false;
  const recent = spansDesc.slice(0, PENALTY_STREAK).map((s) => ({
    start: new Date(s.start).getTime(),
    end: new Date(s.end).getTime(),
  }));
  if (recent.some((s) => Number.isNaN(s.start) || Number.isNaN(s.end))) {
    return false;
  }
  // 최신순이므로 recent[i] 가 recent[i+1] 보다 나중 플레이.
  // 쉬는 간격 = (나중 플레이 시작) − (이전 플레이 종료). 모두 창(window) 미만이어야 한다.
  for (let i = 0; i < PENALTY_STREAK - 1; i += 1) {
    const breakMs = recent[i].start - recent[i + 1].end;
    if (breakMs >= PENALTY_WINDOW_MS) return false;
  }
  return true;
}
