# RULE SLOT — 현황 (v1.0.0)

최종 업데이트: 2026-06-06 · 브랜치: `main` (Vercel 자동 배포) · 배포: https://crack-slot-machine.vercel.app

## 한 줄 요약
규칙을 조작해 슬롯 점수를 겨루는 1인 슬롯 로그라이크. 이번 릴리즈에서 **이벤트별 랭킹 + 서버 재현(replay) 기반 치팅 방지 + Supabase 영구 저장 + 관리자 페이지**를 붙여 실제 공유 가능한 상태로 마무리함.

## 라우트
- `/` → `/e/total` 리다이렉트
- `/e/[slug]` — 이벤트 플레이 (DB에 없는 slug는 404). 로비에 이벤트별 TOP5 표시.
- `/e/[slug]/leaderboard` — 랭킹(Top10·10초 폴링·페이지네이션). `slug=total`이면 전 이벤트 합산.
- `/admin` — 비밀번호 로그인 → 이벤트 생성 / 제목·설명 수정 / 활성·비활성 토글 / 랭킹 링크.
- API: `GET /api/events/[slug]`, `POST .../start`, `POST /api/runs/[runId]/submit`, `GET .../leaderboard`, admin: `login`/`logout`/`events`(GET·POST)·`events/[slug]`(PATCH)·`events/[slug]/active`(POST).

## 아키텍처 핵심
- **결정적 시드 RNG**(`lib/rng.ts` `createSeededRng`) + 스토어가 rng 주입형. `start` API가 seed 발급.
- **서버 검증 = 프론트와 동일 엔진**: `lib/replay.ts`가 실제 `createGameStore`를 헤드리스로 구동해 재현 → 클라/서버 비트 동일(분기 구현 없음). 스토어가 결과-영향 액션을 `RecordedAction[]`로 기록(`getActions`).
- **제출 검증**: `lib/server/verifySubmission.ts`가 replay 결과와 클라 제출본을 비교 → 일치 시 서버 점수만 저장(submitted), 불일치/버전불일치 → rejected(치팅 화면).
- **버전 게이트**: `lib/version.ts` `CLIENT_VERSION`/`RULESET_VERSION`. 리더보드는 현재 버전 기록만 노출.
- **DB 추상화**: `lib/db/*` — Supabase 구현 + 인메모리 폴백(`hasSupabaseEnv` 없으면 메모리). 테이블 `events`, `game_runs`.

## 환경/배포 (자세히는 docs/DEPLOY.md)
Vercel 환경변수: `SUPABASE_URL`(origin만; 코드가 `/rest/v1` 자동 제거), `SUPABASE_SERVICE_ROLE_KEY`(=Supabase **secret 키** `sb_secret_…`), `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `NEXT_PUBLIC_SITE_URL`. DB는 `supabase/migrations/0001_init.sql` 실행으로 생성.

## 검증 상태
- 단위/통합 테스트 **166개** 통과. typecheck·lint·build 클린.
- **퍼즈 테스트**(`lib/__tests__/replayFuzz.test.ts`): 취소·재정렬·선택형·추가픽 포함 500회 랜덤 플레이를 서버 replay로 재현해 바이트 일치 검증.
- **프로덕션 Supabase e2e 수동 확인 완료**: 정직 런 제출→검증→리더보드(이벤트별+total) 노출.

## 이번에 잡은 주요 버그
- **취소-재선택 false-reject**(치명): 룰 선택 후 취소하고 다른 룰 고르면 `cancelSelection` 미기록으로 replay가 어긋나 정직 플레이어가 거부됨 → 기록하도록 수정.
- **PGRST125**: `SUPABASE_URL`에 `/rest/v1/`가 붙어 쿼리 실패 → 코드에서 origin만 추출하도록 보정.
- 환경변수 진단용 `/api/health`는 원인 규명 후 제거함.

## 의식적으로 안 한 것 (결정)
- **RLS 하드닝 패스**: 공개 키를 클라이언트에 노출하지 않고 서버 secret 키로만 접근하므로 현시점 실익 적음. 추후 (a) 브라우저에서 Supabase 직접 접근 또는 (b) 민감 데이터/대규모 트래픽 시 `events`·`game_runs`에 RLS 활성(정책 없음)으로 켜면 됨. 서버 secret 키는 RLS 우회.
- localStorage 랭킹/초기화 버튼 제거(서버 DB로 일원화). 튜토리얼·비속어 필터·크레딧·시도제한 등 §20 미포함 항목 그대로 제외.

## 향후 후보 (필요 시)
- 효과음 파일: `public/sounds/{lever,spin,rule,score,jackpot}.mp3`(CC0) 넣으면 자동 적용(현재 무음 폴백).
- 점수 제출 안정화: 탭 닫힘/하드 새로고침의 짧은 창에서 등록 누락 가능 → 필요 시 `navigator.sendBeacon` 보강(일반 인앱 이동은 정상).
- 이벤트 종료일/시도 제한 등은 의도적으로 보류.
