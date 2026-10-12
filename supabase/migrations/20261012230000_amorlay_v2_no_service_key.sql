-- Amorlay v2 without a service-role key: members act through their own session.
-- Row level security limits each member to their own rows; a few SECURITY DEFINER
-- functions give exactly the cross-member reads the product needs; admins (public.admins)
-- can read and write everything for matching.

-- ---------- helpers ----------
create or replace function public.amorlay_is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins a where a.email = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

create or replace function public.amorlay_try_uuid(t text) returns uuid
language plpgsql immutable set search_path = '' as $$
begin
  return t::uuid;
exception when others then
  return null;
end;
$$;

create or replace function public.amorlay_same_cohort(other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.amorlay_profiles me join public.amorlay_profiles o on o.city_key = me.city_key
    where me.user_id = auth.uid() and o.user_id = other and me.city_key is not null
      and me.intake_complete and o.intake_complete
  );
$$;

create or replace function public.amorlay_matched_with(other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.amorlay_matches m
    where m.status in ('scheduled', 'confirmed', 'needs_reschedule', 'completed')
      and ((m.user_a = auth.uid() and m.user_b = other) or (m.user_b = auth.uid() and m.user_a = other))
  );
$$;

create or replace function public.amorlay_can_view_photos(owner uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select owner is not null and (
    owner = auth.uid() or public.amorlay_is_admin() or public.amorlay_same_cohort(owner) or public.amorlay_matched_with(owner)
  );
$$;

create or replace function public.amorlay_can_view_clip(owner uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select owner is not null and (
    owner = auth.uid() or public.amorlay_is_admin()
    or (public.amorlay_same_cohort(owner) and exists (select 1 from public.amorlay_profiles p where p.user_id = owner and p.share_clip))
  );
$$;

-- ---------- table policies ----------
create policy amorlay_profiles_insert_own on public.amorlay_profiles for insert to authenticated with check (user_id = auth.uid());
create policy amorlay_profiles_update_own on public.amorlay_profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy amorlay_profiles_admin on public.amorlay_profiles for all to authenticated using (public.amorlay_is_admin()) with check (public.amorlay_is_admin());

create policy amorlay_ratings_insert_own on public.amorlay_ratings for insert to authenticated with check (rater_id = auth.uid());
create policy amorlay_ratings_update_own on public.amorlay_ratings for update to authenticated using (rater_id = auth.uid()) with check (rater_id = auth.uid());
create policy amorlay_ratings_admin on public.amorlay_ratings for select to authenticated using (public.amorlay_is_admin());

create policy amorlay_pair_evals_admin on public.amorlay_pair_evals for all to authenticated using (public.amorlay_is_admin()) with check (public.amorlay_is_admin());

create policy amorlay_matches_admin on public.amorlay_matches for all to authenticated using (public.amorlay_is_admin()) with check (public.amorlay_is_admin());

create policy amorlay_coach_insert_own on public.amorlay_coach for insert to authenticated with check (user_id = auth.uid());
create policy amorlay_coach_update_own on public.amorlay_coach for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy amorlay_coach_admin on public.amorlay_coach for select to authenticated using (public.amorlay_is_admin());

create policy matchmaker_photos_select_visible on public.matchmaker_photos for select to authenticated using (public.amorlay_can_view_photos(user_id));

-- ---------- storage ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('matchmaker-photos', 'matchmaker-photos', false, 8388608), ('amorlay-clips', 'amorlay-clips', false, 20971520)
on conflict (id) do nothing;

create policy amorlay_storage_insert_own on storage.objects for insert to authenticated
  with check (bucket_id in ('matchmaker-photos', 'amorlay-clips') and (storage.foldername(name))[1] = auth.uid()::text);
create policy amorlay_storage_delete_own on storage.objects for delete to authenticated
  using (bucket_id in ('matchmaker-photos', 'amorlay-clips') and (storage.foldername(name))[1] = auth.uid()::text);
create policy amorlay_storage_read_photos on storage.objects for select to authenticated
  using (bucket_id = 'matchmaker-photos' and public.amorlay_can_view_photos(public.amorlay_try_uuid((storage.foldername(name))[1])));
create policy amorlay_storage_read_clips on storage.objects for select to authenticated
  using (bucket_id = 'amorlay-clips' and public.amorlay_can_view_clip(public.amorlay_try_uuid((storage.foldername(name))[1])));

-- ---------- member functions ----------
create or replace function public.amorlay_cohort_count() returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.amorlay_profiles o
  where o.intake_complete and o.city_key is not null
    and o.city_key = (select me.city_key from public.amorlay_profiles me where me.user_id = auth.uid());
$$;

-- People in the caller's city cohort who could be a mutual match on the basics (interest both ways, age both ways).
create or replace function public.amorlay_attraction_pool()
returns table (user_id uuid, first_name text, age int, about text, share_clip boolean, clip_path text)
language sql stable security definer set search_path = '' as $$
  with me as (
    select p.*, date_part('year', age(current_date, (p.basics ->> 'birthDate')::date))::int as my_age
    from public.amorlay_profiles p where p.user_id = auth.uid() and p.intake_complete
  ), o as (
    select p.*, date_part('year', age(current_date, (p.basics ->> 'birthDate')::date))::int as o_age
    from public.amorlay_profiles p, me
    where p.city_key = me.city_key and p.user_id <> me.user_id and p.intake_complete and p.basics ? 'birthDate'
  )
  select o.user_id, o.basics ->> 'firstName', o.o_age, o.ai_profile ->> 'about', o.share_clip, o.clip_path
  from o, me
  where (me.basics -> 'interestedIn' ? 'anyone'
         or me.basics -> 'interestedIn' ? (case lower(o.basics ->> 'gender') when 'woman' then 'women' when 'man' then 'men' when 'nonbinary' then 'nonbinary' else '-' end))
    and (o.basics -> 'interestedIn' ? 'anyone'
         or o.basics -> 'interestedIn' ? (case lower(me.basics ->> 'gender') when 'woman' then 'women' when 'man' then 'men' when 'nonbinary' then 'nonbinary' else '-' end))
    and o.o_age between coalesce((me.basics ->> 'ageMin')::int, 18) and coalesce((me.basics ->> 'ageMax')::int, 99)
    and me.my_age between coalesce((o.basics ->> 'ageMin')::int, 18) and coalesce((o.basics ->> 'ageMax')::int, 99);
$$;

-- What a member may see about their date: name, age, the coach-safe profile fields, and whether a second date is mutual.
create or replace function public.amorlay_match_partner(match uuid)
returns table (partner_id uuid, first_name text, age int, about text, interests jsonb, "values" jsonb, feel_understood text,
               mutual_second_date boolean, partner_contact text)
language sql stable security definer set search_path = '' as $$
  with m as (
    select x.*, case when x.user_a = auth.uid() then x.user_b else x.user_a end as pid
    from public.amorlay_matches x where x.id = match and (x.user_a = auth.uid() or x.user_b = auth.uid())
  ), mine as (
    select c.outcome from public.amorlay_coach c, m where c.match_id = m.id and c.user_id = auth.uid()
  ), theirs as (
    select c.outcome, c.share_contact from public.amorlay_coach c, m where c.match_id = m.id and c.user_id = m.pid
  ), mutual as (
    select coalesce((select (outcome ->> 'secondDate')::boolean from mine), false)
       and coalesce((select (outcome ->> 'secondDate')::boolean from theirs), false) as yes
  )
  select m.pid, p.basics ->> 'firstName',
         date_part('year', age(current_date, (p.basics ->> 'birthDate')::date))::int,
         p.ai_profile ->> 'about', p.ai_profile -> 'interests', p.ai_profile -> 'values', p.ai_profile ->> 'feelUnderstood',
         (select yes from mutual),
         case when (select yes from mutual) then (select share_contact from theirs) else null end
  from m join public.amorlay_profiles p on p.user_id = m.pid;
$$;

create or replace function public.amorlay_set_attending(match uuid, attending text) returns text
language plpgsql security definer set search_path = '' as $$
declare m public.amorlay_matches; other text; new_status text;
begin
  if attending not in ('yes', 'no') then raise exception 'bad value'; end if;
  select * into m from public.amorlay_matches where id = match and (user_a = auth.uid() or user_b = auth.uid());
  if not found then raise exception 'not found'; end if;
  other := case when m.user_a = auth.uid() then m.b_attending else m.a_attending end;
  new_status := case when attending = 'no' then 'needs_reschedule' when other = 'yes' then 'confirmed' else m.status end;
  if m.user_a = auth.uid() then
    update public.amorlay_matches set a_attending = attending, status = new_status, updated_at = now() where id = match;
  else
    update public.amorlay_matches set b_attending = attending, status = new_status, updated_at = now() where id = match;
  end if;
  return new_status;
end;
$$;

grant execute on function public.amorlay_cohort_count(), public.amorlay_attraction_pool(), public.amorlay_match_partner(uuid),
  public.amorlay_set_attending(uuid, text) to authenticated;
