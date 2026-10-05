-- Checks Rehla Community's rules in the database itself. Run the whole file at once after the
-- community migrations (20261006000000_community.sql, 20261006010000_community_guard.sql,
-- 20261006020000_community_samples.sql):
--
--   Supabase SQL Editor: paste it and run.
--   psql:                psql -1 -f supabase/tests/community_rules.sql   (one transaction)
--
-- On success the last result is one row: "all community rules hold" and the number of checks.
-- On failure it stops with an error naming the rule, "FAIL: ...".
--
-- Nothing is left behind. Every check runs inside one block that ends by raising a private
-- signal (RHL00), which undoes everything the block wrote; only the count of passed checks, a
-- variable, survives. The count is handed to the final select through a transaction-local
-- setting, which ends with the transaction. No temporary table, no BEGIN or ROLLBACK, so the file
-- behaves the same whether it is sent as one query or statement by statement in one transaction.
--
-- It acts as a guest (anon), as members A, B, C and D, as a moderator M, and as N, who has not
-- joined, by setting the signed-in user the way Supabase does (request.jwt.claims) and the role.

do $test$
declare
  ua constant uuid := '00000000-0000-4000-8000-0000000000a1';
  ub constant uuid := '00000000-0000-4000-8000-0000000000b2';
  uc constant uuid := '00000000-0000-4000-8000-0000000000c3';
  ud constant uuid := '00000000-0000-4000-8000-0000000000d4';
  um constant uuid := '00000000-0000-4000-8000-0000000000e5';
  un constant uuid := '00000000-0000-4000-8000-0000000000f6';
  post_a constant uuid := '00000000-0000-4000-8000-00000000a001';
  reply_a constant uuid := '00000000-0000-4000-8000-00000000a002';
  post_c constant uuid := '00000000-0000-4000-8000-00000000c001';
  reply_c constant uuid := '00000000-0000-4000-8000-00000000c002';
  reply_c2 constant uuid := '00000000-0000-4000-8000-00000000c003';
  sample_post constant uuid := '00000000-0000-4000-8000-00000000e001';
  sample_reply constant uuid := '00000000-0000-4000-8000-00000000e002';
  total constant integer := 15;
  passed integer := 0;
  reporter_id uuid;
begin
  begin
    insert into auth.users (id, email, aud, role, raw_user_meta_data) values
      (ua, 'a@rules.test', 'authenticated', 'authenticated', '{"display_name":"A"}'),
      (ub, 'b@rules.test', 'authenticated', 'authenticated', '{"display_name":"B"}'),
      (uc, 'c@rules.test', 'authenticated', 'authenticated', '{"display_name":"C"}'),
      (ud, 'd@rules.test', 'authenticated', 'authenticated', '{"display_name":"D"}'),
      (um, 'm@rules.test', 'authenticated', 'authenticated', '{"display_name":"M"}'),
      (un, 'n@rules.test', 'authenticated', 'authenticated', '{"display_name":"N"}');
    -- The moderator is assigned in the SQL editor, as docs/DEPLOY.md describes.
    insert into public.community_members (user_id, name, role) values (um, 'Moderator M', 'moderator');

    -- 1. Members join as themselves; a member's own role is always "member".
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    insert into public.community_members (user_id, name, role) values (ua, 'Member A', 'moderator');
    if (select role from public.community_members where user_id = ua) <> 'member' then
      raise exception 'FAIL: a member made themselves a moderator';
    end if;
    begin
      insert into public.community_members (user_id, name) values (ub, 'Someone else');
      raise exception 'FAIL: joined as someone else';
    exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
    begin
      update public.community_members set role = 'guide' where user_id = ua;
      raise exception 'FAIL: a member changed their own role';
    exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
    passed := passed + 1;

    -- 2. An author cannot pin; titles are limited; edits are dated.
    insert into public.community_posts (id, author, category, title, body, language)
      values (post_a, ua, 'encouragement', 'Hello', 'A first post', 'en');
    begin
      update public.community_posts set pinned = true where id = post_a;
      raise exception 'FAIL: an author pinned their own post';
    exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
    begin
      insert into public.community_posts (author, category, title, body, language)
        values (ua, 'encouragement', repeat('x', 121), 'too long a title', 'en');
      raise exception 'FAIL: a title over 120 characters was saved';
    exception when check_violation then null; end;
    update public.community_posts set body = 'An edited first post' where id = post_a;
    if (select edited_at from public.community_posts where id = post_a) is null then
      raise exception 'FAIL: an edit was not dated';
    end if;
    passed := passed + 1;

    -- 3. Five posts an hour: the sixth is refused.
    for i in 2..5 loop
      insert into public.community_posts (author, category, title, body, language)
        values (ua, 'everydayLife', 'Post ' || i, 'Body', 'en');
    end loop;
    begin
      insert into public.community_posts (author, category, title, body, language)
        values (ua, 'everydayLife', 'Post 6', 'Body', 'en');
      raise exception 'FAIL: a sixth post in an hour was saved';
    exception when others then if sqlerrm not like 'community_rate_limit%' then raise; end if; end;
    passed := passed + 1;
    execute 'reset role';

    -- B, C and D join; N does not.
    insert into public.community_members (user_id, name) values (ub, 'Member b2'), (uc, 'Member c3'), (ud, 'Member d4');

    -- 4. What a member can never change through the API: hidden and pinned (even with the setting
    --    the first migration trusted), the author, the post a reply belongs to, the dates.
    perform set_config('request.jwt.claims', json_build_object('sub', uc, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    insert into public.community_posts (id, author, category, title, body, language, created_at, hidden, pinned)
      values (post_c, uc, 'firstSteps', 'C''s post', 'Body', 'en', '2000-01-01', true, true);
    insert into public.community_replies (id, post, author, body, created_at, hidden)
      values (reply_c, post_a, uc, 'C''s reply', '2000-01-01', true);
    if (select created_at from public.community_posts where id = post_c) < now() - interval '1 minute'
       or (select created_at from public.community_replies where id = reply_c) < now() - interval '1 minute' then
      raise exception 'FAIL: a member back-dated a new post or reply';
    end if;
    if (select hidden or pinned from public.community_posts where id = post_c)
       or (select hidden from public.community_replies where id = reply_c) then
      raise exception 'FAIL: a new item was born hidden or pinned';
    end if;
    perform set_config('rehla.community_system', 'on', true);
    begin
      update public.community_replies set hidden = true where id = reply_c;
      raise exception 'FAIL: a member hid their own reply';
    exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
    begin
      update public.community_posts set pinned = true where id = post_c;
      raise exception 'FAIL: a member pinned their post by setting rehla.community_system';
    exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
    perform set_config('rehla.community_system', '', true);
    begin
      update public.community_posts set author = ua where id = post_c;
      raise exception 'FAIL: a member gave their post to another member';
    exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
    begin
      update public.community_posts set author = null where id = post_c;
      raise exception 'FAIL: a member removed the author of their post';
    exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
    begin
      update public.community_replies set author = ua where id = reply_c;
      raise exception 'FAIL: a member gave their reply to another member';
    exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
    begin
      update public.community_replies set post = post_c where id = reply_c;
      raise exception 'FAIL: a member moved their reply to another post';
    exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
    begin
      update public.community_posts set created_at = now() - interval '2 hours' where id = post_c;
      raise exception 'FAIL: a member re-dated their post';
    exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
    update public.community_posts set title = 'C''s post, edited' where id = post_c;
    if (select title from public.community_posts where id = post_c) <> 'C''s post, edited'
       or (select edited_at from public.community_posts where id = post_c) is null then
      raise exception 'FAIL: an author could not edit their own title';
    end if;
    passed := passed + 1;

    -- 5. Another member's row: RLS shows C none of it, so these change nothing.
    update public.community_members set name = 'Renamed by C' where user_id = ud;
    update public.community_members set role = 'moderator' where user_id = ud;
    execute 'reset role';
    if (select name from public.community_members where user_id = ud) <> 'Member d4'
       or (select role from public.community_members where user_id = ud) <> 'member' then
      raise exception 'FAIL: a member changed another member''s name or role';
    end if;
    passed := passed + 1;

    -- 6. Three members report C's reply: it is hidden, and C cannot unhide it.
    foreach reporter_id in array array[ua, ub, ud] loop
      perform set_config('request.jwt.claims', json_build_object('sub', reporter_id, 'role', 'authenticated')::text, true);
      execute 'set local role authenticated';
      insert into public.community_reports (target_type, target_id, reporter, reason) values ('reply', reply_c, reporter_id, 'spam');
      execute 'reset role';
    end loop;
    if not (select hidden from public.community_replies where id = reply_c) then
      raise exception 'FAIL: three reports did not hide the reply';
    end if;
    perform set_config('request.jwt.claims', json_build_object('sub', uc, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    if not exists (select 1 from public.community_replies where id = reply_c) then
      raise exception 'FAIL: the author cannot see their hidden reply';
    end if;
    begin
      update public.community_replies set hidden = false where id = reply_c;
      raise exception 'FAIL: the author unhid their reply';
    exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
    execute 'reset role';
    passed := passed + 1;

    -- 7. Samples: only the database marks them, nobody sets or clears the flag through the API, and
    --     sample items are closed to replies, reactions and reports.
    insert into public.community_posts (id, author, category, title, body, language, is_sample)
      values (sample_post, null, 'encouragement', 'A sample', 'Sample body', 'en', true);
    insert into public.community_replies (id, post, author, body, is_sample)
      values (sample_reply, sample_post, ud, 'A sample reply', true);
    perform set_config('request.jwt.claims', json_build_object('sub', uc, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    insert into public.community_replies (id, post, author, body, is_sample) values (reply_c2, post_c, uc, 'Not a sample', true);
    if (select is_sample from public.community_replies where id = reply_c2) then
      raise exception 'FAIL: a member wrote a reply marked as a sample';
    end if;
    begin
      update public.community_posts set is_sample = true where id = post_c;
      raise exception 'FAIL: a member marked their post as a sample';
    exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
    begin
      update public.community_members set is_sample = true where user_id = uc;
      raise exception 'FAIL: a member marked themselves as a sample';
    exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
    begin
      insert into public.community_replies (post, author, body) values (sample_post, uc, 'Hello');
      raise exception 'FAIL: a member replied to a sample post';
    exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
    begin
      insert into public.community_reactions (member, post) values (uc, sample_post);
      raise exception 'FAIL: a member reacted to a sample post';
    exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
    begin
      insert into public.community_reactions (member, reply) values (uc, sample_reply);
      raise exception 'FAIL: a member reacted to a sample reply';
    exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
    begin
      insert into public.community_reports (target_type, target_id, reporter, reason) values ('post', sample_post, uc, 'spam');
      raise exception 'FAIL: a member reported a sample post';
    exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
    execute 'reset role';
    perform set_config('request.jwt.claims', json_build_object('sub', um, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    begin
      update public.community_posts set is_sample = false where id = sample_post;
      raise exception 'FAIL: a moderator cleared the sample flag';
    exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
    execute 'reset role';
    passed := passed + 1;

    -- 8. Samples never count toward a member's hourly limit.
    for i in 1..5 loop
      insert into public.community_posts (author, category, title, body, language, is_sample)
        values (ud, 'everydayLife', 'Sample ' || i, 'Body', 'en', true);
    end loop;
    perform set_config('request.jwt.claims', json_build_object('sub', ud, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    begin
      insert into public.community_posts (author, category, title, body, language) values (ud, 'everydayLife', 'D''s post', 'Body', 'en');
    exception when others then
      raise exception 'FAIL: sample posts counted toward a member''s hourly limit (%)', sqlerrm;
    end;
    execute 'reset role';
    passed := passed + 1;

    -- 9. Someone who has not joined can read but not write.
    perform set_config('request.jwt.claims', json_build_object('sub', un, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    if not exists (select 1 from public.community_posts where id = post_a) then
      raise exception 'FAIL: a signed-in reader cannot read';
    end if;
    begin
      insert into public.community_replies (post, author, body) values (post_a, un, 'Hi');
      raise exception 'FAIL: someone who has not joined replied';
    exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
    execute 'reset role';
    passed := passed + 1;

    -- 10. Three members report A's post: it is hidden.
    foreach reporter_id in array array[ub, uc, ud] loop
      perform set_config('request.jwt.claims', json_build_object('sub', reporter_id, 'role', 'authenticated')::text, true);
      execute 'set local role authenticated';
      insert into public.community_reports (target_type, target_id, reporter, reason) values ('post', post_a, reporter_id, 'unkind');
      execute 'reset role';
    end loop;
    if not (select hidden from public.community_posts where id = post_a) then
      raise exception 'FAIL: three reports did not hide the post';
    end if;
    passed := passed + 1;

    -- 11. A guest reads visible posts only, writes nothing, and cannot see members or who reacted.
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    execute 'set local role anon';
    if exists (select 1 from public.community_posts where id = post_a) then
      raise exception 'FAIL: a guest sees a hidden post';
    end if;
    if not exists (select 1 from public.community_posts) then
      raise exception 'FAIL: a guest cannot read visible posts';
    end if;
    begin
      insert into public.community_posts (author, category, title, body, language) values (null, 'encouragement', 'x', 'y', 'en');
      raise exception 'FAIL: a guest posted';
    exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
    begin
      perform 1 from public.community_members;
      raise exception 'FAIL: a guest read the member table';
    exception when insufficient_privilege then null; end;
    begin
      perform 1 from public.community_reactions;
      raise exception 'FAIL: a guest read who reacted';
    exception when insufficient_privilege then null; end;
    perform 1 from public.community_helped;
    execute 'reset role';
    passed := passed + 1;

    -- 12. The author still sees their hidden post, and cannot unhide it.
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    if not exists (select 1 from public.community_posts where id = post_a) then
      raise exception 'FAIL: the author cannot see their hidden post';
    end if;
    begin
      update public.community_posts set hidden = false where id = post_a;
      raise exception 'FAIL: the author unhid their post';
    exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
    execute 'reset role';
    passed := passed + 1;

    -- 13. The moderator sees the reports, unhides and pins, clears reports, assigns a role, and
    --     still cannot change who wrote a post.
    perform set_config('request.jwt.claims', json_build_object('sub', um, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    if (select count(*) from public.community_reports where target_id = post_a) <> 3 then
      raise exception 'FAIL: the moderator cannot see the reports';
    end if;
    update public.community_posts set hidden = false, pinned = true where id = post_a;
    if not (select pinned and not hidden from public.community_posts where id = post_a) then
      raise exception 'FAIL: the moderator could not unhide and pin';
    end if;
    delete from public.community_reports where target_id = post_a;
    begin
      update public.community_posts set author = um where id = post_a;
      raise exception 'FAIL: a moderator changed the author of a post';
    exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
    update public.community_members set role = 'guide' where user_id = ub;
    if (select role from public.community_members where user_id = ub) <> 'guide' then
      raise exception 'FAIL: the moderator could not assign a role';
    end if;
    execute 'reset role';
    passed := passed + 1;

    -- 14. One reaction per member and item; leaving and deleting removes posts and reactions.
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    insert into public.community_reactions (member, post) values (ub, post_a);
    begin
      insert into public.community_reactions (member, post) values (ub, post_a);
      raise exception 'FAIL: a member reacted twice';
    exception when unique_violation then null; end;
    insert into public.community_posts (author, category, title, body, language) values (ub, 'firstSteps', 'B''s post', 'Body', 'en');
    perform public.community_leave(false);
    if exists (select 1 from public.community_posts where title = 'B''s post') then
      raise exception 'FAIL: leaving did not delete the posts';
    end if;
    if exists (select 1 from public.community_reactions where member = ub) then
      raise exception 'FAIL: leaving kept the reactions';
    end if;
    execute 'reset role';
    passed := passed + 1;

    -- 15. The author cannot unpin; leaving and keeping makes posts and replies a former member's.
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    begin
      update public.community_posts set pinned = false where id = post_a;
      raise exception 'FAIL: an author unpinned their post';
    exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
    insert into public.community_replies (id, post, author, body) values (reply_a, post_a, ua, 'A reply to keep');
    perform public.community_leave(true);
    if (select author from public.community_replies where id = reply_a) is not null then
      raise exception 'FAIL: leaving and keeping did not make the replies a former member''s';
    end if;
    if (select author from public.community_posts where id = post_a) is not null then
      raise exception 'FAIL: leaving and keeping did not make the posts a former member''s';
    end if;
    if exists (select 1 from public.community_members where user_id = ua) then
      raise exception 'FAIL: the member is still there';
    end if;
    execute 'reset role';
    passed := passed + 1;

    raise exception using errcode = 'RHL00', message = 'community rules test: undo everything';
  exception when sqlstate 'RHL00' then
    null;
  end;

  if passed <> total then
    raise exception 'FAIL: only % of % checks ran', passed, total;
  end if;
  perform set_config('rehla.community_rules_passed', passed::text, true);
end
$test$;

select case when current_setting('rehla.community_rules_passed', true) = '15'
            then 'all community rules hold'
            else 'FAIL: the checks did not run in this transaction (in psql, use -1)'
       end as result,
       nullif(current_setting('rehla.community_rules_passed', true), '')::integer as checks;
