import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/lib/db";
import { and, count, eq, lte } from "drizzle-orm";
import { AppShell } from "@/components/chrome/AppShell";
import { PageViewTracker } from "@/components/analytics/PageViewTracker";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let reviewDue = 0;
  let fontScale = 1.0;
  let displayName: string | null = null;

  if (user) {
    const [profileRows, dueRows] = await Promise.all([
      db
        .select({ fontScale: schema.profiles.fontScale, displayName: schema.profiles.displayName })
        .from(schema.profiles)
        .where(eq(schema.profiles.id, user.id))
        .limit(1),
      db
        .select({ c: count() })
        .from(schema.vocabItems)
        .where(and(eq(schema.vocabItems.userId, user.id), lte(schema.vocabItems.dueAt, new Date()))),
    ]);
    if (profileRows[0]) {
      fontScale = Number(profileRows[0].fontScale);
      displayName = profileRows[0].displayName;
    } else {
      await db
        .insert(schema.profiles)
        .values({ id: user.id, displayName: user.email ?? null })
        .onConflictDoNothing();
      await db.insert(schema.streaks).values({ userId: user.id }).onConflictDoNothing();
      displayName = user.email ?? null;
    }
    reviewDue = Number(dueRows[0]?.c ?? 0);
  }

  const avatarLetter = (displayName?.[0] ?? user?.email?.[0] ?? "?").toUpperCase();

  return (
    <div className="min-h-screen" style={{ fontSize: `${fontScale}rem` }}>
      <PageViewTracker />
      <AppShell
        data={{
          signedIn: !!user,
          name: displayName?.split("@")[0] ?? null,
          email: user?.email ?? null,
          avatarLetter,
          reviewDue,
          canUpload: !!user,
        }}
      >
        {children}
      </AppShell>
    </div>
  );
}
