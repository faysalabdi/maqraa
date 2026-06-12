import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/lib/db";
import { ImportTextForm } from "@/components/texts/ImportTextForm";
import { GenerateStoryCard } from "@/components/texts/GenerateStoryCard";
import { TextCard } from "@/components/texts/TextCard";

export const dynamic = "force-dynamic";

export default async function TextsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?redirect=/texts");

  const [profile] = await db
    .select({ currentLevel: schema.profiles.currentLevel })
    .from(schema.profiles)
    .where(eq(schema.profiles.id, user.id))
    .limit(1);

  const texts = await db
    .select()
    .from(schema.userTexts)
    .where(eq(schema.userTexts.userId, user.id))
    .orderBy(desc(schema.userTexts.lastReadAt), desc(schema.userTexts.createdAt));

  return (
    <main className="mx-auto max-w-2xl space-y-5 px-4 pb-24 pt-6">
      <header>
        <h1 className="text-3xl font-extrabold">My reading</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Generate stories at your level, import articles from a link, or bring the PDFs of
          books you own. Everything is readable with tap-to-translate, saved words become
          flashcards, your position is remembered, and every section has a comprehension check.
        </p>
      </header>

      <GenerateStoryCard level={profile?.currentLevel ?? 1} />

      <ImportTextForm />

      {texts.length === 0 ? (
        <p className="rounded-3xl bg-white p-8 text-center text-sm text-fg-muted shadow-soft ring-1 ring-border">
          Nothing here yet — generate a story above to see how it works.
        </p>
      ) : (
        <section>
          <h2 className="mb-3 text-lg font-bold">
            Continue reading{" "}
            <span className="text-sm font-normal text-fg-muted">({texts.length})</span>
          </h2>
          <div className="space-y-3">
            {texts.map((t) => (
              <TextCard
                key={t.id}
                text={{
                  id: t.id,
                  title: t.title,
                  kind: t.kind,
                  level: t.level,
                  sourceUrl: t.sourceUrl,
                  wordCount: t.wordCount,
                  currentSection: t.currentSection,
                  totalSections: t.totalSections,
                  completedCount: Array.isArray(t.completedSections)
                    ? (t.completedSections as number[]).length
                    : 0,
                  createdAt: t.createdAt.toISOString(),
                  lastReadAt: t.lastReadAt?.toISOString() ?? null,
                }}
              />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
