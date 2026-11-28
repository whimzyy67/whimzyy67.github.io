-- Run once in Supabase: SQL Editor -> New query -> paste -> Run
create table if not exists public.backups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  kind text not null default 'manual',
  label text,
  item_count int not null default 0,
  data jsonb not null
);
create index if not exists backups_user_idx on public.backups (user_id, created_at desc);
alter table public.backups enable row level security;
drop policy if exists "own backups select" on public.backups;
drop policy if exists "own backups insert" on public.backups;
drop policy if exists "own backups delete" on public.backups;
create policy "own backups select" on public.backups for select using (auth.uid() = user_id);
create policy "own backups insert" on public.backups for insert with check (auth.uid() = user_id);
create policy "own backups delete" on public.backups for delete using (auth.uid() = user_id);
