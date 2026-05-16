import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import {
  Flame,
  BookOpen,
  Sparkles,
  Settings as SettingsIcon,
  BarChart3,
  Award,
  Zap,
} from "lucide-react";
import { StatPill } from "@/components/chrome/StatPill";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let xpTotal = 0;
  let currentLevel = 1;
  let streakDays = 0;
  let fontScale = 1.0;
  let displayName: string | null = null;

  if (user) {
    const [profileRows, streakRows] = await Promise.all([
      db
        .select({
          xpTotal: schema.profiles.xpTotal,
          currentLevel: schema.profiles.currentLevel,
          fontScale: schema.profiles.fontScale,
          displayName: schema.profiles.displayName,
        })
        .from(schema.profiles)
        .where(eq(schema.profiles.id, user.id))
        .limit(1),
      db
        .select({ currentDays: schema.streaks.currentDays })
        .from(schema.streaks)
        .where(eq(schema.streaks.userId, user.id))
        .limit(1),
    ]);
    if (profileRows[0]) {
      xpTotal = profileRows[0].xpTotal;
      currentLevel = profileRows[0].currentLevel;
      fontScale = Number(profileRows[0].fontScale);
      displayName = profileRows[0].displayName;
    }
    if (streakRows[0]) {
      streakDays = streakRows[0].currentDays;
    }
  }

  const avatarLetter =
    (displayName?.[0] ?? user?.email?.[0] ?? "?").toUpperCase();

  return (
    <div
      className="min-h-screen"
      style={{ fontSize: `${fontScale}rem` }}
    >
      <header className="sticky top-0 z-30 border-b border-border bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link
            href="/path"
            className="flex shrink-0 items-center gap-2 font-bold"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-brand-fg shadow-glow-brand">
              <BookOpen className="h-5 w-5" strokeWidth={2.5} />
            </span>
            <span className="hidden sm:inline text-base">arabic-xp</span>
          </Link>

          <div className="hidden flex-1 items-center justify-center gap-1.5 md:flex">
            {user && (
              <>
                <StatPill icon={<Sparkles className="h-3.5 w-3.5" />} tone="brand">
                  Lv {currentLevel}
                </StatPill>
                <StatPill icon={<Zap className="h-3.5 w-3.5" />} tone="amber">
                  {xpTotal.toLocaleString()} XP
                </StatPill>
                <StatPill
                  icon={<Flame className="h-3.5 w-3.5" />}
                  tone={streakDays > 0 ? "flame" : "neutral"}
                >
                  {streakDays}d
                </StatPill>
              </>
            )}
          </div>

          <nav className="ml-auto flex items-center gap-0.5 text-sm font-semibold">
            <NavLink href="/path" icon={<Sparkles className="h-4 w-4" />}>
              Path
            </NavLink>
            <NavLink href="/review" icon={<Flame className="h-4 w-4" />}>
              Review
            </NavLink>
            <NavLink href="/stats" icon={<BarChart3 className="h-4 w-4" />}>
              Stats
            </NavLink>
            <NavLink href="/achievements" icon={<Award className="h-4 w-4" />}>
              Awards
            </NavLink>
            <NavLink href="/settings" icon={<SettingsIcon className="h-4 w-4" />}>
              Settings
            </NavLink>
          </nav>

          {user && (
            <Link
              href="/settings"
              title={user.email ?? ""}
              className="ml-1 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand to-brand-dark text-sm font-bold text-brand-fg shadow-soft ring-2 ring-white transition hover:scale-105"
            >
              {avatarLetter}
            </Link>
          )}
        </div>

        {/* Mobile stat strip */}
        {user && (
          <div className="flex items-center justify-center gap-1.5 px-4 pb-2 md:hidden">
            <StatPill icon={<Sparkles className="h-3.5 w-3.5" />} tone="brand">
              Lv {currentLevel}
            </StatPill>
            <StatPill icon={<Zap className="h-3.5 w-3.5" />} tone="amber">
              {xpTotal.toLocaleString()}
            </StatPill>
            <StatPill
              icon={<Flame className="h-3.5 w-3.5" />}
              tone={streakDays > 0 ? "flame" : "neutral"}
            >
              {streakDays}d
            </StatPill>
          </div>
        )}
      </header>
      {children}
    </div>
  );
}

function NavLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-fg-muted transition hover:bg-bg-muted hover:text-fg"
    >
      {icon}
      <span className="hidden sm:inline">{children}</span>
    </Link>
  );
}
