"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BookOpen, Library, Brain, Repeat, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "./ThemeToggle";

type Item = { href: string; label: string; Icon: typeof BookOpen; reading?: boolean; badge?: number };

function isActive(pathname: string, item: Item) {
  if (item.reading) return pathname === "/path" || pathname.startsWith("/book");
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

export function Sidebar({
  name,
  email,
  avatarLetter,
  reviewDue,
  canUpload,
  isPro,
}: {
  name: string | null;
  email: string | null;
  avatarLetter: string;
  reviewDue: number;
  canUpload: boolean;
  isPro: boolean;
}) {
  const pathname = usePathname();
  const items: Item[] = [
    { href: "/path", label: "Read", Icon: BookOpen, reading: true },
    { href: "/words", label: "Words", Icon: Brain },
    { href: "/review", label: "Review", Icon: Repeat, badge: reviewDue },
    { href: "/stats", label: "Stats", Icon: BarChart3 },
    ...(canUpload ? [{ href: "/upload", label: "Library", Icon: Library } as Item] : []),
  ];

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-surface/60 px-3 py-5 backdrop-blur-md md:flex">
      <Link href="/path" className="px-2">
        <Logo />
      </Link>

      <nav className="mt-7 flex flex-1 flex-col gap-1">
        {items.map((it) => {
          const active = isActive(pathname, it);
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-semibold transition",
                active ? "bg-brand/10 text-brand" : "text-fg-muted hover:bg-bg-muted hover:text-fg",
              )}
            >
              <span
                className={cn(
                  "grid h-7 w-7 shrink-0 place-items-center rounded-lg transition",
                  active ? "bg-brand/15 text-brand" : "bg-bg-muted text-fg-muted",
                )}
              >
                <it.Icon className="h-[17px] w-[17px]" />
              </span>
              {it.label}
              {it.badge ? (
                <span className="ml-auto rounded-full bg-brand/15 px-1.5 py-0.5 text-[11px] font-bold text-brand">
                  {it.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-2 flex items-center gap-2 rounded-2xl border border-border bg-bg/40 p-2">
        <Link href="/settings" className="flex min-w-0 flex-1 items-center gap-2.5" title="Settings">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand to-brand-dark text-sm font-bold text-brand-fg shadow-soft">
            {avatarLetter}
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-sm font-semibold">{name ?? "Reader"}</span>
              {isPro && (
                <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-brand px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-brand-fg">
                  <Sparkles className="h-2.5 w-2.5" /> Pro
                </span>
              )}
            </span>
            {email && <span className="block truncate text-xs text-fg-muted">{email}</span>}
          </span>
        </Link>
        <ThemeToggle className="shrink-0" />
      </div>
    </aside>
  );
}
