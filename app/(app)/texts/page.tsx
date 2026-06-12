import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/lib/db";
import { ImportTextForm } from "@/components/texts/ImportTextForm";
import { GenerateStoryCard } from "@/components/texts/GenerateStoryCard";
import { TextCard } from "@/components/texts/TextCard";

export const dynamic = "force-dynamic";
// Big-book PDF imports run multiple Claude vision calls; allow up to 5 minutes.
export const maxDuration = 300;

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
          Generate stories at your level or bring the PDFs of books you own. Everything is
          readable with tap-to-translate, saved words become flashcards, your position is
          remembered, and every section has a comprehension check.
        </p>
      </header>

      <GenerateStoryCard level={profile?.currentLevel ?? 1} />

      <ImportTextForm />

      {texts.length === 0 ? (
        <p className="rounded-3xl bg-white p-8 text-center text-sm text-fg-muted shadow-soft ring-1 ring-border">
          Nothing here yet — generate a story above to see how it works.
        </p>
      ) : (() => {
        const mapped = texts.map((t) => {
          const completedCount = Array.isArray(t.completedSections)
            ? (t.completedSections as number[]).length
            : 0;
          const isFinished =
            t.extractionStatus === "ready" &&
            t.totalSections > 0 &&
            completedCount >= t.totalSections;
          return { t, completedCount, isFinished };
        });
        const active = mapped.filter((x) => !x.isFinished);
        const finished = mapped.filter((x) => x.isFinished);

        const makeCard = ({ t, completedCount }: { t: (typeof texts)[number]; completedCount: number }) => (
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
              completedCount,
              extractionStatus: t.extractionStatus,
              pagesTotal: t.pagesTotal,
              pagesDone: t.pagesDone,
              createdAt: t.createdAt.toISOString(),
              lastReadAt: t.lastReadAt?.toISOString() ?? null,
            }}
          />
        );

        return (
          <>
            {active.length > 0 && (
              <section>
                <h2 className="mb-3 text-lg font-bold">
                  Continue reading{" "}
                  <span className="text-sm font-normal text-fg-muted">({active.length})</span>
                </h2>
                <div className="space-y-3">{active.map(makeCard)}</div>
              </section>
            )}
            {finished.length > 0 && (
              <section>
                <h2 className="mb-3 text-lg font-bold">
                  Completed{" "}
                  <span className="text-sm font-normal text-fg-muted">({finished.length})</span>
                </h2>
                <div className="space-y-3">{finished.map(makeCard)}</div>
              </section>
            )}
          </>
        );
      })()}
    </main>
  );
}
