"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Sparkles, X } from "lucide-react";
import { BadgeIcon } from "./icons";
import { syncAchievements, type EarnedBadge } from "@/server/actions/achievements";

const THROTTLE_MS = 60_000;

/**
 * Mounted in the app shell. At most once a minute (on navigation) it asks the
 * server to award anything newly met and returns only the badges it just
 * awarded, which we toast. Throttled so navigation never waits on it.
 */
export function AchievementWatcher() {
  const pathname = usePathname();
  const [toasts, setToasts] = useState<EarnedBadge[]>([]);
  const lastSync = useRef(0);

  const sync = useCallback(async () => {
    const now = Date.now();
    if (now - lastSync.current < THROTTLE_MS) return;
    lastSync.current = now;
    try {
      const { earned } = await syncAchievements();
      if (earned.length) setToasts((t) => [...t, ...earned]);
    } catch {
      // ignore — purely cosmetic
    }
  }, []);

  useEffect(() => {
    sync();
  }, [pathname, sync]);

  useEffect(() => {
    if (!toasts.length) return;
    const id = setTimeout(() => setToasts((t) => t.slice(1)), 5500);
    return () => clearTimeout(id);
  }, [toasts]);

  if (!toasts.length) return null;

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:bottom-6">
      {toasts.map((a) => (
        <div
          key={a.slug}
          className="flex w-full max-w-sm items-center gap-3 rounded-2xl border border-brand/30 bg-surface p-3 shadow-lift"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand text-brand-fg shadow-glow-brand">
            <BadgeIcon name={a.icon} className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-brand">
              <Sparkles className="h-3 w-3" /> Achievement unlocked
            </p>
            <p className="truncate font-bold leading-tight">{a.nameEn}</p>
          </div>
          <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-bold text-accent-fg ring-1 ring-accent/30">
            +{a.xpReward}
          </span>
          <button
            onClick={() => setToasts((t) => t.filter((x) => x.slug !== a.slug))}
            aria-label="Dismiss"
            className="shrink-0 rounded-full p-1 text-fg-muted transition hover:bg-bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
