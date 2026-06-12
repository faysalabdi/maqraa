"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Eye, EyeOff, Loader2, Send, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SCENARIOS, type StoredMessage } from "@/lib/ai/conversation";
import {
  startConversation,
  sendConversationMessage,
  type ConversationState,
} from "@/server/actions/conversation";
import { useWordTap, TapWords, WordSheet } from "@/components/reader/word-tap";
import { speakArabic, ttsAvailable } from "@/lib/tts";

export function ConversationClient({ initialSavedKeys }: { initialSavedKeys: string[] }) {
  const wordTap = useWordTap(initialSavedKeys, { source: "conversation" });
  const [session, setSession] = useState<ConversationState | null>(null);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [showTranslations, setShowTranslations] = useState(false);
  const [canSpeak, setCanSpeak] = useState(false);
  const [xpTotal, setXpTotal] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => setCanSpeak(ttsAvailable()), []);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.messages.length]);

  async function pick(scenario: (typeof SCENARIOS)[number]["slug"]) {
    setBusy(true);
    try {
      setSession(await startConversation(scenario));
    } finally {
      setBusy(false);
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!session || !input.trim() || busy) return;
    const text = input.trim();
    setInput("");
    // optimistic
    setSession({
      ...session,
      messages: [...session.messages, { role: "user", content_ar: text }],
    });
    setBusy(true);
    try {
      const res = await sendConversationMessage(session.id, text);
      setSession({ ...session, messages: res.messages });
      setXpTotal((x) => x + res.xpEarned);
    } finally {
      setBusy(false);
    }
  }

  if (!session) {
    return (
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
        <Link
          href="/practice"
          className="mb-6 inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg"
        >
          <ArrowLeft className="h-4 w-4" /> Practice
        </Link>
        <h1 className="mb-1 text-2xl font-extrabold">Pick a scenario</h1>
        <p className="mb-6 text-sm text-fg-muted">
          Your partner replies at your level, always in Arabic, and gently corrects real
          mistakes. Tap any Arabic word in the chat to translate and save it.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {SCENARIOS.map((s) => (
            <button
              key={s.slug}
              onClick={() => pick(s.slug)}
              disabled={busy}
              className="rounded-3xl bg-white p-5 text-left shadow-soft ring-1 ring-border transition hover:ring-brand disabled:opacity-50"
            >
              <p className="font-arabic text-xl font-bold text-brand" dir="rtl">
                {s.nameAr}
              </p>
              <p className="font-bold">{s.nameEn}</p>
              <p className="mt-1 text-sm text-fg-muted">{s.description}</p>
            </button>
          ))}
        </div>
        {busy && (
          <p className="mt-6 flex items-center justify-center gap-2 text-sm text-fg-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Your partner is getting ready…
          </p>
        )}
      </main>
    );
  }

  const scenario = SCENARIOS.find((s) => s.slug === session.scenario);

  return (
    <main className="mx-auto flex h-[calc(100vh-3.5rem)] max-w-2xl flex-col px-4">
      <div className="flex items-center justify-between border-b border-border py-3">
        <button
          onClick={() => setSession(null)}
          className="inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg"
        >
          <ArrowLeft className="h-4 w-4" /> Scenarios
        </button>
        <p className="font-arabic text-lg font-bold" dir="rtl">
          {scenario?.nameAr}
        </p>
        <div className="flex items-center gap-2">
          {xpTotal > 0 && <span className="text-xs font-bold text-brand">+{xpTotal} XP</span>}
          <button
            onClick={() => setShowTranslations((v) => !v)}
            className="rounded-full bg-bg-muted p-2 text-fg-muted transition hover:text-fg"
            title={showTranslations ? "Hide translations" : "Show translations"}
          >
            {showTranslations ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto py-4">
        <AnimatePresence initial={false}>
          {(session.messages as StoredMessage[]).map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-3xl px-4 py-3",
                  m.role === "user"
                    ? "rounded-br-md bg-brand text-brand-fg"
                    : "rounded-bl-md bg-white shadow-soft ring-1 ring-border",
                )}
              >
                {m.role === "partner" ? (
                  <TapWords text={m.content_ar} state={wordTap} className="text-xl" />
                ) : (
                  <p className="font-arabic text-xl" dir="rtl">
                    {m.content_ar}
                  </p>
                )}
                {m.role === "partner" && (
                  <div className="mt-1 flex items-center gap-2">
                    {canSpeak && (
                      <button
                        onClick={() => speakArabic(m.content_ar)}
                        className="rounded-full p-1 text-fg-muted hover:text-brand"
                        title="Listen"
                      >
                        <Volume2 className="h-4 w-4" />
                      </button>
                    )}
                    {showTranslations && m.translation_en && (
                      <p className="text-xs text-fg-muted">{m.translation_en}</p>
                    )}
                  </div>
                )}
                {m.role === "user" && m.correction && (
                  <div className="mt-2 rounded-xl bg-white/15 p-2 text-sm">
                    <p className="font-arabic" dir="rtl">
                      ✏️ {m.correction.corrected_ar}
                    </p>
                    <p className="mt-0.5 text-xs opacity-90">{m.correction.note_en}</p>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {busy && (
          <div className="flex justify-start">
            <div className="rounded-3xl rounded-bl-md bg-white px-4 py-3 shadow-soft ring-1 ring-border">
              <Loader2 className="h-4 w-4 animate-spin text-fg-muted" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="sticky bottom-0 flex gap-2 bg-bg pb-4 pt-2">
        <input
          dir="rtl"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="اكتب ردك بالعربية…"
          className="font-arabic min-w-0 flex-1 rounded-2xl border border-border bg-white px-4 py-3 text-lg outline-none focus:ring-2 focus:ring-brand"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand text-brand-fg transition hover:bg-brand-dark disabled:opacity-50"
        >
          <Send className="h-5 w-5" />
        </button>
      </form>

      <WordSheet state={wordTap} />
    </main>
  );
}
