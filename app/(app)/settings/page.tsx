import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import SettingsForm from "@/components/settings/SettingsForm";
import { ThemeSetting } from "@/components/chrome/ThemeSetting";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?redirect=/settings");

  const [profileRows, streakRows] = await Promise.all([
    db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.id, user.id))
      .limit(1),
    db
      .select()
      .from(schema.streaks)
      .where(eq(schema.streaks.userId, user.id))
      .limit(1),
  ]);

  const profile = profileRows[0];
  const streak = streakRows[0];

  if (!profile) {
    return (
      <main className="mx-auto max-w-md px-4 pt-12 text-center">
        <p>Profile not found. Try signing out and back in.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      <header className="mb-6">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Signed in as <span className="font-semibold">{user.email}</span>
        </p>
      </header>

      <div className="mb-6">
        <ThemeSetting />
      </div>

      <SettingsForm
        initial={{
          displayName: profile.displayName,
          fontScale: Number(profile.fontScale),
          prefersRtl: profile.prefersRtl,
          dailyXpGoal: profile.dailyXpGoal,
        }}
        streak={
          streak
            ? {
                currentDays: streak.currentDays,
                longestDays: streak.longestDays,
                freezesRemaining: streak.freezesRemaining,
              }
            : null
        }
      />
    </main>
  );
}
