-- Admin 후원 메모: a free-text note attached when granting the 후원자 badge
-- (입금일/금액/입금자명 등 운영 기록용). Additive + idempotent.
alter table public.players
  add column if not exists supporter_note text;
