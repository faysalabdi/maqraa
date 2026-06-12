import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/lib/db";
import { lookupKey } from "@/lib/arabic";
import { TextReader } from "@/components/texts/TextReader";

export const dynamic = "force-dynamic";

export default async function TextReadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?redirect=/texts");

  const rows = await db
    .select()
    .from(schema.userTexts)
    .where(and(eq(schema.userTexts.id, id), eq(schema.userTexts.userId, user.id)))
    .limit(1);
  const text = rows[0];
  if (!text) notFound();

  const saved = await db
    .select({ lemmaAr: schema.vocabItems.lemmaAr })
    .from(schema.vocabItems)
    .where(eq(schema.vocabItems.userId, user.id));

  return (
    <TextReader
      text={{
        id: text.id,
        title: text.title,
        kind: text.kind,
        level: text.level,
        sourceUrl: text.sourceUrl,
        contentAr: text.contentAr,
        wordCount: text.wordCount,
        currentSection: text.currentSection,
        completedSections: Array.isArray(text.completedSections)
          ? (text.completedSections as number[])
          : [],
        extractionStatus: text.extractionStatus,
        extractionError: text.extractionError,
        pagesTotal: text.pagesTotal,
        pagesDone: text.pagesDone,
      }}
      initialSavedKeys={saved.map((s) => lookupKey(s.lemmaAr))}
    />
  );
}
