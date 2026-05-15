import { createClient } from "@/lib/supabase/server";
import { getPathForUser } from "@/lib/db/queries/path";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { PathSection } from "@/components/path/PathSection";

export const dynamic = "force-dynamic";

export default async function PathPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userLevel = 1;
  if (user) {
    const rows = await db
      .select({ currentLevel: schema.profiles.currentLevel })
      .from(schema.profiles)
      .where(eq(schema.profiles.id, user.id))
      .limit(1);
    userLevel = rows[0]?.currentLevel ?? 1;
  }

  const path = await getPathForUser(user?.id ?? null, userLevel);

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-8">
      <div className="mb-4 text-center">
        <p className="font-arabic text-3xl text-brand" dir="rtl">
          اِقْرَأْ
        </p>
        <h1 className="mt-1 text-3xl font-extrabold">Your reading path</h1>
        <p className="mt-1 text-fg-muted">
          From children&apos;s stories to Ibn al-Qayyim. Pick a book and start.
        </p>
      </div>

      <div className="space-y-4">
        {path.map((level) => (
          <PathSection
            key={level.level}
            level={level}
            isLocked={level.level > userLevel}
          />
        ))}
      </div>
    </main>
  );
}
