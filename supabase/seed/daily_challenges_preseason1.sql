-- 프리 시즌 1 일일 도전 14일치 config (2026-06-16 ~ 06-29, 낮 12시 KST = 03:00 UTC 경계).
-- resolveDailySetup / dailyWindow / dailySeed 로 결정론적 생성 — 앱의 /admin/daily generate 로직과 동일.
-- 멱등(idempotent): ON CONFLICT 시 config 등만 갱신하고 settled_at 은 보존. Supabase SQL editor 에서 실행.
insert into public.daily_challenges
  (season_id, date_key, starts_at, ends_at, seed, group_a_set_id, group_b_set_id, config)
values
  ((select id from public.seasons where slug='2026-06-season-1'), '2026-06-16', '2026-06-16T03:00:00.000Z', '2026-06-17T03:00:00.000Z', 'daily-seed-2026-06-16', 'fruit',   'gem',     '{"basicRuleSetId":"daily_basic_2"}'::jsonb),
  ((select id from public.seasons where slug='2026-06-season-1'), '2026-06-17', '2026-06-17T03:00:00.000Z', '2026-06-18T03:00:00.000Z', 'daily-seed-2026-06-17', 'cat',     'vehicle', '{"basicRuleSetId":"daily_basic_1"}'::jsonb),
  ((select id from public.seasons where slug='2026-06-season-1'), '2026-06-18', '2026-06-18T03:00:00.000Z', '2026-06-19T03:00:00.000Z', 'daily-seed-2026-06-18', 'monster', 'fruit',   '{"basicRuleSetId":"daily_basic_2"}'::jsonb),
  ((select id from public.seasons where slug='2026-06-season-1'), '2026-06-19', '2026-06-19T03:00:00.000Z', '2026-06-20T03:00:00.000Z', 'daily-seed-2026-06-19', 'gem',     'cat',     '{"basicRuleSetId":"daily_basic_1"}'::jsonb),
  ((select id from public.seasons where slug='2026-06-season-1'), '2026-06-20', '2026-06-20T03:00:00.000Z', '2026-06-21T03:00:00.000Z', 'daily-seed-2026-06-20', 'vehicle', 'monster', '{"basicRuleSetId":"daily_basic_1"}'::jsonb),
  ((select id from public.seasons where slug='2026-06-season-1'), '2026-06-21', '2026-06-21T03:00:00.000Z', '2026-06-22T03:00:00.000Z', 'daily-seed-2026-06-21', 'fruit',   'cat',     '{"basicRuleSetId":"daily_basic_2"}'::jsonb),
  ((select id from public.seasons where slug='2026-06-season-1'), '2026-06-22', '2026-06-22T03:00:00.000Z', '2026-06-23T03:00:00.000Z', 'daily-seed-2026-06-22', 'gem',     'vehicle', '{"basicRuleSetId":"daily_basic_1"}'::jsonb),
  ((select id from public.seasons where slug='2026-06-season-1'), '2026-06-23', '2026-06-23T03:00:00.000Z', '2026-06-24T03:00:00.000Z', 'daily-seed-2026-06-23', 'monster', 'cat',     '{"basicRuleSetId":"daily_basic_2"}'::jsonb),
  ((select id from public.seasons where slug='2026-06-season-1'), '2026-06-24', '2026-06-24T03:00:00.000Z', '2026-06-25T03:00:00.000Z', 'daily-seed-2026-06-24', 'fruit',   'vehicle', '{"basicRuleSetId":"daily_basic_1"}'::jsonb),
  ((select id from public.seasons where slug='2026-06-season-1'), '2026-06-25', '2026-06-25T03:00:00.000Z', '2026-06-26T03:00:00.000Z', 'daily-seed-2026-06-25', 'gem',     'monster', '{"basicRuleSetId":"daily_basic_2"}'::jsonb),
  ((select id from public.seasons where slug='2026-06-season-1'), '2026-06-26', '2026-06-26T03:00:00.000Z', '2026-06-27T03:00:00.000Z', 'daily-seed-2026-06-26', 'cat',     'fruit',   '{"basicRuleSetId":"daily_basic_1"}'::jsonb),
  ((select id from public.seasons where slug='2026-06-season-1'), '2026-06-27', '2026-06-27T03:00:00.000Z', '2026-06-28T03:00:00.000Z', 'daily-seed-2026-06-27', 'vehicle', 'gem',     '{"basicRuleSetId":"daily_basic_2"}'::jsonb),
  ((select id from public.seasons where slug='2026-06-season-1'), '2026-06-28', '2026-06-28T03:00:00.000Z', '2026-06-29T03:00:00.000Z', 'daily-seed-2026-06-28', 'monster', 'vehicle', '{"basicRuleSetId":"daily_basic_1"}'::jsonb),
  ((select id from public.seasons where slug='2026-06-season-1'), '2026-06-29', '2026-06-29T03:00:00.000Z', '2026-06-30T03:00:00.000Z', 'daily-seed-2026-06-29', 'fruit',   'gem',     '{"basicRuleSetId":"daily_basic_2"}'::jsonb)
on conflict (season_id, date_key) do update set
  starts_at      = excluded.starts_at,
  ends_at        = excluded.ends_at,
  seed           = excluded.seed,
  group_a_set_id = excluded.group_a_set_id,
  group_b_set_id = excluded.group_b_set_id,
  config         = excluded.config;

-- 검증 쿼리:
-- select date_key, group_a_set_id, group_b_set_id, config->>'basicRuleSetId' as rules, settled_at
-- from public.daily_challenges
-- where season_id = (select id from public.seasons where slug='2026-06-season-1')
-- order by date_key;
-- → 14행, date_key 2026-06-16 … 2026-06-29 이어야 함.
