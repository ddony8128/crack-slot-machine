# 🎰 RULE SLOT

> **규칙을 조작하고 레버를 당겨라.** 운이 아니라 설계로 점수를 만드는 슬롯머신.

일반 슬롯머신은 그냥 돌리고 운에 맡깁니다. RULE SLOT은 다릅니다 — 매 턴 **규칙 카드**를
뽑아 5개의 슬롯에 배치하면, 그 규칙들이 위에서 아래로 순서대로 적용되며 릴 결과를 바꿉니다.
4를 전부 다시 굴리고, 0을 7로 바꾸고, 윗칸 규칙을 복사하고, 4가 5개면 다음 스핀 점수를
×4로 만드는 식으로 — **자신만의 점수 엔진(빌드)을 쌓아 7번의 스핀 안에 최고점**을 노립니다.

이벤트(행사)별로 독립된 랭킹을 운영하며, 모든 점수는 **서버가 직접 재현·검증**한 값만
등록됩니다(아래 [안티치트](#-안티치트--서버-재현-검증) 참고).

---

## 🎮 게임 개요

- **릴 5칸 · 스핀 7번 · 규칙 슬롯 5칸**(위 → 아래 순서로 적용).
- 심볼 9종: 과일(🍒🍋🍇) · 보석(💎🔴🔵) · 숫자(7 · 0 · 4). 기본 확률은 모두 균등.
- 매 스핀 전 **규칙 카드 3장** 중 골라 슬롯에 장착하거나 가방에 보관(가방 규칙은 비활성).
- **30개의 규칙** — 확률 조작(가중치), 재굴림, 변환, 고정(lock), 점수 보너스, 메타(복사),
  플레이어가 칸을 직접 고르는 select 계열까지.
- **점수**: 7 족보 · 컬러/종류 족보(과일·보석) · 색 보너스(올 레드/올 블루) · 4 페널티 ·
  특수 족보(4가 4~5개면 다음 스핀 배수, 0이 3개 이상이면 규칙 추가).
- 규칙·점수 상세는 게임 내 **규칙/점수표 모달** 또는 [`docs/RULESLOT_SPEC.md`](docs/RULESLOT_SPEC.md).

---

## 🛡 안티치트 — 서버 재현 검증

클라이언트가 보낸 점수는 **신뢰하지 않습니다.**

1. 게임 시작 시 서버가 **시드(seed)**를 발급합니다(`POST /api/events/[slug]/start`).
2. 게임 엔진은 RNG가 완전히 주입되는 순수 함수라, **시드 + 플레이어 행동 로그(actions)**만으로
   결과가 결정적으로 재현됩니다.
3. 제출 시(`POST /api/runs/[runId]/submit`) 서버가 동일한 엔진을 헤드리스로 다시 굴려
   (`lib/replay.ts`) 점수를 **직접 계산**하고, 클라이언트 주장과 비교합니다.
4. 일치하면 저장(`verified`), 불일치면 거부(`rejected`). 즉 **저장되는 점수는 항상 서버 계산값**입니다.

또한 랭킹은 `CLIENT_VERSION` + `RULESET_VERSION`(`lib/version.ts`)이 **현재 버전과 일치하는
기록만** 노출하므로, 규칙이 바뀌어도 과거 점수와 섞이지 않습니다.

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
| 테스트 | **Vitest** (175 tests, 500-run replay 퍼즈 포함) |
| 배포 | **Vercel** (main 푸시 시 자동 배포) |

---

## 📁 구조

```
app/
  e/[slug]/                 이벤트 플레이 화면 + /leaderboard
  admin/                    이벤트 관리(비밀번호 로그인)
  api/                      events / start / submit / leaderboard / admin
components/                 슬롯머신·규칙슬롯·결과·랭킹 등 UI
hooks/useSpinReveal.ts      스핀 연출(롤 → 규칙 적용 → 정산) 상태머신
store/gameStore.ts          게임 상태 + 행동 로그 기록(zustand)
lib/
  rng.ts                    시드 PRNG (cyrb128 + mulberry32)
  spin.ts cascade.ts score.ts   순수 게임 엔진(확률·규칙 적용·점수)
  replay.ts                 서버 재현 검증
  db/  supabase/            DB 어댑터(Supabase + in-memory 폴백)
  version.ts                CLIENT_VERSION / RULESET_VERSION
data/rules.ts               30개 규칙 정의
supabase/migrations/        스키마 + 시드 이벤트 SQL
docs/                       RULESLOT_SPEC · DEPLOY · STATUS
```

---

## 🚀 로컬 실행

환경변수가 없으면 **in-memory DB로 폴백**(프로세스 재시작 시 초기화)하므로, 설정 없이도
바로 플레이할 수 있습니다.

```bash
npm install
npm run dev          # http://localhost:3000 → /e/total 로 리다이렉트
```

기타 스크립트:

```bash
npm run build        # 프로덕션 빌드
npm run start        # 빌드 결과 실행
npm test             # Vitest 전체 실행
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
```

> ⚠️ 이 저장소의 Next.js는 학습 데이터와 다를 수 있습니다. 코드 작성 전
> `node_modules/next/dist/docs/`의 해당 가이드를 먼저 확인하세요(`AGENTS.md`).

---

## 🌐 런칭 (Supabase + Vercel)

랭킹을 영구 저장하려면 Supabase 연결이 필요합니다. **전체 가이드는
[`docs/DEPLOY.md`](docs/DEPLOY.md)** 에 있으며, 요약하면:

1. **Supabase 프로젝트 생성** → SQL Editor에서 `supabase/migrations/0001_init.sql` 실행
   (`events`·`game_runs` 테이블 + 인덱스 + 시드 이벤트 `total`/`blackhaven`/`test` 생성).
2. **환경변수 설정** (`.env.example` 참고 → `.env.local` 및 Vercel 환경변수):
   ```
   SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...     # 서버 전용. 절대 노출 금지
   ADMIN_PASSWORD=...                # /admin 로그인
   ADMIN_SESSION_SECRET=...          # 세션 쿠키 서명용 임의 문자열 (openssl rand -hex 32)
   NEXT_PUBLIC_SITE_URL=https://<도메인>   # OG 이미지 절대경로용
   ```
3. **배포**: `main`에 푸시하면 Vercel이 자동 빌드/배포.

### 라우트

| 경로 | 설명 |
|---|---|
| `/` | `/e/total` 로 리다이렉트 |
| `/e/[slug]` | 이벤트 플레이 (DB에 없는 slug는 404) |
| `/e/[slug]/leaderboard` | 랭킹 (`total`이면 전체 종합) |
| `/admin` | 이벤트 생성·활성/비활성 (비밀번호 로그인) |

### 운영 메모

- 새 행사: `/admin`에서 slug 생성 → `/e/<slug>` 링크 공유. 종료 시 비활성화하면
  플레이/제출은 막히고 랭킹 조회는 유지됩니다. `total`은 비활성화 불가.
- 규칙/점수표가 바뀌면 `RULESET_VERSION`을, 앱이 바뀌면 `CLIENT_VERSION`을 올리세요.
- 효과음: `public/sounds/`에 `lever/spin/rule/score/jackpot.mp3`(CC0)를 넣으면 자동 적용,
  없으면 무음으로 동작합니다.

---

## 🧪 테스트

```bash
npm test
```

순수 엔진(확률·규칙 적용·점수)과 서버 재현 검증을 단위 테스트로 덮으며,
**500회 replay 퍼즈 테스트**로 "같은 시드 + 같은 행동 → 같은 결과"의 결정성을 보증합니다.
이 결정성이 안티치트의 토대입니다.
