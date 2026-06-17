import type { Rule, RulePhase } from '@/types';

// Player-facing labels for each trigger-timing phase (the "발동 시점" badge).
export const RULE_PHASE_LABELS: Record<RulePhase, string> = {
  'pre-spin': '스핀 이전',
  sequential: '순서 적용',
  scoring: '점수 계산',
  'next-spin': '다음 스핀',
};

// Player-facing labels for each rule build/set (the "세트" badge — spec §15).
export const RULE_BUILD_LABELS: Record<string, string> = {
  '7': '7',
  fruit: '과일',
  gem: '보석',
  color: '색',
  order: '순서',
  cat: '고양이',
  vehicle: '교통수단',
  monster: '괴물',
  safe: '안전',
  pair: '조합',
  combo: '조합',
  score: '점수',
};

export const RULES: Rule[] = [
  // ---- 7 / jackpot ----
  {
    id: 'seven-fever',
    name: 'SEVEN FEVER',
    type: 'weight',
    phase: 'pre-spin',
    build: '7',
    description: '7이 나올 확률이 세 배가 된다.',
  },
  {
    id: 'seven-double',
    name: 'SEVEN DOUBLE',
    type: 'score',
    phase: 'scoring',
    build: '7',
    description: '이번 스핀에서 7로 얻는 점수가 두 배가 된다.',
  },
  {
    id: 'zero-to-seven',
    name: 'ZERO ASCEND',
    type: 'transform',
    phase: 'sequential',
    build: '7',
    description: '가장 왼쪽 2개의 0이 7로 바뀐다.',
  },
  {
    id: 'number-spin',
    name: 'NUMBER SPIN',
    type: 'weight',
    phase: 'pre-spin',
    build: '7',
    description: '첫 굴림에서 직전 결과가 숫자였던 칸은 다시 숫자가 나온다.',
  },

  // ---- fruit ----
  {
    id: 'fruit-surge',
    name: 'FRUIT SURGE',
    type: 'weight',
    phase: 'pre-spin',
    build: 'fruit',
    description: '과일이 나올 확률이 네 배가 된다.',
  },
  {
    id: 'diamond-cut',
    name: 'DIAMOND CUT',
    type: 'weight',
    phase: 'pre-spin',
    build: 'fruit',
    description: '다이아몬드와 사파이어가 나오지 않는다.',
  },
  {
    id: 'fruit-fish',
    name: 'FRUIT FISH',
    type: 'reroll',
    phase: 'sequential',
    build: 'fruit',
    description: '가장 왼쪽의 과일이 아닌 칸을 과일이 나올 때까지 다시 굴린다.',
  },
  {
    id: 'fruit-vitamin',
    name: '비타민 보충',
    type: 'reroll',
    phase: 'sequential',
    build: 'fruit',
    description: '과일을 모두 다시 굴리고, 다시 굴린 과일 하나당 5점을 얻는다.',
  },

  // ---- gem ----
  {
    id: 'gem-surge',
    name: 'GEM SURGE',
    type: 'weight',
    phase: 'pre-spin',
    build: 'gem',
    description: '보석이 나올 확률이 네 배가 된다.',
  },
  {
    id: 'fruit-freeze',
    name: 'FRUIT FREEZE',
    type: 'lock',
    phase: 'pre-spin',
    build: 'order',
    description: '첫 굴림에서 이전 결과의 가장 왼쪽 과일 두 개가 유지된다.',
  },
  {
    id: 'gem-fish',
    name: 'GEM FISH',
    type: 'reroll',
    phase: 'sequential',
    build: 'gem',
    description: '가장 왼쪽의 보석이 아닌 칸을 보석이 나올 때까지 다시 굴린다.',
  },
  {
    id: 'gem-beauty',
    name: '미의 추구',
    type: 'score',
    phase: 'scoring',
    build: 'gem',
    description: '보석이 하나라도 있으면 100점을 얻는다.',
  },

  // ---- color ----
  {
    id: 'first-cherry',
    name: 'FIRST CHERRY',
    type: 'transform',
    phase: 'sequential',
    build: 'color',
    description: '첫 번째 칸이 체리가 된다.',
  },
  {
    id: 'red-dye',
    name: '붉은 물들이기',
    type: 'transform',
    phase: 'sequential',
    build: 'combo',
    description: '레몬과 다이아몬드가 체리로 바뀐다.',
  },
  {
    id: 'blue-dye',
    name: '푸른 물들이기',
    type: 'transform',
    phase: 'sequential',
    build: 'combo',
    description: '레몬과 다이아몬드가 사파이어로 바뀐다.',
  },

  // ---- order ----
  {
    id: 'center-lock',
    name: 'CENTER LOCK',
    type: 'lock',
    phase: 'pre-spin',
    build: 'order',
    description: '첫 굴림에서 세 번째 칸이 이전 스핀의 값으로 유지된다.',
  },
  {
    id: 'last-lock',
    name: 'LAST LOCK',
    type: 'lock',
    phase: 'pre-spin',
    build: 'order',
    description: '첫 굴림에서 마지막 칸이 이전 스핀의 값으로 유지된다.',
  },
  {
    id: 'left-pair',
    name: 'LEFT PAIR',
    type: 'transform',
    phase: 'sequential',
    build: 'order',
    description: '두 번째 칸이 첫 번째 칸과 같아진다.',
  },
  {
    id: 'center-echo',
    name: 'CENTER ECHO',
    type: 'transform',
    phase: 'sequential',
    build: 'order',
    description: '네 번째 칸이 두 번째 칸과 같아진다.',
  },
  {
    id: 'third-mirror',
    name: 'THIRD MIRROR',
    type: 'transform',
    phase: 'sequential',
    build: 'order',
    description: '세 번째 칸이 다섯 번째 칸과 같아진다.',
  },
  {
    id: 'copy-above',
    name: 'COPY ABOVE',
    type: 'meta',
    phase: 'sequential',
    build: 'order',
    description: '바로 위 칸의 규칙을 한 번 더 적용한다.',
  },
  {
    id: 'select-copy',
    name: 'SELECT COPY',
    type: 'select',
    phase: 'sequential',
    build: 'order',
    description: '직접 고른 칸이 바로 왼쪽 칸과 같아진다.',
  },
  {
    id: 'select-swap',
    name: 'SELECT SWAP',
    type: 'select',
    phase: 'sequential',
    build: 'order',
    description: '직접 고른 두 칸이 서로 교체된다.',
  },
  {
    id: 'select-reroll',
    name: 'SELECT REROLL',
    type: 'select',
    phase: 'sequential',
    build: 'order',
    description: '직접 고른 한 칸을 다시 굴린다.',
  },

  // ---- cat ----
  {
    id: 'cat-hold',
    name: '식빵 굽기',
    type: 'lock',
    phase: 'pre-spin',
    build: 'cat',
    description: '첫 굴림에서 이전 결과가 고양이였던 칸이 유지된다.',
  },
  {
    id: 'cat-zoomies',
    name: '우다다다',
    type: 'transform',
    phase: 'sequential',
    build: 'cat',
    description: '가장 오른쪽의 고양이가 1번 칸으로 이동하고, 그 사이의 심볼들은 오른쪽으로 한 칸씩 밀린다.',
  },
  {
    id: 'cat-jump',
    name: '점프의 달인',
    type: 'transform',
    phase: 'sequential',
    build: 'cat',
    description: '가장 왼쪽 고양이가 두 칸 오른쪽 또는 두 칸 왼쪽 칸과 자리를 바꾼다. 방향은 가능한 쪽 중 무작위로 정해진다.',
  },
  {
    id: 'cat-turf',
    name: '영역 다툼',
    type: 'reroll',
    phase: 'sequential',
    build: 'cat',
    description: '고양이와 이웃한 고양이를 모두 다시 굴린다.',
  },
  {
    id: 'cat-odds',
    name: '고양이 확률 증가',
    type: 'weight',
    phase: 'pre-spin',
    build: 'cat',
    description: '홀수 번째 칸(1·3·5번째)에서 고양이가 나올 확률이 4배가 된다.',
  },

  // ---- vehicle ----
  {
    id: 'vehicle-parking',
    name: '유료 주차',
    type: 'select',
    phase: 'next-spin',
    build: 'vehicle',
    description: '교통수단 칸 중 원하는 2칸을 직접 골라 칸마다 30점을 잃는다. 고른 칸은 다음 스핀 첫 굴림에서 유지된다.',
  },
  {
    id: 'vehicle-surge',
    name: '러시아워',
    type: 'weight',
    phase: 'pre-spin',
    build: 'vehicle',
    description: '교통수단이 나올 확률이 (장착한 규칙 수 + 1)배가 된다.',
  },
  {
    id: 'vehicle-logistics',
    name: '물류 사업',
    type: 'select',
    phase: 'sequential',
    build: 'vehicle',
    description: '비행기 수만큼 반복하여, 직접 고른 두 칸을 교체한다.',
  },
  {
    id: 'vehicle-bigboat',
    name: '배 크다',
    type: 'transform',
    phase: 'sequential',
    build: 'vehicle',
    description: '가장 왼쪽 배의 양옆 칸이 그 배 심볼을 복사한다.',
  },
  {
    id: 'vehicle-crash',
    name: '교통사고',
    type: 'reroll',
    phase: 'sequential',
    build: 'vehicle',
    description: '이웃한 교통수단이 있는 교통수단들을 모두 다시 굴린다.',
  },

  // ---- monster ----
  {
    id: 'monster-haunt',
    name: '유령 들림',
    type: 'transform',
    phase: 'sequential',
    build: 'monster',
    description: '가장 왼쪽 괴물 칸이 유령에 들린다. 이번 스핀의 족보 계산에서 유령 1개로 추가 계산된다.',
  },
  {
    id: 'jibakryeong',
    name: '지박령',
    type: 'transform',
    phase: 'sequential',
    build: 'monster',
    description: '가장 왼쪽 유령이 있는 칸을 유령들리게 하고, 그 유령은 다시 굴린다.',
  },
  {
    id: 'plague',
    name: '퍼져나가는 역병',
    type: 'transform',
    phase: 'sequential',
    build: 'monster',
    description: '가장 왼쪽 좀비의 양옆 칸이 좀비를 복사하고, 원본 좀비는 다시 굴린다.',
  },
  {
    id: 'monster-family',
    name: '가족 만들기',
    type: 'select',
    phase: 'sequential',
    build: 'monster',
    description: '한 칸을 직접 골라 가장 왼쪽 드라큘라를 복사하고, 보드의 드라큘라 수만큼 20점을 얻는다.',
  },
  {
    id: 'monster-infect',
    name: '전염병',
    type: 'transform',
    phase: 'sequential',
    build: 'monster',
    description: '괴물이 있으면 가장 왼쪽 고양이가 좀비고양이로 변한다. 좀비고양이는 고양이이자 괴물로 계산된다.',
  },
  {
    id: 'vampire-exorcist',
    name: '흡혈귀 퇴마사',
    type: 'transform',
    phase: 'sequential',
    build: 'monster',
    description: '드라큘라가 있는 유령들린 칸의 유령들림을 풀고, 칸마다 200점을 얻는다.',
  },
  {
    id: 'night-parade',
    name: '백귀야행',
    type: 'weight',
    phase: 'pre-spin',
    build: 'monster',
    description: '이번 스핀에서 괴물이 나올 확률이 (이전 스핀의 괴물 수 + 3)배가 된다.',
  },

  // ---- safe ----
  {
    id: 'no-zero',
    name: 'NO ZERO',
    type: 'weight',
    phase: 'pre-spin',
    build: 'safe',
    description: '0이 절대 나오지 않는다.',
  },
  {
    id: 'four-shield',
    name: 'FOUR SHIELD',
    type: 'reroll',
    phase: 'sequential',
    build: 'safe',
    description: '나온 4를 모두 다시 굴리고, 이번 스핀에는 0이 나올 확률이 두 배가 된다.',
  },
  {
    id: 'four-parry',
    name: 'FOUR PARRY',
    type: 'reroll',
    phase: 'sequential',
    build: 'safe',
    description: '가장 왼쪽의 4를 4가 아닌 것이 나올 때까지 다시 굴린다.',
  },
  {
    id: 'safe-convert',
    name: 'SAFE CONVERT',
    type: 'transform',
    phase: 'sequential',
    build: 'safe',
    description: '모든 0과 4가 루비로 바뀐다.',
  },
  {
    id: 'gem-shuffle',
    name: 'GEM SHUFFLE',
    type: 'reroll',
    phase: 'sequential',
    build: 'safe',
    description: '가장 왼쪽의 보석 두 개를 보석이 아닌 것이 나올 때까지 다시 굴린다.',
  },

  // ---- score ----
  {
    id: 'bonus-77',
    name: 'LUCKY SEVEN-SEVEN',
    type: 'score',
    phase: 'scoring',
    build: 'score',
    description: '점수를 77점 더 얻는다.',
  },
  {
    id: 'clean-bonus',
    name: 'CLEAN SWEEP',
    type: 'score',
    phase: 'sequential',
    build: 'score',
    description: '이 규칙이 적용되는 시점의 보드에 4가 하나도 없으면 120점을 더 얻는다. (이후 규칙으로 4가 생겨도 보너스 유지)',
  },
  {
    id: 'four-fortune',
    name: 'FOUR FORTUNE',
    type: 'score',
    phase: 'scoring',
    build: 'score',
    description: '4가 나올 확률이 네 배가 되고, 이번 스핀에서 4는 감점 대신 개당 +20점이 된다.',
  },

  // ---- combo (A–B board effect; set membership in lib/rules/combos.ts) ----
  {
    id: 'ruby-convert',
    name: '루비 변환',
    type: 'transform',
    phase: 'sequential',
    build: 'combo',
    description: '0과 7이 루비로 바뀐다.',
  },
  {
    id: 'diamond-convert',
    name: '다이아 변환',
    type: 'transform',
    phase: 'sequential',
    build: 'combo',
    description: '4가 다이아몬드로 바뀐다.',
  },
  {
    id: 'vandalism',
    name: '기물 파손',
    type: 'reroll',
    phase: 'sequential',
    build: 'combo',
    description: '고양이와 이웃한 교통수단을 모두 다시 굴린다.',
  },
  {
    id: 'shakedown',
    name: '금품 갈취',
    type: 'reroll',
    phase: 'sequential',
    build: 'combo',
    description: '드라큘라와 이웃한 보석마다 70점을 얻고, 그 보석들을 다시 굴린다.',
  },
  {
    id: 'why-here',
    name: '왜 여기 타 있어',
    type: 'select',
    phase: 'sequential',
    build: 'combo',
    description: '교통수단과 이웃한 고양이 중 가장 왼쪽 고양이를 직접 고른 칸과 자리를 바꾼다.',
  },
  {
    id: 'gem-obsession',
    name: '망령의 집착',
    type: 'transform',
    phase: 'sequential',
    build: 'combo',
    description: '가장 왼쪽 보석이 있는 칸이 유령들린다.',
  },
  {
    id: 'combo-zombie-cat',
    name: '좀비 고양이',
    type: 'transform',
    phase: 'sequential',
    build: 'combo',
    description: '첫 번째 칸이 좀비고양이가 된다.',
  },
  {
    id: 'combo-ghost-cat',
    name: '유령 고양이',
    type: 'transform',
    phase: 'sequential',
    build: 'combo',
    description: '유령들린 칸의 고양이는 유령고양이가 되고, 그 칸의 유령들림이 풀린다.',
  },

  // ---- pair (A–B conditional bonus) ----
  // The non-spec 페어 보너스 rules (과수원 보석상 / 고양이 택시) were removed.
  // PAIR_RULES is now empty, so no 'pair'-build rules are registered.

  // ---- nothing (첨탑 시작 풀을 채우는 무효 카드) ----
  // 효과가 전혀 없는 placeholder. 첨탑 시작 풀에만 주입되며 상점·타 모드·규칙 도움말에는
  // 절대 노출되지 않는다(NOTHING_RULE_IDS로 가드). 엔진 효과는 100% rule.id 기준이라,
  // 이 id들은 cascade default(no-op)·computeWeights·scoreResult 어디에도 매칭되지 않아
  // 완전 무효다. 규칙 유일성을 지키기 위해 서로 다른 id 3개를 둔다(같은 id 3개는 금지).
  { id: 'nothing-1', name: 'NOTHING', description: '아무 효과가 없습니다.', type: 'score', phase: 'scoring', build: 'nothing' },
  { id: 'nothing-2', name: 'NOTHING', description: '아무 효과가 없습니다.', type: 'score', phase: 'scoring', build: 'nothing' },
  { id: 'nothing-3', name: 'NOTHING', description: '아무 효과가 없습니다.', type: 'score', phase: 'scoring', build: 'nothing' },
];

/**
 * The 3 no-op "NOTHING" cards. They live in `RULES` (so RULES_BY_ID resolves them
 * for the engine + holdings display) but must NEVER appear in the shop, in other
 * modes, or in the 규칙 도움말 — callers gate on this set. They are injected ONLY
 * into the spire starting pool (lib/spire/state.ts applyInitialSetChoice).
 */
export const NOTHING_RULE_IDS: ReadonlySet<string> = new Set<string>([
  'nothing-1',
  'nothing-2',
  'nothing-3',
]);

export const RULES_BY_ID: Record<string, Rule> = Object.fromEntries(
  RULES.map((rule) => [rule.id, rule]),
);

/**
 * 빠른 게임 / 이벤트(레거시)에서 제안될 수 있는 규칙의 **동결된 화이트리스트**.
 *
 * 레거시는 "원조 룰셋"으로 고정한다(사용자 결정). `RULES`는 시즌 세트 규칙까지 담는 공용
 * 테이블이라, 과거에는 "심볼이 굴러가면 노출"(rulePlayable) + combo/pair 빌드 제외 방식으로
 * 레거시 풀을 추렸다. 그 방식은 시즌 중 추가된 과일/보석 빌드 규칙(비타민 보충·미의 추구)이
 * 레거시로 새어 들어오고, 원래 레거시에 있던 붉은/푸른 물들이기(현재 combo 빌드)가 빠지는
 * **드리프트**를 만들었다.
 *
 * 그래서 이제는 **id 화이트리스트**가 단일 기준이다. 이 30개는 시즌-1 작업 직전 커밋
 * (2026-06-15 `d6842dd`)의 data/rules.ts에서 레거시 백(BASE_WEIGHTS)으로 노출되던 규칙
 * 전부와 정확히 일치한다. 시즌 세트 전용 규칙(비타민 보충·미의 추구·고양이/교통/괴물/그 외
 * combo)은 빠른 게임/이벤트에 등장하지 않으며, 시즌 모드(일일/퍼즐/첨탑)에서만 쓰인다.
 *
 * 참고: 과일/보석 확률 ×4 · 0 상승(왼쪽 2개) · 보석 셔플(2개) 세 규칙은 **동작만** 시즌 spec에
 * 맞춰 조정됐고 멤버십은 그대로다 — 모두 이 화이트리스트에 포함된다.
 */
export const LEGACY_RULE_IDS: ReadonlySet<string> = new Set<string>([
  // 7 / 숫자
  'seven-fever', 'seven-double', 'zero-to-seven', 'number-spin',
  // 과일
  'fruit-surge', 'diamond-cut', 'fruit-fish',
  // 보석
  'gem-surge', 'gem-fish',
  // 순서 / 메타 / select
  'fruit-freeze', 'center-lock', 'last-lock', 'left-pair', 'center-echo',
  'third-mirror', 'copy-above', 'select-copy', 'select-swap', 'select-reroll',
  // 컬러 / 물들이기
  'first-cherry', 'red-dye', 'blue-dye',
  // 안전
  'no-zero', 'four-shield', 'four-parry', 'safe-convert', 'gem-shuffle',
  // 점수
  'bonus-77', 'clean-bonus', 'four-fortune',
]);
