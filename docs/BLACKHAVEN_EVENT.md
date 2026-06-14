# BLACKHAVEN GHOST CASINO — 행사 빌드 운영 문서

`blackhaven-event` 브랜치는 오프라인 행사 전용 빌드입니다. 본판(`main`)과 **별도 배포 + 별도 Supabase + 별도 도메인**으로 운영합니다.

---

## 1. 코드로 완료된 것

- **심볼 리스킨(표시만)**: 내부 id 불변. 과일→신체(손/발/눈), 보석→괴물(좀비/흡혈귀/유령). `SymbolView`가 `/symbols/blackhaven/*.webp`를 렌더(에셋 없으면 한글 폴백).
- **규칙 30종 한글화** + `원숭이 손`(7 확률 ×4 + 5% 공포 연출). 연출 랜덤은 시드 RNG와 분리(점수/리플레이 무영향).
- **점수표**: 신체/괴물 보너스 2배(100/160/200/300), 올블루·올레드 제거. (`RULESET_VERSION = 2`)
- **닉네임 화이트리스트**: 전역 `players` 테이블 + soft delete + 재등록 가능. 입장(`/start`)에서 미등록/삭제 닉네임 차단.
- **어드민 `/admin`** "닉네임 화이트리스트" 섹션: 추가 / 삭제(soft) / 복구 / 삭제 포함 보기.
- **리더보드 닉네임별 최고점 1행** dedup.
- **크레딧 계산(결과화면 표시, ledger 없음)**: 첫 플레이 +1, 2000/5000/10000 최초 돌파 +1, 모든 업적 +1. 직전 최고점으로 "최초" 판정.
- **업적 4종**(server replay에서 cheat-proof 감지): 프랑켄슈타인의 재림(신체3종), 백귀야행(괴물3종), 대가는 무엇인가(77777), 친숙한 죽음(44444).
- **공포 연출**: 점프스케어 오버레이, BGM/귀신/업적 사운드 훅.

랭킹 1·2등 정산은 사양상 **수동/오프라인**입니다(크레딧 ledger를 두지 않음). 필요 시 어드민 정산 버튼은 P2로 추가 가능.

---

## 2. 사용자가 해야 할 것 (배포 전 체크리스트)

### 2-1. 새 Supabase 프로젝트
1. 새 프로젝트 생성.
2. SQL 에디터에서 순서대로 실행:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_players_blackhaven.sql`
3. `.env.local`에 **새 프로젝트** 값 입력:
   ```
   SUPABASE_URL=...               # 새 프로젝트 REST URL
   SUPABASE_SERVICE_ROLE_KEY=...  # 새 프로젝트 service role key
   ADMIN_PASSWORD=...             # 행사용 어드민 비밀번호
   ADMIN_SESSION_SECRET=...       # 임의의 긴 랜덤 문자열
   ```
4. `/admin` 로그인 → "닉네임 화이트리스트"에 참가자 닉네임 등록. (행사 중 추가/삭제 가능)

> ⚠️ **보안**: 현재 리포의 `.env.example`에 실제로 보이는 Supabase URL/service key가 들어 있습니다. **그 키는 즉시 폐기(rotate)** 하세요. 새 행사 DB는 별도 키를 쓰며 `.env.local`(gitignore)에만 둡니다.

### 2-2. 이미지/사운드 에셋 (코드가 경로만 배선, 파일 없으면 폴백)
심볼 (512×512, 투명, WebP) — `public/symbols/blackhaven/`:
`hand.webp` `foot.webp` `eye.webp` `zombie.webp` `vampire.webp` `ghost.webp`

업적 (WebP) — `public/achievements/`:
`frankenstein.webp` `hyakki.webp` `midas.webp` `graveyard.webp`

공포 — `public/horror/scare-01.webp` (≈1080px, 300~800KB)

사운드 (MP3) — `public/sounds/`:
`bgm.mp3`(루프) `ghost.mp3` `achievement.mp3` (+기존 lever/spin/rule/score/jackpot)

> Twemoji는 폐기. 신규 심볼은 별도 일러스트 제작 필요(이 작업은 코드 밖).

### 2-3. 배포
- 별도 Vercel 프로젝트로 `blackhaven-event` 브랜치 배포, 새 env 연결, 행사 도메인 연결.
- 플레이 URL: `/e/blackhaven` (이벤트 슬러그 `blackhaven`은 0001에서 시드됨).

---

## 3. 남은/선택 작업
- (P1) 메인 화면 업적 패널에 플레이어별 누적 달성 표시(현재는 조건만 안내). 필요 시 달성현황 API 추가.
- (P2) 어드민 랭킹 1·2등 정산 버튼.
- (P2) 태블릿 화면 최적화, BGM on/off 토글 UX 다듬기.
