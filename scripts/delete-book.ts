/**
 * One-off: delete a book and everything that references it.
 *
 *   pnpm tsx scripts/delete-book.ts            # list all books (slug + title)
 *   pnpm tsx scripts/delete-book.ts <slug>     # delete that book, cascading
 *
 * Mirrors the cascade order in server/actions/admin.ts `deleteBook`. Connects
 * directly via DIRECT_URL/DATABASE_URL (no auth context), so it can remove a
 * private upload too. XP events keep a loose jsonb ref with no FK — left alone.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, inArray } from "drizzle-orm";
import * as schema from "@/lib/db/schema";

async function main() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL (or DIRECT_URL) not set");
    process.exit(1);
  }
  const client = postgres(url, { prepare: false, max: 1 });
  const db = drizzle(client, { schema });

  const slug = process.argv[2];

  if (!slug) {
    const rows = await db
      .select({
        slug: schema.books.slug,
        titleEn: schema.books.titleEn,
        titleAr: schema.books.titleAr,
        ownerId: schema.books.ownerId,
      })
      .from(schema.books);
    console.log(`${rows.length} books:`);
    for (const r of rows) {
      console.log(`  ${r.slug}\t${r.ownerId ? "[upload]" : "[curated]"}\t${r.titleEn} — ${r.titleAr}`);
    }
    console.log("\nRe-run with a slug to delete: pnpm tsx scripts/delete-book.ts <slug>");
    await client.end();
    return;
  }

  const [book] = await db
    .select({ id: schema.books.id, titleEn: schema.books.titleEn })
    .from(schema.books)
    .where(eq(schema.books.slug, slug))
    .limit(1);
  if (!book) {
    console.error(`No book with slug "${slug}".`);
    await client.end();
    process.exit(1);
  }

  const chapterRows = await db
    .select({ id: schema.bookChapters.id })
    .from(schema.bookChapters)
    .where(eq(schema.bookChapters.bookId, book.id));
  const chapterIds = chapterRows.map((c) => c.id);

  await db.delete(schema.comprehensionAttempts).where(eq(schema.comprehensionAttempts.bookId, book.id));
  await db.delete(schema.comprehensionTests).where(eq(schema.comprehensionTests.bookId, book.id));
  await db.delete(schema.readingSessions).where(eq(schema.readingSessions.bookId, book.id));
  await db.delete(schema.userBooks).where(eq(schema.userBooks.bookId, book.id));
  if (chapterIds.length > 0) {
    await db.delete(schema.userChapterProgress).where(inArray(schema.userChapterProgress.chapterId, chapterIds));
    await db.delete(schema.chapterQuizzes).where(inArray(schema.chapterQuizzes.chapterId, chapterIds));
  }
  await db.delete(schema.bookChapters).where(eq(schema.bookChapters.bookId, book.id));
  await db.delete(schema.books).where(eq(schema.books.id, book.id));

  console.log(`Deleted "${book.titleEn}" (${slug}) and ${chapterIds.length} chapters + dependents.`);
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
