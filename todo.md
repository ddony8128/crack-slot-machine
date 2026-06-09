# TODO

## 연출 (UX)

- [x] **재굴림 시 값이 그대로면 모션이 안 보이는 문제** (해결: `SpinLogStep.rerolled` 추가 → reveal flash 합집합)
  - 증상: FOUR SHIELD 등 재굴림 규칙에서 4 → 4로 다시 나온 칸은 "안 돌아간 것처럼" 보임 (큔 제보, DIAMOND CUT·GEM SHUFFLE·FOUR SHIELD·ZERO ASCEND 조합).
  - 원인: `hooks/useSpinReveal.ts`의 `diffIndices(prev, step.result)`가 **값이 바뀐 칸만** 연출함. 4→4 재굴림은 값이 같아 연출에서 빠짐.
  - 영향: 로직·점수는 정상. 연출만 혼란을 줌 (재굴림했는데 안 한 것처럼 보임).
  - 해결안:
    1. (권장) `SpinLogStep`에 "이 스텝에서 실제로 굴린 칸 인덱스" 추가 → reveal이 값 변화가 아닌 실제 재굴림 칸을 연출. (cascade·types·reveal 수정 필요)
    2. (간단) reroll 계열 스텝은 대상 칸을 무조건 한 번 번쩍이게 처리.
