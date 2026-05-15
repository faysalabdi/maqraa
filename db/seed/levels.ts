export const LEVELS = [
  {
    level: 1,
    slug: "emerging-reader",
    nameEn: "Emerging Reader",
    nameAr: "القارئ الناشئ",
    description:
      "Fully diacritized, simple narrative. Children's stories, abridged classics, and graded readers. Just keep reading — understanding 30% is enough.",
    booksRequiredToClear: 4,
  },
  {
    level: 2,
    slug: "apprentice",
    nameEn: "Apprentice",
    nameAr: "المُتَدَرِّب",
    description:
      "Mostly diacritized, fuller sentences. Famous matns, short novels in translation, and inspirational biographies.",
    booksRequiredToClear: 5,
  },
  {
    level: 3,
    slug: "seeker",
    nameEn: "Seeker",
    nameAr: "طالب العلم",
    description:
      "Minimal diacritics. Modern Arabic prose, popular fiction, foundational Islamic texts with commentary.",
    booksRequiredToClear: 6,
  },
  {
    level: 4,
    slug: "scholar",
    nameEn: "Scholar",
    nameAr: "العالِم",
    description:
      "Unvocalized classical prose. Short works by Ibn al-Qayyim, Mahfouz novels, Orwell, intermediate tafsir.",
    booksRequiredToClear: 6,
  },
  {
    level: 5,
    slug: "advanced-seeker",
    nameEn: "Advanced Seeker",
    nameAr: "المتقدم",
    description:
      "Classical fluency. The Cairo Trilogy, Madarij al-Salikin, dense Russian classics in translation.",
    booksRequiredToClear: 5,
  },
  {
    level: 6,
    slug: "master",
    nameEn: "Master",
    nameAr: "المتمكِّن",
    description:
      "Dense classical and literary Arabic. Selections from Majmu' al-Fatawa, al-Jahiz, Mahmoud Darwish complete.",
    booksRequiredToClear: 5,
  },
  {
    level: 7,
    slug: "mujtahid",
    nameEn: "Mujtahid",
    nameAr: "المجتهد",
    description:
      "Technical classical, multivolume works. Complete tafsirs, al-Mutanabbi, Maqamat al-Hariri, full Majmu' al-Fatawa.",
    booksRequiredToClear: 4,
  },
  {
    level: 8,
    slug: "imam",
    nameEn: "Imam",
    nameAr: "الإمام",
    description:
      "Mastery and synthesis. Parallel tafsir study, complete classical works, advanced Arabic linguistics. A destination, not a stage to clear.",
    booksRequiredToClear: 99,
  },
] as const;
