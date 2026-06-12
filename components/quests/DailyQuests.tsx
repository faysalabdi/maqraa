"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Check,
  Gift,
  Headphones,
  Loader2,
  MessagesSquare,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { claimQuest } from "@/server/actions/quests";
import type { DailyQuestState } from "@/lib/quests/progress";
import type { Skill } from "@/lib/xp/skills";

const SKILL_ICON: Record<Skill, React.ComponentType<{ className?: string }>> = {
  reading: BookOpen,
  listening: Headphones,
  speaking: MessagesSquare,
};

const SKILL_BAR: Record<Skill, string> = {
  reading: "bg-emerald-500",
  listening: "bg-sky-500",
  speaking: "bg-violet-500",
};

export function DailyQuests({ initial }: { initial: DailyQuestState }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [claiming, setClaiming] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function claim(questId: string) {
    setClaiming(questId);
    startTransition(async () => {
      const res = await claimQuest(questId);
      setClaiming(null);
      if ("error" in res) return;
      if (res.xpEarned > 0) {
        setToast(
          res.allBonus
            ? `+${res.xpEarned} XP — all quests done, bonus included!`
            : `+${res.xpEarned} XP`,
        );
        setTimeout(() => setToast(null), 3000);
      }
      router.refresh();
    });
  }

  return (
    <section className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-border">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-fg-muted">
          <Gift className="h-4 w-4 text-brand" />
          Daily quests
        </h2>
        <span className="text-xs font-semibold text-fg-muted">
          +{initial.questXp} XP each · +{initial.allBonusXp} for all three
        </span>
      </div>

      <ul className="space-y-2.5">
        {initial.quests.map((q) => {
          const Icon = SKILL_ICON[q.skill];
          const pct = Math.round((q.progress / q.target) * 100);
          return (
            <li
              key={q.id}
              className={cn(
                "flex items-center gap-3 rounded-2xl border p-3 transition",
                q.claimed
                  ? "border-emerald-200 bg-emerald-50"
                  : q.claimable
                    ? "border-amber-300 bg-amber-50"
                    : "border-border",
              )}
            >
              <span
                className={cn(
                  "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                  q.claimed ? "bg-emerald-500 text-white" : "bg-bg-muted text-fg-muted",
                )}
              >
                {q.claimed ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
              </span>

              <div className="min-w-0 flex-1">
                <p className={cn("text-sm font-bold", q.claimed && "text-emerald-900")}>
                  {q.title}
                </p>
                {!q.claimed && (
                  <>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-bg-muted">
                      <div
                        className={cn("h-full rounded-full transition-all", SKILL_BAR[q.skill])}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="mt-0.5 text-[11px] font-semibold text-fg-muted">
                      {q.progress} / {q.target}
                    </p>
                  </>
                )}
              </div>

              {q.claimable && (
                <button
                  onClick={() => claim(q.id)}
                  disabled={isPending}
                  className="shrink-0 rounded-xl bg-amber-400 px-3.5 py-2 text-xs font-black text-amber-950 shadow-soft transition hover:bg-amber-300 disabled:opacity-60"
                >
                  {claiming === q.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    `Claim +${initial.questXp}`
                  )}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            className="mt-3 flex items-center justify-center gap-2 rounded-2xl bg-brand py-2.5 text-sm font-bold text-brand-fg shadow-glow-brand"
          >
            <Sparkles className="h-4 w-4" />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
