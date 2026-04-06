create extension if not exists pgcrypto;

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  birthdate date,
  region_id text not null,
  custom_life_expectancy numeric(5, 2),
  age_adjusted boolean not null default true,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  notes text not null default '',
  start_date date not null,
  end_date date not null,
  check_ins date[] not null default '{}'::date[],
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint goals_title_not_blank check (char_length(trim(title)) > 0),
  constraint goals_date_window check (end_date >= start_date)
);

create index if not exists goals_user_id_idx on public.goals (user_id, start_date);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists user_settings_set_updated_at on public.user_settings;
create trigger user_settings_set_updated_at
before update on public.user_settings
for each row
execute function public.set_updated_at();

drop trigger if exists goals_set_updated_at on public.goals;
create trigger goals_set_updated_at
before update on public.goals
for each row
execute function public.set_updated_at();

alter table public.user_settings enable row level security;
alter table public.goals enable row level security;

drop policy if exists "Users can read their own settings" on public.user_settings;
create policy "Users can read their own settings"
on public.user_settings
for select
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own settings" on public.user_settings;
create policy "Users can insert their own settings"
on public.user_settings
for insert
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own settings" on public.user_settings;
create policy "Users can update their own settings"
on public.user_settings
for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can read their own goals" on public.goals;
create policy "Users can read their own goals"
on public.goals
for select
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own goals" on public.goals;
create policy "Users can insert their own goals"
on public.goals
for insert
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own goals" on public.goals;
create policy "Users can update their own goals"
on public.goals
for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own goals" on public.goals;
create policy "Users can delete their own goals"
on public.goals
for delete
using ((select auth.uid()) = user_id);
