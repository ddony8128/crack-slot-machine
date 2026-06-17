# 🎰 RULE SLOT

> **규칙을 조작하고 레버를 당겨라.** 운이 아니라 설계로 점수를 만드는 슬롯머신.

일반 슬롯머신은 그냥 돌리고 운에 맡깁니다. RULE SLOT은 다릅니다 — 매 턴 **규칙 카드**를
뽑아 5개의 슬롯에 배치하면, 그 규칙들이 위에서 아래로 순서대로 적용되며 릴 결과를 바꿉니다.
4를 전부 다시 굴리고, 0을 7로 바꾸고, 윗칸 규칙을 복사하고, 4가 5개면 다음 스핀 점수를
×4로 만드는 식으로 — **자신만의 점수 엔진(빌드)을 쌓아** 최고점을 노립니다.

이 저장소는 현재 **시즌제 공개 테스트(Season 1)** 상태입니다. 계정 + 4개 모드 +
시즌 통합 랭킹을 운영하며, 모든 점수는 **서버가 직접 재현·검증**한 값만 등록됩니다
(아래 [안티치트](#-안티치트--서버-재현-검증) 참고).

---

## 🎮 게임 개요

- **릴 5칸 · 규칙 슬롯 5칸**(위 → 아래 순서로 적용). 스핀 수는 모드마다 다름.
- **심볼 세트 6종**: 숫자(7·0·4) · 과일(🍒🍋🍇) · 보석(💎🔴🔵) · 고양이(치즈/턱시도/삼색) ·
  교통수단(✈️🚢🚗) · 괴물(드라큘라/좀비/유령). 세트마다 고유 족보·규칙·점수가 있습니다.
- 매 스핀 전 **규칙 카드 후보 중 골라** 슬롯에 장착하거나 가방에 보관(가방 규칙은 비활성).
- **규칙 종류**: 확률 조작(가중치), 재굴림, 변환, 고정(lock), 점수 보너스, 메타(위 규칙 복사),
  플레이어가 칸을 직접 고르는 select 계열(교환/복사/재굴림/주차/물류 등).
- **점수**: 세트별 족보(과일 3종/올 과일, 보석 3종/올 보석, 고양이 마릿수·이웃 페널티 등) ·
  7 족보 · 4 페널티 · 특수 족보(4가 4~5개면 다음 스핀 배수, 0이 3개 이상이면 규칙 추가) ·
  이벤트 점수(교통수단 이동·괴물 복사 등).
- 규칙·점수·세트의 **단일 진실 원천(SoT)은 [`docs/SPEC.md`](docs/SPEC.md)** 입니다.
  게임 내에서는 모드별 도움말(빠른 게임=규칙/점수표, 첨탑=보유 현황, 퍼즐=심볼 풀)로 확인합니다.

---

## 🗺 모드

Season 1은 4개 모드를 운영합니다. **시즌 랭킹**(`/season/leaderboard`)은 첨탑·퍼즐·일일의
시즌 점수를 합산해 한 줄로 보여줍니다. 빠른 게임은 시즌과 별개입니다.

| 모드 | 경로 | 설명 | 시즌 점수 |
|---|---|---|---|
| **빠른 게임** | `/quick` | 로그인 없이 게스트로 즐기는 레거시 7스핀 룰. 별도 랭킹. | ❌ (시즌 무관) |
| **일일 도전** | `/season/daily` | 매일 정해진 시드·규칙 풀로 모두가 같은 판을 플레이. 하루 3회(+광고 충전). | ✅ 첫 플레이 +20 · 정산 시 순위 보상 |
| **퍼즐** | `/season/puzzle` | 정해진 규칙·보드·목표를 가진 결정형 퍼즐 10종. 클리어/미클리어만 판정. | ✅ 퍼즐당 100 + 남은 스핀×10 (각 퍼즐 최고 기록) |
| **첨탑 오르기** | `/season/spire` | 10스테이지 로그라이크. 돈·상점·아티팩트·족보 강화로 빌드를 쌓아 등반. | ✅ 최고 도달 스테이지×100 + 남은 돈×10 + 남긴 스핀×10 (베스트 런) |

- **빠른 게임**: 레거시 9심볼 룰셋을 **원조 그대로 동결**(규칙 화이트리스트 + 올 레드/올 블루 색 보너스 복원).
  게스트·회원 모두 표시, 시즌 랭킹 미반영, 시즌마다 초기화. 자세한 동결 정책은 `docs/SPEC.md` §1.1.
- **일일 도전**: KST 12:00 경계로 날짜가 바뀝니다. 정산된 날의 순위 보상(상위 10% +50, 상위 50% +30)은
  최고 10일치만 시즌 점수에 합산.
- **퍼즐**: 랜덤 카드 뽑기가 없습니다. 퍼즐별 고정 규칙이 처음부터 가방에 들어 있습니다.
- **첨탑**: 스테이지 시작/종료 시 서버에 진행도가 자동 저장돼, 시즌 허브 카드에서 **이어하기** 가능.

자세한 모드별 규칙 구성·점수 공식·상점 경제는 [`docs/SPEC.md`](docs/SPEC.md)
(§1 모드 구성, "Season scoring & mode economy")를 참고하세요.

---

## 🛡 안티치트 — 서버 재현 검증

클라이언트가 보낸 점수는 **신뢰하지 않습니다.**

1. 게임 시작 시 서버가 **시드(seed)**를 발급합니다(예: `POST /api/spire/start`, `/api/daily/start`).
2. 게임 엔진은 RNG가 완전히 주입되는 순수 함수라, **시드 + 플레이어 행동 로그(actions)**만으로
   결과가 결정적으로 재현됩니다.
3. 제출 시 서버가 동일한 엔진을 헤드리스로 다시 굴려(`lib/replay.ts`, `lib/spire/replay.ts`)
   점수·클리어 여부를 **직접 계산**하고, 클라이언트 주장과 비교합니다.
4. 일치하면 저장(`submitted`/`verified`), 불일치면 거부(`rejected`). 즉 **저장되는 점수는 항상 서버 계산값**입니다.

또한 랭킹은 `CLIENT_VERSION` + `RULESET_VERSION`(`lib/version.ts`)이 **현재 버전과 일치하는
기록만** 노출하므로, 규칙이 바뀌어도 과거 점수와 섞이지 않습니다. **500회 replay 퍼즈 테스트**
(`lib/__tests__/replayFuzz.test.ts`)가 "같은 시드 + 같은 행동 → 같은 결과"의 결정성을 보증하며,
이 결정성이 안티치트의 토대입니다.

---

## 🧰 기술 스택

| 영역 | 사용 기술 |
|---|---|
| 프레임워크 | **Next.js 16** (App Router, Route Handlers) · **React 19** |
| 언어 | **TypeScript** |
| 상태관리 | **Zustand**(vanilla store, RNG 주입형) |
| 스타일 | **Tailwind CSS v4** |
| 드래그앤드롭 | **@dnd-kit** (규칙 슬롯 재정렬, 모바일 long-press 지원) |
| DB | **Supabase (Postgres)** — query builder만 사용, service_role 키는 서버 전용 |
| 인증 | 자체 세션(scrypt 비밀번호 + HMAC 서명 쿠키 `rs_player`) · 게스트 지원 |
| 테스트 | **Vitest** (692 tests, 500-run replay 퍼즈 포함) · Playwright 스모크 |
| 배포 | **Vercel** (`main` 푸시 시 자동 배포) |

> ⚠️ 이 저장소의 Next.js는 학습 데이터와 다를 수 있습니다. 코드 작성 전
> `node_modules/next/dist/docs/`의 해당 가이드를 먼저 확인하세요(`AGENTS.md`).

---

## 📁 구조

```
app/
  season/                   시즌 허브 · 랭킹 · daily · puzzle · spire 플레이 화면
  quick/                    빠른 게임(게스트) + 랭킹
  login/ signup/ me/        계정 · 프로필 · 설정 · 비밀번호 복구
  e/[slug]/                 레거시 이벤트 플레이 + /leaderboard
  admin/                    이벤트·일일·랭킹·유저 관리(비밀번호 로그인)
  api/                      auth · quick · daily · puzzles · spire · events · admin
components/                 슬롯머신 · 규칙슬롯 · 결과 · 랭킹 · 상점 · 모달 등 UI
store/gameStore.ts          게임 상태 + 행동 로그 기록(zustand, RNG 주입형)
lib/
  rng.ts                    시드 PRNG (cyrb128 + mulberry32)
  spin.ts cascade.ts score.ts   순수 게임 엔진(확률·규칙 적용·점수)
  symbols/ rules/           심볼 세트 · 규칙 세트 · 조합 규칙 정의
  spire/                    첨탑 상태머신 · 스테이지 · 상점 · 아티팩트 · replay · 리더보드
  daily/ puzzle/            일일·퍼즐 config 및 판정
  season/scoring.ts         시즌 점수 공식 + buildSeasonRanking
  replay.ts                 서버 재현 검증(모드 공용)
  db/  supabase/            DB 어댑터(Supabase + in-memory 폴백)
  version.ts                CLIENT_VERSION / RULESET_VERSION / SEASON_SLUG
data/                       rules.ts(규칙 정의) · scoreTable.ts(점수 상수) · symbols.ts
supabase/migrations/        0001_init(이벤트) · 0002_season1(시즌 스키마)
docs/                       SPEC(기획 SoT) · UI(UI 의도) · STATUS(현황) · DEPLOY · 기타 계획서
```

---

## 🚀 로컬 실행

환경변수가 없으면 **in-memory DB로 폴백**(프로세스 재시작 시 초기화, Season 1 자동 시드)하므로,
설정 없이도 바로 플레이할 수 있습니다.

```bash
npm install
npm run dev          # http://localhost:3000 → /season 으로 진입
```

기타 스크립트:

```bash
npm run build        # 프로덕션 빌드
npm run start        # 빌드 결과 실행
npm test             # Vitest 전체 실행 (692 tests)
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
```

---

## 🌐 런칭 (Supabase + Vercel)

랭킹을 영구 저장하려면 Supabase 연결이 필요합니다. **전체 가이드는
[`docs/DEPLOY.md`](docs/DEPLOY.md)** 에 있으며, 요약하면:

1. **Supabase 프로젝트 생성** → SQL Editor에서 `supabase/migrations/0001_init.sql` 실행 후
   `0002_season1.sql` 실행(`players`·`seasons`·`best_scores`·`daily_challenges`·`puzzle_stages`
   생성, `game_runs`를 전 모드용으로 일반화, Season 1 시드).
2. **환경변수 설정** (`.env.example` 참고 → `.env.local` 및 Vercel 환경변수):
   ```
   SUPABASE_URL=...                  # origin만. 코드가 /rest/v1 자동 제거
   SUPABASE_SERVICE_ROLE_KEY=...     # Supabase secret 키. 서버 전용, 절대 노출 금지
   ADMIN_PASSWORD=...                # /admin 로그인
   ADMIN_SESSION_SECRET=...          # 세션 쿠키 서명용(플레이어 세션도 이 키로 서명). openssl rand -hex 32
   NEXT_PUBLIC_SITE_URL=https://<도메인>   # OG 이미지 절대경로용
   ```
3. **배포**: `main`에 푸시하면 Vercel이 자동 빌드/배포.

### 운영 메모

- 규칙/점수표가 바뀌면 `RULESET_VERSION`을, 앱이 바뀌면 `CLIENT_VERSION`을 올리세요
  (`lib/version.ts`). 시즌이 바뀌면 `SEASON_SLUG` + seasons 테이블을 갱신합니다.
- 레거시 이벤트(`/e/[slug]`)와 관리자(`/admin`)는 그대로 유지됩니다. 운영 상세는 `docs/STATUS.md`.
- 효과음: `public/sounds/`에 `lever/spin/rule/score/jackpot.mp3`(CC0)를 넣으면 자동 적용,
  없으면 무음으로 동작합니다.

---

## 📚 문서 지도

| 문서 | 내용 |
|---|---|
| [`docs/SPEC.md`](docs/SPEC.md) | **기획 단일 진실 원천** — 모드 구성, 세트별 규칙·점수, 조합 규칙, 아티팩트, 시즌 점수·첨탑 경제. 코드와 충돌 시 이 문서가 우선. |
| [`docs/UI.md`](docs/UI.md) | **UI 디테일과 의도** — QA 라운드에서 내린 화면/문구/연출 결정과 그 이유. |
| [`docs/STATUS.md`](docs/STATUS.md) | **현황 스냅샷** — 버전, 라우트, 모드별 구현 상태, 인프라, 검증 상태. |
| [`docs/DEPLOY.md`](docs/DEPLOY.md) | 배포·환경변수·Supabase 설정 가이드. |
