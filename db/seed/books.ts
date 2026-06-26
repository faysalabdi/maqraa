export type SeedBook = {
  slug: string;
  level: number;
  orderInLevel: number;
  titleAr: string;
  titleEn: string;
  authorAr?: string;
  authorEn?: string;
  blurb: string;
  difficulty: number; // 1..5 within level
  genre: "islamic" | "arabic_literature" | "translated" | "graded_reader" | "classical";
  isSelection?: boolean;
  recommendedPages?: number;
  hasFullText?: boolean;
};

// The curated on-ramp: a small set of genuinely readable graded books. `level`
// is an advisory difficulty band for sorting only — it no longer gates anything.
// Readers progress by finishing books, not by clearing stages. Everything else
// is reader-supplied (uploads).
export const BOOKS: SeedBook[] = [
  {
    slug: "rihlat-samir",
    level: 1,
    orderInLevel: 0,
    titleAr: "رحلة سامر",
    titleEn: "Samir's Journey (Arabic XP Original)",
    authorEn: "Arabic XP Originals",
    blurb:
      "An original fully-diacritized beginner story written for this app. Read it right here — tap any word to translate and save it. Four short chapters about a boy who discovers that every book is a voyage.",
    difficulty: 1,
    genre: "graded_reader",
    recommendedPages: 12,
    hasFullText: true,
  },
  {
    slug: "fi-as-sabah",
    level: 1,
    orderInLevel: 1,
    titleAr: "في الصباح",
    titleEn: "In the Morning",
    authorEn: "Maqraa Originals",
    blurb:
      "An absolute-beginner original: a child's morning routine in short, fully-diacritized, present-tense sentences. Your very first Arabic reading — tap any word to translate and save it.",
    difficulty: 1,
    genre: "graded_reader",
    recommendedPages: 8,
    hasFullText: true,
  },
  {
    slug: "as-sadiq-al-jadid",
    level: 2,
    orderInLevel: 1,
    titleAr: "الصديق الجديد",
    titleEn: "The New Friend",
    authorEn: "Maqraa Originals",
    blurb:
      "A simple original story in the past tense: a new student, a first friendship, and a small act of kindness. Fully diacritized, four short chapters — a gentle step up from your first reader.",
    difficulty: 2,
    genre: "graded_reader",
    recommendedPages: 14,
    hasFullText: true,
  },
  {
    slug: "nawadir-juha",
    level: 2,
    orderInLevel: 0,
    titleAr: "نوادر جحا",
    titleEn: "Tales of Juha",
    authorEn: "Arab folk tradition",
    blurb:
      "The funniest character in Arabic folklore. Short, simple, fully-diacritized anecdotes about Juha and his donkey — public-domain folk tales retold for new readers. Each story is a chapter; tap any word to translate and save it.",
    difficulty: 2,
    genre: "arabic_literature",
    recommendedPages: 20,
    hasFullText: true,
  },
  {
    slug: "arba'in-nawawi",
    level: 3,
    orderInLevel: 0,
    titleAr: "الأربعون النووية",
    titleEn: "The 40 Hadith of al-Nawawi",
    authorAr: "الإمام النووي",
    authorEn: "al-Nawawi",
    blurb:
      "Forty famous hadith. Short, memorizable, and your vocabulary for the rest of your Arabic life. Each hadith is a chapter with tap-to-translate.",
    difficulty: 2,
    genre: "islamic",
    recommendedPages: 80,
    hasFullText: true,
  },
  {
    slug: "arba'in-qudsiyya",
    level: 3,
    orderInLevel: 1,
    titleAr: "الأربعون القدسية",
    titleEn: "Forty Hadith Qudsi",
    authorAr: "الإمام النووي",
    authorEn: "al-Nawawi",
    blurb:
      "Forty hadith qudsi — the words of Allah related by the Prophet. Short, profound, and fully readable in-app: each is a chapter with tap-to-translate and save-to-flashcards.",
    difficulty: 2,
    genre: "islamic",
    recommendedPages: 70,
    hasFullText: true,
  },
  {
    slug: "alf-layla",
    level: 4,
    orderInLevel: 0,
    titleAr: "ألف ليلة وليلة",
    titleEn: "One Thousand and One Nights",
    authorEn: "Arabic folk tradition",
    blurb:
      "The most famous story-frame in the world: King Shahrayar, the clever Shahrazad, and a thousand nights of tales to stay alive. Public-domain classical Arabic. The opening nights are readable here, with tap-to-translate throughout.",
    difficulty: 3,
    genre: "classical",
    recommendedPages: 200,
    hasFullText: true,
  },
  {
    slug: "matn-al-ajurrumiyya",
    level: 4,
    orderInLevel: 1,
    titleAr: "متن الآجرّومية",
    titleEn: "Al-Ajurrumiyya (Grammar Primer)",
    authorAr: "ابن آجُرُّوم",
    authorEn: "Ibn Ajurrum",
    blurb:
      "The most famous beginner's primer of Arabic grammar — memorized by students for seven centuries. Short, precise, public-domain. Read the foundational definitions of speech and case-inflection, tapping any term to translate it.",
    difficulty: 4,
    genre: "classical",
    recommendedPages: 40,
    hasFullText: true,
  },
  {
    slug: "kalila-wa-dimna",
    level: 5,
    orderInLevel: 0,
    titleAr: "كليلة ودمنة",
    titleEn: "Kalila wa Dimna",
    authorAr: "ابن المقفع",
    authorEn: "Abdullah ibn al-Muqaffa'",
    blurb:
      "The 8th-century Arabic classic — Indian fables of clever jackals and noble lions, rendered in Ibn al-Muqaffa's famously elegant prose. Public domain. The first chapters are readable here.",
    difficulty: 3,
    genre: "classical",
    recommendedPages: 320,
    hasFullText: true,
  },
];
