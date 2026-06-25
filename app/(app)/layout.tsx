import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/lib/db";
import { and, count, eq } from "drizzle-orm";
import { uploadUnlocked } from "@/lib/admin";
import {
  Flame,
  BookOpen,
  Settings as SettingsIcon,
  Brain,
  Repeat,
  BookUp,
} from "lucide-react";
import { StatPill } from "@/components/chrome/StatPill";
import { Logo } from "@/components/brand/Logo";
import { PageViewTracker } from "@/components/analytics/PageViewTracker";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let streakDays = 0;
  let wordsSaved = 0;
  let booksDone = 0;
  let fontScale = 1.0;
  let displayName: string | null = null;

  if (user) {
    const [profileRows, streakRows, wordRows, bookRows] = await Promise.all([
      db
        .select({
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
      db
        .select({ c: count() })
        .from(schema.vocabItems)
        .where(eq(schema.vocabItems.userId, user.id)),
      db
        .select({ c: count() })
        .from(schema.userBooks)
        .where(and(eq(schema.userBooks.userId, user.id), eq(schema.userBooks.status, "completed"))),
    ]);
    if (profileRows[0]) {
      fontScale = Number(profileRows[0].fontScale);
      displayName = profileRows[0].displayName;
    } else {
      // First visit after password/OTP signup — provision the profile rows.
      await db
        .insert(schema.profiles)
        .values({ id: user.id, displayName: user.email ?? null })
        .onConflictDoNothing();
      await db.insert(schema.streaks).values({ userId: user.id }).onConflictDoNothing();
      displayName = user.email ?? null;
    }
    streakDays = streakRows[0]?.currentDays ?? 0;
    wordsSaved = Number(wordRows[0]?.c ?? 0);
    booksDone = Number(bookRows[0]?.c ?? 0);
  }

  const avatarLetter = (displayName?.[0] ?? user?.email?.[0] ?? "?").toUpperCase();
  const canUpload = !!user && uploadUnlocked(user.email, booksDone);

  return (
    <div className="min-h-screen" style={{ fontSize: `${fontScale}rem` }}>
      <header className="sticky top-0 z-30 border-b border-border/70 bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5">
          <Link href="/path" className="shrink-0">
            <Logo />
          </Link>

          {/* Quiet progress: streak + words saved only. */}
          <div className="hidden flex-1 items-center justify-center gap-1.5 md:flex">
            {user && (
              <>
                <StatPill
                  icon={<Flame className="h-3.5 w-3.5" />}
                  tone={streakDays > 0 ? "flame" : "neutral"}
                >
                  {streakDays}d streak
                </StatPill>
                <StatPill icon={<Brain className="h-3.5 w-3.5" />} tone="brand">
                  {wordsSaved.toLocaleString()} words
                </StatPill>
                <StatPill icon={<BookOpen className="h-3.5 w-3.5" />} tone="neutral">
                  {booksDone} {booksDone === 1 ? "book" : "books"}
                </StatPill>
              </>
            )}
          </div>

          <nav className="ml-auto flex items-center gap-0.5 text-sm font-semibold">
            <NavLink href="/path" icon={<BookOpen className="h-4 w-4" />}>
              Read
            </NavLink>
            <NavLink href="/words" icon={<Brain className="h-4 w-4" />}>
              Words
            </NavLink>
            <NavLink href="/review" icon={<Repeat className="h-4 w-4" />}>
              Review
            </NavLink>
            {canUpload && (
              <NavLink href="/upload" icon={<BookUp className="h-4 w-4" />}>
                Upload
              </NavLink>
            )}
            <NavLink href="/settings" icon={<SettingsIcon className="h-4 w-4" />}>
              Settings
            </NavLink>
          </nav>

          {user && (
            <Link
              href="/settings"
              title={user.email ?? ""}
              className="ml-1 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand to-brand-dark text-sm font-bold text-brand-fg shadow-soft ring-2 ring-surface transition hover:scale-105"
            >
              {avatarLetter}
            </Link>
          )}
        </div>

        {/* Mobile progress strip */}
        {user && (
          <div className="flex items-center justify-center gap-1.5 px-4 pb-2 md:hidden">
            <StatPill
              icon={<Flame className="h-3.5 w-3.5" />}
              tone={streakDays > 0 ? "flame" : "neutral"}
            >
              {streakDays}d
            </StatPill>
            <StatPill icon={<Brain className="h-3.5 w-3.5" />} tone="brand">
              {wordsSaved.toLocaleString()} words
            </StatPill>
          </div>
        )}
      </header>
      <PageViewTracker />
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
      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-fg-muted transition hover:bg-bg-muted hover:text-fg"
    >
      {icon}
      <span className="hidden sm:inline">{children}</span>
    </Link>
  );
}
