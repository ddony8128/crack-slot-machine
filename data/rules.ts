import type { Rule } from '@/types';

export const RULES: Rule[] = [
  // ---- 7 / jackpot ----
  {
    id: 'seven-fever',
    name: '원숭이 손',
    type: 'weight',
    build: '7',
    description: '7이 나올 확률이 네 배가 된다.',
  },
  {
    id: 'seven-double',
    name: '더블 세븐',
    type: 'score',
    build: '7',
    description: '이번 스핀에서 7로 얻는 점수가 두 배가 된다.',
  },
  {
    id: 'zero-to-seven',
    name: '영의 상승',
    type: 'transform',
    build: '7',
    description: '모든 0이 7로 바뀐다.',
  },
  {
    id: 'number-spin',
    name: '숫자 회귀',
    type: 'weight',
    build: '7',
    description: '직전 결과가 숫자였던 칸은 첫 굴림에서 다시 숫자가 나온다.',
  },

  // ---- fruit ----
  {
    id: 'fruit-surge',
    name: '신체 소환',
    type: 'weight',
    build: 'fruit',
    description: '신체가 나올 확률이 세 배가 된다.',
  },
  {
    id: 'diamond-cut',
    name: '은빛 결계',
    type: 'weight',
    build: 'fruit',
    description: '좀비와 유령이 나오지 않는다.',
  },
  {
    id: 'fruit-fish',
    name: '신체 낚시',
    type: 'reroll',
    build: 'fruit',
    description: '가장 왼쪽의 신체가 아닌 칸을 신체가 나올 때까지 다시 굴린다.',
  },

  // ---- gem ----
  {
    id: 'gem-surge',
    name: '괴물 출현',
    type: 'weight',
    build: 'gem',
    description: '괴물이 나올 확률이 세 배가 된다.',
  },
  {
    id: 'fruit-freeze',
    name: '신체 보존',
    type: 'lock',
    build: 'order',
    description: '이전 결과에서 가장 왼쪽 신체 두 개가 유지된다.',
  },
  {
    id: 'gem-fish',
    name: '괴물 낚시',
    type: 'reroll',
    build: 'gem',
    description: '가장 왼쪽의 괴물이 아닌 칸을 괴물이 나올 때까지 다시 굴린다.',
  },

  // ---- color ----
  {
    id: 'first-cherry',
    name: '첫 손님',
    type: 'transform',
    build: 'color',
    description: '첫 번째 칸이 손이 된다.',
  },
  {
    id: 'red-dye',
    name: '손자국',
    type: 'transform',
    build: 'color',
    description: '발과 좀비가 손으로 바뀐다.',
  },
  {
    id: 'blue-dye',
    name: '혼령화',
    type: 'transform',
    build: 'color',
    description: '발과 좀비가 유령으로 바뀐다.',
  },

  // ---- order ----
  {
    id: 'center-lock',
    name: '중앙 봉인',
    type: 'lock',
    build: 'order',
    description: '세 번째 칸이 이전 스핀의 값으로 고정되어 돌지 않는다.',
  },
  {
    id: 'last-lock',
    name: '마지막 봉인',
    type: 'lock',
    build: 'order',
    description: '마지막 칸이 이전 스핀의 값으로 고정되어 돌지 않는다.',
  },
  {
    id: 'left-pair',
    name: '왼쪽 복제',
    type: 'transform',
    build: 'order',
    description: '두 번째 칸이 첫 번째 칸과 같아진다.',
  },
  {
    id: 'center-echo',
    name: '중앙 메아리',
    type: 'transform',
    build: 'order',
    description: '네 번째 칸이 두 번째 칸과 같아진다.',
  },
  {
    id: 'third-mirror',
    name: '세 번째 거울',
    type: 'transform',
    build: 'order',
    description: '세 번째 칸이 다섯 번째 칸과 같아진다.',
  },
  {
    id: 'copy-above',
    name: '위 규칙 복사',
    type: 'meta',
    build: 'order',
    description: '바로 위 규칙을 한 번 더 적용한다.',
  },
  {
    id: 'select-copy',
    name: '직접 복제',
    type: 'select',
    build: 'order',
    description: '직접 고른 칸이 바로 왼쪽 칸과 같아진다.',
  },
  {
    id: 'select-swap',
    name: '직접 교환',
    type: 'select',
    build: 'order',
    description: '직접 고른 두 칸이 서로 교체된다.',
  },
  {
    id: 'select-reroll',
    name: '직접 재굴림',
    type: 'select',
    build: 'order',
    description: '직접 고른 한 칸을 다시 굴린다.',
  },

  // ---- safe ----
  {
    id: 'no-zero',
    name: '0 금지',
    type: 'weight',
    build: 'safe',
    description: '0이 절대 나오지 않는다.',
  },
  {
    id: 'four-shield',
    name: '4 방어',
    type: 'reroll',
    build: 'safe',
    description: '나온 4를 모두 다시 굴리고, 이번 스핀에는 0이 나올 확률이 두 배가 된다.',
  },
  {
    id: 'four-parry',
    name: '4 쳐내기',
    type: 'reroll',
    build: 'safe',
    description: '가장 왼쪽의 4를 4가 아닌 것이 나올 때까지 다시 굴린다.',
  },
  {
    id: 'safe-convert',
    name: '피의 계약',
    type: 'transform',
    build: 'safe',
    description: '모든 0과 4가 흡혈귀로 바뀐다.',
  },
  {
    id: 'gem-shuffle',
    name: '퇴마 셔플',
    type: 'reroll',
    build: 'safe',
    description: '가장 왼쪽의 괴물을 괴물이 아닌 것이 나올 때까지 다시 굴린다.',
  },

  // ---- score ----
  {
    id: 'bonus-77',
    name: '럭키 세븐세븐',
    type: 'score',
    build: 'score',
    description: '점수를 77점 더 얻는다.',
  },
  {
    id: 'clean-bonus',
    name: '깨끗한 손',
    type: 'score',
    build: 'score',
    description: '보드에 4가 하나도 없으면 120점을 더 얻는다.',
  },
  {
    id: 'four-fortune',
    name: '불길한 행운',
    type: 'score',
    build: 'score',
    description: '4가 나올 확률이 네 배가 되고, 4 하나당 +20점이 된다.',
  },
];

export const RULES_BY_ID: Record<string, Rule> = Object.fromEntries(
  RULES.map((rule) => [rule.id, rule]),
);
