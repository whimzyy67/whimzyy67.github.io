-- Whimzyy closed-app alerts. Run ONCE in Supabase > SQL Editor > New query > Run. Safe to run again.
create table if not exists public.push_subscriptions (
  user_id    uuid not null references auth.users(id) on delete cascade,
  endpoint   text not null,
  p256dh     text not null,
  auth       text not null,
  tz         text not null default 'UTC',
  settings   jsonb not null default '{}'::jsonb,   -- your water / stretch / rest settings
  next_at    jsonb not null default '{}'::jsonb,   -- when each reminder is due next (ms)
  updated_at timestamptz not null default now(),
  primary key (user_id, endpoint)
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "push own read"   on public.push_subscriptions;
drop policy if exists "push own insert" on public.push_subscriptions;
drop policy if exists "push own update" on public.push_subscriptions;
drop policy if exists "push own delete" on public.push_subscriptions;
create policy "push own read"   on public.push_subscriptions for select using (auth.uid() = user_id);
create policy "push own insert" on public.push_subscriptions for insert with check (auth.uid() = user_id);
create policy "push own update" on public.push_subscriptions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "push own delete" on public.push_subscriptions for delete using (auth.uid() = user_id);
grant select, insert, update, delete on public.push_subscriptions to authenticated;
