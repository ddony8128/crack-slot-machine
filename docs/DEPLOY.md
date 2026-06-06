# RULE SLOT — 배포 & 설정 가이드 (v1.0.0)

이 릴리즈는 **Supabase(Postgres)** + **Vercel 자동 배포**를 사용합니다. 환경변수가
없으면 앱은 **in-memory DB로 폴백**(프로세스 재시작 시 초기화)하므로 로컬 플레이는
설정 없이도 되지만, 운영 랭킹을 저장하려면 아래 설정이 필요합니다.

## 1. Supabase 프로젝트 만들기
1. https://supabase.com 에서 새 프로젝트 생성.
2. **SQL Editor**에서 `supabase/migrations/0001_init.sql` 전체를 붙여넣고 실행.
   - `events`, `game_runs` 테이블 + 인덱스가 생성되고
   - 시드 이벤트 `total`(고정), `blackhaven`, `test`(비활성)가 입력됩니다.
3. **Project Settings → API**에서 다음을 확보:
   - `Project URL` → `SUPABASE_URL`
   - `service_role` secret → `SUPABASE_SERVICE_ROLE_KEY`
     - ⚠️ service_role 키는 **서버 전용**입니다. 절대 클라이언트/깃에 노출 금지.
       (코드상 `lib/supabase/server.ts`가 `server-only`로 보호됩니다.)

## 2. 환경변수 설정
`.env.example`를 참고해 `.env.local`(로컬) 및 **Vercel Project → Settings →
Environment Variables**(운영)에 입력:

```
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
ADMIN_PASSWORD=...                 # /admin 로그인 비밀번호
ADMIN_SESSION_SECRET=...           # 세션 쿠키 서명용 임의 문자열(길게)
NEXT_PUBLIC_SITE_URL=https://<your-domain>   # OG 이미지 절대경로용(권장)
```

`ADMIN_SESSION_SECRET`은 `openssl rand -hex 32` 같은 임의 값을 권장합니다.

## 3. 배포
- `main` 브랜치에 푸시하면 Vercel이 자동 빌드/배포합니다.
- 이번 작업은 `release/v1.0.0` 브랜치에 있습니다. Vercel에 연결돼 있으면 이 브랜치
  푸시 시 **프리뷰 URL**이 생성됩니다. 프리뷰에서 확인 후 `main`에 머지하세요.
- 배포 후에는 강력 새로고침(Ctrl+Shift+R)으로 캐시를 비우고 확인합니다.

## 4. 라우트 개요
- `/` → `/e/total`로 리다이렉트
- `/e/[slug]` — 이벤트 플레이 (DB에 없는 slug는 404)
- `/e/[slug]/leaderboard` — 랭킹 (slug=`total`이면 전체 종합)
- `/admin` — 이벤트 관리(비밀번호 로그인)

## 5. 운영 메모
- 랭킹은 `client_version` + `ruleset_version`이 **현재 값과 일치하는 기록만** 노출
  됩니다(`lib/version.ts`). 규칙/점수표가 바뀌면 `RULESET_VERSION`을, 앱이 바뀌면
  `CLIENT_VERSION`을 올리세요. 과거 점수와 섞이지 않습니다.
- 점수는 **서버 재현(replay) 검증**을 통과한 값만 저장됩니다. 클라이언트가 보낸
  점수는 신뢰하지 않습니다(`POST /api/runs/[runId]/submit` → `lib/replay.ts`).
- 새 행사: `/admin`에서 slug 생성 → `/e/<slug>` 공유. 종료 시 `/admin`에서
  비활성화(플레이/제출 차단, 랭킹 조회는 유지). `total`은 비활성화 불가.
- 효과음: `public/sounds/`에 `lever/spin/rule/score/jackpot.mp3`(CC0)를 넣으면
  자동 적용됩니다. 없으면 무음으로 동작합니다(`public/sounds/README.md`).
- 파비콘/OG: `public/favicon.ico`, `public/og_image.png` 사용. 메타데이터는
  `app/layout.tsx`에 설정돼 있습니다.
