import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { after } from "next/server";
import { and, count, eq, sql } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/lib/db";
import { lookupKey } from "@/lib/arabic";
import { TextReader } from "@/components/texts/TextReader";

export const dynamic = "force-dynamic";

/**
 * Self-heal a dead extraction chain: if a text is still "processing" but no
 * worker owns any chunk (e.g. a previous invocation was killed mid-handoff),
 * re-kick the background job. Atomic chunk claims make duplicate kicks no-ops,
 * so firing this from page views is safe.
 */
async function reviveStalledExtraction(textId: string): Promise<void> {
  const [counts] = await db
    .select({
      pending: count(sql`case when ${schema.textChunks.status} = 'pending' then 1 end`),
      working: count(sql`case when ${schema.textChunks.status} = 'working' then 1 end`),
    })
    .from(schema.textChunks)
    .where(eq(schema.textChunks.textId, textId));

  if (!counts || Number(counts.working) > 0 || Number(counts.pending) === 0) return;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${proto}://${host}` : undefined;

  const { triggerExtraction } = await import("@/lib/texts/extract-job");
  after(() => triggerExtraction(textId, origin));
}

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

  if (text.extractionStatus === "processing") {
    await reviveStalledExtraction(text.id);
  }

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
