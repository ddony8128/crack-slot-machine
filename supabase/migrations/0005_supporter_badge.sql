-- Supporter (후원자) badge: granted to players who donate 만원 이상.
-- Purely cosmetic — never affects scoring or season points.
alter table public.players
  add column if not exists supporter_badge boolean not null default false;
alter table public.players
  add column if not exists supporter_badge_granted_at timestamptz;
