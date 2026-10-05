-- Optional learner accounts: a profile and the learner's progress, nothing else.
--
-- Privacy (CLAUDE.md rule 8): no column here, and none to be added, holds or infers a religious
-- background, a date of conversion, a former faith, family, health or any other sensitive
-- attribute. Country is what the learner picks from a list, or null; it is never guessed.
-- Rafiq's conversations stay on the device and have no table.
--
-- Idempotent: safe to run again in the Supabase SQL editor.

-- Profiles ------------------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  -- ISO 3166-1 alpha-2, chosen by the learner; null when not given.
  country text check (country is null or country ~ '^[A-Z]{2}$'),
  locale text not null default 'ar' check (locale in ('ar', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Progress: one row per thing the device already records by id ---------------------------------

create table if not exists public.progress_items (
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id text not null check (char_length(item_id) between 1 and 200),
  kind text not null check (
    kind in (
      'lessonCompleted', 'startStation', 'question', 'quiz', 'baseline', 'exam',
      'pick', 'provision', 'practiceBest', 'tourSeen'
    )
  ),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

-- The primary key's leading user_id serves the policies' lookups; this one serves "everything
-- changed since" when a device catches up.
create index if not exists progress_items_user_updated on public.progress_items (user_id, updated_at);

-- updated_at -----------------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists progress_items_touch on public.progress_items;
create trigger progress_items_touch before update on public.progress_items
  for each row execute function public.touch_updated_at();

-- A profile on sign-up, from the three things the sign-up form sends ----------------------------

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  chosen_name text := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  chosen_country text := upper(nullif(btrim(coalesce(new.raw_user_meta_data ->> 'country', '')), ''));
  chosen_locale text := coalesce(new.raw_user_meta_data ->> 'locale', 'ar');
begin
  insert into public.profiles (id, display_name, country, locale)
  values (
    new.id,
    -- A name is required by the form; this only guards a sign-up made some other way.
    case when char_length(chosen_name) between 1 and 40 then chosen_name else 'Learner' end,
    case when chosen_country ~ '^[A-Z]{2}$' then chosen_country else null end,
    case when chosen_locale in ('ar', 'en') then chosen_locale else 'ar' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

-- Row level security: each learner reaches only their own rows ----------------------------------
--
-- These tables stay owner-only for good. When the community section shows a display name and a
-- country, it will do so through a separate view selecting only those two columns, never by
-- loosening these policies.

alter table public.profiles enable row level security;
alter table public.progress_items enable row level security;

revoke all on public.profiles from anon;
revoke all on public.progress_items from anon;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.progress_items to authenticated;

drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "progress: read own" on public.progress_items;
create policy "progress: read own" on public.progress_items
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "progress: add own" on public.progress_items;
create policy "progress: add own" on public.progress_items
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "progress: change own" on public.progress_items;
create policy "progress: change own" on public.progress_items
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "progress: remove own" on public.progress_items;
create policy "progress: remove own" on public.progress_items
  for delete to authenticated using ((select auth.uid()) = user_id);
