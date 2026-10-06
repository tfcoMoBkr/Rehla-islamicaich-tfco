-- Sample posts for Rehla Community, so the space can be seen in use. Written by the Rehla team
-- as illustrations, not real members' words: every row is marked is_sample, and the page shows a
-- "Sample" badge on each and a note on the home. Everyday experience and encouragement only.
--
-- Run it whole in the Supabase SQL editor after the community migrations (including
-- 20261006020000_community_samples.sql). Safe to run again: rows have fixed ids.
-- Remove everything it adds with supabase/seed/community_samples_remove.sql.
--
-- The sample members are accounts that cannot sign in (no password), with addresses under the
-- reserved .invalid domain, so they can never belong to anyone.
--
-- Dates: every sample row falls between the start of the challenge (4 October 2026, 08:00 Riyadh
-- time) and an hour before the moment this runs, in a fixed order, replies after their posts and
-- reactions after what they react to. sample_at(n) places a row n steps (of 20400) back from the
-- end of that span; it lives only for this session.
create or replace function pg_temp.sample_at(steps_back integer)
returns timestamptz language sql stable as $$
  select timestamptz '2026-10-04 08:00:00+03'
       + (now() - interval '1 hour' - timestamptz '2026-10-04 08:00:00+03') * (1 - steps_back / 20400.0)
$$;

insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('5a5a5a5a-0000-4000-8000-000000000001', 'sample-01@samples.rehla.invalid', 'authenticated', 'authenticated', '{"display_name": "Sample Traveller", "locale": "en"}'),
  ('5a5a5a5a-0000-4000-8000-000000000002', 'sample-02@samples.rehla.invalid', 'authenticated', 'authenticated', '{"display_name": "Sample Newcomer", "locale": "en"}'),
  ('5a5a5a5a-0000-4000-8000-000000000003', 'sample-03@samples.rehla.invalid', 'authenticated', 'authenticated', '{"display_name": "Sample Study Buddy", "locale": "en"}'),
  ('5a5a5a5a-0000-4000-8000-000000000004', 'sample-04@samples.rehla.invalid', 'authenticated', 'authenticated', '{"display_name": "Sample Neighbour", "locale": "en"}'),
  ('5a5a5a5a-0000-4000-8000-000000000005', 'sample-05@samples.rehla.invalid', 'authenticated', 'authenticated', '{"display_name": "مثال: مسافر", "locale": "ar"}'),
  ('5a5a5a5a-0000-4000-8000-000000000006', 'sample-06@samples.rehla.invalid', 'authenticated', 'authenticated', '{"display_name": "مثال: مبتدئ", "locale": "ar"}'),
  ('5a5a5a5a-0000-4000-8000-000000000007', 'sample-07@samples.rehla.invalid', 'authenticated', 'authenticated', '{"display_name": "مثال: زميل دراسة", "locale": "ar"}'),
  ('5a5a5a5a-0000-4000-8000-000000000008', 'sample-08@samples.rehla.invalid', 'authenticated', 'authenticated', '{"display_name": "مثال: جار", "locale": "ar"}')
on conflict (id) do nothing;

insert into public.community_members (user_id, name, is_sample, joined_at) values
  ('5a5a5a5a-0000-4000-8000-000000000001', 'Sample Traveller', true, pg_temp.sample_at(20400)),
  ('5a5a5a5a-0000-4000-8000-000000000002', 'Sample Newcomer', true, pg_temp.sample_at(20400)),
  ('5a5a5a5a-0000-4000-8000-000000000003', 'Sample Study Buddy', true, pg_temp.sample_at(20400)),
  ('5a5a5a5a-0000-4000-8000-000000000004', 'Sample Neighbour', true, pg_temp.sample_at(20400)),
  ('5a5a5a5a-0000-4000-8000-000000000005', 'مثال: مسافر', true, pg_temp.sample_at(20400)),
  ('5a5a5a5a-0000-4000-8000-000000000006', 'مثال: مبتدئ', true, pg_temp.sample_at(20400)),
  ('5a5a5a5a-0000-4000-8000-000000000007', 'مثال: زميل دراسة', true, pg_temp.sample_at(20400)),
  ('5a5a5a5a-0000-4000-8000-000000000008', 'مثال: جار', true, pg_temp.sample_at(20400))
on conflict (user_id) do nothing;

insert into public.community_posts (id, author, category, title, body, language, needs_specialist, pinned, is_sample, created_at) values
  ('5a5a5a5a-0001-4000-8000-000000000001', '5a5a5a5a-0000-4000-8000-000000000001', 'firstSteps', 'My first visit to a mosque', 'I went for the first time last Friday. I did not know where to leave my shoes, so I stood by the door for a while. A man showed me the shoe racks and where I could sit, and nobody stared.

If you are nervous about going, you can arrive early and sit at the back. It made it much easier for me.', 'en', false, false, true, pg_temp.sample_at(18600)),
  ('5a5a5a5a-0001-4000-8000-000000000002', '5a5a5a5a-0000-4000-8000-000000000002', 'firstSteps', 'Going slowly', 'I am taking it one lesson at a time. Some days I only manage a few minutes. Is anyone else going slowly?', 'en', false, false, true, pg_temp.sample_at(15600)),
  ('5a5a5a5a-0001-4000-8000-000000000003', '5a5a5a5a-0000-4000-8000-000000000004', 'everydayLife', 'Telling a colleague', 'I told one colleague I trust, over coffee. I kept it short and said I was happy to answer questions another day. It went better than I feared.', 'en', false, false, true, pg_temp.sample_at(13800)),
  ('5a5a5a5a-0001-4000-8000-000000000004', '5a5a5a5a-0000-4000-8000-000000000001', 'everydayLife', 'Finding a quiet room at work', 'I asked at work whether there was a quiet room. There is a small meeting room that is free most afternoons. Asking was the hardest part.', 'en', false, false, true, pg_temp.sample_at(10800)),
  ('5a5a5a5a-0001-4000-8000-000000000005', null, 'everydayLife', 'Eating out with friends', 'When I go out with friends, I look at the menu online first, so I am not deciding in a rush at the table. It made those evenings easier.', 'en', false, false, true, pg_temp.sample_at(9000)),
  ('5a5a5a5a-0001-4000-8000-000000000006', '5a5a5a5a-0000-4000-8000-000000000004', 'encouragement', 'To whoever is starting this week', 'You do not need to know everything at once. Every small step counts. Keep going.', 'en', false, true, true, pg_temp.sample_at(19800)),
  ('5a5a5a5a-0001-4000-8000-000000000007', '5a5a5a5a-0000-4000-8000-000000000002', 'encouragement', 'A small win', 'Today I finished the first station on the road. It took me three weeks, and I am proud of it.', 'en', false, false, true, pg_temp.sample_at(5760)),
  ('5a5a5a5a-0001-4000-8000-000000000008', '5a5a5a5a-0000-4000-8000-000000000003', 'learningTogether', 'Looking for a study partner (evenings, English)', 'I would like to go through the lessons with someone, twice a week in the evening. We could each read a lesson, then talk about what we understood.', 'en', false, false, true, pg_temp.sample_at(7200)),
  ('5a5a5a5a-0001-4000-8000-000000000009', '5a5a5a5a-0000-4000-8000-000000000003', 'learningTogether', 'What helped me remember a lesson', 'After each lesson I write three short lines in my own words, then read them the next morning. It helps me more than rereading the whole lesson.', 'en', false, false, true, pg_temp.sample_at(3600)),
  ('5a5a5a5a-0001-4000-8000-00000000000a', '5a5a5a5a-0000-4000-8000-000000000001', 'askCommunity', 'A question about my work', 'There is something about my work I am not sure about, and I would like a clear answer for my own case.', 'en', true, false, true, pg_temp.sample_at(2400)),
  ('5a5a5a5a-0001-4000-8000-00000000000b', '5a5a5a5a-0000-4000-8000-000000000002', 'askCommunity', 'Getting used to a new daily routine', 'Practical tips welcome: alarms, apps, notes on the fridge? What helped you build a new routine?', 'en', false, false, true, pg_temp.sample_at(1200)),
  ('5a5a5a5a-0001-4000-8000-00000000000c', '5a5a5a5a-0000-4000-8000-000000000005', 'firstSteps', 'زيارتي الأولى للمسجد', 'ذهبت أول مرة يوم الجمعة الماضي، ولم أعرف أين أضع حذائي، فوقفت عند الباب قليلًا. أشار إليّ رجل إلى رفّ الأحذية وإلى مكان أجلس فيه، ولم يحدّق بي أحد.

إن كنت مترددًا فيمكنك أن تصل مبكرًا وتجلس في الخلف؛ هذا سهّل عليّ الأمر كثيرًا.', 'ar', false, false, true, pg_temp.sample_at(18000)),
  ('5a5a5a5a-0001-4000-8000-00000000000d', '5a5a5a5a-0000-4000-8000-000000000006', 'firstSteps', 'أتعلّم ببطء', 'أسير درسًا درسًا، وفي بعض الأيام لا أجد إلا دقائق قليلة. هل هناك من يسير ببطء مثلي؟', 'ar', false, false, true, pg_temp.sample_at(15000)),
  ('5a5a5a5a-0001-4000-8000-00000000000e', '5a5a5a5a-0000-4000-8000-000000000008', 'everydayLife', 'كيف أخبرت زميلي في العمل', 'أخبرت زميلًا أثق به ونحن نشرب القهوة. اختصرت الكلام، وقلت إنني مستعد للإجابة عن أسئلته في يوم آخر. كان الأمر أسهل مما توقعت.', 'ar', false, false, true, pg_temp.sample_at(12600)),
  ('5a5a5a5a-0001-4000-8000-00000000000f', '5a5a5a5a-0000-4000-8000-000000000005', 'everydayLife', 'تنظيم الوقت بين العمل والدروس', 'صرت أخصص ربع ساعة بعد العمل للدرس قبل أي شيء آخر. حين أؤجله إلى الليل أنساه.', 'ar', false, false, true, pg_temp.sample_at(9600)),
  ('5a5a5a5a-0001-4000-8000-000000000010', '5a5a5a5a-0000-4000-8000-000000000008', 'encouragement', 'إلى من بدأ هذا الأسبوع', 'لا يلزمك أن تعرف كل شيء دفعة واحدة. لكل خطوة صغيرة قيمتها، فاستمر.', 'ar', false, false, true, pg_temp.sample_at(8400)),
  ('5a5a5a5a-0001-4000-8000-000000000011', '5a5a5a5a-0000-4000-8000-000000000006', 'encouragement', 'أنهيت المحطة الأولى', 'احتجت ثلاثة أسابيع لأنهي المحطة الأولى في الطريق، وأنا سعيد بذلك.', 'ar', false, false, true, pg_temp.sample_at(4800)),
  ('5a5a5a5a-0001-4000-8000-000000000012', '5a5a5a5a-0000-4000-8000-000000000007', 'learningTogether', 'أبحث عن زميل دراسة (مساءً، بالعربية)', 'أودّ أن أراجع الدروس مع أحد مرتين في الأسبوع مساءً: يقرأ كلٌّ منا درسًا، ثم نتحدث عمّا فهمناه.', 'ar', false, false, true, pg_temp.sample_at(6600)),
  ('5a5a5a5a-0001-4000-8000-000000000013', '5a5a5a5a-0000-4000-8000-000000000007', 'learningTogether', 'ما الذي ساعدني على تذكّر الدرس', 'أكتب بعد كل درس ثلاثة أسطر بكلماتي، ثم أقرؤها صباح اليوم التالي. هذا ينفعني أكثر من إعادة قراءة الدرس كله.', 'ar', false, false, true, pg_temp.sample_at(3000)),
  ('5a5a5a5a-0001-4000-8000-000000000014', '5a5a5a5a-0000-4000-8000-000000000006', 'askCommunity', 'كيف تعتاد على روتين يومي جديد؟', 'أرحّب بالنصائح العملية: منبّهات، تطبيقات، ملاحظات على باب الثلاجة؟ ما الذي أعانكم على بناء روتين جديد؟', 'ar', false, false, true, pg_temp.sample_at(1800)),
  ('5a5a5a5a-0001-4000-8000-000000000015', '5a5a5a5a-0000-4000-8000-000000000005', 'askCommunity', 'كيف تتعامل مع الأسئلة الكثيرة؟', 'حين يعرف الناس أنني أتعلّم يسألونني أسئلة كثيرة لا أعرف جوابها. ماذا تقولون في مثل هذا الموقف؟', 'ar', false, false, true, pg_temp.sample_at(720))
on conflict (id) do nothing;

insert into public.community_replies (id, post, author, body, is_sample, created_at) values
  ('5a5a5a5a-0002-4000-8000-000000000001', '5a5a5a5a-0001-4000-8000-000000000001', '5a5a5a5a-0000-4000-8000-000000000002', 'Arriving early helped me too. It was quiet, and I could look around before it got busy.', true, pg_temp.sample_at(18420)),
  ('5a5a5a5a-0002-4000-8000-000000000002', '5a5a5a5a-0001-4000-8000-000000000001', '5a5a5a5a-0000-4000-8000-000000000004', 'Thank you for writing this. I am going for the first time next week and this helps.', true, pg_temp.sample_at(18060)),
  ('5a5a5a5a-0002-4000-8000-000000000003', '5a5a5a5a-0001-4000-8000-000000000001', '5a5a5a5a-0000-4000-8000-000000000003', 'Same with the shoes! Now I keep a small bag for them in my coat pocket.', true, pg_temp.sample_at(16800)),
  ('5a5a5a5a-0002-4000-8000-000000000004', '5a5a5a5a-0001-4000-8000-000000000002', '5a5a5a5a-0000-4000-8000-000000000003', 'Going slowly here too. A few minutes most days adds up.', true, pg_temp.sample_at(15300)),
  ('5a5a5a5a-0002-4000-8000-000000000005', '5a5a5a5a-0001-4000-8000-000000000002', '5a5a5a5a-0000-4000-8000-000000000001', 'I take one lesson a week and come back to it twice. Slow is fine.', true, pg_temp.sample_at(14400)),
  ('5a5a5a5a-0002-4000-8000-000000000006', '5a5a5a5a-0001-4000-8000-000000000003', '5a5a5a5a-0000-4000-8000-000000000001', 'Keeping it short is good advice. I said too much the first time and it got confusing.', true, pg_temp.sample_at(13560)),
  ('5a5a5a5a-0002-4000-8000-000000000007', '5a5a5a5a-0001-4000-8000-000000000003', '5a5a5a5a-0000-4000-8000-000000000002', 'I have not told anyone at work yet. Good to read that it can go well.', true, pg_temp.sample_at(12240)),
  ('5a5a5a5a-0002-4000-8000-000000000008', '5a5a5a5a-0001-4000-8000-000000000004', '5a5a5a5a-0000-4000-8000-000000000004', 'Our office has no spare room, so I use a corner of the library at lunch.', true, pg_temp.sample_at(10440)),
  ('5a5a5a5a-0002-4000-8000-000000000009', '5a5a5a5a-0001-4000-8000-000000000004', '5a5a5a5a-0000-4000-8000-000000000003', 'Asking really is the hardest part. Well done.', true, pg_temp.sample_at(10080)),
  ('5a5a5a5a-0002-4000-8000-00000000000a', '5a5a5a5a-0001-4000-8000-000000000005', '5a5a5a5a-0000-4000-8000-000000000002', 'Checking the menu first is a good tip. Thank you.', true, pg_temp.sample_at(8520)),
  ('5a5a5a5a-0002-4000-8000-00000000000b', '5a5a5a5a-0001-4000-8000-000000000006', '5a5a5a5a-0000-4000-8000-000000000002', 'I needed this today. Thank you.', true, pg_temp.sample_at(19680)),
  ('5a5a5a5a-0002-4000-8000-00000000000c', '5a5a5a5a-0001-4000-8000-000000000006', '5a5a5a5a-0000-4000-8000-000000000001', 'Saving this for the days I feel behind.', true, pg_temp.sample_at(18900)),
  ('5a5a5a5a-0002-4000-8000-00000000000d', '5a5a5a5a-0001-4000-8000-000000000006', '5a5a5a5a-0000-4000-8000-000000000003', 'Every small step counts. Agreed.', true, pg_temp.sample_at(17400)),
  ('5a5a5a5a-0002-4000-8000-00000000000e', '5a5a5a5a-0001-4000-8000-000000000007', '5a5a5a5a-0000-4000-8000-000000000004', 'Three weeks is great. Congratulations!', true, pg_temp.sample_at(5700)),
  ('5a5a5a5a-0002-4000-8000-00000000000f', '5a5a5a5a-0001-4000-8000-000000000007', '5a5a5a5a-0000-4000-8000-000000000003', 'Well done. On to the next station.', true, pg_temp.sample_at(5340)),
  ('5a5a5a5a-0002-4000-8000-000000000010', '5a5a5a5a-0001-4000-8000-000000000008', '5a5a5a5a-0000-4000-8000-000000000002', 'I would be interested. Tuesday and Thursday evenings work for me.', true, pg_temp.sample_at(7020)),
  ('5a5a5a5a-0002-4000-8000-000000000011', '5a5a5a5a-0001-4000-8000-000000000008', '5a5a5a5a-0000-4000-8000-000000000001', 'Good idea. Maybe write here which lesson you are on, so others can join in.', true, pg_temp.sample_at(6600)),
  ('5a5a5a5a-0002-4000-8000-000000000012', '5a5a5a5a-0001-4000-8000-000000000009', '5a5a5a5a-0000-4000-8000-000000000001', 'I tried the three lines tonight. Writing in my own words showed me what I had missed.', true, pg_temp.sample_at(3360)),
  ('5a5a5a5a-0002-4000-8000-000000000013', '5a5a5a5a-0001-4000-8000-000000000009', '5a5a5a5a-0000-4000-8000-000000000004', 'I do something similar with short voice notes on my walk home.', true, pg_temp.sample_at(2640)),
  ('5a5a5a5a-0002-4000-8000-000000000014', '5a5a5a5a-0001-4000-8000-00000000000a', '5a5a5a5a-0000-4000-8000-000000000004', 'This sounds like one for a specialist. The "Talk to a specialist" page lists who you can contact.', true, pg_temp.sample_at(2280)),
  ('5a5a5a5a-0002-4000-8000-000000000015', '5a5a5a5a-0001-4000-8000-00000000000b', '5a5a5a5a-0000-4000-8000-000000000003', 'Alarms with short labels help me, like "lesson, 10 minutes".', true, pg_temp.sample_at(1080)),
  ('5a5a5a5a-0002-4000-8000-000000000016', '5a5a5a5a-0001-4000-8000-00000000000b', '5a5a5a5a-0000-4000-8000-000000000004', 'I tie a new habit to an old one: right after my morning coffee.', true, pg_temp.sample_at(840)),
  ('5a5a5a5a-0002-4000-8000-000000000017', '5a5a5a5a-0001-4000-8000-00000000000c', '5a5a5a5a-0000-4000-8000-000000000006', 'الوصول مبكرًا أعانني أيضًا؛ كان المكان هادئًا، ورأيت كل شيء قبل الزحام.', true, pg_temp.sample_at(17760)),
  ('5a5a5a5a-0002-4000-8000-000000000018', '5a5a5a5a-0001-4000-8000-00000000000c', '5a5a5a5a-0000-4000-8000-000000000008', 'شكرًا على هذا. سأذهب أول مرة الأسبوع القادم، وكلامك طمأنني.', true, pg_temp.sample_at(17400)),
  ('5a5a5a5a-0002-4000-8000-000000000019', '5a5a5a5a-0001-4000-8000-00000000000c', '5a5a5a5a-0000-4000-8000-000000000007', 'وأنا كذلك احترت في الأحذية! صرت أحمل لها كيسًا صغيرًا.', true, pg_temp.sample_at(16320)),
  ('5a5a5a5a-0002-4000-8000-00000000001a', '5a5a5a5a-0001-4000-8000-00000000000d', '5a5a5a5a-0000-4000-8000-000000000007', 'وأنا أيضًا أسير ببطء. الدقائق القليلة كل يوم تتراكم.', true, pg_temp.sample_at(14640)),
  ('5a5a5a5a-0002-4000-8000-00000000001b', '5a5a5a5a-0001-4000-8000-00000000000d', '5a5a5a5a-0000-4000-8000-000000000005', 'أدرس درسًا واحدًا في الأسبوع، وأعود إليه مرتين.', true, pg_temp.sample_at(13680)),
  ('5a5a5a5a-0002-4000-8000-00000000001c', '5a5a5a5a-0001-4000-8000-00000000000e', '5a5a5a5a-0000-4000-8000-000000000005', 'نصيحة الاختصار جيدة؛ أطلت في المرة الأولى فاختلط الكلام.', true, pg_temp.sample_at(12300)),
  ('5a5a5a5a-0002-4000-8000-00000000001d', '5a5a5a5a-0001-4000-8000-00000000000e', '5a5a5a5a-0000-4000-8000-000000000006', 'لم أخبر أحدًا في العمل بعد، ويسرّني أن أقرأ أن الأمر قد يمضي بسهولة.', true, pg_temp.sample_at(11160)),
  ('5a5a5a5a-0002-4000-8000-00000000001e', '5a5a5a5a-0001-4000-8000-00000000000f', '5a5a5a5a-0000-4000-8000-000000000007', 'أفعل مثلك: الدرس أولًا، ثم بقية المساء.', true, pg_temp.sample_at(9420)),
  ('5a5a5a5a-0002-4000-8000-00000000001f', '5a5a5a5a-0001-4000-8000-00000000000f', '5a5a5a5a-0000-4000-8000-000000000008', 'جرّبت ذلك هذا الأسبوع، فنجح معي يومين من ثلاثة.', true, pg_temp.sample_at(7800)),
  ('5a5a5a5a-0002-4000-8000-000000000020', '5a5a5a5a-0001-4000-8000-000000000010', '5a5a5a5a-0000-4000-8000-000000000006', 'كنت أحتاج هذه الكلمات اليوم. شكرًا لك.', true, pg_temp.sample_at(8280)),
  ('5a5a5a5a-0002-4000-8000-000000000021', '5a5a5a5a-0001-4000-8000-000000000010', '5a5a5a5a-0000-4000-8000-000000000005', 'سأعود إليها في الأيام التي أشعر فيها بالتأخر.', true, pg_temp.sample_at(7320)),
  ('5a5a5a5a-0002-4000-8000-000000000022', '5a5a5a5a-0001-4000-8000-000000000011', '5a5a5a5a-0000-4000-8000-000000000008', 'ثلاثة أسابيع إنجاز جميل. تهانينا!', true, pg_temp.sample_at(4740)),
  ('5a5a5a5a-0002-4000-8000-000000000023', '5a5a5a5a-0001-4000-8000-000000000011', '5a5a5a5a-0000-4000-8000-000000000007', 'أحسنت. إلى المحطة التالية.', true, pg_temp.sample_at(4260)),
  ('5a5a5a5a-0002-4000-8000-000000000024', '5a5a5a5a-0001-4000-8000-000000000012', '5a5a5a5a-0000-4000-8000-000000000006', 'يناسبني ذلك، مساء الثلاثاء والخميس.', true, pg_temp.sample_at(6360)),
  ('5a5a5a5a-0002-4000-8000-000000000025', '5a5a5a5a-0001-4000-8000-000000000012', '5a5a5a5a-0000-4000-8000-000000000005', 'فكرة حسنة. اكتبوا هنا الدرس الذي وصلتم إليه ليلحق بكم غيركم.', true, pg_temp.sample_at(5880)),
  ('5a5a5a5a-0002-4000-8000-000000000026', '5a5a5a5a-0001-4000-8000-000000000013', '5a5a5a5a-0000-4000-8000-000000000005', 'جرّبت الأسطر الثلاثة الليلة، فظهر لي ما فاتني.', true, pg_temp.sample_at(2820)),
  ('5a5a5a5a-0002-4000-8000-000000000027', '5a5a5a5a-0001-4000-8000-000000000013', '5a5a5a5a-0000-4000-8000-000000000008', 'أفعل شيئًا قريبًا بتسجيلات صوتية قصيرة في طريق العودة.', true, pg_temp.sample_at(2160)),
  ('5a5a5a5a-0002-4000-8000-000000000028', '5a5a5a5a-0001-4000-8000-000000000014', '5a5a5a5a-0000-4000-8000-000000000007', 'تعينني المنبّهات ذات العناوين القصيرة، مثل: درس، عشر دقائق.', true, pg_temp.sample_at(1680)),
  ('5a5a5a5a-0002-4000-8000-000000000029', '5a5a5a5a-0001-4000-8000-000000000014', '5a5a5a5a-0000-4000-8000-000000000008', 'أربط العادة الجديدة بعادة قديمة: بعد قهوة الصباح مباشرة.', true, pg_temp.sample_at(1380)),
  ('5a5a5a5a-0002-4000-8000-00000000002a', '5a5a5a5a-0001-4000-8000-000000000015', '5a5a5a5a-0000-4000-8000-000000000008', 'أقول بصراحة: ما زلت أتعلّم، وسأخبرك حين أعرف.', true, pg_temp.sample_at(660))
on conflict (id) do nothing;

insert into public.community_reactions (member, post, reply) values
  ('5a5a5a5a-0000-4000-8000-000000000002', '5a5a5a5a-0001-4000-8000-000000000006', null),
  ('5a5a5a5a-0000-4000-8000-000000000001', '5a5a5a5a-0001-4000-8000-000000000006', null),
  ('5a5a5a5a-0000-4000-8000-000000000003', '5a5a5a5a-0001-4000-8000-000000000007', null),
  ('5a5a5a5a-0000-4000-8000-000000000004', '5a5a5a5a-0001-4000-8000-000000000009', null),
  ('5a5a5a5a-0000-4000-8000-000000000001', '5a5a5a5a-0001-4000-8000-000000000009', null),
  ('5a5a5a5a-0000-4000-8000-000000000002', null, '5a5a5a5a-0002-4000-8000-000000000016'),
  ('5a5a5a5a-0000-4000-8000-000000000006', '5a5a5a5a-0001-4000-8000-000000000010', null),
  ('5a5a5a5a-0000-4000-8000-000000000007', '5a5a5a5a-0001-4000-8000-00000000000c', null),
  ('5a5a5a5a-0000-4000-8000-000000000005', '5a5a5a5a-0001-4000-8000-000000000013', null),
  ('5a5a5a5a-0000-4000-8000-000000000005', null, '5a5a5a5a-0002-4000-8000-00000000002a')
on conflict do nothing;

-- A reaction comes twenty minutes after what it reacts to.
update public.community_reactions reaction
set created_at = least(target.created_at + interval '20 minutes', now())
from (
  select id as post, null::uuid as reply, created_at from public.community_posts where is_sample
  union all
  select null, id, created_at from public.community_replies where is_sample
) target
where reaction.member in (select user_id from public.community_members where is_sample)
  and (reaction.post = target.post or reaction.reply = target.reply);

select (select count(*) from public.community_posts where is_sample) as sample_posts,
       (select count(*) from public.community_replies where is_sample) as sample_replies;
