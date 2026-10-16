-- Members never see each other before the date.
-- Attraction is learned from a library of example photos, so member photos and clips
-- are visible only to their owner and the matchmaker, and the member-to-member rating pool is closed.

alter table public.amorlay_profiles add column if not exists attraction jsonb not null default '{}'::jsonb;

create or replace function public.amorlay_can_view_photos(owner uuid)
returns boolean language sql stable security definer set search_path to ''
as $$ select owner is not null and (owner = auth.uid() or public.amorlay_is_admin()); $$;

create or replace function public.amorlay_can_view_clip(owner uuid)
returns boolean language sql stable security definer set search_path to ''
as $$ select owner is not null and (owner = auth.uid() or public.amorlay_is_admin()); $$;

create or replace function public.amorlay_attraction_pool()
returns table(user_id uuid, first_name text, age integer, about text, share_clip boolean, clip_path text)
language sql stable security definer set search_path to ''
as $$ select null::uuid, null::text, null::int, null::text, null::boolean, null::text where false; $$;
