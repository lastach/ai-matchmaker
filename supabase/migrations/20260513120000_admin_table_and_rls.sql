-- Migration: admins table + RLS policies so admin email users can read all rows
-- Replaces the previous architecture which required SUPABASE_SERVICE_ROLE_KEY in Vercel env
-- to bypass RLS. Now admin reads work with the standard anon key + authenticated session,
-- because the policy below grants SELECT to anyone whose JWT email is in the admins table.

-- 1. Create admins registry table
create table if not exists public.admins (
  email text primary key,
  created_at timestamptz not null default now()
);

-- 2. Seed Laurie's admin email
insert into public.admins (email) values ('laurie.stach@gmail.com')
on conflict (email) do nothing;

-- 3. Lock the admins table down: only admins themselves can see it (no public read)
alter table public.admins enable row level security;
drop policy if exists admins_self_select on public.admins;
create policy admins_self_select on public.admins
  for select to authenticated
  using (email = lower((auth.jwt() ->> 'email')::text));

-- 4. Add admin-read policy on user_profiles
do $$ begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'user_profiles') then
    drop policy if exists admins_read_all_user_profiles on public.user_profiles;
    execute 'create policy admins_read_all_user_profiles on public.user_profiles for select to authenticated using (exists (select 1 from public.admins where email = lower((auth.jwt() ->> ''email'')::text)))';
  end if;
end $$;

-- 5. Add admin-read policy on matchmaker_profiles
do $$ begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'matchmaker_profiles') then
    drop policy if exists admins_read_all_matchmaker_profiles on public.matchmaker_profiles;
    execute 'create policy admins_read_all_matchmaker_profiles on public.matchmaker_profiles for select to authenticated using (exists (select 1 from public.admins where email = lower((auth.jwt() ->> ''email'')::text)))';
  end if;
end $$;

-- 6. Add admin-read policy on matches (if exists)
do $$ begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'matches') then
    drop policy if exists admins_read_all_matches on public.matches;
    execute 'create policy admins_read_all_matches on public.matches for select to authenticated using (exists (select 1 from public.admins where email = lower((auth.jwt() ->> ''email'')::text)))';
  end if;
end $$;
