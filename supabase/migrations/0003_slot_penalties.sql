-- napolitan(룰 슬롯츠) — 반복 플레이 패널티 (슬롯 자체 DB 전용).
-- 같은 닉네임이 "직전 플레이 종료 후 3분 이내로 5회 연속" 플레이하면 패널티 화면을
-- 최초 1회만 띄운다. 이 테이블은 그 1회 발생 여부를 기록한다.
--
-- 식별은 닉네임 기준(8번출구 공유 화이트리스트 모드에서는 슬롯 player_id 가 없음).
-- 이벤트별로 (event_id, nickname) 당 1행만 존재한다.
--
-- Run AFTER 0001_init.sql on the SLOT's own Supabase project.

create table if not exists public.slot_penalties (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events(id) on delete cascade,
  nickname   text not null,
  created_at timestamptz not null default now()
);

-- 이벤트당 닉네임 1회(대소문자 무시).
create unique index if not exists slot_penalties_event_nick_uidx
  on public.slot_penalties (event_id, lower(nickname));
