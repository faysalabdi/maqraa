"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BookOpen, Brain, Mic, Repeat, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/path", label: "Read", Icon: BookOpen, reading: true },
  { href: "/talk", label: "Talk", Icon: Mic },
  { href: "/words", label: "Words", Icon: Brain },
  { href: "/review", label: "Review", Icon: Repeat },
  { href: "/stats", label: "Stats", Icon: BarChart3 },
  { href: "/achievements", label: "Awards", Icon: Trophy },
];

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
      {TABS.map((t) => {
        const active = t.reading
          ? pathname === "/path" || pathname.startsWith("/book")
          : pathname === t.href || pathname.startsWith(t.href + "/");
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold transition",
              active ? "text-brand" : "text-fg-muted",
            )}
          >
            <t.Icon className={cn("h-5 w-5", active && "drop-shadow-[0_0_8px_color-mix(in_oklab,var(--color-brand)_55%,transparent)]")} />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
