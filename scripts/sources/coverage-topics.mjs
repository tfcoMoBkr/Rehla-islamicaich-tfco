// For docs/COVERAGE.md: for each lesson, the phrases that mark a book section or a hadith category
// as covering its topic. A phrase matches a heading or a category title (ar or en) when it
// appears in it; "=phrase" only when it is the whole title. Matching ignores case, diacritics,
// tatweel and alef forms (scripts/sources/text-match.mjs). These are search phrases written for
// the report, not lesson content; the report lists every match so a reviewer can check each one.

export const COVERAGE_TOPICS = {
  "1.1": {
    en: ["my happiness lies", "excellence and merits of islam"],
    ar: ["سعادتي في ديني", "فضل الاسلام ومحاسنه"],
  },
  "1.2": {
    en: ["my lord is allah", "belief in allah", "categories of tawhid", "oneness of allah", "excellence of monotheism"],
    ar: ["ربي ا", "الايمان بالله", "اقسام التوحيد", "توحيد الربوبية", "توحيد الالوهية", "توحيد الاسماء والصفات", "فضائل التوحيد"],
  },
  "1.3": {
    en: ["my prophet is muhammad", "belief in the messengers", "our prophet muhammad"],
    ar: ["نبي محمد", "الايمان بالرسل", "نبينا محمد"],
  },
  "1.4": {
    en: ["pillars of islam", "establishing prayer", "almsgiving", "fasting the month", "pilgrimage to the sacred", "=islam"],
    ar: ["اركان الاسلام", "=الاسلام"],
  },
  "1.5": {
    en: ["pillars of faith", "pillars of iman", "belief in"],
    ar: ["اركان الايمان", "الايمان بالملائكة", "الايمان بالكتب", "الايمان بالرسل", "الايمان باليوم الاخر", "الايمان بالقضاء"],
  },
  "1.6": {
    en: ["=repentance", "branches of faith", "increase and decrease of faith", "adorning oneself", "islamic manners"],
    ar: ["=التوبة", "شعب الايمان", "زيادة الايمان", "من صفات المؤمن", "التحلي بالاخلاق", "التادب بالاداب"],
  },
  "2.1": {
    en: ["=purification", "rulings of water", "=utensils", "natural cleanliness"],
    ar: ["=الطهارة", "احكام المياه", "=الانية", "سنن الفطرة"],
  },
  "2.2": {
    en: ["removing impurities", "toilet manners"],
    ar: ["ازالة النجاسات", "اداب قضاء الحاجة"],
  },
  "2.3": {
    en: ["invalidators of ablution", "nullifiers of ablution", "menses"],
    ar: ["نواقض الوضوء", "الحيض والنفاس"],
  },
  "2.4": {
    en: ["learn wudu", "face boundaries", "wiping over", "conditions of ablution", "obligatory acts of ablution", "=ablution", "method of ablution", "pillars of ablution", "manners of ablution", "excellence of ablution"],
    ar: ["اتعلم الوضوء", "المسح على الخفين", "شروط الوضوء", "فروض الوضوء", "=الوضوء", "صفة الوضوء", "اركان الوضوء", "سنن واداب الوضوء", "فضل الوضوء", "اسباغ الوضوء"],
  },
  "2.5": {
    en: ["ghusl", "tayammum", "ritual bath", "dry ablution"],
    ar: ["الغسل", "التيمم"],
  },
  "3.1": {
    en: ["virtue of prayer", "obligation of prayer", "establishing prayer"],
    ar: ["فضل الصلاة", "وجوب الصلاة"],
  },
  "3.2": {
    en: ["conditions of prayer"],
    ar: ["شروط الصلاة", "التوجه الى القبلة"],
  },
  "3.3": {
    en: ["times of the prayer", "prayer times"],
    ar: ["مواقيت الصلاة", "اوقات الصلاة"],
  },
  "3.4": {
    en: ["learn how to pray", "method of prayer", "during prayer", "explanation of tashahhud"],
    ar: ["اتعلم الصلاة", "صفة الصلاة", "كيفية صلاة النبي", "دعاء الاستفتاح", "الركوع", "السجود", "الجلوس", "بيان التشهد", "اذكار الصلاة", "اخطاء المصلين"],
  },
  "3.5": {
    en: ["fatihah"],
    ar: ["الفاتحة"],
  },
  "3.6": {
    en: ["pillars of the prayer", "pillars of prayer", "obligatory acts of prayer", "acts of prayer", "invalidators of prayer", "nullifiers of prayer"],
    ar: ["اركان الصلاة", "واجبات الصلاة", "سنن الصلاة", "مبطلات الصلاة"],
  },
  "3.7": {
    en: ["congregational prayer", "imam and followers"],
    ar: ["صلاة الجماعة", "الامام والماموم"],
  },
  "3.8": {
    en: ["friday", "jumu"],
    ar: ["الجمعة"],
  },
};
