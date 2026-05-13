-- Migration: ensure user_profiles, intake_profiles, matchmaker_profiles tables exist
-- with the columns the codebase expects. All operations are idempotent.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- user_profiles: primary intake storage written by /api/intake/save
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  core_intake_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  location text,
  gender text,
  interested_in text,
  dob date,
  age_min int,
  age_max int,
  profile_strength int,
  photos jsonb DEFAULT '[]'::jsonb,
  intake_completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add any columns that may be missing on older instances
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS profile_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS core_intake_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS interested_in text,
  ADD COLUMN IF NOT EXISTS dob date,
  ADD COLUMN IF NOT EXISTS age_min int,
  ADD COLUMN IF NOT EXISTS age_max int,
  ADD COLUMN IF NOT EXISTS profile_strength int,
  ADD COLUMN IF NOT EXISTS photos jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS intake_completed_at timestamptz;

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_profiles_self_select ON public.user_profiles;
CREATE POLICY user_profiles_self_select ON public.user_profiles FOR SELECT TO authenticated
  USING (id = auth.uid());
DROP POLICY IF EXISTS user_profiles_self_upsert_insert ON public.user_profiles;
CREATE POLICY user_profiles_self_upsert_insert ON public.user_profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS user_profiles_self_upsert_update ON public.user_profiles;
CREATE POLICY user_profiles_self_upsert_update ON public.user_profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- admins-read policy (so admin can see all intakes)
DROP POLICY IF EXISTS admins_read_all_user_profiles ON public.user_profiles;
CREATE POLICY admins_read_all_user_profiles ON public.user_profiles FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admins WHERE email = lower((auth.jwt() ->> 'email')::text)));

-- matchmaker_profiles: post-cohort-threshold promoted profiles
CREATE TABLE IF NOT EXISTS public.matchmaker_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  location text,
  intake_completed_at timestamptz,
  top_value text,
  top_life_goal text,
  attachment_self text,
  priority_choice text,
  profile_strength int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.matchmaker_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matchmaker_profiles_self ON public.matchmaker_profiles;
CREATE POLICY matchmaker_profiles_self ON public.matchmaker_profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS admins_read_all_matchmaker_profiles ON public.matchmaker_profiles;
CREATE POLICY admins_read_all_matchmaker_profiles ON public.matchmaker_profiles FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admins WHERE email = lower((auth.jwt() ->> 'email')::text)));

-- intake_profiles: supply-pool view (subset of user_profiles)
CREATE TABLE IF NOT EXISTS public.intake_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  age int,
  gender text,
  metro_area text,
  region text,
  verified boolean DEFAULT false,
  intent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.intake_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS intake_profiles_anon_read_count ON public.intake_profiles;
CREATE POLICY intake_profiles_anon_read_count ON public.intake_profiles FOR SELECT TO authenticated
  USING (true); -- supply-pool counts are not personally-identifying
