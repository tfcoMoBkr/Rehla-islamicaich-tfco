-- Rehla Community: an opt-in place for support, experience and encouragement. Not for rulings.
--
-- Privacy (CLAUDE.md rule 8): a member is shown only by the community name they chose, their role
-- badge, and their country if they switch it on. There is no profile page, member list or direct
-- message, and no column here holds or infers a religious background or any sensitive attribute.
--
-- Rules live here, not only in the page: length limits, hourly limits, auto-hide at three reports,
-- moderator-only pinning, unhiding and role changes, and hidden items seen only by their author and
-- moderators. Writes are owner-only; every table has row level security.
--
-- Idempotent: safe to run again in the Supabase SQL editor.

-- Members ---------------------------------------------------------------------------------------

create table if not exists public.community_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 3 and 24 and name = btrim(name)),
  show_country boolean not null default false,
  role text not null default 'member' check (role in ('member', 'moderator', 'guide')),
  joined_at timestamptz not null default now()
);
create unique index if not exists community_members_name_unique on public.community_members (lower(name));

create or replace function public.community_is_member(uid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.community_members where user_id = uid);
$$;

create or replace function public.community_is_moderator(uid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.community_members where user_id = uid and role = 'moderator');
$$;

-- Posts and replies -----------------------------------------------------------------------------

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  -- Null once a member leaves and keeps their posts: shown as "former member".
  author uuid references auth.users (id) on delete cascade,
  category text not null check (category in ('firstSteps', 'everydayLife', 'encouragement', 'learningTogether', 'askCommunity')),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  language text not null check (language in ('ar', 'en')),
  -- The writer was told a specialist would answer this better, and posted it anyway.
  needs_specialist boolean not null default false,
  -- Set only for the posts the team seeds (community_seed), so seeding can run again.
  seed_key text unique,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  hidden boolean not null default false,
  pinned boolean not null default false
);
create index if not exists community_posts_latest on public.community_posts (created_at desc) where not hidden;
create index if not exists community_posts_author on public.community_posts (author, created_at);

create table if not exists public.community_replies (
  id uuid primary key default gen_random_uuid(),
  post uuid not null references public.community_posts (id) on delete cascade,
  author uuid references auth.users (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  needs_specialist boolean not null default false,
  created_at timestamptz not null default now(),
  hidden boolean not null default false
);
create index if not exists community_replies_post on public.community_replies (post, created_at);
create index if not exists community_replies_author on public.community_replies (author, created_at);

-- "This helped me": one per member and item.
create table if not exists public.community_reactions (
  id uuid primary key default gen_random_uuid(),
  member uuid not null references auth.users (id) on delete cascade,
  post uuid references public.community_posts (id) on delete cascade,
  reply uuid references public.community_replies (id) on delete cascade,
  kind text not null default 'helped' check (kind = 'helped'),
  created_at timestamptz not null default now(),
  check ((post is null) <> (reply is null))
);
create unique index if not exists community_reactions_once on public.community_reactions (member, coalesce(post, reply));

create table if not exists public.community_reports (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('post', 'reply')),
  target_id uuid not null,
  reporter uuid not null references auth.users (id) on delete cascade,
  reason text not null check (reason in ('unkind', 'rulingWithoutSource', 'personalData', 'spam', 'other')),
  created_at timestamptz not null default now(),
  unique (reporter, target_type, target_id)
);
create index if not exists community_reports_target on public.community_reports (target_type, target_id);

-- Rules as triggers -----------------------------------------------------------------------------

-- At most 5 posts and 30 replies an hour per member (moderators, who seed, are exempt).
create or replace function public.community_rate_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  recent integer;
begin
  if new.author is null or auth.uid() is null or public.community_is_moderator(new.author) then
    return new;
  end if;
  if tg_table_name = 'community_posts' then
    select count(*) into recent from public.community_posts where author = new.author and created_at > now() - interval '1 hour';
    if recent >= 5 then raise exception 'community_rate_limit' using errcode = 'P0001', hint = 'posts'; end if;
  else
    select count(*) into recent from public.community_replies where author = new.author and created_at > now() - interval '1 hour';
    if recent >= 30 then raise exception 'community_rate_limit' using errcode = 'P0001', hint = 'replies'; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists community_posts_rate on public.community_posts;
create trigger community_posts_rate before insert on public.community_posts for each row execute function public.community_rate_limit();
drop trigger if exists community_replies_rate on public.community_replies;
create trigger community_replies_rate before insert on public.community_replies for each row execute function public.community_rate_limit();

-- Only moderators pin, hide or unhide; authors may edit their own words. A new item is never born
-- hidden or pinned by its author. Changes made in the SQL editor (no signed-in user) are allowed.
create or replace function public.community_guard_item()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  -- Set by the database's own rules (auto-hide on reports, leaving) for their own changes.
  system boolean := coalesce(current_setting('rehla.community_system', true), '') = 'on';
begin
  if uid is null or system or public.community_is_moderator(uid) then
    if tg_op = 'UPDATE' and tg_table_name = 'community_posts' and (new.title, new.body) is distinct from (old.title, old.body) then
      new.edited_at := now();
    end if;
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.hidden := false;
    if tg_table_name = 'community_posts' then
      new.pinned := false;
      new.seed_key := null;
    end if;
    return new;
  end if;
  if new.hidden is distinct from old.hidden then
    raise exception 'community_moderators_only' using errcode = '42501';
  end if;
  if tg_table_name = 'community_posts' then
    if new.pinned is distinct from old.pinned or new.seed_key is distinct from old.seed_key then
      raise exception 'community_moderators_only' using errcode = '42501';
    end if;
    if (new.title, new.body) is distinct from (old.title, old.body) then
      new.edited_at := now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists community_posts_guard on public.community_posts;
create trigger community_posts_guard before insert or update on public.community_posts for each row execute function public.community_guard_item();
drop trigger if exists community_replies_guard on public.community_replies;
create trigger community_replies_guard before insert or update on public.community_replies for each row execute function public.community_guard_item();

-- Only moderators change roles; a member may change their own name and country switch.
create or replace function public.community_guard_member()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or public.community_is_moderator(uid) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.role := 'member';
  elsif new.role is distinct from old.role then
    raise exception 'community_moderators_only' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists community_members_guard on public.community_members;
create trigger community_members_guard before insert or update on public.community_members for each row execute function public.community_guard_member();

-- Three different members reporting the same item hide it until a moderator reviews it.
create or replace function public.community_hide_reported()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  reporters integer;
begin
  select count(distinct reporter) into reporters from public.community_reports
    where target_type = new.target_type and target_id = new.target_id;
  if reporters >= 3 then
    perform set_config('rehla.community_system', 'on', true);
    if new.target_type = 'post' then
      update public.community_posts set hidden = true where id = new.target_id;
    else
      update public.community_replies set hidden = true where id = new.target_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists community_reports_hide on public.community_reports;
create trigger community_reports_hide after insert on public.community_reports for each row execute function public.community_hide_reported();

-- Leaving: the member's posts and replies are deleted, or kept as "former member".
create or replace function public.community_leave(keep_posts boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  perform set_config('rehla.community_system', 'on', true);
  if keep_posts then
    update public.community_posts set author = null where author = uid;
    update public.community_replies set author = null where author = uid;
  else
    delete from public.community_replies where author = uid;
    delete from public.community_posts where author = uid;
  end if;
  delete from public.community_reactions where member = uid;
  delete from public.community_reports where reporter = uid;
  delete from public.community_members where user_id = uid;
end;
$$;

-- What anyone may see of a member: the community name, the role badge, and the country only when
-- they switched it on, and only for members with something visible posted (so it is no member
-- list). Profiles and community_members themselves stay owner-only.
create or replace view public.community_authors as
  select m.user_id, m.name, m.role, case when m.show_country then p.country end as country
  from public.community_members m
  left join public.profiles p on p.id = m.user_id
  where exists (select 1 from public.community_posts c where c.author = m.user_id and not c.hidden)
     or exists (select 1 from public.community_replies r where r.author = m.user_id and not r.hidden);

-- How many found each post or reply helpful, without saying who.
create or replace view public.community_helped as
  select coalesce(post, reply) as target, count(*)::int as helped
  from public.community_reactions
  group by coalesce(post, reply);

-- Row level security ----------------------------------------------------------------------------

alter table public.community_members enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_replies enable row level security;
alter table public.community_reactions enable row level security;
alter table public.community_reports enable row level security;

revoke all on public.community_members, public.community_posts, public.community_replies,
  public.community_reactions, public.community_reports from anon, authenticated;
grant select on public.community_posts, public.community_replies to anon, authenticated;
grant select on public.community_authors, public.community_helped to anon, authenticated;
grant select on public.community_reactions to authenticated;
grant select, insert, update, delete on public.community_members to authenticated;
grant insert, update, delete on public.community_posts, public.community_replies to authenticated;
grant insert, delete on public.community_reactions to authenticated;
grant select, insert, delete on public.community_reports to authenticated;
revoke all on function public.community_leave(boolean) from public, anon;
grant execute on function public.community_leave(boolean) to authenticated;

-- Members: each sees and changes only their own row (others are seen through community_authors).
drop policy if exists "members: read own" on public.community_members;
create policy "members: read own" on public.community_members for select to authenticated
  using ((select auth.uid()) = user_id or public.community_is_moderator((select auth.uid())));
drop policy if exists "members: join" on public.community_members;
create policy "members: join" on public.community_members for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists "members: change own" on public.community_members;
create policy "members: change own" on public.community_members for update to authenticated
  using ((select auth.uid()) = user_id or public.community_is_moderator((select auth.uid())))
  with check ((select auth.uid()) = user_id or public.community_is_moderator((select auth.uid())));
drop policy if exists "members: leave" on public.community_members;
create policy "members: leave" on public.community_members for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Posts and replies: everyone reads what is not hidden; a hidden item only its author and moderators.
drop policy if exists "posts: read" on public.community_posts;
create policy "posts: read" on public.community_posts for select to anon, authenticated
  using (not hidden or author = (select auth.uid()) or public.community_is_moderator((select auth.uid())));
drop policy if exists "posts: write as member" on public.community_posts;
create policy "posts: write as member" on public.community_posts for insert to authenticated
  with check (author = (select auth.uid()) and public.community_is_member((select auth.uid())));
drop policy if exists "posts: change own or moderate" on public.community_posts;
create policy "posts: change own or moderate" on public.community_posts for update to authenticated
  using (author = (select auth.uid()) or public.community_is_moderator((select auth.uid())))
  with check (author = (select auth.uid()) or public.community_is_moderator((select auth.uid())));
drop policy if exists "posts: remove own or moderate" on public.community_posts;
create policy "posts: remove own or moderate" on public.community_posts for delete to authenticated
  using (author = (select auth.uid()) or public.community_is_moderator((select auth.uid())));

drop policy if exists "replies: read" on public.community_replies;
create policy "replies: read" on public.community_replies for select to anon, authenticated
  using (not hidden or author = (select auth.uid()) or public.community_is_moderator((select auth.uid())));
drop policy if exists "replies: write as member" on public.community_replies;
create policy "replies: write as member" on public.community_replies for insert to authenticated
  with check (author = (select auth.uid()) and public.community_is_member((select auth.uid())));
drop policy if exists "replies: change own or moderate" on public.community_replies;
create policy "replies: change own or moderate" on public.community_replies for update to authenticated
  using (author = (select auth.uid()) or public.community_is_moderator((select auth.uid())))
  with check (author = (select auth.uid()) or public.community_is_moderator((select auth.uid())));
drop policy if exists "replies: remove own or moderate" on public.community_replies;
create policy "replies: remove own or moderate" on public.community_replies for delete to authenticated
  using (author = (select auth.uid()) or public.community_is_moderator((select auth.uid())));

-- Reactions: each member sees only their own (everyone else sees counts, in community_helped);
-- given and taken back by members, as themselves.
drop policy if exists "reactions: read" on public.community_reactions;
drop policy if exists "reactions: read own" on public.community_reactions;
create policy "reactions: read own" on public.community_reactions for select to authenticated
  using (member = (select auth.uid()));
drop policy if exists "reactions: give" on public.community_reactions;
create policy "reactions: give" on public.community_reactions for insert to authenticated
  with check (member = (select auth.uid()) and public.community_is_member((select auth.uid())));
drop policy if exists "reactions: take back" on public.community_reactions;
create policy "reactions: take back" on public.community_reactions for delete to authenticated
  using (member = (select auth.uid()));

-- Reports: a member sees their own; moderators see all and clear them after review.
drop policy if exists "reports: read own or moderate" on public.community_reports;
create policy "reports: read own or moderate" on public.community_reports for select to authenticated
  using (reporter = (select auth.uid()) or public.community_is_moderator((select auth.uid())));
drop policy if exists "reports: file" on public.community_reports;
create policy "reports: file" on public.community_reports for insert to authenticated
  with check (reporter = (select auth.uid()) and public.community_is_member((select auth.uid())));
drop policy if exists "reports: clear as moderator" on public.community_reports;
create policy "reports: clear as moderator" on public.community_reports for delete to authenticated
  using (public.community_is_moderator((select auth.uid())));
