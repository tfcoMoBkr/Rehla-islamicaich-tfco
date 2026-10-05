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
  ('5a5a5a5a-0000-4000-8000-000000000001', 'Sample Traveller', true, now() - interval '20400 minutes'),
  ('5a5a5a5a-0000-4000-8000-000000000002', 'Sample Newcomer', true, now() - interval '20400 minutes'),
  ('5a5a5a5a-0000-4000-8000-000000000003', 'Sample Study Buddy', true, now() - interval '20400 minutes'),
  ('5a5a5a5a-0000-4000-8000-000000000004', 'Sample Neighbour', true, now() - interval '20400 minutes'),
  ('5a5a5a5a-0000-4000-8000-000000000005', 'مثال: مسافر', true, now() - interval '20400 minutes'),
  ('5a5a5a5a-0000-4000-8000-000000000006', 'مثال: مبتدئ', true, now() - interval '20400 minutes'),
  ('5a5a5a5a-0000-4000-8000-000000000007', 'مثال: زميل دراسة', true, now() - interval '20400 minutes'),
  ('5a5a5a5a-0000-4000-8000-000000000008', 'مثال: جار', true, now() - interval '20400 minutes')
on conflict (user_id) do nothing;

insert into public.community_posts (id, author, category, title, body, language, needs_specialist, pinned, is_sample, created_at) values
  ('5a5a5a5a-0001-4000-8000-000000000001', '5a5a5a5a-0000-4000-8000-000000000001', 'firstSteps', 'My first visit to a mosque', 'I went for the first time last Friday. I did not know where to leave my shoes, so I stood by the door for a while. A man showed me the shoe racks and where I could sit, and nobody stared.

If you are nervous about going, you can arrive early and sit at the back. It made it much easier for me.', 'en', false, false, true, now() - interval '18600 minutes'),
  ('5a5a5a5a-0001-4000-8000-000000000002', '5a5a5a5a-0000-4000-8000-000000000002', 'firstSteps', 'Going slowly', 'I am taking it one lesson at a time. Some days I only manage a few minutes. Is anyone else going slowly?', 'en', false, false, true, now() - interval '15600 minutes'),
  ('5a5a5a5a-0001-4000-8000-000000000003', '5a5a5a5a-0000-4000-8000-000000000004', 'everydayLife', 'Telling a colleague', 'I told one colleague I trust, over coffee. I kept it short and said I was happy to answer questions another day. It went better than I feared.', 'en', false, false, true, now() - interval '13800 minutes'),
  ('5a5a5a5a-0001-4000-8000-000000000004', '5a5a5a5a-0000-4000-8000-000000000001', 'everydayLife', 'Finding a quiet room at work', 'I asked at work whether there was a quiet room. There is a small meeting room that is free most afternoons. Asking was the hardest part.', 'en', false, false, true, now() - interval '10800 minutes'),
  ('5a5a5a5a-0001-4000-8000-000000000005', null, 'everydayLife', 'Eating out with friends', 'When I go out with friends, I look at the menu online first, so I am not deciding in a rush at the table. It made those evenings easier.', 'en', false, false, true, now() - interval '9000 minutes'),
  ('5a5a5a5a-0001-4000-8000-000000000006', '5a5a5a5a-0000-4000-8000-000000000004', 'encouragement', 'To whoever is starting this week', 'You do not need to know everything at once. Every small step counts. Keep going.', 'en', false, true, true, now() - interval '19800 minutes'),
  ('5a5a5a5a-0001-4000-8000-000000000007', '5a5a5a5a-0000-4000-8000-000000000002', 'encouragement', 'A small win', 'Today I finished the first station on the road. It took me three weeks, and I am proud of it.', 'en', false, false, true, now() - interval '5760 minutes'),
  ('5a5a5a5a-0001-4000-8000-000000000008', '5a5a5a5a-0000-4000-8000-000000000003', 'learningTogether', 'Looking for a study partner (evenings, English)', 'I would like to go through the lessons with someone, twice a week in the evening. We could each read a lesson, then talk about what we understood.', 'en', false, false, true, now() - interval '7200 minutes'),
  ('5a5a5a5a-0001-4000-8000-000000000009', '5a5a5a5a-0000-4000-8000-000000000003', 'learningTogether', 'What helped me remember a lesson', 'After each lesson I write three short lines in my own words, then read them the next morning. It helps me more than rereading the whole lesson.', 'en', false, false, true, now() - interval '3600 minutes'),
  ('5a5a5a5a-0001-4000-8000-00000000000a', '5a5a5a5a-0000-4000-8000-000000000001', 'askCommunity', 'A question about my work', 'There is something about my work I am not sure about, and I would like a clear answer for my own case.', 'en', true, false, true, now() - interval '2400 minutes'),
  ('5a5a5a5a-0001-4000-8000-00000000000b', '5a5a5a5a-0000-4000-8000-000000000002', 'askCommunity', 'Getting used to a new daily routine', 'Practical tips welcome: alarms, apps, notes on the fridge? What helped you build a new routine?', 'en', false, false, true, now() - interval '1200 minutes'),
  ('5a5a5a5a-0001-4000-8000-00000000000c', '5a5a5a5a-0000-4000-8000-000000000005', 'firstSteps', 'زيارتي الأولى للمسجد', 'ذهبت أول مرة يوم الجمعة الماضي، ولم أعرف أين أضع حذائي، فوقفت عند الباب قليلًا. أشار إليّ رجل إلى رفّ الأحذية وإلى مكان أجلس فيه، ولم يحدّق بي أحد.

إن كنت مترددًا فيمكنك أن تصل مبكرًا وتجلس في الخلف؛ هذا سهّل عليّ الأمر كثيرًا.', 'ar', false, false, true, now() - interval '18000 minutes'),
  ('5a5a5a5a-0001-4000-8000-00000000000d', '5a5a5a5a-0000-4000-8000-000000000006', 'firstSteps', 'أتعلّم ببطء', 'أسير درسًا درسًا، وفي بعض الأيام لا أجد إلا دقائق قليلة. هل هناك من يسير ببطء مثلي؟', 'ar', false, false, true, now() - interval '15000 minutes'),
  ('5a5a5a5a-0001-4000-8000-00000000000e', '5a5a5a5a-0000-4000-8000-000000000008', 'everydayLife', 'كيف أخبرت زميلي في العمل', 'أخبرت زميلًا أثق به ونحن نشرب القهوة. اختصرت الكلام، وقلت إنني مستعد للإجابة عن أسئلته في يوم آخر. كان الأمر أسهل مما توقعت.', 'ar', false, false, true, now() - interval '12600 minutes'),
  ('5a5a5a5a-0001-4000-8000-00000000000f', '5a5a5a5a-0000-4000-8000-000000000005', 'everydayLife', 'تنظيم الوقت بين العمل والدروس', 'صرت أخصص ربع ساعة بعد العمل للدرس قبل أي شيء آخر. حين أؤجله إلى الليل أنساه.', 'ar', false, false, true, now() - interval '9600 minutes'),
  ('5a5a5a5a-0001-4000-8000-000000000010', '5a5a5a5a-0000-4000-8000-000000000008', 'encouragement', 'إلى من بدأ هذا الأسبوع', 'لا يلزمك أن تعرف كل شيء دفعة واحدة. لكل خطوة صغيرة قيمتها، فاستمر.', 'ar', false, false, true, now() - interval '8400 minutes'),
  ('5a5a5a5a-0001-4000-8000-000000000011', '5a5a5a5a-0000-4000-8000-000000000006', 'encouragement', 'أنهيت المحطة الأولى', 'احتجت ثلاثة أسابيع لأنهي المحطة الأولى في الطريق، وأنا سعيد بذلك.', 'ar', false, false, true, now() - interval '4800 minutes'),
  ('5a5a5a5a-0001-4000-8000-000000000012', '5a5a5a5a-0000-4000-8000-000000000007', 'learningTogether', 'أبحث عن زميل دراسة (مساءً، بالعربية)', 'أودّ أن أراجع الدروس مع أحد مرتين في الأسبوع مساءً: يقرأ كلٌّ منا درسًا، ثم نتحدث عمّا فهمناه.', 'ar', false, false, true, now() - interval '6600 minutes'),
  ('5a5a5a5a-0001-4000-8000-000000000013', '5a5a5a5a-0000-4000-8000-000000000007', 'learningTogether', 'ما الذي ساعدني على تذكّر الدرس', 'أكتب بعد كل درس ثلاثة أسطر بكلماتي، ثم أقرؤها صباح اليوم التالي. هذا ينفعني أكثر من إعادة قراءة الدرس كله.', 'ar', false, false, true, now() - interval '3000 minutes'),
  ('5a5a5a5a-0001-4000-8000-000000000014', '5a5a5a5a-0000-4000-8000-000000000006', 'askCommunity', 'كيف تعتاد على روتين يومي جديد؟', 'أرحّب بالنصائح العملية: منبّهات، تطبيقات، ملاحظات على باب الثلاجة؟ ما الذي أعانكم على بناء روتين جديد؟', 'ar', false, false, true, now() - interval '1800 minutes'),
  ('5a5a5a5a-0001-4000-8000-000000000015', '5a5a5a5a-0000-4000-8000-000000000005', 'askCommunity', 'كيف تتعامل مع الأسئلة الكثيرة؟', 'حين يعرف الناس أنني أتعلّم يسألونني أسئلة كثيرة لا أعرف جوابها. ماذا تقولون في مثل هذا الموقف؟', 'ar', false, false, true, now() - interval '720 minutes')
on conflict (id) do nothing;

insert into public.community_replies (id, post, author, body, is_sample, created_at) values
  ('5a5a5a5a-0002-4000-8000-000000000001', '5a5a5a5a-0001-4000-8000-000000000001', '5a5a5a5a-0000-4000-8000-000000000002', 'Arriving early helped me too. It was quiet, and I could look around before it got busy.', true, now() - interval '18420 minutes'),
  ('5a5a5a5a-0002-4000-8000-000000000002', '5a5a5a5a-0001-4000-8000-000000000001', '5a5a5a5a-0000-4000-8000-000000000004', 'Thank you for writing this. I am going for the first time next week and this helps.', true, now() - interval '18060 minutes'),
  ('5a5a5a5a-0002-4000-8000-000000000003', '5a5a5a5a-0001-4000-8000-000000000001', '5a5a5a5a-0000-4000-8000-000000000003', 'Same with the shoes! Now I keep a small bag for them in my coat pocket.', true, now() - interval '16800 minutes'),
  ('5a5a5a5a-0002-4000-8000-000000000004', '5a5a5a5a-0001-4000-8000-000000000002', '5a5a5a5a-0000-4000-8000-000000000003', 'Going slowly here too. A few minutes most days adds up.', true, now() - interval '15300 minutes'),
  ('5a5a5a5a-0002-4000-8000-000000000005', '5a5a5a5a-0001-4000-8000-000000000002', '5a5a5a5a-0000-4000-8000-000000000001', 'I take one lesson a week and come back to it twice. Slow is fine.', true, now() - interval '14400 minutes'),
  ('5a5a5a5a-0002-4000-8000-000000000006', '5a5a5a5a-0001-4000-8000-000000000003', '5a5a5a5a-0000-4000-8000-000000000001', 'Keeping it short is good advice. I said too much the first time and it got confusing.', true, now() - interval '13560 minutes'),
  ('5a5a5a5a-0002-4000-8000-000000000007', '5a5a5a5a-0001-4000-8000-000000000003', '5a5a5a5a-0000-4000-8000-000000000002', 'I have not told anyone at work yet. Good to read that it can go well.', true, now() - interval '12240 minutes'),
  ('5a5a5a5a-0002-4000-8000-000000000008', '5a5a5a5a-0001-4000-8000-000000000004', '5a5a5a5a-0000-4000-8000-000000000004', 'Our office has no spare room, so I use a corner of the library at lunch.', true, now() - interval '10440 minutes'),
  ('5a5a5a5a-0002-4000-8000-000000000009', '5a5a5a5a-0001-4000-8000-000000000004', '5a5a5a5a-0000-4000-8000-000000000003', 'Asking really is the hardest part. Well done.', true, now() - interval '10080 minutes'),
  ('5a5a5a5a-0002-4000-8000-00000000000a', '5a5a5a5a-0001-4000-8000-000000000005', '5a5a5a5a-0000-4000-8000-000000000002', 'Checking the menu first is a good tip. Thank you.', true, now() - interval '8520 minutes'),
  ('5a5a5a5a-0002-4000-8000-00000000000b', '5a5a5a5a-0001-4000-8000-000000000006', '5a5a5a5a-0000-4000-8000-000000000002', 'I needed this today. Thank you.', true, now() - interval '19680 minutes'),
  ('5a5a5a5a-0002-4000-8000-00000000000c', '5a5a5a5a-0001-4000-8000-000000000006', '5a5a5a5a-0000-4000-8000-000000000001', 'Saving this for the days I feel behind.', true, now() - interval '18900 minutes'),
  ('5a5a5a5a-0002-4000-8000-00000000000d', '5a5a5a5a-0001-4000-8000-000000000006', '5a5a5a5a-0000-4000-8000-000000000003', 'Every small step counts. Agreed.', true, now() - interval '17400 minutes'),
  ('5a5a5a5a-0002-4000-8000-00000000000e', '5a5a5a5a-0001-4000-8000-000000000007', '5a5a5a5a-0000-4000-8000-000000000004', 'Three weeks is great. Congratulations!', true, now() - interval '5700 minutes'),
  ('5a5a5a5a-0002-4000-8000-00000000000f', '5a5a5a5a-0001-4000-8000-000000000007', '5a5a5a5a-0000-4000-8000-000000000003', 'Well done. On to the next station.', true, now() - interval '5340 minutes'),
  ('5a5a5a5a-0002-4000-8000-000000000010', '5a5a5a5a-0001-4000-8000-000000000008', '5a5a5a5a-0000-4000-8000-000000000002', 'I would be interested. Tuesday and Thursday evenings work for me.', true, now() - interval '7020 minutes'),
  ('5a5a5a5a-0002-4000-8000-000000000011', '5a5a5a5a-0001-4000-8000-000000000008', '5a5a5a5a-0000-4000-8000-000000000001', 'Good idea. Maybe write here which lesson you are on, so others can join in.', true, now() - interval '6600 minutes'),
  ('5a5a5a5a-0002-4000-8000-000000000012', '5a5a5a5a-0001-4000-8000-000000000009', '5a5a5a5a-0000-4000-8000-000000000001', 'I tried the three lines tonight. Writing in my own words showed me what I had missed.', true, now() - interval '3360 minutes'),
  ('5a5a5a5a-0002-4000-8000-000000000013', '5a5a5a5a-0001-4000-8000-000000000009', '5a5a5a5a-0000-4000-8000-000000000004', 'I do something similar with short voice notes on my walk home.', true, now() - interval '2640 minutes'),
  ('5a5a5a5a-0002-4000-8000-000000000014', '5a5a5a5a-0001-4000-8000-00000000000a', '5a5a5a5a-0000-4000-8000-000000000004', 'This sounds like one for a specialist. The "Talk to a specialist" page lists who you can contact.', true, now() - interval '2280 minutes'),
  ('5a5a5a5a-0002-4000-8000-000000000015', '5a5a5a5a-0001-4000-8000-00000000000b', '5a5a5a5a-0000-4000-8000-000000000003', 'Alarms with short labels help me, like "lesson, 10 minutes".', true, now() - interval '1080 minutes'),
  ('5a5a5a5a-0002-4000-8000-000000000016', '5a5a5a5a-0001-4000-8000-00000000000b', '5a5a5a5a-0000-4000-8000-000000000004', 'I tie a new habit to an old one: right after my morning coffee.', true, now() - interval '840 minutes'),
  ('5a5a5a5a-0002-4000-8000-000000000017', '5a5a5a5a-0001-4000-8000-00000000000c', '5a5a5a5a-0000-4000-8000-000000000006', 'الوصول مبكرًا أعانني أيضًا؛ كان المكان هادئًا، ورأيت كل شيء قبل الزحام.', true, now() - interval '17760 minutes'),
  ('5a5a5a5a-0002-4000-8000-000000000018', '5a5a5a5a-0001-4000-8000-00000000000c', '5a5a5a5a-0000-4000-8000-000000000008', 'شكرًا على هذا. سأذهب أول مرة الأسبوع القادم، وكلامك طمأنني.', true, now() - interval '17400 minutes'),
  ('5a5a5a5a-0002-4000-8000-000000000019', '5a5a5a5a-0001-4000-8000-00000000000c', '5a5a5a5a-0000-4000-8000-000000000007', 'وأنا كذلك احترت في الأحذية! صرت أحمل لها كيسًا صغيرًا.', true, now() - interval '16320 minutes'),
  ('5a5a5a5a-0002-4000-8000-00000000001a', '5a5a5a5a-0001-4000-8000-00000000000d', '5a5a5a5a-0000-4000-8000-000000000007', 'وأنا أيضًا أسير ببطء. الدقائق القليلة كل يوم تتراكم.', true, now() - interval '14640 minutes'),
  ('5a5a5a5a-0002-4000-8000-00000000001b', '5a5a5a5a-0001-4000-8000-00000000000d', '5a5a5a5a-0000-4000-8000-000000000005', 'أدرس درسًا واحدًا في الأسبوع، وأعود إليه مرتين.', true, now() - interval '13680 minutes'),
  ('5a5a5a5a-0002-4000-8000-00000000001c', '5a5a5a5a-0001-4000-8000-00000000000e', '5a5a5a5a-0000-4000-8000-000000000005', 'نصيحة الاختصار جيدة؛ أطلت في المرة الأولى فاختلط الكلام.', true, now() - interval '12300 minutes'),
  ('5a5a5a5a-0002-4000-8000-00000000001d', '5a5a5a5a-0001-4000-8000-00000000000e', '5a5a5a5a-0000-4000-8000-000000000006', 'لم أخبر أحدًا في العمل بعد، ويسرّني أن أقرأ أن الأمر قد يمضي بسهولة.', true, now() - interval '11160 minutes'),
  ('5a5a5a5a-0002-4000-8000-00000000001e', '5a5a5a5a-0001-4000-8000-00000000000f', '5a5a5a5a-0000-4000-8000-000000000007', 'أفعل مثلك: الدرس أولًا، ثم بقية المساء.', true, now() - interval '9420 minutes'),
  ('5a5a5a5a-0002-4000-8000-00000000001f', '5a5a5a5a-0001-4000-8000-00000000000f', '5a5a5a5a-0000-4000-8000-000000000008', 'جرّبت ذلك هذا الأسبوع، فنجح معي يومين من ثلاثة.', true, now() - interval '7800 minutes'),
  ('5a5a5a5a-0002-4000-8000-000000000020', '5a5a5a5a-0001-4000-8000-000000000010', '5a5a5a5a-0000-4000-8000-000000000006', 'كنت أحتاج هذه الكلمات اليوم. شكرًا لك.', true, now() - interval '8280 minutes'),
  ('5a5a5a5a-0002-4000-8000-000000000021', '5a5a5a5a-0001-4000-8000-000000000010', '5a5a5a5a-0000-4000-8000-000000000005', 'سأعود إليها في الأيام التي أشعر فيها بالتأخر.', true, now() - interval '7320 minutes'),
  ('5a5a5a5a-0002-4000-8000-000000000022', '5a5a5a5a-0001-4000-8000-000000000011', '5a5a5a5a-0000-4000-8000-000000000008', 'ثلاثة أسابيع إنجاز جميل. تهانينا!', true, now() - interval '4740 minutes'),
  ('5a5a5a5a-0002-4000-8000-000000000023', '5a5a5a5a-0001-4000-8000-000000000011', '5a5a5a5a-0000-4000-8000-000000000007', 'أحسنت. إلى المحطة التالية.', true, now() - interval '4260 minutes'),
  ('5a5a5a5a-0002-4000-8000-000000000024', '5a5a5a5a-0001-4000-8000-000000000012', '5a5a5a5a-0000-4000-8000-000000000006', 'يناسبني ذلك، مساء الثلاثاء والخميس.', true, now() - interval '6360 minutes'),
  ('5a5a5a5a-0002-4000-8000-000000000025', '5a5a5a5a-0001-4000-8000-000000000012', '5a5a5a5a-0000-4000-8000-000000000005', 'فكرة حسنة. اكتبوا هنا الدرس الذي وصلتم إليه ليلحق بكم غيركم.', true, now() - interval '5880 minutes'),
  ('5a5a5a5a-0002-4000-8000-000000000026', '5a5a5a5a-0001-4000-8000-000000000013', '5a5a5a5a-0000-4000-8000-000000000005', 'جرّبت الأسطر الثلاثة الليلة، فظهر لي ما فاتني.', true, now() - interval '2820 minutes'),
  ('5a5a5a5a-0002-4000-8000-000000000027', '5a5a5a5a-0001-4000-8000-000000000013', '5a5a5a5a-0000-4000-8000-000000000008', 'أفعل شيئًا قريبًا بتسجيلات صوتية قصيرة في طريق العودة.', true, now() - interval '2160 minutes'),
  ('5a5a5a5a-0002-4000-8000-000000000028', '5a5a5a5a-0001-4000-8000-000000000014', '5a5a5a5a-0000-4000-8000-000000000007', 'تعينني المنبّهات ذات العناوين القصيرة، مثل: درس، عشر دقائق.', true, now() - interval '1680 minutes'),
  ('5a5a5a5a-0002-4000-8000-000000000029', '5a5a5a5a-0001-4000-8000-000000000014', '5a5a5a5a-0000-4000-8000-000000000008', 'أربط العادة الجديدة بعادة قديمة: بعد قهوة الصباح مباشرة.', true, now() - interval '1380 minutes'),
  ('5a5a5a5a-0002-4000-8000-00000000002a', '5a5a5a5a-0001-4000-8000-000000000015', '5a5a5a5a-0000-4000-8000-000000000008', 'أقول بصراحة: ما زلت أتعلّم، وسأخبرك حين أعرف.', true, now() - interval '660 minutes')
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

select (select count(*) from public.community_posts where is_sample) as sample_posts,
       (select count(*) from public.community_replies where is_sample) as sample_replies;
