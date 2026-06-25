import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/lib/db";
import { and, count, eq, lte } from "drizzle-orm";
import { Logo } from "@/components/brand/Logo";
import { Sidebar } from "@/components/chrome/Sidebar";
import { MobileNav } from "@/components/chrome/MobileNav";
import { ThemeToggle } from "@/components/chrome/ThemeToggle";
import { PageViewTracker } from "@/components/analytics/PageViewTracker";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let wordsCount = 0;
  let reviewDue = 0;
  let fontScale = 1.0;
  let displayName: string | null = null;

  if (user) {
    const [profileRows, wordRows, dueRows] = await Promise.all([
      db
        .select({ fontScale: schema.profiles.fontScale, displayName: schema.profiles.displayName })
        .from(schema.profiles)
        .where(eq(schema.profiles.id, user.id))
        .limit(1),
      db
        .select({ c: count() })
        .from(schema.vocabItems)
        .where(eq(schema.vocabItems.userId, user.id)),
      db
        .select({ c: count() })
        .from(schema.vocabItems)
        .where(and(eq(schema.vocabItems.userId, user.id), lte(schema.vocabItems.dueAt, new Date()))),
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
    wordsCount = Number(wordRows[0]?.c ?? 0);
    reviewDue = Number(dueRows[0]?.c ?? 0);
  }

  const avatarLetter = (displayName?.[0] ?? user?.email?.[0] ?? "?").toUpperCase();
  const name = displayName?.split("@")[0] ?? null;

  return (
    <div className="min-h-screen md:pl-64" style={{ fontSize: `${fontScale}rem` }}>
      <Sidebar
        name={name}
        email={user?.email ?? null}
        avatarLetter={avatarLetter}
        wordsCount={wordsCount}
        reviewDue={reviewDue}
      />

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-bg/80 px-4 py-2.5 backdrop-blur-md md:hidden">
        <Link href="/path" className="shrink-0">
          <Logo />
        </Link>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          {user && (
            <Link
              href="/settings"
              title={user.email ?? ""}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand to-brand-dark text-sm font-bold text-brand-fg shadow-soft"
            >
              {avatarLetter}
            </Link>
          )}
        </div>
      </header>

      <PageViewTracker />
      <main className="pb-24 md:pb-12">{children}</main>
      <MobileNav />
    </div>
  );
}
