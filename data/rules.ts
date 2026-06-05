import type { Rule } from '@/types';

export const RULES: Rule[] = [
  {
    id: 'fruit-mode',
    name: 'FRUIT MODE',
    type: 'weight',
    description: '과일 확률 증가 — 🍒🍋🍇가 더 자주 등장',
  },
  {
    id: 'gem-mode',
    name: 'GEM MODE',
    type: 'weight',
    description: '보석 확률 증가 — 💎🔴🔵가 더 자주 등장',
  },
  {
    id: 'seven-fever',
    name: 'SEVEN FEVER',
    type: 'weight',
    description: '7 확률 증가 — JACKPOT을 노린다',
  },
  {
    id: 'zero-fog',
    name: 'ZERO FOG',
    type: 'weight',
    description: '0 확률 증가, 4 확률 감소',
  },
  {
    id: 'four-shield',
    name: 'FOUR SHIELD',
    type: 'reroll',
    description: '나온 4를 한 번 다시 굴린다',
  },
  {
    id: 'zero-break',
    name: 'ZERO BREAK',
    type: 'reroll',
    description: '나온 0을 한 번 다시 굴린다',
  },
  {
    id: 'edge-mirror',
    name: 'EDGE MIRROR',
    type: 'transform',
    description: '마지막 칸이 첫 칸과 같아진다 (5번=1번)',
  },
  {
    id: 'left-pair',
    name: 'LEFT PAIR',
    type: 'transform',
    description: '두 번째 칸이 첫 칸과 같아진다 (2번=1번)',
  },
  {
    id: 'center-echo',
    name: 'CENTER ECHO',
    type: 'transform',
    description: '네 번째 칸이 두 번째 칸과 같아진다 (4번=2번)',
  },
  {
    id: 'center-lock',
    name: 'CENTER LOCK',
    type: 'lock',
    description: '가운데 칸은 이전 스핀 결과를 유지',
  },
  {
    id: 'lucky-convert',
    name: 'LUCKY CONVERT',
    type: 'transform',
    description: '가장 왼쪽 0 하나를 7로 변환',
  },
  {
    id: 'safe-convert',
    name: 'SAFE CONVERT',
    type: 'transform',
    description: '가장 왼쪽 4 하나를 0으로 변환',
  },
];

export const RULES_BY_ID: Record<string, Rule> = Object.fromEntries(
  RULES.map((rule) => [rule.id, rule]),
);
