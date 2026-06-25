"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const OPTS = [
  { v: "light", label: "Light", Icon: Sun },
  { v: "system", label: "System", Icon: Monitor },
  { v: "dark", label: "Dark", Icon: Moon },
] as const;

export function ThemeSetting() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const active = mounted ? (theme ?? "system") : "system";

  return (
    <div className="rounded-3xl bg-surface p-6 shadow-card ring-1 ring-border">
      <h2 className="text-lg font-bold">Appearance</h2>
      <p className="mt-1 text-sm text-fg-muted">Light, dark, or follow your system.</p>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {OPTS.map(({ v, label, Icon }) => (
          <button
            key={v}
            type="button"
            onClick={() => setTheme(v)}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-2xl border-2 px-3 py-3 text-sm font-semibold transition",
              active === v
                ? "border-brand bg-brand/5 text-fg"
                : "border-border text-fg-muted hover:border-fg-muted",
            )}
          >
            <Icon className="h-5 w-5" /> {label}
          </button>
        ))}
      </div>
    </div>
  );
}
