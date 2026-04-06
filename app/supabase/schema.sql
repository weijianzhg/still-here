-- =========================================================================
-- Still Here — Supabase schema
-- Run this in the Supabase SQL Editor to set up the database.
-- =========================================================================

-- 1. User settings (mirrors the localStorage shape, synced when logged in)
create table if not exists public.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  birthdate text,
  region_id text not null default 'world',
  custom_life_expectancy text default '73',
  age_adjusted boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.user_settings enable row level security;

create policy "Users can read own settings"
  on public.user_settings for select
  using (auth.uid() = user_id);

create policy "Users can insert own settings"
  on public.user_settings for insert
  with check (auth.uid() = user_id);

create policy "Users can update own settings"
  on public.user_settings for update
  using (auth.uid() = user_id);

-- 2. Goals
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.goals enable row level security;

create policy "Users can read own goals"
  on public.goals for select
  using (auth.uid() = user_id);

create policy "Users can insert own goals"
  on public.goals for insert
  with check (auth.uid() = user_id);

create policy "Users can update own goals"
  on public.goals for update
  using (auth.uid() = user_id);

create policy "Users can delete own goals"
  on public.goals for delete
  using (auth.uid() = user_id);

-- 3. Goal check-ins (one per day per goal)
create table if not exists public.goal_checkins (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  check_date date not null,
  note text,
  created_at timestamptz not null default now(),
  unique (goal_id, check_date)
);

alter table public.goal_checkins enable row level security;

create policy "Users can read own checkins"
  on public.goal_checkins for select
  using (auth.uid() = user_id);

create policy "Users can insert own checkins"
  on public.goal_checkins for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own checkins"
  on public.goal_checkins for delete
  using (auth.uid() = user_id);

-- 4. Journal entries
create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date text not null,
  day_number integer not null default 0,
  title text not null default '',
  body text not null default '',
  created_at timestamptz not null default now()
);

alter table public.journal_entries enable row level security;

create policy "Users can read own journal entries"
  on public.journal_entries for select
  using (auth.uid() = user_id);

create policy "Users can insert own journal entries"
  on public.journal_entries for insert
  with check (auth.uid() = user_id);

create policy "Users can update own journal entries"
  on public.journal_entries for update
  using (auth.uid() = user_id);

create policy "Users can delete own journal entries"
  on public.journal_entries for delete
  using (auth.uid() = user_id);
