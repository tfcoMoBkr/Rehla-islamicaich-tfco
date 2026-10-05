-- Rehla Community: closes a gap in the guards of 20261006000000_community.sql.
--
-- The guards let a change through when the transaction-local setting rehla.community_system was
-- 'on'. The auto-hide trigger and community_leave set it and never cleared it, so every later
-- statement in the same transaction skipped the guards: an author could unhide a post that three
-- reports had hidden. Any session can also set that setting itself with set_config.
--
-- The first version also tested post-only columns (title, body) in a condition evaluated for
-- replies, which fails in PL/pgSQL: hiding a reply after three reports, or leaving while keeping
-- replies, would have raised an error.
--
-- The guards no longer read any setting. They run with the caller's rights (security invoker) and
-- trust only changes made by the database itself: the database's own functions (security definer,
-- run as their owner), the SQL editor and the server key. A signed-in member or guest, reaching the
-- tables through the API as "authenticated" or "anon", is held to the rules:
--
-- - posts and replies: only moderators change hidden or pinned (posts also seed_key); nobody
--   changes the id, the author, the post a reply belongs to, or the creation date; the database
--   dates every new item and every edit; an author still edits their own title and body;
-- - members: only moderators change a role; nobody changes user_id or joined_at; RLS keeps each
--   member to their own row (a moderator may also rename a member, as moderation).
--
-- Idempotent: safe to run again in the Supabase SQL editor.

-- True for a change made through the API by a member or guest; false for the database's own
-- functions, the SQL editor and the server key.
create or replace function public.community_from_api()
returns boolean language sql stable set search_path = '' as $$
  select current_user in ('anon', 'authenticated');
$$;

-- Separate ifs per table: PL/pgSQL resolves every new.<column> in an expression, so a column the
-- other table lacks cannot share a condition with the table test.
create or replace function public.community_guard_item()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  is_post boolean := tg_table_name = 'community_posts';
begin
  if tg_op = 'INSERT' then
    if public.community_from_api() then
      new.hidden := false;
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
    if new.id is distinct from old.id or new.author is distinct from old.author or new.created_at is distinct from old.created_at then
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
    new.joined_at := now();
    return new;
  end if;
  if new.user_id is distinct from old.user_id or new.joined_at is distinct from old.joined_at then
    raise exception 'community_fixed_column' using errcode = '42501';
  end if;
  if new.role is distinct from old.role and not public.community_is_moderator(auth.uid()) then
    raise exception 'community_moderators_only' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- The same rules as before, without the setting: as security definer functions they run as their
-- owner, which the guards trust.
create or replace function public.community_hide_reported()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  reporters integer;
begin
  select count(distinct reporter) into reporters from public.community_reports
    where target_type = new.target_type and target_id = new.target_id;
  if reporters >= 3 then
    if new.target_type = 'post' then
      update public.community_posts set hidden = true where id = new.target_id;
    else
      update public.community_replies set hidden = true where id = new.target_id;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.community_leave(keep_posts boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
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

revoke all on function public.community_leave(boolean) from public, anon;
grant execute on function public.community_leave(boolean) to authenticated;
