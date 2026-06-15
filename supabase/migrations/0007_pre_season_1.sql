-- 프리 시즌 1: rename + reschedule the season to 2026-06-16 12:00 ~ 06-30 12:00 KST.
-- Idempotent UPDATE (by the stable 0002 slug) so DBs that already applied 0002's
-- earlier seed ('RULE SLOT Season 1', 6/15~6/28) get corrected. Slug is left
-- unchanged to avoid inserting a second active season.
update public.seasons
set title      = '프리 시즌 1',
    starts_at  = '2026-06-16T03:00:00Z',
    ends_at    = '2026-06-30T03:00:00Z'
where slug = '2026-06-season-1';
