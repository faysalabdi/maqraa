"use client";

import { useState } from "react";

export type XpDay = { date: string; total: number };

export function XpChart({ days }: { days: XpDay[] }) {
  const max = Math.max(1, ...days.map((d) => d.total));
  // Tapped bar (mobile has no hover) — tap toggles the value; desktop also gets
  // it on hover via group-hover.
  const [active, setActive] = useState<string | null>(null);

  return (
    <div className="rounded-3xl bg-surface p-6 shadow-soft ring-1 ring-border">
      <h2 className="text-base font-extrabold">XP earned · last 14 days</h2>
      <p className="mt-1 text-xs text-fg-muted">Each bar is one day. Tap a bar for the number.</p>
      <div className="mt-6 flex h-32 items-end gap-1.5">
        {days.map((d) => {
          const pct = (d.total / max) * 100;
          const shown = active === d.date;
          return (
            <button
              key={d.date}
              type="button"
              onClick={() => setActive((a) => (a === d.date ? null : d.date))}
              className="group relative flex flex-1 flex-col items-center gap-1"
            >
              <span
                className={`absolute -top-6 whitespace-nowrap rounded-md bg-fg px-1.5 py-0.5 text-[10px] font-bold text-bg group-hover:block ${
                  shown ? "block" : "hidden"
                }`}
              >
                {d.total} XP
              </span>
              <div
                className="w-full rounded-t-md bg-brand transition-all group-hover:shadow-glow-brand"
                style={{ height: `${Math.max(4, pct)}%` }}
              />
              <span className="text-[9px] font-bold uppercase tracking-widest text-fg-muted">
                {labelFor(d.date)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function labelFor(yyyyMmDd: string) {
  const d = new Date(yyyyMmDd);
  return d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2);
}
