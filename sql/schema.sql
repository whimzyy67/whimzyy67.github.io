-- Whimzyy: run this ONCE in Supabase > SQL Editor > New query > Run.
-- One table holds every synced "whimzyy-..." browser key for every user.

create table if not exists public.user_data (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  key        text        not null,
  value      text        not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- Row Level Security: each person can only ever touch their own rows.
alter table public.user_data enable row level security;

create policy "read own data"   on public.user_data for select using (auth.uid() = user_id);
create policy "insert own data" on public.user_data for insert with check (auth.uid() = user_id);
create policy "update own data" on public.user_data for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own data" on public.user_data for delete using (auth.uid() = user_id);
