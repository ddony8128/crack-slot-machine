-- 0013: 공지(announcements) + 후기/피드백(feedback)
--
-- 공지: 관리자가 작성/발행하고, 로그인한 유저가 시즌 페이지 진입 시 모달로 본다.
-- 피드백: 로그인 유저가 후원 모달에서 별점+후기를 남기면, 관리자가 닉네임과 함께 본다.
-- 두 테이블 모두 기존 Db 추상화(memory + supabase) 패턴을 따른다.

-- ── announcements ────────────────────────────────────────────────────────────
create table if not exists public.announcements (
  id          uuid primary key default gen_random_uuid(),
  -- null = 전역 공지(모든 시즌). 특정 시즌 한정이면 season_id 지정.
  season_id   uuid references public.seasons(id) on delete cascade,
  title       text not null,
  body        text not null,
  published   boolean not null default false,
  pinned      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 발행된 공지 조회용(고정 먼저, 최신순).
create index if not exists announcements_published_idx
  on public.announcements (published, pinned desc, created_at desc);

-- ── feedback ─────────────────────────────────────────────────────────────────
create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  -- 로그인 필수이므로 작성 시엔 항상 채워지지만, 플레이어 하드삭제 시 기록은 보존(set null).
  player_id   uuid references public.players(id) on delete set null,
  season_id   uuid references public.seasons(id) on delete set null,
  rating      smallint,                       -- 1~5 (nullable; 별점 미입력 허용)
  body        text not null,
  status      text not null default 'new',    -- 'new' | 'read' | 'archived'
  created_at  timestamptz not null default now()
);

create index if not exists feedback_created_idx
  on public.feedback (created_at desc);
