/**
 * 첨탑 아티팩트 카탈로그 (v0). Declarative defs — each effect is applied by the
 * engine (score.ts / store / spire reducers) keyed off the artifact id, so the
 * whole catalog is plain data and a run's artifacts (SpireRunState.artifacts)
 * stay replay-serializable.
 *
 * Acquisition: 3/6/9 clear selection or shop purchase only, never mid-stage, and
 * NO DUPLICATES in a run (owned ids are excluded from offers). Set-specific
 * artifacts only appear when their required set is in the symbol pool.
 */

export type ArtifactCategory =
  | 'general'
  | 'number'
  | 'fruit'
  | 'gem'
  | 'cat'
  | 'vehicle'
  | 'monster';

export type ArtifactDef = {
  id: string;
  name: string;
  description: string;
  category: ArtifactCategory;
  /** Only offered when ALL these set ids are owned (in the symbol pool). */
  requiredSetIds?: string[];
};

export const ARTIFACTS: ArtifactDef[] = [
  // ── general ──
  {
    id: 'bean-blessing',
    name: '콩의 가호',
    description: '매 스핀마다 두 번째 규칙 슬롯의 규칙을 한 번 더 적용합니다.',
    category: 'general',
  },
  {
    id: 'time-capsule',
    name: '타임캡슐',
    description: '첫 번째 스핀의 점수는 0이 되고, 일곱 번째 스핀의 점수가 2배가 됩니다.',
    category: 'general',
  },
  {
    id: 'ledger',
    name: '가계부',
    description: '이자를 두 배로 얻습니다.',
    category: 'general',
  },
  {
    id: 'chime',
    name: '차임벨',
    description: '상점에 들어갈 때마다 무료 리롤 2회가 주어집니다.',
    category: 'general',
  },
  {
    id: 'blank-canvas',
    name: '새하얀 도화지',
    description: '매 스핀마다 비어 있는 규칙 칸 하나당 50점을 얻습니다.',
    category: 'general',
  },
  {
    id: 'engine',
    name: '엔진',
    description: '각 스테이지의 첫 스핀 전에 규칙을 한 개 더 고릅니다.',
    category: 'general',
  },
  {
    id: 'swiss-knife',
    name: '맥가이버 칼',
    description: '규칙을 고를 때 후보가 3개 대신 4개 등장합니다.',
    category: 'general',
  },
  {
    id: 'watering-can',
    name: '물뿌리개',
    description: '획득 시 0을 제외하고, 가장 많은 심볼 중 하나가 +1, 가장 적은 심볼 중 하나가 -1.',
    category: 'general',
  },
  {
    id: 'slot-machine',
    name: '슬롯머신',
    description: '획득 시 심볼 풀을 전체에서 무작위로 다시 구성하고, 새 심볼 풀의 세트 규칙으로 규칙 풀을 다시 구성합니다.',
    category: 'general',
  },

  // ── number ──
  {
    id: 'four-statue',
    name: '4 석상',
    description: '특수 족보 활성화: 4가 4개면 다음 스핀 점수 2배, 5개면 3배.',
    category: 'number',
  },
  {
    id: 'zero-statue',
    name: '0 석상',
    description: '특수 족보 활성화: 0이 4개 이상이면 다음 스핀 전 규칙을 한 개 더 고릅니다.',
    category: 'number',
  },

  // ── fruit ──
  {
    id: 'receipt',
    name: '영수증',
    description: '올 과일 보너스가 300점 증가합니다.',
    category: 'fruit',
    requiredSetIds: ['fruit'],
  },
  {
    id: 'cherry-charm',
    name: '체리',
    description: '족보 계산 시 체리가 하나 더 있는 것으로 계산합니다.',
    category: 'fruit',
    requiredSetIds: ['fruit'],
  },

  // ── gem ──
  {
    id: 'vault',
    name: '금고',
    description: '보석 3종 보너스가 200점 증가합니다.',
    category: 'gem',
    requiredSetIds: ['gem'],
  },
  {
    id: 'gold-bar',
    name: '금괴',
    description: '스핀 최종 조합에 보석이 4개 이상이면 1원을 얻습니다.',
    category: 'gem',
    requiredSetIds: ['gem'],
  },

  // ── cat ──
  {
    id: 'cat-tower',
    name: '캣 타워',
    description: '이웃한 고양이 페널티가 마리당 60점 줄어듭니다. (이웃 페널티 제거)',
    category: 'cat',
    requiredSetIds: ['cat'],
  },
  {
    id: 'melted-cat',
    name: '녹아버린 고양이',
    description: '각 스테이지의 첫 번째 스핀에서 고양이가 나오지 않습니다.',
    category: 'cat',
    requiredSetIds: ['cat'],
  },

  // ── vehicle ──
  {
    id: 'spooky-cruise',
    name: '으스스한 유람선',
    description: '교통수단 심볼이 복사될 때마다 40점을 얻습니다.',
    category: 'vehicle',
    requiredSetIds: ['vehicle'],
  },
  {
    id: 'private-jet',
    name: '전용기',
    description: '한 스핀에서 교통수단 이동(이동 이벤트)이 6회 이상이면 그 스핀 점수가 2배가 됩니다.',
    category: 'vehicle',
    requiredSetIds: ['vehicle'],
  },

  // ── monster ──
  {
    id: 'monster-truck',
    name: '괴물 자동차',
    description: '괴물 심볼이 이동하거나 재굴림될 때마다 20점을 얻습니다.',
    category: 'monster',
    requiredSetIds: ['monster'],
  },
  {
    id: 'crowbar',
    name: '빠루',
    description: '한 스핀에서 괴물이 3회 이상 재굴림되면 그 스핀 점수가 2배가 됩니다.',
    category: 'monster',
    requiredSetIds: ['monster'],
  },
];

export const ARTIFACTS_BY_ID: Record<string, ArtifactDef> = Object.fromEntries(
  ARTIFACTS.map((a) => [a.id, a]),
);

/**
 * Is this artifact eligible to be OFFERED? Not already owned, and (if
 * set-specific) every required set is in the owned-set list.
 */
export function artifactOffered(
  def: ArtifactDef,
  ownedSetIds: string[],
  ownedArtifacts: string[],
): boolean {
  if (ownedArtifacts.includes(def.id)) return false;
  if (def.requiredSetIds && !def.requiredSetIds.every((s) => ownedSetIds.includes(s))) {
    return false;
  }
  return true;
}
