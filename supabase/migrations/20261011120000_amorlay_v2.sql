-- Amorlay v2: conversational intake, AI video interview, two-way attraction,
-- match score with per-person learned weights, app-set dates, AI date coach.
-- Idempotent. All writes go through server routes using the service role;
-- members can read only their own rows.

create extension if not exists pgcrypto;

-- One row per member: everything the intake, video and learning produce.
create table if not exists public.amorlay_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  step text not null default 'basics',          -- basics | intake | video | photos | attraction | ready
  basics jsonb not null default '{}'::jsonb,     -- firstName, birthDate, city, gender, interestedIn[], ageMin, ageMax
  city_key text,                                 -- normalized city used for cohorts
  conversation jsonb not null default '[]'::jsonb,
  ai_profile jsonb not null default '{}'::jsonb, -- AI analysis of the conversation
  video jsonb not null default '{}'::jsonb,      -- AI analysis of the video interview
  clip_path text,                                -- optional intro clip in storage
  share_clip boolean not null default false,
  weights jsonb not null default '{"mustHaves":30,"values":25,"attraction":20,"goodPartner":15,"energy":10}'::jsonb,
  intake_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists amorlay_profiles_city_idx on public.amorlay_profiles (city_key);

-- Attraction ratings: rater rates target's photo, then again with clip or about text.
create table if not exists public.amorlay_ratings (
  rater_id uuid not null references auth.users(id) on delete cascade,
  target_id uuid not null references auth.users(id) on delete cascade,
  photo_rating int check (photo_rating between 1 and 5),
  video_rating int check (video_rating between 1 and 5),
  updated_at timestamptz not null default now(),
  primary key (rater_id, target_id)
);

-- Cached AI evaluation of a pair (both directions), so matching runs can resume.
create table if not exists public.amorlay_pair_evals (
  pair_key text primary key,                     -- smaller uuid || ':' || larger uuid
  version_key text not null,                     -- changes when either profile changes
  eval jsonb not null,
  created_at timestamptz not null default now()
);

-- One row per proposed or scheduled pairing.
create table if not exists public.amorlay_matches (
  id uuid primary key default gen_random_uuid(),
  cycle text not null,                           -- YYYY-MM
  city_key text,
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  score numeric not null,
  breakdown jsonb not null default '{}'::jsonb,  -- components, directional scores, flags, why
  date_idea text,
  venue_name text,
  venue_address text,
  date_at timestamptz,
  status text not null default 'proposed',       -- proposed | scheduled | confirmed | cancelled | completed
  a_attending text,                              -- yes | no
  b_attending text,
  approved_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists amorlay_matches_a_idx on public.amorlay_matches (user_a);
create index if not exists amorlay_matches_b_idx on public.amorlay_matches (user_b);

-- Coach state per member per match: prep, debrief conversation and outcome.
create table if not exists public.amorlay_coach (
  match_id uuid not null references public.amorlay_matches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  prep jsonb,
  debrief jsonb not null default '[]'::jsonb,
  outcome jsonb,                                 -- overall, feltUnderstood, flow, secondDate, redFlags, patternNote
  share_contact text,
  updated_at timestamptz not null default now(),
  primary key (match_id, user_id)
);

alter table public.amorlay_profiles enable row level security;
alter table public.amorlay_ratings enable row level security;
alter table public.amorlay_pair_evals enable row level security;
alter table public.amorlay_matches enable row level security;
alter table public.amorlay_coach enable row level security;

drop policy if exists amorlay_profiles_self on public.amorlay_profiles;
create policy amorlay_profiles_self on public.amorlay_profiles for select to authenticated using (user_id = auth.uid());
drop policy if exists amorlay_ratings_self on public.amorlay_ratings;
create policy amorlay_ratings_self on public.amorlay_ratings for select to authenticated using (rater_id = auth.uid());
drop policy if exists amorlay_matches_self on public.amorlay_matches;
create policy amorlay_matches_self on public.amorlay_matches for select to authenticated using (user_a = auth.uid() or user_b = auth.uid());
drop policy if exists amorlay_coach_self on public.amorlay_coach;
create policy amorlay_coach_self on public.amorlay_coach for select to authenticated using (user_id = auth.uid());
-- amorlay_pair_evals: no member access; service role only.
