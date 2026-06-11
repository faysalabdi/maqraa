export const LEVELS = [
  {
    level: 1,
    slug: "beginner",
    nameEn: "Beginner",
    nameAr: "المبتدئ",
    description:
      "Children's stories and absolute-beginner graded readers. Fully diacritized. Just read. Decoding letters is the win.",
    booksRequiredToClear: 3,
  },
  {
    level: 2,
    slug: "starter",
    nameEn: "Starter",
    nameAr: "البادئ",
    description:
      "Fully diacritized, simple narrative. Children's classics, abridged translations, early graded readers. Understanding 30% is enough.",
    booksRequiredToClear: 3,
  },
  {
    level: 3,
    slug: "walker",
    nameEn: "Walker",
    nameAr: "السائر",
    description:
      "Mostly diacritized, fuller sentences. Famous matns, short novels in translation, and inspirational biographies.",
    booksRequiredToClear: 5,
  },
  {
    level: 4,
    slug: "crosser",
    nameEn: "Crosser",
    nameAr: "العابر",
    description:
      "Minimal diacritics. Modern Arabic prose, popular fiction, foundational Islamic texts with commentary.",
    booksRequiredToClear: 6,
  },
  {
    level: 5,
    slug: "patient",
    nameEn: "Patient",
    nameAr: "الصابر",
    description:
      "Unvocalized classical prose. Short works by Ibn al-Qayyim, Mahfouz novels, Orwell, intermediate tafsir.",
    booksRequiredToClear: 6,
  },
  {
    level: 6,
    slug: "steadfast",
    nameEn: "Steadfast",
    nameAr: "المداوم",
    description:
      "Classical fluency. The Cairo Trilogy, Madarij al-Salikin, dense Russian classics in translation.",
    booksRequiredToClear: 5,
  },
  {
    level: 7,
    slug: "rooted",
    nameEn: "Rooted",
    nameAr: "الراسخ",
    description:
      "Dense classical and literary Arabic. Selections from Majmu' al-Fatawa, al-Jahiz, Mahmoud Darwish complete.",
    booksRequiredToClear: 5,
  },
  {
    level: 8,
    slug: "established",
    nameEn: "Established",
    nameAr: "المتمكن",
    description:
      "Technical classical, multivolume works. Complete tafsirs, al-Mutanabbi, Maqamat al-Hariri, full Majmu' al-Fatawa.",
    booksRequiredToClear: 4,
  },
  {
    level: 9,
    slug: "seeker-of-knowledge",
    nameEn: "Seeker of Knowledge",
    nameAr: "طالب العلم",
    description:
      "A station you never leave. Parallel tafsir, foundational grammar, the mother-books. The path doesn't end — you keep seeking.",
    booksRequiredToClear: 99,
  },
] as const;
