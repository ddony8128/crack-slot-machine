# 누락 규칙 구현 계획 (체크리스트 전수)

The rule-set checklist defined ~16 rules + structural pieces the engine was
missing. Implement in waves; each wave: cascade/score + data/rules + set wiring +
tests, replay-fuzz green, commit.

## Wave 1a — 단일 세트 보드효과 규칙 (clean cascade/score)
- [ ] 미의 추구 (gem): 보석이 하나라도 있으면 +100 (score rule, build gem)
- [ ] 영역 다툼 (cat): 고양이와 이웃한 고양이를 모두 재굴림 (reroll)
- [ ] 교통사고 (vehicle): 이웃한 교통수단이 있는 교통수단을 모두 재굴림 (reroll)

## Wave 1b — 조합(combo) 규칙 인프라 + 보드효과 조합 규칙
- [ ] COMBO_RULES registry (ruleId → [setA,setB]); buildRulePool + rulePlayable include when both sets owned
- [ ] 루비 변환 (num+gem): 0과 7이 루비로 (transform)
- [ ] 다이아 변환 (num+gem): 4가 다이아몬드로 (transform)
- [ ] 기물 파손 (cat+vehicle): 고양이와 이웃한 교통수단 재굴림 (reroll)
- [ ] 금품 갈취 (monster+gem): 드라큘라와 이웃한 보석마다 +70 + 그 보석 재굴림 (score+reroll)
- [ ] 왜 여기 타 있어 (cat+vehicle): 교통수단과 이웃한 가장 왼쪽 고양이를 선택한 칸과 교환 (select)

## Wave 2 — 괴물 세트 재정리 + 괴물 규칙
- [ ] 괴물 set ruleIds → [백귀야행, 지박령, 흡혈귀 퇴마사(W3), 퍼져나가는 역병, 가족 만들기]
- [ ] 지박령 (monster): 가장 왼쪽 유령 칸 유령들림 + 그 유령 재굴림
- [ ] 퍼져나가는 역병 (monster): 가장 왼쪽 좀비 양옆이 좀비 복사, 원본 좀비 재굴림
- [ ] (유령들림/전염병은 set에서 제거; rule은 deprecated 유지 또는 재사용)

## Wave 3 — cell-status 모델 + ghost_cat + 잔여 괴물/조합
- [ ] ghost_cat 심볼 + SYMBOL_TAGS(['cat','monster']) + emoji
- [ ] cell-status 모델 확장 (haunted clear 이벤트; 흡혈귀퇴마사/유령고양이가 해제)
- [ ] 흡혈귀 퇴마사 (monster): 흡혈귀 있는 유령들린 칸 해제 + 200점
- [ ] 망령의 집착 (monster+gem): 가장 왼쪽 보석 칸 유령들림
- [ ] 좀비 고양이 (monster+cat): 첫 칸 → zombie_cat
- [ ] 유령 고양이 (monster+cat): 유령들린 칸의 고양이 → ghost_cat + 해제

## Wave 4 — 위치/이전상태 조건부 확률
- [ ] 고양이 확률 증가 (cat): 홀수 칸에서 고양이 확률 ×4
- [ ] 백귀야행 (monster): 괴물 확률 = 이전 스핀 괴물 수 + 3배

Process per wave: subagent (supervised) → vitest + eslint → tsc → commit. replay-fuzz must stay green (new rules only fire in their sets; legacy unaffected).
