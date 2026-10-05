-- Seeds Rehla Community with the team's own posts: a welcome, the full rules, and one discussion
-- prompt per category, in Arabic and in English. Nothing else: no members, no other posts.
--
-- 1. Create the team account in the site (sign up), with the display name you want shown.
-- 2. Replace TEAM_EMAIL below with that account's email, then run this whole file in the SQL editor.
-- It makes that account a member named «فريق رحلة» with the moderator role ("Rehla team" badge),
-- and is safe to run again: posts are keyed by seed_key and never duplicated.

do $$
declare
  team uuid := (select id from auth.users where email = 'TEAM_EMAIL');
begin
  if team is null then
    raise exception 'No account with that email: sign up first, then set TEAM_EMAIL.';
  end if;

  insert into public.community_members (user_id, name, role)
  values (team, 'فريق رحلة', 'moderator')
  on conflict (user_id) do update set role = 'moderator';

  insert into public.community_posts (author, category, title, body, language, pinned, seed_key) values
  (team, 'firstSteps', 'أهلًا بك في مجتمع رحلة',
   'هذا مكان يتعاون فيه المسلمون الجدد ومن يحب أن يساندهم: نتبادل التجارب، ونشجّع بعضنا، ونتعلم معًا.' || chr(10) || chr(10) ||
   'ما يُكتب هنا تجارب أعضاء، لا فتاوى. إن كان سؤالك عن حكم يخصك، فاسأل «رفيق» على انفراد أو تحدّث مع مختص.' || chr(10) || chr(10) ||
   'عرّفنا بنفسك إن أحببت، باسم مستعار إن شئت، ولا تذكر ما لا تريد أن يعرفه غيرك.',
   'ar', true, 'welcome-ar'),
  (team, 'firstSteps', 'Welcome to Rehla Community',
   'This is a place where new Muslims, and people who want to support them, share experience, encourage each other and learn together.' || chr(10) || chr(10) ||
   'What is written here is members'' experience, not rulings. If your question is about a ruling for your own situation, ask Rafiq privately or talk to a specialist.' || chr(10) || chr(10) ||
   'Introduce yourself if you like, under a nickname if you prefer, and share nothing you would not want others to know.',
   'en', true, 'welcome-en'),
  (team, 'firstSteps', 'قواعد المجتمع',
   '١. كن لطيفًا: لا سخرية ولا تجريح، ولا جدال يؤذي.' || chr(10) ||
   '٢. هذا مكان للتجربة والتشجيع، لا للفتوى. لا تُصدر حكمًا على حال أحد، ومن أراد حكمًا فليسأل مختصًا.' || chr(10) ||
   '٣. إن نقلت معلومة دينية فاذكر مصدرها.' || chr(10) ||
   '٤. احفظ خصوصيتك وخصوصية غيرك: لا أرقام هواتف، ولا عناوين، ولا ما يدل على هوية أحد.' || chr(10) ||
   '٥. لا إعلانات ولا روابط تجارية.' || chr(10) ||
   '٦. إن رأيت ما يخالف هذه القواعد فأبلغ عنه، وسيراجعه فريق رحلة. ما يبلّغ عنه ثلاثة أعضاء يُخفى حتى يراجَع.' || chr(10) ||
   '٧. إن كنت تمر بضيق أو خطر، فلا تنتظر الردود: تواصل مع مختص أو مع خدمات الطوارئ.',
   'ar', true, 'rules-ar'),
  (team, 'firstSteps', 'Community rules',
   '1. Be kind: no mockery, no hurtful words, no arguments that wound.' || chr(10) ||
   '2. This is a place for experience and encouragement, not rulings. Do not rule on anyone''s situation; whoever needs a ruling should ask a specialist.' || chr(10) ||
   '3. If you pass on religious information, name its source.' || chr(10) ||
   '4. Keep your privacy and others'': no phone numbers, no addresses, nothing that identifies anyone.' || chr(10) ||
   '5. No advertising and no commercial links.' || chr(10) ||
   '6. If you see something against these rules, report it and the Rehla team will review it. Anything reported by three members is hidden until it is reviewed.' || chr(10) ||
   '7. If you are going through something hard or are in danger, do not wait for replies: contact a specialist or emergency services.',
   'en', true, 'rules-en'),
  (team, 'firstSteps', 'كيف كانت أيامك الأولى؟', 'شاركنا ما الذي فاجأك في أيامك الأولى، وما الذي سهّل عليك الطريق. قد تكون تجربتك عونًا لمن بدأ للتو.', 'ar', false, 'prompt-firstSteps-ar'),
  (team, 'firstSteps', 'What were your first days like?', 'Tell us what surprised you in your first days, and what made the way easier. Your experience may help someone who has just begun.', 'en', false, 'prompt-firstSteps-en'),
  (team, 'everydayLife', 'نصيحة عملية من يومك', 'ما الذي ساعدك على ترتيب يومك بين العمل والأسرة وما تتعلمه؟ نصيحة صغيرة قد تنفع غيرك.', 'ar', false, 'prompt-everydayLife-ar'),
  (team, 'everydayLife', 'A practical tip from your day', 'What has helped you fit your day together, between work, family and what you are learning? A small tip may help someone else.', 'en', false, 'prompt-everydayLife-en'),
  (team, 'encouragement', 'كلمة لمن بدأ اليوم', 'لو التقيت شخصًا بدأ رحلته اليوم، ماذا تحب أن تقول له؟ اكتب كلمة طيبة.', 'ar', false, 'prompt-encouragement-ar'),
  (team, 'encouragement', 'A word for someone starting today', 'If you met someone who began their journey today, what would you like to tell them? Write a kind word.', 'en', false, 'prompt-encouragement-en'),
  (team, 'learningTogether', 'ما الذي ساعدك على فهم درس؟', 'أي درس من «خطوات» فهمته أخيرًا، وما الذي ساعدك على ذلك؟ ومن يبحث عن رفيق دراسة فليذكر هنا.', 'ar', false, 'prompt-learningTogether-ar'),
  (team, 'learningTogether', 'What helped you understand a lesson?', 'Which lesson in Khutuwat finally made sense to you, and what helped? If you are looking for a study partner, say so here.', 'en', false, 'prompt-learningTogether-en'),
  (team, 'askCommunity', 'اسأل المجتمع', 'اسأل عن تجارب الأعضاء في الأمور العملية: كيف تعاملوا مع موقف، أو ما الذي جربوه. أما الأحكام فاسأل عنها «رفيق» أو مختصًا.', 'ar', false, 'prompt-askCommunity-ar'),
  (team, 'askCommunity', 'Ask the community', 'Ask about members'' experience of practical things: how they handled a moment, or what they tried. For rulings, ask Rafiq or a specialist.', 'en', false, 'prompt-askCommunity-en')
  on conflict (seed_key) do nothing;
end;
$$;
