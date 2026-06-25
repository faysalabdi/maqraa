"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      aria-label="Toggle dark mode"
      title={dark ? "Light mode" : "Dark mode"}
      onClick={() => setTheme(dark ? "light" : "dark")}
      className={cn(
        "grid h-9 w-9 place-items-center rounded-full text-fg-muted transition hover:bg-bg-muted hover:text-fg",
        className,
      )}
    >
      {mounted && dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
