"use client";

import { useEffect, useState } from "react";
import { Target } from "lucide-react";

export function DailyGoalRing({ value, goal }: { value: number; goal: number }) {
  const pct = Math.min(1, value / Math.max(1, goal));
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);

  const r = 52;
  const c = 2 * Math.PI * r;
  const done = value >= goal;
  const remaining = Math.max(0, goal - value);

  return (
    <div className="flex items-center gap-5 rounded-3xl bg-surface p-6 shadow-card ring-1 ring-border">
      <div className="relative h-32 w-32 shrink-0">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle cx="60" cy="60" r={r} fill="none" stroke="var(--color-bg-muted)" strokeWidth="10" />
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - shown)}
            style={{
              transition: "stroke-dashoffset 900ms cubic-bezier(.22,1,.36,1)",
              filter: "drop-shadow(0 0 6px color-mix(in oklab, var(--color-accent) 50%, transparent))",
            }}
          />
        </svg>
        <div className="absolute inset-0 grid place-content-center text-center">
          <p className="text-3xl font-extrabold leading-none">{value}</p>
          <p className="mt-0.5 text-xs font-semibold text-fg-muted">/ {goal} XP</p>
        </div>
      </div>
      <div className="min-w-0">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-accent-fg ring-1 ring-accent/30">
          <Target className="h-3 w-3" /> Daily goal
        </span>
        <p className="mt-2 text-lg font-bold leading-snug">
          {done ? "Goal hit — nice work." : `${remaining} XP to go — one review session.`}
        </p>
        <p className="mt-1 text-sm text-fg-muted">
          {done
            ? "Come back tomorrow to keep the habit going."
            : "Hit it a few days running and the streak compounds."}
        </p>
      </div>
    </div>
  );
}
