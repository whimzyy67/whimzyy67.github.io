-- Whimzyy Growth + Search Homies: run this ONCE in Supabase > SQL Editor > New query > Run.
-- (Safe to run again: it skips anything that already exists.)

-- ============ 1. Profiles: @username, display name, progress ============
create table if not exists public.profiles (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  username        text not null unique check (username ~ '^[a-z0-9_.]{3,20}$'),
  display_name    text,
  progress        integer not null default 0,     -- overall progress, 0-100
  today           integer not null default 0,     -- today's progress, 0-100
  progress_public boolean not null default true,  -- false = friends cannot see the percentage
  updated_at      timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- you can read and change ONLY your own row here. Other people see you through the view below.
drop policy if exists "own profile read"   on public.profiles;
drop policy if exists "own profile insert" on public.profiles;
drop policy if exists "own profile update" on public.profiles;
drop policy if exists "own profile delete" on public.profiles;
create policy "own profile read"   on public.profiles for select using (auth.uid() = user_id);
create policy "own profile insert" on public.profiles for insert with check (auth.uid() = user_id);
create policy "own profile update" on public.profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own profile delete" on public.profiles for delete using (auth.uid() = user_id);

-- what OTHER people can see: username, name, and the percentage only when you made it public
create or replace view public.public_profiles as
  select user_id, username, display_name, progress_public,
         case when progress_public then progress end as progress,
         case when progress_public then today end    as today
  from public.profiles;
grant select on public.public_profiles to authenticated;

-- ============ 2. Follows ============
create table if not exists public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  followee_id uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
alter table public.follows enable row level security;
drop policy if exists "see my follows"   on public.follows;
drop policy if exists "follow someone"   on public.follows;
drop policy if exists "unfollow someone" on public.follows;
create policy "see my follows"   on public.follows for select using (auth.uid() = follower_id or auth.uid() = followee_id);
create policy "follow someone"   on public.follows for insert with check (auth.uid() = follower_id);
create policy "unfollow someone" on public.follows for delete using (auth.uid() = follower_id);

-- ============ 3. Vision boards ============
create table if not exists public.vision_boards (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text,
  items      jsonb not null,                      -- [{ "path": "...", "tag": "..." }]
  created_at timestamptz not null default now()
);
alter table public.vision_boards enable row level security;
drop policy if exists "own boards read"   on public.vision_boards;
drop policy if exists "own boards insert" on public.vision_boards;
drop policy if exists "own boards delete" on public.vision_boards;
create policy "own boards read"   on public.vision_boards for select using (auth.uid() = user_id);
create policy "own boards insert" on public.vision_boards for insert with check (auth.uid() = user_id);
create policy "own boards delete" on public.vision_boards for delete using (auth.uid() = user_id);

-- private storage bucket for the images (each person only reaches their own folder)
insert into storage.buckets (id, name, public) values ('vision', 'vision', false) on conflict (id) do nothing;
drop policy if exists "vision read own"   on storage.objects;
drop policy if exists "vision upload own" on storage.objects;
drop policy if exists "vision delete own" on storage.objects;
create policy "vision read own"   on storage.objects for select using (bucket_id = 'vision' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "vision upload own" on storage.objects for insert with check (bucket_id = 'vision' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "vision delete own" on storage.objects for delete using (bucket_id = 'vision' and (storage.foldername(name))[1] = auth.uid()::text);
