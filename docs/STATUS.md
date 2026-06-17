# RULE SLOT — 현황 (Season 1)

최종 업데이트: 2026-06-17 · 브랜치: `main`(Vercel 자동 배포) · 시즌 slug `2026-06-season-1`
(6/15 12:00 ~ 6/28 12:00 KST) · `CLIENT_VERSION=2.1.0` · `RULESET_VERSION=3`.

## 한 줄 요약
규칙을 조작해 슬롯 점수를 겨루는 1인 슬롯 로그라이크. **계정 + 4개 모드(빠른/일일/퍼즐/첨탑) +
시즌 통합 랭킹 + 서버 재현(replay) 기반 치팅 방지 + Supabase 영구 저장**을 갖춘 공개 테스트 시즌 상태.
레거시 이벤트(`/e/[slug]`)·관리자(`/admin`)는 그대로 유지.

## 모드별 구현 상태
| 모드 | 경로 | 상태 | 비고 |
|---|---|---|---|
| 빠른 게임 | `/quick` | ✅ 운영 | 게스트, 시즌 무관, 별도 랭킹. 레거시 룰셋 + 3개 규칙만 spec 패치(아래). |
| 일일 도전 | `/season/daily` | ✅ 운영 | 하루 3회+광고 충전, 서버 검증, 정산 순위 보상, 후원 CTA. |
| 퍼즐 | `/season/puzzle` | ✅ 운영 | 고정 규칙·목표 퍼즐, 클리어 판정, 심볼 풀 표시. |
| 첨탑 오르기 | `/season/spire` | ✅ 운영 | 10스테이지, 상점·아티팩트·족보 강화, 진행도 저장·이어하기, 자체 랭킹. |
| 레거시 이벤트 | `/e/[slug]` | ✅ 유지 | 기존 이벤트 플레이 + 랭킹 + 관리자. |

## 라우트
- `/` → `/season` 진입.
- 시즌: `/season`(허브), `/season/leaderboard`(통합 랭킹+점수 설명), `/season/daily`(+`/leaderboard`),
  `/season/puzzle`(+`/[puzzleKey]`), `/season/spire`.
- 빠른 게임: `/quick`(+`/leaderboard`).
- 계정: `/login`(+`/recover`), `/signup`, `/me`(+`/settings`), `/privacy`.
- 레거시/관리: `/e/[slug]`(+`/leaderboard`), `/admin`(daily·ranking·runs·users).
- API: `auth/*`, `quick/*`, `daily/*`(current·start·submit·refill·leaderboard),
  `puzzles/*`(list·[key]/start·submit), `spire/*`(start·submit·current·progress·leaderboard),
  `events/*`, `runs/[runId]/submit`, `admin/*`, `guest`.

## 아키텍처 핵심
- **결정적 시드 RNG**(`lib/rng.ts`) + 스토어가 rng 주입형. `start` API가 seed 발급.
- **서버 검증 = 프론트와 동일 엔진**: `lib/replay.ts`(공용)·`lib/spire/replay.ts`(첨탑)가 헤드리스로 재현 →
  클라/서버 비트 동일. 스토어가 결과-영향 액션을 `RecordedAction[]`/`SpireAction[]`로 기록.
- **버전 게이트**: `lib/version.ts`. 리더보드는 현재 `CLIENT_VERSION`/`RULESET_VERSION` 기록만 노출.
- **시즌 점수**: `lib/season/scoring.ts` — 첨탑/퍼즐/일일 공식 + `buildSeasonRanking`(모드별 캡 없이 합산).
- **DB 추상화**: `lib/db/*` — Supabase 구현 + 인메모리 폴백(env 없으면 메모리, Season 1 시드).
  테이블: `players`·`seasons`·`best_scores`·`daily_challenges`·`puzzle_stages`·`game_runs`(전 모드)·`events`.

## 환경/배포 (자세히는 docs/DEPLOY.md)
Vercel 환경변수: `SUPABASE_URL`(origin만), `SUPABASE_SERVICE_ROLE_KEY`(Supabase secret `sb_secret_…`),
`ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`(플레이어 세션 쿠키도 이 키로 서명), `NEXT_PUBLIC_SITE_URL`.
DB는 `0001_init.sql` → `0002_season1.sql` 순서로 실행.

## 검증 상태
- 단위/통합 테스트 **690개** 통과. typecheck·lint 클린. Playwright 스모크 포함.
- **퍼즈 테스트**(`replayFuzz.test.ts`): 취소·재정렬·선택형·추가픽 포함 500회 랜덤 플레이를 서버 replay로
  재현해 바이트 일치 검증. 첨탑은 `replaySpireRun` 결정성 동일 보증.
- 라이브 Supabase(season-1) e2e 수동 확인: 정직 런 제출→검증→리더보드 노출, 첨탑 진행도 저장·이어하기.

## Season 1 QA 라운드에서 잡은 것 (요약)
docs/SPEC.md "Code↔spec mismatches"와 docs/UI.md에 상세. 핵심:
- 퍼즐/첨탑 **instant-clear** 제거(reveal 먼저 → 정산/판정). 첨탑 정산 화면을 스테이지 종료와 함께 노출.
- 첨탑 **보유 현황** 패널(심볼 주머니·가중치·규칙·아티팩트), 상점 **품절**·**족보 강화 once**·세트 족보 강화,
  진행도 **자동 저장 + 이어하기**, 결과 화면 **시즌 첨탑 랭킹**.
- 퍼즐 **심볼 풀** 표시(점수표/규칙 도움말 제거), 결과 화면 시즌 점수 설명.
- 일일 **재도전(refill+retry)**·**후원 CTA** 타이밍, 특수 족보 숨김.
- 콘텐츠: 고양이 이동 +40/마리, 백귀야행+COPY ABOVE 가중치 중첩, 물류 사업 select화.
- **3개 규칙 spec 패치를 빠른 게임에도 적용**(과일/보석 확률 ×4, 0 상승=왼쪽 2개, 보석 셔플=2개) — 아래.

## 빠른 게임 / 레거시 이벤트의 규칙·족보 동결 (중요)
- **빠른 게임(`/quick`)과 레거시 이벤트(`/e/[slug]`)는 "원조 룰셋"으로 동결**한다(사용자 결정).
  기준은 **id 화이트리스트 `LEGACY_RULE_IDS`**(`data/rules.ts`) — 시즌-1 직전 커밋(`d6842dd`, 06-15)에서
  레거시 백으로 노출되던 규칙 **정확히 30개**. 시즌 세트 규칙(고양이/교통/괴물·그 외 combo·시즌 추가
  과일/보석)은 빠른 게임/이벤트에 **등장하지 않으며**, 시즌 모드에서만 쓰인다.
  - 화이트리스트로 **복원**: `붉은/푸른 물들이기`(원조엔 color, 시즌에 combo로 재분류돼 빠졌던 것).
  - 화이트리스트로 **제외**: `비타민 보충`·`미의 추구`(시즌 추가분이 과일/보석 빌드라 새어들던 것).
  - 오퍼 풀(`offerRules`)과 `규칙 보기`(ReferenceModal)가 같은 화이트리스트를 써서 항상 일치한다.
- **족보 동결**: 원조 레거시 색 보너스 **올 레드(+250)·올 블루(+200)**가 시즌 config-driven scoring
  리팩터에서 누락됐던 것을 **레거시 전용으로 복원**(`legacyColorBonus`, `score.ts`). 시즌 모드는 세트
  기반 보너스만 쓰므로 적용하지 않는다(규칙 화이트리스트와 동일한 `isOfferProvisioning` 경계).
- **동작만 조정(멤버십 유지)**: 과일/보석 **확률 ×4**, **0 상승 = 왼쪽 2개**, **보석 셔플 = 2개** —
  세 규칙은 spec에 맞춰 동작만 바꿨고 모두 화이트리스트에 포함된다.
- 위 변경으로 빠른 게임 점수 산식이 원조로 돌아가므로 **`RULESET_VERSION` 2→3**(`CLIENT_VERSION` 2.1.0).
  랭킹은 현재 버전 기록만 노출하므로 과도기의 빠른 게임/이벤트 기록과 섞이지 않는다.

## 의식적으로 안 한 것 / 후보
- **RLS 하드닝**: 서버 secret 키로만 접근(공개 키 미노출)하므로 현시점 실익 적음. 추후 브라우저 직접 접근
  또는 민감 데이터 시 `best_scores`·`game_runs` 등에 RLS 활성 고려.
- 효과음 파일(`public/sounds/*.mp3`, CC0) 넣으면 자동 적용(현재 무음 폴백).
- 점수 제출 안정화(`navigator.sendBeacon`), 이벤트 종료일/시도 제한 등은 보류.

> ⚠️ 보안 메모: 라이브 season-1 service-role 키가 한 차례 대화에 노출된 적이 있다. 키 회전(rotate) 권장 —
> 회전 후 `.env.local`과 Vercel 환경변수의 `SUPABASE_SERVICE_ROLE_KEY`만 갱신하면 된다.
