-- Rehla Community: sample posts, so the space can be seen in use before real members write.
--
-- Sample members, posts and replies are written by the Rehla team in the SQL editor
-- (supabase/seed/community_samples.sql) and marked is_sample; the page shows them with a "Sample"
-- badge and a note on the home. supabase/seed/community_samples_remove.sql removes them all.
--
-- The guards keep the flag the database's own:
-- - through the API nobody sets or clears is_sample: a new row is never a sample, and the flag of
--   an existing row never changes;
-- - sample items are closed: nobody replies to a sample post, reacts to a sample item or reports
--   one, so removing the samples never takes a real member's words with it;
-- - sample items never count toward a member's hourly limits.
--
-- Idempotent: safe to run again in the Supabase SQL editor.

alter table public.community_members add column if not exists is_sample boolean not null default false;
alter table public.community_posts add column if not exists is_sample boolean not null default false;
alter table public.community_replies add column if not exists is_sample boolean not null default false;
create index if not exists community_posts_samples on public.community_posts (id) where is_sample;

-- Whether a post or reply is a sample, whoever is asking (RLS would hide a hidden one).
create or replace function public.community_is_sample(target_type text, target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case target_type
    when 'post' then exists (select 1 from public.community_posts where id = target and is_sample)
    when 'reply' then exists (select 1 from public.community_replies where id = target and is_sample)
    else false
  end;
$$;

-- The guards of 20261006010000_community_guard.sql, with the sample flag added.
create or replace function public.community_guard_item()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  is_post boolean := tg_table_name = 'community_posts';
begin
  if tg_op = 'INSERT' then
    if public.community_from_api() then
      new.hidden := false;
      new.is_sample := false;
      new.created_at := now();
      if is_post then
        new.pinned := false;
        new.seed_key := null;
        new.edited_at := null;
      end if;
    end if;
    return new;
  end if;

  if public.community_from_api() then
    if new.id is distinct from old.id
       or new.author is distinct from old.author
       or new.created_at is distinct from old.created_at
       or new.is_sample is distinct from old.is_sample then
      raise exception 'community_fixed_column' using errcode = '42501';
    end if;
    if not is_post then
      if new.post is distinct from old.post then
        raise exception 'community_fixed_column' using errcode = '42501';
      end if;
    end if;
    if not public.community_is_moderator(auth.uid()) then
      if new.hidden is distinct from old.hidden then
        raise exception 'community_moderators_only' using errcode = '42501';
      end if;
      if is_post then
        if new.pinned is distinct from old.pinned or new.seed_key is distinct from old.seed_key then
          raise exception 'community_moderators_only' using errcode = '42501';
        end if;
      end if;
    end if;
  end if;

  if is_post then
    if (new.title, new.body) is distinct from (old.title, old.body) then
      new.edited_at := now();
    elsif public.community_from_api() then
      new.edited_at := old.edited_at;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.community_guard_member()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if not public.community_from_api() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.role := 'member';
    new.is_sample := false;
    new.joined_at := now();
    return new;
  end if;
  if new.user_id is distinct from old.user_id
     or new.joined_at is distinct from old.joined_at
     or new.is_sample is distinct from old.is_sample then
    raise exception 'community_fixed_column' using errcode = '42501';
  end if;
  if new.role is distinct from old.role and not public.community_is_moderator(auth.uid()) then
    raise exception 'community_moderators_only' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Sample items are closed to replies, reactions and reports from the API.
create or replace function public.community_guard_sample_target()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  closed boolean := false;
begin
  if not public.community_from_api() then
    return new;
  end if;
  if tg_table_name = 'community_replies' then
    closed := public.community_is_sample('post', new.post);
  elsif tg_table_name = 'community_reactions' then
    if new.post is not null then
      closed := public.community_is_sample('post', new.post);
    else
      closed := public.community_is_sample('reply', new.reply);
    end if;
  elsif tg_table_name = 'community_reports' then
    closed := public.community_is_sample(new.target_type, new.target_id);
  end if;
  if closed then
    raise exception 'community_sample_closed' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists community_replies_sample on public.community_replies;
create trigger community_replies_sample before insert on public.community_replies for each row execute function public.community_guard_sample_target();
drop trigger if exists community_reactions_sample on public.community_reactions;
create trigger community_reactions_sample before insert on public.community_reactions for each row execute function public.community_guard_sample_target();
drop trigger if exists community_reports_sample on public.community_reports;
create trigger community_reports_sample before insert on public.community_reports for each row execute function public.community_guard_sample_target();

-- The hourly limits of the first migration, not counting samples.
create or replace function public.community_rate_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  recent integer;
begin
  if new.author is null or new.is_sample or auth.uid() is null or public.community_is_moderator(new.author) then
    return new;
  end if;
  if tg_table_name = 'community_posts' then
    select count(*) into recent from public.community_posts
      where author = new.author and not is_sample and created_at > now() - interval '1 hour';
    if recent >= 5 then raise exception 'community_rate_limit' using errcode = 'P0001', hint = 'posts'; end if;
  else
    select count(*) into recent from public.community_replies
      where author = new.author and not is_sample and created_at > now() - interval '1 hour';
    if recent >= 30 then raise exception 'community_rate_limit' using errcode = 'P0001', hint = 'replies'; end if;
  end if;
  return new;
end;
$$;
