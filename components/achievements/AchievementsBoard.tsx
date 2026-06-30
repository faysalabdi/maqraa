"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { BadgeIcon } from "./icons";
import type { AchievementView } from "@/lib/achievements/server";

type Filter = "all" | "earned" | "locked";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function AchievementsBoard({
  items,
  earnedCount,
  total,
  xpEarned,
  xpRemaining,
}: {
  items: AchievementView[];
  earnedCount: number;
  total: number;
  xpEarned: number;
  xpRemaining: number;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const lockedCount = total - earnedCount;
  const closest = items
    .filter((i) => !i.earned)
    .sort((a, b) => b.current / b.target - a.current / a.target)[0];

  const shown = items.filter((i) =>
    filter === "all" ? true : filter === "earned" ? i.earned : !i.earned,
  );

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-3xl bg-surface p-5 shadow-card ring-1 ring-border">
          <p className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">Earned</p>
          <p className="mt-2 text-3xl font-extrabold text-brand">
            {earnedCount} <span className="text-fg-muted">/ {total}</span>
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-bg-muted">
            <div
              className="h-full rounded-full bg-brand transition-all"
              style={{ width: `${total ? (earnedCount / total) * 100 : 0}%` }}
            />
          </div>
        </div>
        <div className="rounded-3xl bg-surface p-5 shadow-card ring-1 ring-border">
          <p className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">
            XP from badges
          </p>
          <p className="mt-2 text-3xl font-extrabold text-accent-fg">{xpEarned.toLocaleString()}</p>
          <p className="mt-1 text-xs text-fg-muted">
            {xpRemaining.toLocaleString()} XP still on the table
          </p>
        </div>
        <div className="rounded-3xl bg-surface p-5 shadow-card ring-1 ring-border">
          <p className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">Closest</p>
          {closest ? (
            <>
              <p className="mt-2 text-lg font-bold leading-tight">{closest.nameEn}</p>
              <p className="mt-1 text-xs text-fg-muted">
                {closest.current} / {closest.target} {closest.unit}
              </p>
            </>
          ) : (
            <p className="mt-2 text-lg font-bold text-brand">All earned</p>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {(
          [
            ["all", `All · ${total}`],
            ["earned", `Earned · ${earnedCount}`],
            ["locked", `Locked · ${lockedCount}`],
          ] as [Filter, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-bold ring-1 transition",
              filter === key
                ? "bg-brand text-brand-fg ring-brand"
                : "bg-surface text-fg-muted ring-border hover:text-fg",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {shown.map((a) => (
          <Card key={a.slug} a={a} />
        ))}
      </div>
      {shown.length === 0 && (
        <p className="mt-8 text-center text-sm text-fg-muted">Nothing here yet.</p>
      )}
    </>
  );
}

function Card({ a }: { a: AchievementView }) {
  const pct = Math.min(100, Math.round((a.current / a.target) * 100));
  return (
    <div
      className={cn(
        "rounded-3xl bg-surface p-5 shadow-card ring-1 transition",
        a.earned ? "ring-2 ring-brand/50" : "ring-border",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "grid h-12 w-12 shrink-0 place-items-center rounded-2xl",
            a.earned ? "bg-brand/15 text-brand" : "bg-bg-muted text-fg-muted",
          )}
        >
          <BadgeIcon name={a.icon} className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate font-bold leading-tight">{a.nameEn}</p>
            <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-bold text-accent-fg ring-1 ring-accent/30">
              +{a.xpReward}
            </span>
          </div>
          <p className="font-arabic truncate text-sm text-fg-muted" dir="rtl">
            {a.nameAr}
          </p>
        </div>
      </div>
      <p className="mt-3 text-sm text-fg-muted">{a.description}</p>
      {a.earned ? (
        <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand">
          <Check className="h-4 w-4" /> Earned{a.earnedAt ? ` · ${formatDate(a.earnedAt)}` : ""}
        </p>
      ) : (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs font-semibold text-fg-muted">
            <span>
              {a.current} / {a.target} {a.unit}
            </span>
            <span>{pct}%</span>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-bg-muted">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
