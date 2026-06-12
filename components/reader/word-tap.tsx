"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookmarkPlus, Check, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { cleanWord, isArabicWord, lookupKey, tokenizeParagraph } from "@/lib/arabic";
import { lookupWord, saveWord } from "@/server/actions/vocab";
import type { WordLookup } from "@/lib/ai/word-lookup";

export type WordTapState = ReturnType<typeof useWordTap>;

/**
 * Shared tap-to-translate state. One instance per page; pass it to any number
 * of <TapWords> blocks and render one <WordSheet> at the page root.
 */
export function useWordTap(initialSavedKeys: string[], sourceRef?: { source: string }) {
  const [selected, setSelected] = useState<{ surface: string; context: string } | null>(null);
  const [lookup, setLookup] = useState<WordLookup | null>(null);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set(initialSavedKeys));
  const [sessionSaved, setSessionSaved] = useState(0);
  const [lookupError, setLookupError] = useState(false);
  const [isPending, startTransition] = useTransition();

  function tap(surface: string, context: string) {
    if (!isArabicWord(surface)) return;
    setSelected({ surface, context });
    setLookup(null);
    setLookupError(false);
    startTransition(async () => {
      try {
        setLookup(await lookupWord(surface, context));
      } catch {
        setLookupError(true);
      }
    });
  }

  function save() {
    if (!lookup) return;
    const key = lookupKey(lookup.lemma_ar);
    setSavedKeys((prev) => new Set(prev).add(key).add(lookupKey(lookup.surface)));
    setSessionSaved((n) => n + 1);
    startTransition(async () => {
      await saveWord({
        lemmaAr: lookup.lemma_ar,
        glossEn: lookup.gloss_en,
        exampleAr: lookup.example_ar,
        bookSlug: sourceRef?.source,
      }).catch(() => {});
    });
  }

  return {
    selected,
    lookup,
    savedKeys,
    sessionSaved,
    lookupError,
    isPending,
    tap,
    save,
    close: () => setSelected(null),
    isLookupSaved: lookup ? savedKeys.has(lookupKey(lookup.lemma_ar)) : false,
  };
}

/** One paragraph of tappable Arabic. */
export function TapWords({
  text,
  state,
  className,
}: {
  text: string;
  state: WordTapState;
  className?: string;
}) {
  return (
    <p dir="rtl" className={cn("font-arabic text-2xl leading-loose text-fg", className)}>
      {tokenizeParagraph(text).map((w, wi) => {
        const known = state.savedKeys.has(cleanWord(w));
        const isSelected = state.selected?.surface === w;
        return (
          <span key={wi}>
            <span
              onClick={() => state.tap(w, text)}
              className={cn(
                "cursor-pointer rounded-md px-0.5 transition hover:bg-amber-100",
                known && "underline decoration-emerald-400 decoration-2 underline-offset-4",
                isSelected && "bg-amber-200",
              )}
            >
              {w}
            </span>{" "}
          </span>
        );
      })}
    </p>
  );
}

/** The bottom sheet showing the current lookup. Render once per page. */
export function WordSheet({ state }: { state: WordTapState }) {
  const { selected, lookup, lookupError, isPending, isLookupSaved } = state;
  return (
    <AnimatePresence>
      {selected && (
        <motion.div
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-2xl px-4 pb-4"
        >
          <div className="rounded-3xl border border-border bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between">
              <p className="font-arabic text-2xl font-bold" dir="rtl">
                {selected.surface}
              </p>
              <button
                onClick={state.close}
                className="rounded-full p-1 text-fg-muted hover:bg-bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {isPending && !lookup ? (
              <div className="flex items-center gap-2 py-3 text-sm text-fg-muted">
                <Loader2 className="h-4 w-4 animate-spin" /> Looking up…
              </div>
            ) : lookupError ? (
              <p className="py-3 text-sm text-danger">Lookup failed — tap the word again.</p>
            ) : lookup ? (
              <div className="mt-1">
                <p className="text-lg font-semibold">{lookup.gloss_en}</p>
                <p className="text-sm text-fg-muted">
                  <span className="font-arabic text-base" dir="rtl">
                    {lookup.lemma_ar}
                  </span>
                  {lookup.pos ? ` · ${lookup.pos}` : ""}
                </p>
                {lookup.example_ar && (
                  <p className="font-arabic mt-2 rounded-xl bg-bg-muted p-3 text-base" dir="rtl">
                    {lookup.example_ar}
                  </p>
                )}
                <button
                  onClick={state.save}
                  disabled={isLookupSaved}
                  className={cn(
                    "mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 font-semibold transition",
                    isLookupSaved
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-brand text-brand-fg hover:bg-brand-dark",
                  )}
                >
                  {isLookupSaved ? (
                    <>
                      <Check className="h-4 w-4" /> Saved to your words
                    </>
                  ) : (
                    <>
                      <BookmarkPlus className="h-4 w-4" /> Save word (+2 XP)
                    </>
                  )}
                </button>
              </div>
            ) : null}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
