"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { BookmarkPlus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { cleanWord, isArabicWord, tokenizeParagraph } from "@/lib/arabic";

const PARAS = [
  "سَامِرٌ وَلَدٌ صَغِيرٌ عُمْرُهُ اثْنَا عَشَرَ عَامًا. يَسْكُنُ سَامِرٌ مَعَ أُسْرَتِهِ فِي مَدِينَةٍ كَبِيرَةٍ بِجَانِبِ الْبَحْرِ.",
  "فِي يَوْمٍ مِنَ الْأَيَّامِ، قَالَ الْأَبُ: «يَا سَامِرُ، سَنُسَافِرُ غَدًا إِلَى مَدِينَةٍ جَدِيدَةٍ، وَجَدْتُ عَمَلًا هُنَاكَ».",
];

// A small canned dictionary so the demo works offline with no account.
const GLOSS: Record<string, { en: string; lemma: string; pos: string }> = {
  سامر: { en: "Samir (a name)", lemma: "سَامِر", pos: "proper noun" },
  ولد: { en: "boy, child", lemma: "وَلَد", pos: "noun" },
  صغير: { en: "small, young", lemma: "صَغِير", pos: "adjective" },
  عمره: { en: "his age", lemma: "عُمْر", pos: "noun" },
  اثنا: { en: "two", lemma: "اِثْنَان", pos: "number" },
  عشر: { en: "ten", lemma: "عَشَرَة", pos: "number" },
  عاما: { en: "year(s) old", lemma: "عَام", pos: "noun" },
  يسكن: { en: "lives, resides", lemma: "سَكَنَ", pos: "verb" },
  مع: { en: "with", lemma: "مَعَ", pos: "preposition" },
  أسرته: { en: "his family", lemma: "أُسْرَة", pos: "noun" },
  في: { en: "in", lemma: "فِي", pos: "preposition" },
  مدينة: { en: "city", lemma: "مَدِينَة", pos: "noun" },
  كبيرة: { en: "big, large", lemma: "كَبِير", pos: "adjective" },
  بجانب: { en: "beside, next to", lemma: "جَانِب", pos: "preposition" },
  البحر: { en: "the sea", lemma: "بَحْر", pos: "noun" },
  يوم: { en: "day", lemma: "يَوْم", pos: "noun" },
  من: { en: "from, of", lemma: "مِنْ", pos: "preposition" },
  الأيام: { en: "the days", lemma: "يَوْم", pos: "noun" },
  قال: { en: "said", lemma: "قَالَ", pos: "verb" },
  الأب: { en: "the father", lemma: "أَب", pos: "noun" },
  يا: { en: "O (calling)", lemma: "يَا", pos: "particle" },
  سنسافر: { en: "we will travel", lemma: "سَافَرَ", pos: "verb" },
  غدا: { en: "tomorrow", lemma: "غَدًا", pos: "adverb" },
  إلى: { en: "to, towards", lemma: "إِلَى", pos: "preposition" },
  جديدة: { en: "new", lemma: "جَدِيد", pos: "adjective" },
  وجدت: { en: "I found", lemma: "وَجَدَ", pos: "verb" },
  عملا: { en: "work, a job", lemma: "عَمَل", pos: "noun" },
  هناك: { en: "there", lemma: "هُنَاك", pos: "adverb" },
};

export function PreviewDemo() {
  const [selected, setSelected] = useState<string | null>(null);
  const key = selected ? cleanWord(selected) : "";
  const entry = key ? GLOSS[key] : undefined;

  return (
    <div className="relative">
      <article className="rounded-[1.75rem] bg-surface px-6 py-10 shadow-card ring-1 ring-border sm:px-10">
        <header className="mb-8 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-fg-muted">Chapter 1</p>
          <h2 className="font-arabic mt-3 text-3xl font-bold" dir="rtl">
            الفصل الأول: مدينة جديدة
          </h2>
          <div className="mt-5 flex items-center justify-center gap-3 text-fg-muted opacity-50">
            <span className="h-px w-12 bg-current" />
            <span className="leading-none">۞</span>
            <span className="h-px w-12 bg-current" />
          </div>
        </header>

        <div className="space-y-6">
          {PARAS.map((p, pi) => (
            <p key={pi} dir="rtl" className="font-arabic text-2xl" style={{ lineHeight: 2.1 }}>
              {tokenizeParagraph(p).map((w, wi) => {
                const isSel = selected === w;
                const tappable = isArabicWord(w);
                return (
                  <span key={wi}>
                    <span
                      onClick={() => tappable && setSelected(w)}
                      className={cn(
                        tappable &&
                          "cursor-pointer rounded px-0.5 underline decoration-dotted decoration-accent/45 underline-offset-[6px] transition hover:bg-accent-soft hover:decoration-accent",
                        isSel && "bg-accent-soft ring-1 ring-accent/40 decoration-transparent",
                      )}
                    >
                      {w}
                    </span>{" "}
                  </span>
                );
              })}
            </p>
          ))}
        </div>
      </article>

      <p className="mt-4 text-center text-sm text-fg-muted">Tap any underlined word ↑</p>

      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ y: 140, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 140, opacity: 0 }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
            className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-2xl px-4 pb-4"
          >
            <div className="rounded-[1.5rem] border border-border bg-surface p-5 shadow-lift">
              <div className="flex items-start justify-between">
                <p className="font-arabic text-3xl font-bold" dir="rtl">
                  {selected}
                </p>
                <button
                  onClick={() => setSelected(null)}
                  className="rounded-full p-1.5 text-fg-muted transition hover:bg-bg-muted"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {entry ? (
                <div className="mt-1">
                  <p className="text-lg font-semibold">{entry.en}</p>
                  <p className="text-sm text-fg-muted">
                    <span className="font-arabic text-base" dir="rtl">
                      {entry.lemma}
                    </span>{" "}
                    · {entry.pos}
                  </p>
                </div>
              ) : (
                <p className="mt-1 text-sm text-fg-muted">
                  In the app, every word is looked up instantly with full context.
                </p>
              )}

              <Link
                href="/sign-in"
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 font-semibold text-brand-fg transition hover:bg-brand-dark"
              >
                <BookmarkPlus className="h-4 w-4" /> Sign in to save · +2 XP
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
