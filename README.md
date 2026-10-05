<div align="center">

# رحلة · Rehla

**رفيقك في الطريق إلى النور**
*Your companion on the road to the light*

[العربية](#العربية) · [English](#english)

</div>

---

<div dir="rtl">

## العربية

### نبذة

«رحلة» منصة ذكية ترافق المسلم الجديد من لحظة نطق الشهادة إلى الممارسة الواثقة والانتماء، بلغته ومن مصادر معتمدة.

يقدّمها فريق **ذكاء فلو** ضمن **تحدي الذكاء الاصطناعي في خدمة المحتوى الإسلامي**، في **المسار الثالث: التجارب التفاعلية والرحلة المعرفية للتعريف بالإسلام وتعلمه**.

### المشكلة

بلغ عدد الداخلين في الإسلام في المملكة العربية السعودية 163,319 شخصًا في عام 2023 وحده، و347,646 شخصًا خلال خمس سنوات، وفق بيان وزارة الشؤون الإسلامية والدعوة والإرشاد ([وكالة الأنباء السعودية، يناير 2024](https://www.spa.gov.sa/N2031934)). وكثير منهم وافدون لا يتحدثون العربية.

بعد الشهادة مباشرة يواجه المسلم الجديد أسئلة عملية لا تحتمل التأجيل: كيف يتطهر ويصلي، وكيف يتصرف في المسجد لأول مرة، وماذا تعني النصوص العربية من حوله، ولمن يلجأ إذا تعثر. والمتابعة البشرية وحدها لا تستطيع مرافقته في يومه.

### الحل

منصة ويب بالعربية والإنجليزية، يقودها مساعد ذكي اسمه **«رفيق»**، حاضر في جميع أقسامها:

| القسم | الوصف | الحالة |
|---|---|---|
| **خطوات** | مسار تعلّم متدرج: دروس، واختبارات قصيرة، وشرح لكل خطأ | متاح |
| **تدرَّب** | أنشطة الدروس كلها في مكان واحد، يجرّبها المتعلم متى شاء ويجمع بها زادًا لطريقه | متاح |
| **اسأل «رفيق»** | إجابات مسندة إلى مصادرها، مع الامتناع والإحالة عند الحاجة | متاح |
| **عدسة** | صوّر شيئًا مما حولك (لافتة في مسجد، سجادة صلاة، كتابة عربية) لتعرف ما هو وما معناه من المصادر المعتمدة، مع امتناع واضح عند الحاجة | متاح |
| **موقف** | تدريب تفاعلي على مواقف الحياة اليومية للمسلم، مع تقييم وتصحيح | قريبًا |
| **مجتمع رحلة** | منتدى اختياري يشارك فيه دعاة موثّقون، ودليل للمساجد والمراكز القريبة | قريبًا |
| **أقم** | صلاة تدريبية بالكاميرا تنتهي بتقرير عن الأداء | قريبًا |

### المبادئ

- **الإسناد:** كل معلومة شرعية تُعرض مع مصدرها، ولا يُنسب قول إلى مرجع لا يوجد فيه.
- **الامتناع والإحالة:** عند غياب المرجع، أو في المسائل الشخصية والخلافية، يمتنع «رفيق» ويحيل إلى مختص. لا يُصدر النظام فتوى.
- **النص الشرعي لا يُولَّد:** الآيات والأحاديث تُعرض حرفيًا من مصادرها المعتمدة.
- **الشفافية:** يُفصح «رفيق» عن كونه أداة ذكاء اصطناعي، لا مختصًا بشريًا.
- **الخصوصية:** يحدد المستخدم مرحلته بنفسه، ولا يستنتج النظام أي سمة دينية أو حساسة عنه.

### المرجعية العلمية

يعتمد المحتوى على المصادر الواردة في «المرجعية والحزمة العلمية والبيانات» الصادرة عن التحدي، وسيُوثَّق سجل المصادر والتراخيص كاملًا في هذا المستودع.

### التشغيل محليًا

المتطلبات: Node.js 20.9 أو أحدث، وPython 3.12 أو أحدث، و[uv](https://docs.astral.sh/uv/).

**1. خدمة الذكاء الاصطناعي** (FastAPI على المنفذ 8000). تعمل الخدمة دون مفاتيح، ويمكن إضافتها لاحقًا في الملف `ai/.env`:

<div dir="ltr">

```bash
cd ai
cp .env.example .env
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

</div>

**2. تطبيق الويب** (Next.js على المنفذ 3000). يتصل بالخدمة عبر `AI_SERVICE_URL`، وقيمته الافتراضية `http://localhost:8000`:

<div dir="ltr">

```bash
cd web
cp .env.example .env.local
npm install
npm run dev
```

</div>

ثم افتح `http://localhost:3000/ar` للعربية أو `http://localhost:3000/en` للإنجليزية.

**الفحوص:**

<div dir="ltr">

```bash
cd web && npm run lint && npm run typecheck && npm run build
cd ai && uv run ruff check && uv run mypy app tests && uv run pytest
```

</div>

### الفريق

**ذكاء فلو (Thakaa Flow)**

- محمد بابكر: مهندس ذكاء اصطناعي
- فيصل الحارثي: المدير التنفيذي لذكاء فلو، مهندس برمجيات

### حالة المشروع

> **التطوير جارٍ.** بدأ البناء مع انطلاق أيام التحدي في **4 أكتوبر 2026**، ويوضح الملف [docs/START_STATE.md](docs/START_STATE.md) حالة المستودع قبل ذلك.
> يُضاف رابط التجربة والتوثيق التقني تباعًا.

</div>

---

## English

### Overview

**Rehla** ("journey" in Arabic) is an AI-powered platform that accompanies new Muslims from the moment they declare the Shahada to confident practice and belonging, in their own language and grounded in approved sources.

It is built by **Thakaa Flow** for the **AI Challenge Serving Islamic Content**, in **Track 3: Interactive experiences and the learning journey for introducing and teaching Islam**.

### The problem

163,319 people embraced Islam in Saudi Arabia in 2023 alone, and 347,646 over five years, according to the Ministry of Islamic Affairs, Dawah and Guidance ([Saudi Press Agency, January 2024](https://www.spa.gov.sa/N2031934)). Many of them are expatriates who do not speak Arabic.

Right after the Shahada, a new Muslim faces practical questions that cannot wait: how to purify and pray, how to behave in a mosque for the first time, what the Arabic texts around them mean, and who to turn to when stuck. Human follow-up alone cannot be present in their every day.

### The solution

A bilingual web platform (Arabic and English) led by one AI companion, **Rafiq**, present in every section:

| Section | Description | Status |
|---|---|---|
| **Khutuwat** (Steps) | A graded learning path: lessons, short quizzes, and an explanation for every mistake | Available |
| **Practice** | Every lesson activity in one place, to try at any time and gather provisions for the road | Available |
| **Ask Rafiq** | Answers cited to their sources, with abstention and referral when needed | Available |
| **Adasa** (Lens) | Photograph something around you (a sign in a mosque, a prayer mat, Arabic writing) and see what it is and what it means from the approved sources, with a clear decline when it should not answer | Available |
| **Mawqif** (Situation) | Interactive practice of everyday situations, with evaluation and correction | Coming soon |
| **Rehla Community** | An opt-in forum with verified da'wah guides, and a directory of nearby mosques and centers | Coming soon |
| **Aqim** | A camera-based practice prayer that ends with a performance report | Coming soon |

### Principles

- **Attribution:** every religious statement is shown with its source; nothing is attributed to a reference that does not contain it.
- **Abstention and referral:** when no reference is found, or for personal and disputed matters, Rafiq abstains and refers to a qualified person. The system does not issue fatwas.
- **Sacred text is never generated:** Quran verses and hadiths are displayed verbatim from their approved sources.
- **Transparency:** Rafiq discloses that it is an AI tool, not a human specialist.
- **Privacy:** users state their own stage; the system does not infer any religious or sensitive attribute about them.

### Scholarly reference

Content relies on the sources listed in the challenge's official scholarly reference package. A full log of sources and licenses will be documented in this repository.

### Run locally

Requirements: Node.js 20.9+, Python 3.12+ and [uv](https://docs.astral.sh/uv/).

**1. AI service** (FastAPI on port 8000). It starts without any keys; add them to `ai/.env` when needed:

```bash
cd ai
cp .env.example .env
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

**2. Web app** (Next.js on port 3000). It reaches the AI service through `AI_SERVICE_URL`, which defaults to `http://localhost:8000`:

```bash
cd web
cp .env.example .env.local
npm install
npm run dev
```

Then open `http://localhost:3000/ar` (Arabic) or `http://localhost:3000/en` (English).

**Checks:**

```bash
cd web && npm run lint && npm run typecheck && npm run build
cd ai && uv run ruff check && uv run mypy app tests && uv run pytest
```

### Team

**Thakaa Flow**

- Mohamed Babikir: AI Engineer
- Faisal Al-Harthi: CEO of Thakaa Flow, Software Engineer

### Project status

> **Development is in progress.** The build started with the challenge build days on **October 4, 2026**; [docs/START_STATE.md](docs/START_STATE.md) records the repository's state before then.
> The live demo link and technical documentation will be added as the work progresses.
