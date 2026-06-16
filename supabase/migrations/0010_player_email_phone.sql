-- RULE SLOT — collect BOTH email AND phone on signup (each optional, ≥1 required).
-- Additive over 0002_season1.sql: contact_type/contact_value stay populated from
-- the PRIMARY contact (email if present, else phone) so existing reads keep working.

alter table public.players add column if not exists email text;
alter table public.players add column if not exists phone text;

-- Active uniqueness per contact (only when present, only for non-deleted rows).
create unique index if not exists players_active_email_uidx
  on public.players (lower(email)) where deleted_at is null and email is not null;
create unique index if not exists players_active_phone_uidx
  on public.players (phone) where deleted_at is null and phone is not null;
