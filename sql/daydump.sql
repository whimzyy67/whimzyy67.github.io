-- Whimzyy Day Dump (photos of your day). Run ONCE in Supabase > SQL Editor > New query > Run.
-- Run sql/growth.sql first. Safe to run again.

-- 1. one public/private switch for all your days (private by default)
alter table public.profiles add column if not exists dump_public boolean not null default false;

create or replace view public.public_profiles as
  select user_id, username, display_name, progress_public,
         case when progress_public then progress end as progress,
         case when progress_public then today end    as today,
         dump_public
  from public.profiles;
grant select on public.public_profiles to authenticated;

-- 2. who may see a person's day dump: them, or someone who follows them while their dump is public
create or replace function public.can_see_dump(owner uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() = owner
      or ( exists (select 1 from public.profiles p where p.user_id = owner and p.dump_public)
           and exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.followee_id = owner) );
$$;
grant execute on function public.can_see_dump(uuid) to authenticated;

-- 3. one row per photo
create table if not exists public.day_photos (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  day        date not null,
  path       text not null,
  created_at timestamptz not null default now()
);
create index if not exists day_photos_user_day on public.day_photos (user_id, day);
alter table public.day_photos enable row level security;
drop policy if exists "dump read"   on public.day_photos;
drop policy if exists "dump insert" on public.day_photos;
drop policy if exists "dump delete" on public.day_photos;
create policy "dump read"   on public.day_photos for select using (public.can_see_dump(user_id));
create policy "dump insert" on public.day_photos for insert with check (auth.uid() = user_id);
create policy "dump delete" on public.day_photos for delete using (auth.uid() = user_id);
grant select, insert, delete on public.day_photos to authenticated;

-- at most 6 photos per day
create or replace function public.day_photos_limit() returns trigger language plpgsql as $$
begin
  if (select count(*) from public.day_photos where user_id = new.user_id and day = new.day) >= 6 then
    raise exception 'Day dump is full (6 photos per day)';
  end if;
  return new;
end $$;
drop trigger if exists day_photos_limit on public.day_photos;
create trigger day_photos_limit before insert on public.day_photos for each row execute function public.day_photos_limit();

-- 4. private storage bucket for the pictures
insert into storage.buckets (id, name, public) values ('daydump', 'daydump', false) on conflict (id) do nothing;
drop policy if exists "daydump read"   on storage.objects;
drop policy if exists "daydump upload" on storage.objects;
drop policy if exists "daydump delete" on storage.objects;
create policy "daydump read"   on storage.objects for select
  using (bucket_id = 'daydump' and public.can_see_dump(((storage.foldername(name))[1])::uuid));
create policy "daydump upload" on storage.objects for insert
  with check (bucket_id = 'daydump' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "daydump delete" on storage.objects for delete
  using (bucket_id = 'daydump' and (storage.foldername(name))[1] = auth.uid()::text);
