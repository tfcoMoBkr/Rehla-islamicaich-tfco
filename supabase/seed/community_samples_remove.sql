-- Removes every sample that supabase/seed/community_samples.sql added, and nothing else: sample
-- replies, sample posts (including the one shown as from a former member), the sample members and
-- their accounts, and with them their reactions. Real members' rows are untouched: the database
-- never lets anyone reply to, react to or report a sample item, so nothing real hangs from one.
--
-- Run it whole in the Supabase SQL editor. Safe to run again.

delete from public.community_replies where is_sample;
delete from public.community_posts where is_sample;
-- Deleting the accounts removes their profiles, memberships and reactions with them. Both the
-- seed's fixed ids and its reserved address domain must match, so no real account is touched.
delete from auth.users
  where id::text like '5a5a5a5a-0000-4000-8000-%'
    and email like '%@samples.rehla.invalid';
delete from public.community_members where is_sample;

select (select count(*) from public.community_posts where is_sample) as sample_posts_left,
       (select count(*) from public.community_replies where is_sample) as sample_replies_left,
       (select count(*) from public.community_members where is_sample) as sample_members_left;
