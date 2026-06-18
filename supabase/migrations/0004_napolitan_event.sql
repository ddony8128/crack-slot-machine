-- napolitan 이벤트 시드 — 나폴리탄 카지노 룰 슬롯츠 행사용 슬러그.
-- 플레이 URL: /e/napolitan, 랭킹: /e/napolitan/leaderboard
-- Run on the SLOT's own Supabase project (idempotent).

insert into public.events (slug, title, is_active) values
  ('napolitan', '나폴리탄 카지노 룰 슬롯츠', true)
on conflict (slug) do nothing;
