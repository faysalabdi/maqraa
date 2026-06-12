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
 * worker is actually making progress, re-kick the background job. Atomic chunk
 * claims make duplicate kicks no-ops, so firing this from page views is safe.
 */
async function reviveStalledExtraction(textId: string): Promise<void> {
  const { STALE_WORKING_MS, triggerExtraction } = await import("@/lib/texts/extract-job");
  const staleBefore = new Date(Date.now() - STALE_WORKING_MS).toISOString();
  // The reader polls every 4s; a fresh kick that just claimed chunks needs
  // breathing room before another page view re-kicks.
  const KICK_QUIET_MS = 60_000;
  const recentKickBefore = new Date(Date.now() - KICK_QUIET_MS).toISOString();

  const [counts] = await db
    .select({
      pending: count(sql`case when ${schema.textChunks.status} = 'pending' then 1 end`),
      // Anything claimed in the last KICK_QUIET_MS — a healthy worker may still
      // be starting up, no need for another kick yet.
      recentlyClaimed: count(
        sql`case when ${schema.textChunks.claimedAt} > ${recentKickBefore}::timestamptz then 1 end`,
      ),
      staleWorking: count(
        sql`case when ${schema.textChunks.status} = 'working' and (${schema.textChunks.claimedAt} is null or ${schema.textChunks.claimedAt} <= ${staleBefore}::timestamptz) then 1 end`,
      ),
    })
    .from(schema.textChunks)
    .where(eq(schema.textChunks.textId, textId));

  if (!counts) return;
  if (Number(counts.recentlyClaimed) > 0) return;
  const hasRecoverableWork =
    Number(counts.pending) > 0 || Number(counts.staleWorking) > 0;
  if (!hasRecoverableWork) return;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${proto}://${host}` : undefined;

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
